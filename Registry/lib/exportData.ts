// No "server-only" import: this module is shared with the CLI exporter (scripts/export-dataset.ts).
import type { Firestore } from "firebase-admin/firestore";
import type { ExportData } from "./export";
import {
  DEFAULT_SETTINGS,
  type Criterion,
  type Participant,
  type Rating,
  type Sample,
  type Settings,
  type Study,
  type UserDoc,
} from "./types";

/** Reads everything an export needs. Volumes are small (hundreds of samples), so one pass is fine. */
export async function loadExportData(db: Firestore) {
  const [participants, samples, ratings, criteria, users, studies, settingsSnap] = await Promise.all([
    db.collection("participants").get(),
    db.collection("samples").get(),
    db.collection("ratings").get(),
    db.collection("criteria").get(),
    db.collection("users").get(),
    db.collection("studies").get(),
    db.collection("settings").doc("global").get(),
  ]);
  const s = (settingsSnap.data() ?? {}) as Partial<Settings>;
  const data: ExportData = {
    participants: participants.docs.map((d) => d.data() as Participant),
    samples: samples.docs.map((d) => ({ id: d.id, ...d.data() }) as Sample),
    ratings: ratings.docs.map((d) => ({ id: d.id, ...d.data() }) as Rating),
    criteria: criteria.docs.map((d) => ({ id: d.id, ...d.data() }) as Criterion),
    raterAliases: Object.fromEntries(users.docs.map((d) => [d.id, (d.data() as UserDoc).alias])),
    raterInfo: Object.fromEntries(
      users.docs.map((d) => {
        const u = d.data() as UserDoc;
        return [d.id, { source: u.public ? "public" : "account", firstLanguage: u.nativeReader ?? null, ageGroup: u.ageGroup ?? null }];
      }),
    ),
    studies: studies.docs.map((d) => ({ id: d.id, ...d.data() }) as Study),
  };
  return { data, rubricVersions: { ...DEFAULT_SETTINGS.rubricVersion, ...s.rubricVersion } };
}
