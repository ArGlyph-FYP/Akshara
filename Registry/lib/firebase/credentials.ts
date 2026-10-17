// No "server-only" here so it can be unit tested; only server code imports it.
import type { ServiceAccount } from "firebase-admin/app";

export type CredentialStatus = "ok" | "missing" | "invalid-json" | "missing-fields" | "emulator";

/**
 * Reads FIREBASE_SERVICE_ACCOUNT leniently: the JSON as one line, wrapped in quotes, base64-encoded,
 * or with the private key's line breaks pasted as literal "\\n" or real newlines (common when copying into Vercel).
 */
export function readServiceAccount(env: Record<string, string | undefined> = process.env): { status: CredentialStatus; account?: ServiceAccount & { client_email?: string } } {
  if (env.FIRESTORE_EMULATOR_HOST) return { status: "emulator" };
  let raw = (env.FIREBASE_SERVICE_ACCOUNT ?? "").trim();
  if (!raw) return { status: "missing" };
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"') && !raw.startsWith('"{'))) {
    raw = raw.slice(1, -1).trim();
  }
  if (!raw.startsWith("{")) {
    try {
      raw = Buffer.from(raw, "base64").toString("utf8").trim();
    } catch {
      return { status: "invalid-json" };
    }
  }
  let json: Record<string, string>;
  try {
    json = JSON.parse(raw);
  } catch {
    try {
      // Real newlines inside the private_key string make the JSON invalid; escape them and retry.
      json = JSON.parse(raw.replace(/"(?:[^"\\]|\\.)*"/g, (str) => str.replace(/\r?\n/g, "\\n")));
    } catch {
      return { status: "invalid-json" };
    }
  }
  if (!json.project_id || !json.client_email || !json.private_key) return { status: "missing-fields" };
  const privateKey = json.private_key.replace(/\\n/g, "\n");
  return {
    status: "ok",
    account: { projectId: json.project_id, clientEmail: json.client_email, privateKey, client_email: json.client_email },
  };
}
