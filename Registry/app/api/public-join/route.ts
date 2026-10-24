import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";
import { newReaderAlias } from "@/lib/codes";
import { col, getStudyByPublicToken } from "@/lib/data";
import { adminAuth } from "@/lib/firebase/admin";
import { assignPublicReader, publicLinkOpen } from "@/lib/public";
import type { UserDoc } from "@/lib/types";
import { surveyText } from "@/app/_survey/i18n";

const AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
/** Exports still carry an age group, so it is derived from the exact age. */
const ageGroupOf = (age: number) => AGE_GROUPS[age < 25 ? 0 : age < 35 ? 1 : age < 45 ? 2 : age < 55 ? 3 : age < 65 ? 4 : 5];

/**
 * Public-link sign-up. The browser signs in anonymously with Firebase and posts its ID token with the
 * reader's details; we create (or refresh) their rater profile, assign samples, and start a session.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    idToken?: string;
    token?: string;
    name?: string;
    contact?: string;
    age?: number;
    occupation?: string;
    nativeReader?: boolean;
    adult?: boolean;
    consent?: boolean;
  };
  const study = await getStudyByPublicToken(String(body.token ?? ""));
  if (!publicLinkOpen(study)) return NextResponse.json({ error: "This survey link is closed." }, { status: 404 });
  const t = surveyText(study.script);

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(String(body.idToken ?? ""));
  } catch {
    return NextResponse.json({ error: "Please reload the page and try again." }, { status: 401 });
  }
  // Session cookies need a sign-in from the last 5 minutes; the browser then signs in afresh and retries.
  if (Date.now() / 1000 - decoded.auth_time > 4 * 60) {
    return NextResponse.json({ error: "stale", stale: true }, { status: 401 });
  }

  const ref = col.users().doc(decoded.uid);
  const existing = (await ref.get()).data() as UserDoc | undefined;
  if (existing && !existing.active) return NextResponse.json({ error: "This browser's access has been disabled." }, { status: 403 });

  if (!existing) {
    const name = String(body.name ?? "").trim().slice(0, 80);
    const occupation = String(body.occupation ?? "").trim().slice(0, 120);
    const contact = String(body.contact ?? "").trim().slice(0, 120);
    const age = Number(body.age);
    if (!name || !occupation || !contact) return NextResponse.json({ error: t.required }, { status: 400 });
    if (!Number.isInteger(age) || age < 18 || age > 100) return NextResponse.json({ error: t.ageError }, { status: 400 });
    if (!body.adult || !body.consent) return NextResponse.json({ error: t.required }, { status: 400 });
    const doc: UserDoc = {
      email: contact,
      displayName: name,
      role: "rater",
      scripts: [study.script],
      active: true,
      alias: newReaderAlias(),
      createdAt: Date.now(),
      public: true,
      nativeReader: typeof body.nativeReader === "boolean" ? body.nativeReader : null,
      ageGroup: ageGroupOf(age),
      age,
      occupation,
      consentedAt: Date.now(),
    };
    await ref.set(doc);
  } else if (!existing.scripts.includes(study.script)) {
    await ref.update({ scripts: [...existing.scripts, study.script] });
  }

  const items = await assignPublicReader(study, decoded.uid);
  if (items === 0) {
    return NextResponse.json({ error: study.type === "rubric" ? t.allFull : t.nothingToRate }, { status: 409 });
  }

  const expiresIn = SESSION_DAYS * 24 * 60 * 60 * 1000;
  const cookie = await adminAuth().createSessionCookie(String(body.idToken), { expiresIn });
  const res = NextResponse.json({ ok: true, next: `/rate/next?study=${study.id}` });
  res.cookies.set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn / 1000,
  });
  return res;
}
