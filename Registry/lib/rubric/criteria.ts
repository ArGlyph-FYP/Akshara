import type { Criterion, Script } from "../types";
import { CRITERIA } from "./si";

/**
 * The main-study criteria are fixed (Akshara Rubric v1, 24 Oct 2026): A1–A8, each 1–10.
 * They live in code, not in the database, so every survey and export uses the same eight.
 * IDs are the keys (a1…a8), which is also how ratings store criterion scores.
 */
export const RUBRIC_VERSION = 1;

export function rubricCriteria(script: Script): Criterion[] {
  return CRITERIA.map((c, i) => ({
    id: c.key,
    script,
    rubricVersion: RUBRIC_VERSION,
    key: c.key,
    labelEn: `${c.code} ${c.labelEn}`,
    // Tamil labels come with the Tamil rubric; until then Tamil forms show the English names.
    labelLocal: script === "si" ? c.label : "",
    description: script === "si" ? c.lookFor : "",
    level: "paragraph",
    scaleMin: 1,
    scaleMax: 10,
    active: true,
    order: i + 1,
  }));
}
