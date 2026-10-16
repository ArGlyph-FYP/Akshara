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
  overallScale: Scale;
  legibilityScale: Scale;
  surveyScale: Scale;
  ratersPerSample: number;
  /** Fraction (0–1) of each rater's items re-shown later as blinded repeats. */
  repeatFraction: number;
  rubricVersion: Record<Script, number>;
}

export const DEFAULT_SETTINGS: Settings = {
  overallScale: { min: 1, max: 7 },
  legibilityScale: { min: 1, max: 5 },
  surveyScale: { min: 1, max: 7 },
  ratersPerSample: 3,
  repeatFraction: 0.1,
  rubricVersion: { si: 1, ta: 1 },
};

export type AssignmentKind = "anchor" | "normal" | "repeat";

export interface Assignment {
  id: string;
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
  assignmentId: string;
  raterId: string;
  sampleId: string;
  script: Script;
  kind: AssignmentKind;
  overall: number;
  legibility: number;
  criterionScores: Record<string, number>;
  regions: Region[];
  comment: string;
  durationMs: number;
  rubricVersion: number;
  submittedAt: number;
}

export interface Survey {
  id: string;
  script: Script;
  title: string;
  instructions: string;
  shareToken: string;
  open: boolean;
  sampleIds: string[];
  createdAt: number;
}

export interface SurveyReader {
  uid: string;
  nativeReader: boolean;
  adultConfirmed: boolean;
  consentedAt: number;
}

export interface SurveyResponse {
  respondentUid: string;
  sampleId: string;
  overall: number;
  likedText: string;
  dislikedText: string;
  durationMs: number;
  submittedAt: number;
}
