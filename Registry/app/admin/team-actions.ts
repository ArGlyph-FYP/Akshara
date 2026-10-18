"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { col, db } from "@/lib/data";
import { adminAuth } from "@/lib/firebase/admin";
import type { UserDoc } from "@/lib/types";

/** Research-team logins (admins). Readers and raters never need accounts: they join through a study link. */

type Result<T = object> = ({ ok: true } & T) | { ok?: false; error: string };
const fail = (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) });

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generatePassword(len = 12) {
  return Array.from({ length: len }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

/** Creates (or re-enables) a team login with email + password. The password is returned once and never stored. */
export async function addTeamMember(input: { name: string; email: string }): Promise<Result<{ email: string; password: string }>> {
  try {
    await assertAdmin();
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email");
    const displayName = String(input.name ?? "").trim().slice(0, 80);
    if (!displayName) throw new Error("Enter their name");
    const password = generatePassword();

    const auth = adminAuth();
    const existing = await auth.getUserByEmail(email).catch(() => null);
    const user = existing
      ? await auth.updateUser(existing.uid, { password, displayName, disabled: false })
      : await auth.createUser({ email, password, displayName });

    const ref = col.users().doc(user.uid);
    const counter = col.counters().doc("raters");
    await db().runTransaction(async (tx) => {
      const prev = (await tx.get(ref)).data() as UserDoc | undefined;
      if (prev) {
        tx.update(ref, { role: "admin", active: true, displayName, email });
        return;
      }
      const n = ((await tx.get(counter)).data()?.nextNumber as number | undefined) ?? 1;
      const doc: UserDoc = { email, displayName, role: "admin", scripts: [], active: true, alias: `R${String(n).padStart(2, "0")}`, createdAt: Date.now() };
      tx.set(ref, doc);
      tx.set(counter, { nextNumber: n + 1 }, { merge: true });
    });
    revalidatePath("/admin", "layout");
    return { ok: true, email, password };
  } catch (e) {
    return fail(e);
  }
}

export async function resetTeamPassword(uid: string): Promise<Result<{ email: string; password: string }>> {
  try {
    const s = await assertAdmin();
    const doc = (await col.users().doc(uid).get()).data() as UserDoc | undefined;
    if (!doc || doc.role !== "admin") throw new Error("Team member not found");
    const password = generatePassword();
    await adminAuth().updateUser(uid, { password });
    // Sign them out everywhere (but don't sign out the admin resetting their own password).
    if (uid !== s.uid) await adminAuth().revokeRefreshTokens(uid);
    return { ok: true, email: doc.email, password };
  } catch (e) {
    return fail(e);
  }
}

export async function removeTeamMember(uid: string): Promise<Result> {
  try {
    const s = await assertAdmin();
    if (uid === s.uid) throw new Error("You can't remove your own access");
    await col.users().doc(uid).update({ active: false });
    await adminAuth().updateUser(uid, { disabled: true });
    await adminAuth().revokeRefreshTokens(uid);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
