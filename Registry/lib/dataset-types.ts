import type { Phase, SampleStatus, StudyType } from "./types";

/** "Not rated" = no completed ratings yet; "in progress" = some done, some pending; "rated" = all assigned done. */
export type RatingState = "not_rated" | "in_progress" | "rated";

export interface SampleRow {
  id: string;
  code: string;
  pageNo: number;
  phase: Phase;
  status: SampleStatus;
  isAnchor: boolean;
  writerId: string;
  uploadedAt: number;
  assigned: number;
  done: number;
  rating: RatingState;
  studyIds: string[];
}

export interface StudyRef {
  id: string;
  title: string;
  type: StudyType;
  open: boolean;
}

export const RATING_LABEL: Record<RatingState, string> = {
  not_rated: "Not rated",
  in_progress: "In progress",
  rated: "Fully rated",
};

export const QC_LABEL: Record<SampleStatus, string> = {
  uploaded: "Unchecked",
  qc_ok: "Approved",
  rejected: "Rejected",
  excluded: "Withdrawn",
};

/** sessionStorage key used to hand a Dataset selection to the new-study wizard. */
export const PICK_KEY = "akshara:pickedSamples";
