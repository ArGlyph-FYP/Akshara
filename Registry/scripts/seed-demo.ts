// Fills the LOCAL EMULATOR with demo data so every screen can be tried end to end.
//   npm run emulators   (in one terminal)
//   npm run seed:demo   (in another)
import { deflateSync } from "node:zlib";
import { planAllToAll, planAssignments } from "../lib/assign";
import { newId, newWriterId, formatCode } from "../lib/codes";
import { seededRandom } from "../lib/random";
import type { Assignment, Participant, Phase, Sample, Script, Study, UserDoc } from "../lib/types";
import { auth, bucket, db } from "./admin-app";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Refusing to seed: FIRESTORE_EMULATOR_HOST is not set (this script is for the emulator only).");
  process.exit(1);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** A fake "handwriting" page: wavy ink strokes on paper, varying in neatness by `messiness`. */
function fakeScan(seed: string, messiness: number, w = 1240, h = 1754): Buffer {
  const rand = seededRandom(seed);
  const px = new Uint8Array(w * h).fill(246);
  const dot = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xi = Math.round(x + dx), yi = Math.round(y + dy);
        if (xi >= 0 && xi < w && yi >= 0 && yi < h) px[yi * w + xi] = 30;
      }
  };
  const lines = 12;
  for (let l = 0; l < lines; l++) {
    const base = 180 + l * 110 + (rand() - 0.5) * 30 * messiness;
    const slope = (rand() - 0.5) * 0.06 * messiness;
    let x = 110 + rand() * 20 * messiness;
    while (x < w - 120 - rand() * 200) {
      const wordLen = 60 + rand() * 120;
      const amp = 14 + rand() * 10 * (1 + messiness);
      const freq = 0.12 + rand() * 0.08;
      for (let t = 0; t < wordLen; t += 0.5) {
        const y = base + slope * (x + t) + Math.sin((x + t) * freq) * amp * (0.6 + 0.4 * Math.sin(t * 0.05)) + (rand() - 0.5) * 3 * messiness;
        dot(x + t, y);
      }
      x += wordLen + 25 + rand() * 30 * (1 + messiness);
    }
  }
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    raw.set(px.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const DEMO_PASSWORD = "Demo#2026";
let aliasN = 1;
async function user(email: string, displayName: string, role: UserDoc["role"], scripts: Script[]) {
  const u = await auth.getUserByEmail(email).catch(() => auth.createUser({ email }));
  await auth.updateUser(u.uid, { password: DEMO_PASSWORD, displayName });
  const doc: UserDoc = { email, displayName, role, scripts, active: true, alias: `R${String(aliasN++).padStart(2, "0")}`, createdAt: Date.now() };
  await db.collection("users").doc(u.uid).set(doc);
  return u.uid;
}

async function main() {
  console.log("Seeding emulator…");
  const adminUid = await user("admin@akshara.test", "Demo Admin", "admin", ["si", "ta"]);
  for (let i = 1; i <= 3; i++) await user(`rater${i}.si@akshara.test`, `Sinhala rater ${i}`, "rater", ["si"]);
  await user("rater1.ta@akshara.test", "Tamil rater 1", "rater", ["ta"]);
  await db.collection("counters").doc("raters").set({ nextNumber: aliasN });

  const plan: { script: Script; pilot: number; main: number }[] = [
    { script: "si", pilot: 4, main: 8 },
    { script: "ta", pilot: 3, main: 4 },
  ];
  const pilotIds: Record<Script, string[]> = { si: [], ta: [] };
  for (const { script, pilot, main } of plan) {
    for (let n = 1; n <= pilot + main; n++) {
      const code = formatCode(script, n);
      const phase: Phase = n <= pilot ? "pilot" : "main";
      const p: Participant = {
        code, script, phase,
        consentReceivedAt: Date.now(), consentVerifiedBy: "admin@akshara.test",
        status: "active", withdrawnAt: null, writerId: newWriterId(), notes: "demo", createdAt: Date.now(),
      };
      await db.collection("participants").doc(code).set(p);
      const id = newId();
      const imagePath = `scans/${script}/${id}.png`;
      await bucket.file(imagePath).save(fakeScan(code, (n % 4) / 1.5), { contentType: "image/png", resumable: false });
      const s: Omit<Sample, "id"> = {
        participantCode: code, writerId: p.writerId, script, phase, pageNo: 1, imagePath, contentType: "image/png",
        width: 1240, height: 1754, status: phase === "main" ? "qc_ok" : "uploaded",
        isAnchor: phase === "main" && n === pilot + 1,
        anchorScores: phase === "main" && n === pilot + 1 ? { overall: 5, legibility: 4, note: "DEMO: neat, but the baseline drifts upward." } : null,
        uploadedAt: Date.now(), uploadedBy: "admin@akshara.test",
      };
      await db.collection("samples").doc(id).set(s);
      if (phase === "pilot") pilotIds[script].push(id);
    }
    await db.collection("counters").doc(script).set({ nextNumber: pilot + main + 1 });
  }

  // A perception study (every SI rater sees every pilot sample) and a rubric study (3 raters per main sample).
  const siRaters = (await db.collection("users").where("scripts", "array-contains", "si").where("role", "==", "rater").get()).docs.map((d) => d.id);
  const siMain = (await db.collection("samples").where("script", "==", "si").where("phase", "==", "main").get()).docs.map((d) => ({ id: d.id, isAnchor: !!d.data().isAnchor }));
  const studies: { study: Omit<Study, "id">; samples: { id: string; isAnchor: boolean }[]; mode: "manual" | "random" }[] = [
    {
      study: { script: "si", type: "perception", title: "Sinhala perception pilot (demo)", instructions: "DEMO: score each page and tell us why.", sampleIds: pilotIds.si, open: true, overallScale: { min: 1, max: 7 }, legibilityScale: null, rubricVersion: null, publicToken: "demo-si", publicOpen: true, perReader: null, createdAt: Date.now() },
      samples: pilotIds.si.map((id) => ({ id, isAnchor: false })),
      mode: "manual",
    },
    {
      study: { script: "si", type: "rubric", title: "Sinhala main study (demo)", instructions: "", sampleIds: siMain.map((s) => s.id), open: true, overallScale: { min: 1, max: 10 }, legibilityScale: { min: 1, max: 10 }, rubricVersion: 1, publicToken: "demo-si-main", publicOpen: true, perReader: 10, repeatPct: 10, targetPerSample: 5, maxPerSample: 10, createdAt: Date.now() + 1 },
      samples: siMain,
      mode: "random",
    },
  ];
  await db.collection("studies").doc(newId()).set({
    script: "ta", type: "perception", title: "Tamil perception pilot (demo)", instructions: "", sampleIds: pilotIds.ta, open: true,
    overallScale: { min: 1, max: 7 }, legibilityScale: null, rubricVersion: null, publicToken: "demo-ta", publicOpen: true, perReader: 2, createdAt: Date.now(),
  } satisfies Omit<Study, "id">);
  for (const { study, samples, mode } of studies) {
    const id = newId();
    await db.collection("studies").doc(id).set(study);
    const planned =
      mode === "manual"
        ? planAllToAll({ samples, raterIds: siRaters, existing: [], seed: id })
        : planAssignments({ samples, raterIds: siRaters, existing: [], ratersPerSample: 3, repeatFraction: 0.1, seed: id }).assignments;
    const batch = db.batch();
    for (const a of planned) {
      const doc: Omit<Assignment, "id"> = { ...a, studyId: id, script: study.script, status: "pending", createdAt: Date.now() };
      batch.set(db.collection("assignments").doc(newId()), doc);
    }
    await batch.commit();
  }

  console.log(`✓ Seeded. Admin: admin@akshara.test (uid ${adminUid}); raters: rater1..3.si@akshara.test, rater1.ta@akshara.test`);
  console.log(`  Password for every demo account: ${DEMO_PASSWORD}`);
  console.log("  Public survey links: http://localhost:3000/sin/survey/demo-si (Sinhala), /tam/survey/demo-ta (Tamil, 2 samples per reader)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
