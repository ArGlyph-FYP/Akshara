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
  type Survey,
  type SurveyReader,
  type SurveyResponse,
  type UserDoc,
} from "./types";

/** Reads everything an export needs. Volumes are small (hundreds of samples), so one pass is fine. */
export async function loadExportData(db: Firestore, opts: { includeSurveys: boolean }) {
  const [participants, samples, ratings, criteria, users, surveys, settingsSnap] = await Promise.all([
    db.collection("participants").get(),
    db.collection("samples").get(),
    db.collection("ratings").get(),
    db.collection("criteria").get(),
    db.collection("users").get(),
    db.collection("surveys").get(),
    db.collection("settings").doc("global").get(),
  ]);

  const surveyList = surveys.docs.map((d) => ({ id: d.id, ...d.data() }) as Survey);
  const surveyReaders: ExportData["surveyReaders"] = [];
  const surveyResponses: ExportData["surveyResponses"] = [];
  if (opts.includeSurveys) {
    await Promise.all(
      surveyList.map(async (s) => {
        const [rd, rs] = await Promise.all([
          db.collection("surveys").doc(s.id).collection("readers").get(),
          db.collection("surveys").doc(s.id).collection("responses").get(),
        ]);
        rd.docs.forEach((d) => surveyReaders.push({ surveyId: s.id, ...(d.data() as SurveyReader) }));
        rs.docs.forEach((d) => surveyResponses.push({ surveyId: s.id, ...(d.data() as SurveyResponse) }));
      }),
    );
  }

  const s = (settingsSnap.data() ?? {}) as Partial<Settings>;
  const data: ExportData = {
    participants: participants.docs.map((d) => d.data() as Participant),
    samples: samples.docs.map((d) => ({ id: d.id, ...d.data() }) as Sample),
    ratings: ratings.docs.map((d) => ({ id: d.id, ...d.data() }) as Rating),
    criteria: criteria.docs.map((d) => ({ id: d.id, ...d.data() }) as Criterion),
    raterAliases: Object.fromEntries(users.docs.map((d) => [d.id, (d.data() as UserDoc).alias])),
    surveys: surveyList,
    surveyReaders,
    surveyResponses,
  };
  return { data, rubricVersions: { ...DEFAULT_SETTINGS.rubricVersion, ...s.rubricVersion } };
}
