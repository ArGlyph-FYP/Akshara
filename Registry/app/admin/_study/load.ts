import "server-only";
import { compareSamples } from "@/lib/codes";
import { col, criteriaFor, getSamplesByIds, getUsersByIds, listAssignments, listRatings, listStudies } from "@/lib/data";
import { surveyStatus, type SurveyStatus } from "./status";
import { datasetRows } from "@/lib/dataset";
import type { SampleRow, StudyRef } from "@/lib/dataset-types";
import { datasetOf, type AssignmentKind, type Criterion, type Dataset, type Region, type Script, type Study, type StudyType } from "@/lib/types";

export interface ReaderInfo {
  uid: string;
  name: string;
  contact: string;
  alias: string;
  public: boolean;
  nativeReader: boolean | null;
  ageGroup: string | null;
  age: number | null;
  occupation: string | null;
  training: string | null;
  joinedAt: number;
}

export interface ResponseInfo {
  /** Null when the rater marked the paragraph unscorable (Sinhala v12). */
  overall: number | null;
  legibility: number | null;
  liked: string;
  disliked: string;
  comment: string;
  decoration: string | null;
  alterations: string | null;
  regions: Region[];
  criterionScores: Record<string, number>;
  notApplicable: string[];
  copyError: boolean;
  unscorable: boolean;
  unscorableReason: string;
  durationMs: number;
  submittedAt: number;
}

export interface ItemInfo {
  id: string;
  raterId: string;
  sampleId: string;
  kind: AssignmentKind;
  status: "pending" | "done" | "skipped";
  batch: number;
  rating: ResponseInfo | null;
}

export interface StudyPageData {
  script: Script;
  /** Dataset the survey's samples come from. */
  dataset: { id: string; name: string };
  type: StudyType;
  /** The survey shown; null on the "new survey" screen. */
  study: Study | null;
  /** Every survey of this type in the dataset, newest first. */
  rounds: { id: string; title: string; createdAt: number }[];
  /** Samples that can be added (not withdrawn or rejected). */
  rows: SampleRow[];
  refs: StudyRef[];
  /** The fixed main-study criteria (A1–A8). */
  criteria: Criterion[];
  samples: { id: string; code: string; pageNo: number; part: number | null; isAnchor: boolean }[];
  readers: ReaderInfo[];
  items: ItemInfo[];
}

export interface SurveySummary {
  id: string;
  title: string;
  token: string | null;
  status: SurveyStatus;
  samples: number;
  readers: number;
  done: number;
  total: number;
  createdAt: number;
}

/** Every survey of one type in a dataset for the list screen, newest first, with reader and response counts. */
export async function loadSurveyList(script: Script, datasetId: string, type: StudyType): Promise<SurveySummary[]> {
  const studies = (await listStudies(script)).filter((s) => s.type === type && datasetOf(s) === datasetId);
  const count = async (q: FirebaseFirestore.Query) => (await q.count().get()).data().count;
  return Promise.all(
    studies.map(async (s) => {
      const items = col.assignments().where("studyId", "==", s.id);
      const [total, done, readers] = await Promise.all([
        count(items),
        count(items.where("status", "==", "done")),
        // Every reader's queue starts at position 0, so this counts readers.
        count(items.where("position", "==", 0)),
      ]);
      return {
        id: s.id,
        title: s.title,
        token: s.publicToken ?? null,
        status: surveyStatus(s),
        samples: s.sampleIds.length,
        readers,
        done,
        total,
        createdAt: s.createdAt,
      };
    }),
  );
}

/** One survey's page (with `id`), or the "new survey" screen (without), within one dataset. */
export async function loadStudyPage(script: Script, dataset: Dataset, type: StudyType, id?: string): Promise<StudyPageData> {
  const [all, { rows, studies: refs }] = await Promise.all([listStudies(script), datasetRows(script, dataset.id)]);
  const rounds = all.filter((s) => s.type === type && datasetOf(s) === dataset.id);
  const study = (id && rounds.find((s) => s.id === id)) || null;
  const base = {
    script,
    dataset: { id: dataset.id, name: dataset.name },
    type,
    study,
    rounds: rounds.map((s) => ({ id: s.id, title: s.title, createdAt: s.createdAt })),
    rows: rows.filter((r) => r.status !== "excluded" && r.status !== "rejected"),
    refs,
    criteria: criteriaFor(script),
  };
  if (!study) return { ...base, samples: [], readers: [], items: [] };

  const [assignments, ratings, samples] = await Promise.all([
    listAssignments({ studyId: study.id }),
    listRatings({ studyId: study.id }),
    getSamplesByIds(study.sampleIds),
  ]);
  const ratingByAssignment = new Map(ratings.map((r) => [r.assignmentId, r]));
  const readerIds = new Set(assignments.map((a) => a.raterId));
  const users = await getUsersByIds([...readerIds]);
  const firstItem = new Map<string, number>();
  for (const a of assignments) firstItem.set(a.raterId, Math.min(firstItem.get(a.raterId) ?? Infinity, a.createdAt));

  return {
    ...base,
    samples: samples
      .sort(compareSamples)
      .map((s) => ({ id: s.id, code: s.participantCode, pageNo: s.pageNo, part: s.part ?? null, isAnchor: s.isAnchor })),
    readers: users
      .map((u) => ({
        uid: u.uid,
        name: u.displayName || u.email,
        contact: u.email,
        alias: u.alias,
        public: !!u.public,
        nativeReader: u.nativeReader ?? null,
        ageGroup: u.ageGroup ?? null,
        age: u.age ?? null,
        occupation: u.occupation ?? null,
        training: u.training ?? null,
        joinedAt: firstItem.get(u.uid) ?? u.createdAt,
      }))
      .sort((a, b) => b.joinedAt - a.joinedAt),
    items: assignments.map((a) => {
      const r = ratingByAssignment.get(a.id);
      return {
        id: a.id,
        raterId: a.raterId,
        sampleId: a.sampleId,
        kind: a.kind,
        status: a.status,
        batch: a.batch ?? 1,
        rating: r
          ? {
              overall: r.overall,
              legibility: r.legibility,
              liked: r.likedText,
              disliked: r.dislikedText,
              comment: r.comment,
              decoration: r.decoration ?? null,
              alterations: r.alterations ?? null,
              regions: r.regions,
              criterionScores: r.criterionScores,
              notApplicable: r.notApplicable ?? [],
              copyError: r.copyError ?? false,
              unscorable: r.unscorable ?? false,
              unscorableReason: r.unscorableReason ?? "",
              durationMs: r.durationMs,
              submittedAt: r.submittedAt,
            }
          : null,
      };
    }),
  };
}
