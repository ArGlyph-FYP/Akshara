import type { Criterion, Script } from "../types";
import { COUNT_NAMES_EN, LEVEL_NAMES_EN, CRITERIA as SI_CRITERIA, RUBRIC_VERSION as SI_RUBRIC_VERSION } from "./si";
import { CRITERIA as TA_CRITERIA } from "./ta";

/**
 * The main-study criteria are fixed in code, not in the database, so every survey and export uses the same set.
 * Sinhala: rubric v_final (11 Nov 2026; stored as version 12, same answers as v12): A1–A5, A7, A8 on five levels (1 = Very weak … 5 = Excellent) and
 * A6a–A6c on four (0 = None … 3 = Many). Tamil: rubric v0.3 (26 Oct 2026), C1–C8, each 1–10.
 * IDs are the keys (a1…a8, a6a…a6c, c1…c8), which is also how ratings store criterion scores.
 */
export const RUBRIC_VERSIONS: Record<Script, number> = { si: SI_RUBRIC_VERSION, ta: 1 };
export const rubricVersionFor = (script: Script) => RUBRIC_VERSIONS[script];

/** Level names from the lowest stored value up. */
const LEVELS_LOW_FIRST = [...LEVEL_NAMES_EN].reverse();

export function rubricCriteria(script: Script): Criterion[] {
  const base = { script, rubricVersion: RUBRIC_VERSIONS[script], level: "paragraph" as const, active: true };
  if (script === "ta") {
    return TA_CRITERIA.map((c, i) => ({
      ...base,
      id: c.key,
      key: c.key,
      labelEn: `${c.code} ${c.labelEn}`,
      labelLocal: c.label,
      description: c.lookFor,
      scaleMin: 1,
      scaleMax: 10,
      order: i + 1,
    }));
  }
  return SI_CRITERIA.map((c, i) => {
    const count = c.kind === "count";
    return {
      ...base,
      id: c.key,
      key: c.key,
      labelEn: `${c.code} ${c.labelEn}`,
      labelLocal: c.label,
      description: c.lookFor,
      scaleMin: count ? 0 : 1,
      scaleMax: count ? 3 : 5,
      levels: count ? [...COUNT_NAMES_EN] : LEVELS_LOW_FIRST,
      order: i + 1,
    };
  });
}
