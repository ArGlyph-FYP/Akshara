// No "server-only" import: this module is shared with the CLI exporter (scripts/export-dataset.ts).
import type { Firestore } from "firebase-admin/firestore";
import type { ExportData } from "./export";
import { RUBRIC_VERSIONS, rubricCriteria } from "./rubric/criteria";
import type { Participant, Rating, Sample, Study, UserDoc } from "./types";

/** Reads everything an export needs. Volumes are small (hundreds of samples), so one pass is fine. */
export async function loadExportData(db: Firestore) {
  const [participants, samples, ratings, users, studies] = await Promise.all([
    db.collection("participants").get(),
    db.collection("samples").get(),
    db.collection("ratings").get(),
    db.collection("users").get(),
    db.collection("studies").get(),
  ]);
  const data: ExportData = {
    participants: participants.docs.map((d) => d.data() as Participant),
    samples: samples.docs.map((d) => ({ id: d.id, ...d.data() }) as Sample),
    ratings: ratings.docs.map((d) => ({ id: d.id, ...d.data() }) as Rating),
    // Fixed criteria from code: Sinhala Rubric v12 (A1–A8, A6a–A6c) and Tamil rubric v0.3 (C1–C8).
    criteria: [...rubricCriteria("si"), ...rubricCriteria("ta")],
    raterAliases: Object.fromEntries(users.docs.map((d) => [d.id, (d.data() as UserDoc).alias])),
    raterInfo: Object.fromEntries(
      users.docs.map((d) => {
        const u = d.data() as UserDoc;
        return [
          d.id,
          {
            source: u.public ? "public" : "account",
            firstLanguage: u.nativeReader ?? null,
            ageGroup: u.ageGroup ?? null,
            age: u.age ?? null,
            occupation: u.occupation ?? null,
            training: u.training ?? null,
          },
        ];
      }),
    ),
    studies: studies.docs.map((d) => ({ id: d.id, ...d.data() }) as Study),
  };
  return { data, rubricVersions: RUBRIC_VERSIONS };
}
