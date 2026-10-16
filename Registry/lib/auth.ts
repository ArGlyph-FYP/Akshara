import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { adminAuth, adminDb } from "./firebase/admin";
import type { Script, UserDoc } from "./types";

export const SESSION_COOKIE = "__session";
export const SESSION_DAYS = 7;

export type Session =
  | { kind: "staff"; uid: string; user: UserDoc }
  | { kind: "reader"; uid: string };

/** Verifies the session cookie and loads the user's role. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  let decoded;
  try {
    decoded = await adminAuth().verifySessionCookie(cookie, true);
  } catch {
    return null; // expired, revoked or forged cookie
  }
  if (decoded.firebase?.sign_in_provider === "anonymous") return { kind: "reader", uid: decoded.uid };
  const snap = await adminDb().collection("users").doc(decoded.uid).get();
  const user = snap.data() as UserDoc | undefined;
  if (!user || !user.active) return null;
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

export async function assertReader() {
  const s = await getSession();
  if (!s) throw new AuthError("Session expired. Reload the page.");
  return s;
}

export function canRateScript(user: UserDoc, script: Script) {
  return user.scripts.includes(script);
}
