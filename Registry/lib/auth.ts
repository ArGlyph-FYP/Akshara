import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { adminAuth, adminDb } from "./firebase/admin";
import type { Script, UserDoc } from "./types";

export const SESSION_COOKIE = "__session";
export const SESSION_DAYS = 7;

export type Session = { kind: "staff"; uid: string; user: UserDoc };

/** Verifies the session cookie and loads the user's role. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  let decoded;
  try {
    // Checked locally (no call to Firebase Auth), so busy survey traffic stays fast.
    decoded = await adminAuth().verifySessionCookie(cookie);
  } catch {
    return null; // expired or forged cookie
  }
  // Anonymous sign-ins are public-link readers; they count only once /api/public-join created their users doc.
  // Readers are cut off through `active`; admins also get the revocation check (password resets, removed access).
  const snap = await adminDb().collection("users").doc(decoded.uid).get();
  const user = snap.data() as UserDoc | undefined;
  if (!user || !user.active) return null;
  if (user.role === "admin") {
    try {
      await adminAuth().verifySessionCookie(cookie, true);
    } catch {
      return null; // revoked
    }
  }
  return { kind: "staff", uid: decoded.uid, user };
});

export class AuthError extends Error {}

export async function requireAdmin() {
  const s = await getSession();
  if (s?.kind !== "staff" || s.user.role !== "admin") redirect("/login");
  return s;
}

/** For pages: raters and admins can rate, limited to their scripts. */
export async function requireRater() {
  const s = await getSession();
  if (s?.kind !== "staff") redirect("/login");
  return s;
}

/** For server actions, where redirecting is not wanted. */
export async function assertAdmin() {
  const s = await getSession();
  if (s?.kind !== "staff" || s.user.role !== "admin") throw new AuthError("Admins only");
  return s;
}

export async function assertStaff() {
  const s = await getSession();
  if (s?.kind !== "staff") throw new AuthError("Sign in required");
  return s;
}

export function canRateScript(user: UserDoc, script: Script) {
  return user.scripts.includes(script);
}
