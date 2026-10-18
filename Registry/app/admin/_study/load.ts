import "server-only";
import { getSettings, listAssignments, listCriteria, listRatings, listSamples, listStudies, listUsers } from "@/lib/data";
import { datasetRows } from "@/lib/dataset";
import type { SampleRow, StudyRef } from "@/lib/dataset-types";
import type { AssignmentKind, Criterion, Region, Script, Study, StudyType } from "@/lib/types";

export interface ReaderInfo {
  uid: string;
  name: string;
  contact: string;
  alias: string;
  public: boolean;
  nativeReader: boolean | null;
  ageGroup: string | null;
  joinedAt: number;
}

export interface ResponseInfo {
  overall: number;
  legibility: number | null;
  liked: string;
  disliked: string;
  comment: string;
  regions: Region[];
  criterionScores: Record<string, number>;
  durationMs: number;
  submittedAt: number;
}

export interface ItemInfo {
  id: string;
  raterId: string;
  sampleId: string;
  kind: AssignmentKind;
  status: "pending" | "done";
  rating: ResponseInfo | null;
}

export interface StudyPageData {
  script: Script;
  type: StudyType;
  /** The study shown (the newest of this type unless another round is picked); null = not started yet. */
  study: Study | null;
  /** Every study of this type for the script, newest first (normally just one). */
  rounds: { id: string; title: string; createdAt: number }[];
  /** Samples that can be added (not withdrawn or rejected). */
  rows: SampleRow[];
  refs: StudyRef[];
  criteria: Criterion[];
  rubricVersion: number;
  samples: { id: string; code: string; pageNo: number; isAnchor: boolean }[];
  readers: ReaderInfo[];
  items: ItemInfo[];
}

export async function loadStudyPage(script: Script, type: StudyType, id?: string): Promise<StudyPageData> {
  const [all, { rows, studies: refs }, criteria, settings] = await Promise.all([
    listStudies(script),
    datasetRows(script),
    listCriteria(script),
    getSettings(),
  ]);
  const rounds = all.filter((s) => s.type === type);
  const study = rounds.find((s) => s.id === id) ?? rounds[0] ?? null;
  const base = {
    script,
    type,
    study,
    rounds: rounds.map((s) => ({ id: s.id, title: s.title, createdAt: s.createdAt })),
    rows: rows.filter((r) => r.status !== "excluded" && r.status !== "rejected"),
    refs,
    criteria,
    rubricVersion: settings.rubricVersion[script],
  };
  if (!study) return { ...base, samples: [], readers: [], items: [] };

  const [assignments, ratings, samples, users] = await Promise.all([
    listAssignments({ studyId: study.id }),
    listRatings({ studyId: study.id }),
    listSamples({ script }),
    listUsers(),
  ]);
  const inStudy = new Set(study.sampleIds);
  const ratingByAssignment = new Map(ratings.map((r) => [r.assignmentId, r]));
  const readerIds = new Set(assignments.map((a) => a.raterId));
  const firstItem = new Map<string, number>();
  for (const a of assignments) firstItem.set(a.raterId, Math.min(firstItem.get(a.raterId) ?? Infinity, a.createdAt));

  return {
    ...base,
    samples: samples
      .filter((s) => inStudy.has(s.id))
      .map((s) => ({ id: s.id, code: s.participantCode, pageNo: s.pageNo, isAnchor: s.isAnchor })),
    readers: users
      .filter((u) => readerIds.has(u.uid))
      .map((u) => ({
        uid: u.uid,
        name: u.displayName || u.email,
        contact: u.email,
        alias: u.alias,
        public: !!u.public,
        nativeReader: u.nativeReader ?? null,
        ageGroup: u.ageGroup ?? null,
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
        rating: r
          ? {
              overall: r.overall,
              legibility: r.legibility,
              liked: r.likedText,
              disliked: r.dislikedText,
              comment: r.comment,
              regions: r.regions,
              criterionScores: r.criterionScores,
              durationMs: r.durationMs,
              submittedAt: r.submittedAt,
            }
          : null,
      };
    }),
  };
}
