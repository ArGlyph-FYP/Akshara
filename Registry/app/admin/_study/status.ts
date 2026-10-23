import type { Study } from "@/lib/types";

/**
 * "open": anyone with the link can join; "full": no new readers, those who joined can finish;
 * "closed": nobody can rate.
 */
export type SurveyStatus = "open" | "full" | "closed";

export const surveyStatus = (s: Pick<Study, "open" | "publicOpen">): SurveyStatus => (!s.open ? "closed" : s.publicOpen ? "open" : "full");

export const STATUS: Record<SurveyStatus, { label: string; hint: string }> = {
  open: { label: "Open", hint: "Anyone with the link can join" },
  full: { label: "No new readers", hint: "People who joined can finish" },
  closed: { label: "Closed", hint: "Nobody can rate" },
};
