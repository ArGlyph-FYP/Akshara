"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { col, db } from "@/lib/data";
import { adminAuth } from "@/lib/firebase/admin";
import { SCRIPTS, type Role, type Script, type UserDoc } from "@/lib/types";

type Result<T = object> = ({ ok: true } & T) | { ok?: false; error: string };
const fail = (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) });

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generatePassword(len = 12) {
  return Array.from({ length: len }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

function clean(input: { name?: string; role?: string; scripts?: string[] }) {
  const role = input.role === "admin" ? "admin" : ("rater" as Role);
  const scripts = (input.scripts ?? []).filter((s): s is Script => (SCRIPTS as readonly string[]).includes(s));
  if (role === "rater" && scripts.length === 0) throw new Error("Pick Sinhala, Tamil or both");
  return { role, scripts, displayName: String(input.name ?? "").trim().slice(0, 80) };
}

/** Creates (or re-enables) a login with email + password. The password is returned once and never stored. */
export async function createRater(input: {
  name: string;
  email: string;
  password?: string;
  role: string;
  scripts: string[];
}): Promise<Result<{ uid: string; email: string; password: string }>> {
  try {
    await assertAdmin();
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email");
    const { role, scripts, displayName } = clean(input);
    if (!displayName) throw new Error("Enter the rater's name");
    const password = (input.password ?? "").trim() || generatePassword();
    if (password.length < 8) throw new Error("Password must be at least 8 characters");

    const auth = adminAuth();
    const existing = await auth.getUserByEmail(email).catch(() => null);
    if (existing && (await col.users().doc(existing.uid).get()).exists) {
      throw new Error(`${email} already has an account. Use “Reset password” on their row.`);
    }
    const user = existing
      ? await auth.updateUser(existing.uid, { password, displayName, disabled: false })
      : await auth.createUser({ email, password, displayName });

    const ref = col.users().doc(user.uid);
    const counter = col.counters().doc("raters");
    await db().runTransaction(async (tx) => {
      const n = ((await tx.get(counter)).data()?.nextNumber as number | undefined) ?? 1;
      const doc: UserDoc = { email, displayName, role, scripts, active: true, alias: `R${String(n).padStart(2, "0")}`, createdAt: Date.now() };
      tx.set(ref, doc);
      tx.set(counter, { nextNumber: n + 1 }, { merge: true });
    });
    revalidatePath("/admin", "layout");
    return { ok: true, uid: user.uid, email, password };
  } catch (e) {
    return fail(e);
  }
}

export async function resetPassword(uid: string): Promise<Result<{ email: string; password: string }>> {
  try {
    const s = await assertAdmin();
    const doc = (await col.users().doc(uid).get()).data() as UserDoc | undefined;
    if (!doc) throw new Error("User not found");
    const password = generatePassword();
    await adminAuth().updateUser(uid, { password });
    // Sign them out everywhere (but don't sign out the admin doing a reset of their own account).
    if (uid !== s.uid) await adminAuth().revokeRefreshTokens(uid);
    return { ok: true, email: doc.email, password };
  } catch (e) {
    return fail(e);
  }
}

export async function updateRater(
  uid: string,
  input: { name: string; role: string; scripts: string[]; active: boolean },
): Promise<Result> {
  try {
    const s = await assertAdmin();
    const { role, scripts, displayName } = clean(input);
    const active = !!input.active;
    if (uid === s.uid && (role !== "admin" || !active)) throw new Error("You can't remove your own admin access");
    await col.users().doc(uid).update({ role, scripts, active, ...(displayName ? { displayName } : {}) });
    await adminAuth().updateUser(uid, { disabled: !active });
    if (!active) await adminAuth().revokeRefreshTokens(uid);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
