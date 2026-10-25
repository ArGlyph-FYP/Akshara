// Test data for trying the Sinhala main study before collection starts.
// Copies the existing Sinhala paragraphs into fake writers SI-901, SI-902, … until there are --total samples,
// and creates one main-study survey (marked TEST) over all of them, so the rating flow can be tried end to end.
// Shows what it would do first; nothing changes without --yes.
//   npm run test-data:prod                       (dry run: add)
//   npm run test-data:prod -- --yes              (add, default --total 100)
//   npm run test-data:prod -- --remove           (dry run: remove)
//   npm run test-data:prod -- --remove --yes     (remove every test sample, writer, the test survey, its ratings and readers)
// Real samples are only read and listed in the test survey; --remove never deletes them.
import type { DocumentReference } from "firebase-admin/firestore";
import { compareSamples, formatCode, newId, newPublicToken, newWriterId } from "../lib/codes";
import { RUBRIC_VERSION } from "../lib/rubric/criteria";
import { MAIN_DEFAULTS, MAIN_SCALE, surveyPath, type Participant, type Sample, type Study } from "../lib/types";
import { arg, auth, bucket, db, target } from "./admin-app";

const FIRST_TEST_NUMBER = 901;
const NOTE = "TEST DATA: copy of real samples, remove with npm run test-data:prod -- --remove --yes";

async function deleteAll(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

async function add(yes: boolean, total: number) {
  const existingTest = await db.collection("samples").where("testData", "==", true).limit(1).get();
  if (!existingTest.empty) throw new Error("Test data already exists. Remove it first (--remove --yes).");

  const real = (await db.collection("samples").where("script", "==", "si").get()).docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Sample, "id">) }))
    .filter((s) => s.imagePath && s.status !== "excluded" && s.status !== "rejected")
    .sort(compareSamples);
  if (real.length === 0) throw new Error("No usable Sinhala samples to copy.");
  const byPart = new Map<number, typeof real>();
  for (const s of real) byPart.set(s.part ?? 1, [...(byPart.get(s.part ?? 1) ?? []), s]);
  const parts = [...byPart.keys()].sort((a, b) => a - b);

  const needed = Math.max(0, total - real.length);
  const writers = Math.ceil(needed / parts.length);
  console.log(
    `${real.length} real Sinhala sample(s) found. Adding ${needed} copies as writers ` +
      `${formatCode("si", FIRST_TEST_NUMBER)}–${formatCode("si", FIRST_TEST_NUMBER + writers - 1)}, then one TEST main-study survey over ${real.length + needed} samples.`,
  );
  if (!yes) return;

  const now = Date.now();
  const newIds: string[] = [];
  let made = 0;
  for (let w = 0; w < writers && made < needed; w++) {
    const code = formatCode("si", FIRST_TEST_NUMBER + w);
    const p: Participant & { testData: true } = {
      code, script: "si", phase: "main", consentReceivedAt: now, consentVerifiedBy: "test-data script",
      status: "active", withdrawnAt: null, writerId: newWriterId(), notes: NOTE, createdAt: now, testData: true,
    };
    await db.collection("participants").doc(code).set(p);

    for (const part of parts) {
      if (made >= needed) break;
      const pool = byPart.get(part)!;
      const src = pool[w % pool.length];
      const id = newId();
      const ext = src.imagePath!.split(".").pop();
      const imagePath = `scans/si/${id}.${ext}`;
      await bucket.file(src.imagePath!).copy(bucket.file(imagePath));
      let thumbPath: string | null = null;
      if (src.thumbPath) {
        thumbPath = `scans/si/${id}_thumb.jpg`;
        await bucket.file(src.thumbPath).copy(bucket.file(thumbPath));
      }
      const s: Omit<Sample, "id"> & { testData: true; copiedFrom: string } = {
        participantCode: code, writerId: p.writerId, script: "si", phase: "main", pageNo: 1, part,
        sourcePath: null, crop: null, imagePath, thumbPath, contentType: src.contentType,
        width: src.width, height: src.height, status: "qc_ok", isAnchor: false, anchorScores: null,
        uploadedAt: now, uploadedBy: "test-data script", testData: true, copiedFrom: src.id,
      };
      await db.collection("samples").doc(id).set(s);
      newIds.push(id);
      made++;
    }
    process.stdout.write(`\r  ${made}/${needed} copies`);
  }
  console.log();

  const studyId = newId();
  const study: Omit<Study, "id"> & { testData: true } = {
    script: "si", type: "rubric", title: "TEST – Sinhala main study (copied samples)",
    instructions: "", sampleIds: [...real.map((s) => s.id), ...newIds], open: true,
    overallScale: MAIN_SCALE, legibilityScale: MAIN_SCALE, rubricVersion: RUBRIC_VERSION,
    publicToken: newPublicToken(), publicOpen: true, perReader: MAIN_DEFAULTS.formSize, repeatPct: 10,
    targetPerSample: MAIN_DEFAULTS.targetPerSample, maxPerSample: MAIN_DEFAULTS.maxPerSample,
    createdAt: now, testData: true,
  };
  await db.collection("studies").doc(studyId).set(study);
  console.log(`Survey created. Rating link: ${surveyPath("si", study.publicToken!)} (admin: /admin/main/${studyId})`);
}

