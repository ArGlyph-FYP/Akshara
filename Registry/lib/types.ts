export const SCRIPTS = ["si", "ta"] as const;
export type Script = (typeof SCRIPTS)[number];

export const SCRIPT_LABEL: Record<Script, string> = { si: "Sinhala", ta: "Tamil" };
export const SCRIPT_PREFIX: Record<Script, "SI" | "TA"> = { si: "SI", ta: "TA" };

export type Role = "admin" | "rater";
export type Phase = "pilot" | "main";

export interface UserDoc {
  email: string;
  displayName: string;
  role: Role;
  scripts: Script[];
  active: boolean;
  /** Pseudonymous rater label used in exports, e.g. "R03". */
  alias: string;
  createdAt: number;
  /** Joined through a study's public link (no password; tied to this browser). */
  public?: boolean;
  /** Self-reported at sign-up via a public link. */
  nativeReader?: boolean | null;
  ageGroup?: string | null;
  consentedAt?: number | null;
}

export interface Participant {
  code: string;
  script: Script;
  phase: Phase;
  consentReceivedAt: number | null;
  consentVerifiedBy: string | null;
  status: "active" | "withdrawn";
  withdrawnAt: number | null;
  /** Random, stable ID used in public exports instead of the code. */
  writerId: string;
  notes: string;
  createdAt: number;
}

export type SampleStatus = "uploaded" | "qc_ok" | "rejected" | "excluded";

export interface Sample {
  id: string;
  participantCode: string;
  writerId: string;
  script: Script;
  phase: Phase;
  pageNo: number;
  imagePath: string | null;
  /** Small JPEG preview for grids; null for older uploads (the full image is used instead). */
  thumbPath?: string | null;
  contentType: string;
  width: number;
  height: number;
  status: SampleStatus;
  isAnchor: boolean;
  /** Reference scores shown to raters after rating a calibration anchor. */
  anchorScores: { overall: number | null; legibility: number | null; note: string } | null;
  uploadedAt: number;
  uploadedBy: string;
}

export type Level = "akshara" | "word" | "line" | "paragraph";
export const LEVELS: Level[] = ["akshara", "word", "line", "paragraph"];

export interface Criterion {
  id: string;
  script: Script;
  rubricVersion: number;
  key: string;
  labelEn: string;
  labelLocal: string;
  description: string;
  level: Level;
  scaleMin: number;
  scaleMax: number;
  active: boolean;
  order: number;
}

export interface Scale {
  min: number;
  max: number;
}

export interface Settings {
  /** Current rubric version per script; rubric studies pin the version they were created with. */
  rubricVersion: Record<Script, number>;
}

export const DEFAULT_SETTINGS: Settings = { rubricVersion: { si: 1, ta: 1 } };

export const DEFAULT_SCALES = {
  overall: { min: 1, max: 7 } as Scale,
  legibility: { min: 1, max: 5 } as Scale,
};

/** perception = Phase A (score + open-text reasons); rubric = Phase C (overall, legibility, criteria, regions). */
export type StudyType = "perception" | "rubric";
export const STUDY_LABEL: Record<StudyType, string> = { perception: "Perception", rubric: "Rubric rating" };

export interface Study {
  id: string;
  script: Script;
  type: StudyType;
  title: string;
  instructions: string;
  sampleIds: string[];
  open: boolean;
  overallScale: Scale;
  /** Rubric studies only. */
  legibilityScale: Scale | null;
  rubricVersion: number | null;
  /** Public sign-up link: anyone with /join/{publicToken} can become a reader of this study. */
  publicToken?: string | null;
  publicOpen?: boolean;
  /** Samples each public reader gets (null = all of the study's samples). Least-covered samples go first. */
  perReader?: number | null;
  createdAt: number;
}

export type AssignmentKind = "anchor" | "normal" | "repeat";

export interface Assignment {
  id: string;
  studyId: string;
  raterId: string;
  sampleId: string;
  script: Script;
  kind: AssignmentKind;
  position: number;
  status: "pending" | "done";
  createdAt: number;
}

export interface Region {
  criterionId: string;
  /** Normalised 0–1 coordinates relative to the full image. */
  x: number;
  y: number;
  w: number;
  h: number;
  note: string;
}

export interface Rating {
  id: string;
  studyId: string;
  studyType: StudyType;
  assignmentId: string;
  raterId: string;
  sampleId: string;
  script: Script;
  kind: AssignmentKind;
  overall: number;
  /** Rubric studies only. */
  legibility: number | null;
  criterionScores: Record<string, number>;
  regions: Region[];
  /** Perception studies only. */
  likedText: string;
  dislikedText: string;
  comment: string;
  durationMs: number;
  rubricVersion: number | null;
  submittedAt: number;
}
