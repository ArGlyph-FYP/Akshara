import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { UserDoc } from "@/lib/types";

export async function POST(req: Request) {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Only accounts an admin created (a users doc exists and is active) may sign in.
  let user: UserDoc | undefined;
  try {
    user = (await adminDb().collection("users").doc(decoded.uid).get()).data() as UserDoc | undefined;
  } catch (e) {
    console.error("[akshara] session: Firestore read failed", e);
    return NextResponse.json(
      { error: "The server can't reach the database. An admin should open /api/health to check the deployment settings." },
      { status: 500 },
    );
  }
  if (!user || !user.active) {
    return NextResponse.json(
      { error: "This account doesn't have access. Ask an Akshara admin to add you." },
      { status: 403 },
    );
  }

  const expiresIn = SESSION_DAYS * 24 * 60 * 60 * 1000;
  let cookie: string;
  try {
    cookie = await adminAuth().createSessionCookie(idToken, { expiresIn });
  } catch (e) {
    console.error("[akshara] session: createSessionCookie failed", e);
    return NextResponse.json({ error: "Could not start a session. Please sign in again." }, { status: 500 });
  }
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn / 1000,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
