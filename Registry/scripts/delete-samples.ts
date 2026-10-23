// Deletes every sample of the given codes: image files, ratings, rating work, and their place in studies.
// Shows what it would delete first; nothing changes without --yes.
//   npm run delete-samples:prod -- --codes SI-002,SI-003            (dry run)
//   npm run delete-samples:prod -- --codes SI-002,SI-003 --yes      (delete)
//   add --with-writers to delete the writer records too (otherwise only writers auto-created by an upload go).
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { AUTO_REGISTER_NOTE, parseFormCode } from "../lib/codes";
import { arg, bucket, db, target } from "./admin-app";

async function deleteAll(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

async function main() {
  const raw = arg("codes");
  if (!raw || raw === "true") throw new Error("Pass --codes SI-002,SI-003");
  const codes = raw.split(",").map((c) => {
    const code = parseFormCode(c, "si");
    if (!code) throw new Error(`Not a code: ${c}`);
    return code;
  });
  const yes = arg("yes") === "true";
  const withWriters = arg("with-writers") === "true";

  console.log(`${yes ? "DELETING" : "Dry run"} on ${target()}: ${codes.join(", ")}\n`);
  const studies = (await db.collection("studies").get()).docs;
  const pages = new Set<string>();

  for (const code of codes) {
    const pRef = db.collection("participants").doc(code);
    const participant = (await pRef.get()).data();
    const samples = (await db.collection("samples").where("participantCode", "==", code).get()).docs;
    console.log(`${code}: writer ${participant ? `${participant.status}${participant.notes ? ` ("${participant.notes}")` : ""}` : "not registered"}, ${samples.length} sample(s)`);

    for (const s of samples) {
      const d = s.data();
      const [ratings, work] = await Promise.all([
        db.collection("ratings").where("sampleId", "==", s.id).get(),
        db.collection("assignments").where("sampleId", "==", s.id).get(),
      ]);
      const inStudies = studies.filter((st) => (st.data().sampleIds as string[]).includes(s.id));
      const label = `${code}${d.part ? `-${d.part}` : ""}${d.pageNo > 1 ? ` p${d.pageNo}` : ""}`;
      console.log(
        `  ${label} (${s.id}): ${ratings.size} rating(s), ${work.size} queued item(s)` +
          (inStudies.length ? `, in ${inStudies.map((st) => `"${st.data().title}"`).join(", ")}` : ""),
      );
      if (!yes) continue;

      await deleteAll([...ratings.docs, ...work.docs].map((x) => x.ref));
      const batch = db.batch();
      for (const st of inStudies) batch.update(st.ref, { sampleIds: FieldValue.arrayRemove(s.id) });
      batch.delete(s.ref);
      await batch.commit();
      for (const p of [d.imagePath, d.thumbPath]) if (p) await bucket.file(p).delete({ ignoreNotFound: true });
      if (d.sourcePath) pages.add(d.sourcePath);
    }

    const dropWriter = participant && (withWriters || participant.notes === AUTO_REGISTER_NOTE);
    if (dropWriter) console.log(`  writer record ${yes ? "deleted" : "would be deleted"}`);
    if (yes && dropWriter) {
      const left = await db.collection("samples").where("participantCode", "==", code).limit(1).get();
      if (left.empty) await pRef.delete();
    }
  }

  for (const p of pages) {
    const users = await db.collection("samples").where("sourcePath", "==", p).limit(1).get();
    if (users.empty) await bucket.file(p).delete({ ignoreNotFound: true });
  }
  console.log(yes ? "\nDone." : "\nNothing changed. Run again with --yes to delete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
