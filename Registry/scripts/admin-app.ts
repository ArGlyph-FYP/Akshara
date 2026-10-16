// Admin SDK setup for CLI scripts (lib/firebase/admin.ts is server-only and can't be imported here).
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
const app = initializeApp({
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  ...(sa ? { credential: cert(JSON.parse(sa)) } : {}),
});

export const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });
export const auth = getAuth(app);
export const bucket = getStorage(app).bucket();

export function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : "true";
}

export function target() {
  return process.env.FIRESTORE_EMULATOR_HOST
    ? `emulator (${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID})`
    : `PROJECT ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`;
}
