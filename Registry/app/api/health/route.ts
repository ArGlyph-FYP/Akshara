import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const firstLine = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).split("\n")[0].slice(0, 300);

/**
 * Deployment self-check: runtime, config presence, and whether Firebase loads and Firestore answers.
 * Firebase is imported inside try/catch so even a crash while loading it is reported here. Reveals no secrets.
 */
export async function GET() {
  const report: Record<string, unknown> = {
    node: process.version,
    region: process.env.VERCEL_REGION ?? null,
    env: {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
      storageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      serviceAccountVarLength: (process.env.FIREBASE_SERVICE_ACCOUNT ?? "").length,
      usesEmulators: !!process.env.FIRESTORE_EMULATOR_HOST || process.env.NEXT_PUBLIC_USE_EMULATORS === "true",
    },
  };
  let ok = false;
  try {
    const { readServiceAccount } = await import("@/lib/firebase/credentials");
    const { status, account } = readServiceAccount();
    report.serviceAccount = status;
    report.serviceAccountProject = account?.projectId ?? null;
    try {
      const { adminDb } = await import("@/lib/firebase/admin");
      try {
        await adminDb().collection("settings").doc("global").get();
        report.firestore = "ok";
        ok = status === "ok";
      } catch (e) {
        report.firestore = `error: ${firstLine(e)}`;
      }
    } catch (e) {
      report.firebaseLoad = `error: ${firstLine(e)}`;
    }
  } catch (e) {
    report.credentialsLoad = `error: ${firstLine(e)}`;
  }
  return NextResponse.json({ ok, ...report }, { status: ok ? 200 : 500, headers: { "cache-control": "no-store" } });
}
