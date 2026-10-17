import { describe, expect, it } from "vitest";
import { readServiceAccount } from "@/lib/firebase/credentials";

const KEY = "-----BEGIN PRIVATE KEY-----\nABC\nDEF\n-----END PRIVATE KEY-----\n";
const obj = { type: "service_account", project_id: "akshara-fyp", client_email: "x@akshara-fyp.iam.gserviceaccount.com", private_key: KEY };
const json = JSON.stringify(obj);
const read = (v?: string) => readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: v });

describe("readServiceAccount", () => {
  it("accepts the JSON on one line", () => {
    const r = read(json);
    expect(r.status).toBe("ok");
    expect(r.account?.privateKey).toBe(KEY);
  });
  it("accepts it wrapped in single quotes (as in .env.prod)", () => expect(read(`'${json}'`).status).toBe("ok"));
  it("accepts base64", () => expect(read(Buffer.from(json).toString("base64")).status).toBe("ok"));
  it("repairs real newlines pasted inside the key", () => {
    const pretty = JSON.stringify(obj, null, 2).replace(/\\n/g, "\n");
    const r = read(pretty);
    expect(r.status).toBe("ok");
    expect(r.account?.privateKey).toContain("BEGIN PRIVATE KEY-----\nABC");
  });
  it("unescapes double-escaped \\\\n", () => {
    const r = read(json.replace(/\\n/g, "\\\\n"));
    expect(r.account?.privateKey).toBe(KEY);
  });
  it("reports missing / broken values", () => {
    expect(read(undefined).status).toBe("missing");
    expect(read("   ").status).toBe("missing");
    expect(read("{not json").status).toBe("invalid-json");
    expect(read(JSON.stringify({ project_id: "p" })).status).toBe("missing-fields");
    expect(readServiceAccount({ FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" }).status).toBe("emulator");
  });
});
