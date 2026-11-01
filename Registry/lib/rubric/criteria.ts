import type { Criterion, Script } from "../types";
import { CRITERIA as SI_CRITERIA } from "./si";
import { CRITERIA as TA_CRITERIA } from "./ta";

/**
 * The main-study criteria are fixed in code, not in the database, so every survey and export uses the same set.
 * Sinhala: Akshara Rubric v1 (24 Oct 2026), A1–A8. Tamil: Tamil rubric v0.3 (26 Oct 2026), C1–C8. Each 1–10.
 * IDs are the keys (a1…a8, c1…c8), which is also how ratings store criterion scores.
 */
export const RUBRIC_VERSION = 1;

export function rubricCriteria(script: Script): Criterion[] {
  return (script === "ta" ? TA_CRITERIA : SI_CRITERIA).map((c, i) => ({
    id: c.key,
    script,
    rubricVersion: RUBRIC_VERSION,
    key: c.key,
    labelEn: `${c.code} ${c.labelEn}`,
    labelLocal: c.label,
    description: c.lookFor,
    level: "paragraph",
    scaleMin: 1,
    scaleMax: 10,
    active: true,
    order: i + 1,
  }));
}
