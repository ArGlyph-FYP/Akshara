import { NextResponse } from "next/server";
import { adminDb, readServiceAccount } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/** Deployment self-check: which config is present and whether Firestore answers. Reveals no secrets. */
export async function GET() {
  const { status, account } = readServiceAccount();
  const env = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
    storageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    usesEmulators: !!process.env.FIRESTORE_EMULATOR_HOST || process.env.NEXT_PUBLIC_USE_EMULATORS === "true",
  };
  let firestore: string;
  try {
    await adminDb().collection("settings").doc("global").get();
    firestore = "ok";
  } catch (e) {
    firestore = `error: ${(e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 160)}`;
  }
  const ok = status === "ok" && firestore === "ok" && !env.usesEmulators && !!env.projectId;
  return NextResponse.json(
    {
      ok,
      serviceAccount: status,
      serviceAccountProject: account?.projectId ?? null,
      projectMatches: account ? account.projectId === env.projectId : null,
      firestore,
      env,
    },
    { status: ok ? 200 : 500, headers: { "cache-control": "no-store" } },
  );
}