async function remove(yes: boolean) {
  const [samples, participants, studies] = await Promise.all(
    ["samples", "participants", "studies"].map((c) => db.collection(c).where("testData", "==", true).get()),
  );
  const ratings: DocumentReference[] = [];
  const work: DocumentReference[] = [];
  const readers = new Set<string>();
  const sampleIds = new Set(samples.docs.map((d) => d.id));
  for (const st of studies.docs) {
    const [r, a] = await Promise.all([
      db.collection("ratings").where("studyId", "==", st.id).get(),
      db.collection("assignments").where("studyId", "==", st.id).get(),
    ]);
    r.docs.forEach((d) => ratings.push(d.ref));
    a.docs.forEach((d) => {
      work.push(d.ref);
      readers.add(d.data().raterId);
    });
  }
  // Ratings of test samples made in other (real) surveys go too, so no rating points at a deleted sample.
  for (const id of sampleIds) {
    const [r, a] = await Promise.all([
      db.collection("ratings").where("sampleId", "==", id).get(),
      db.collection("assignments").where("sampleId", "==", id).get(),
    ]);
    r.docs.forEach((d) => !ratings.some((x) => x.path === d.ref.path) && ratings.push(d.ref));
    a.docs.forEach((d) => !work.some((x) => x.path === d.ref.path) && work.push(d.ref));
  }
  // Only remove link readers who did nothing outside the test survey.
  const testStudyIds = new Set(studies.docs.map((d) => d.id));
  const readerDocs: DocumentReference[] = [];
  for (const uid of readers) {
    const u = await db.collection("users").doc(uid).get();
    if (!u.exists || u.data()!.role !== "rater" || !u.data()!.public) continue;
    const other = (await db.collection("assignments").where("raterId", "==", uid).get()).docs.some((d) => !testStudyIds.has(d.data().studyId));
    if (!other) readerDocs.push(u.ref);
  }

  console.log(
    `${samples.size} test sample(s), ${participants.size} test writer(s), ${studies.size} test survey(s), ` +
      `${ratings.length} rating(s), ${work.length} queued item(s), ${readerDocs.length} test reader(s).`,
  );
  if (!yes) return;

  await deleteAll([...ratings, ...work]);
  await deleteAll(studies.docs.map((d) => d.ref));
  for (const s of samples.docs) {
    const d = s.data();
    for (const p of [d.imagePath, d.thumbPath]) if (p) await bucket.file(p).delete({ ignoreNotFound: true });
  }
  await deleteAll([...samples.docs, ...participants.docs].map((d) => d.ref));
  for (const r of readerDocs) {
    await r.delete();
    await auth.deleteUser(r.id).catch(() => undefined);
  }
}

async function main() {
  const yes = arg("yes") === "true";
  const removing = arg("remove") === "true";
  const total = Number(arg("total", "100"));
  if (!(total > 0)) throw new Error("--total must be a positive number");
  console.log(`${yes ? "" : "Dry run on "}${target()}\n`);
  await (removing ? remove(yes) : add(yes, total));
  console.log(yes ? "\nDone." : "\nNothing changed. Run again with --yes.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
