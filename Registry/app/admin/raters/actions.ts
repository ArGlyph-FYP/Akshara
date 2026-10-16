"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { run, str, type ActionResult } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { col, db } from "@/lib/data";
import { adminAuth } from "@/lib/firebase/admin";
import { SCRIPTS, type Role, type Script, type UserDoc } from "@/lib/types";

function parseScripts(fd: FormData): Script[] {
  return fd.getAll("scripts").map(String).filter((s): s is Script => (SCRIPTS as readonly string[]).includes(s));
}

function parseRole(v: string): Role {
  if (v !== "admin" && v !== "rater") throw new Error("Choose a role");
  return v;
}

export async function inviteUser(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const email = str(fd, "email").toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email");
    const role = parseRole(str(fd, "role"));
    const scripts = parseScripts(fd);
    if (role === "rater" && scripts.length === 0) throw new Error("Pick at least one script for a rater");

    const auth = adminAuth();
    const user = await auth.getUserByEmail(email).catch(() => auth.createUser({ email, emailVerified: false }));
    const ref = col.users().doc(user.uid);
    const counter = col.counters().doc("raters");
    await db().runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists) throw new Error(`${email} is already on the team`);
      const n = (((await tx.get(counter)).data()?.nextNumber as number | undefined) ?? 1);
      const doc: UserDoc = {
        email,
        displayName: str(fd, "displayName") || email.split("@")[0],
        role,
        scripts,
        active: true,
        alias: `R${String(n).padStart(2, "0")}`,
        createdAt: Date.now(),
      };
      tx.set(ref, doc);
      tx.set(counter, { nextNumber: n + 1 }, { merge: true });
    });
    revalidatePath("/admin/raters");
    return `Added ${email}. They can now sign in at /login with this email.`;
  });
}

export async function updateUser(_: ActionResult, fd: FormData) {
  return run(async () => {
    const s = await assertAdmin();
    const uid = str(fd, "uid");
    const role = parseRole(str(fd, "role"));
    const active = str(fd, "active") === "1";
    if (uid === s.uid && (role !== "admin" || !active)) throw new Error("You can't remove your own admin access");
    await col.users().doc(uid).update({ role, scripts: parseScripts(fd), active, displayName: str(fd, "displayName") });
    if (!active) await adminAuth().revokeRefreshTokens(uid);
    revalidatePath("/admin/raters");
    return "Saved";
  });
}

/** Generates a one-off sign-in link to send by WhatsApp/email if the Firebase email doesn't arrive. */
export async function makeLoginLink(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    const link = await adminAuth().generateSignInWithEmailLink(str(fd, "email"), {
      url: `${origin}/login`,
      handleCodeInApp: true,
    });
    return link;
  });
}
