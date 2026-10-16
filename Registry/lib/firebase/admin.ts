import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    // On App Hosting, Application Default Credentials are used; locally the emulators need none.
    ...(serviceAccount ? { credential: cert(JSON.parse(serviceAccount)) } : {}),
  });
}

// Kept on globalThis because Next.js can load this module more than once (server bundles, dev reloads),
// while firebase-admin itself is a single shared instance and settings() may only be called once.
const g = globalThis as typeof globalThis & { __aksharaDb?: Firestore };

export function adminDb(): Firestore {
  if (!g.__aksharaDb) {
    const db = getFirestore(app());
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Already configured by another copy of this module.
    }
    g.__aksharaDb = db;
  }
  return g.__aksharaDb;
}

export const adminAuth = () => getAuth(app());
export const adminBucket = () => getStorage(app()).bucket();
