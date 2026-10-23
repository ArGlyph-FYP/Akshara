import { customAlphabet } from "nanoid";
import { SCRIPT_PREFIX, type Script } from "./types";

const CODE_RE = /^(SI|TA)-(\d{3,4})$/;

export function formatCode(script: Script, n: number): string {
  return `${SCRIPT_PREFIX[script]}-${String(n).padStart(3, "0")}`;
}

/** Normalises "si 7", "SI-007", "si-7" to "SI-007"; returns null if not a code. */
export function normaliseCode(raw: string): { code: string; script: Script; number: number } | null {
  const m = raw.trim().toUpperCase().replace(/\s+/g, "-").match(/^(SI|TA)-?(\d{1,4})$/);
  if (!m) return null;
  const script: Script = m[1] === "SI" ? "si" : "ta";
  const number = Number(m[2]);
  return { code: formatCode(script, number), script, number };
}

export function isCode(code: string): boolean {
  return CODE_RE.test(code);
}

/** Note on writers created automatically by a form upload; such a writer is removed again once it has no samples. */
export const AUTO_REGISTER_NOTE = "Registered during bulk upload";

const alnum = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 8);
const idAlphabet = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);

/** Random writer ID, unrelated to the participant code. */
export const newWriterId = () => `w_${alnum()}`;
export const newId = () => idAlphabet();
/**
 * Pseudonym for a survey-link reader, e.g. "R-K7M2QX". Random rather than numbered so that many people joining
 * at once don't all queue on one shared counter document.
 */
const aliasCode = customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZ", 6);
export const newReaderAlias = () => `R-${aliasCode()}`;
export const newPublicToken = customAlphabet("23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", 10);

/**
 * Reads the code as written on a paper form, where "SI -" is printed and the writer fills in the rest.
 * Accepts "SI-001", "SI-S001", "S001", "001" or "1"; `script` is used when no SI/TA prefix is given.
 */
export function parseFormCode(raw: string, script: Script): string | null {
  const m = raw.trim().toUpperCase().replace(/\s+/g, "").match(/^(?:(SI|TA)-?)?[ST]?-?(\d{1,4})$/);
  if (!m) return null;
  const n = Number(m[2]);
  if (!(n >= 1)) return null;
  return formatCode(m[1] === "TA" ? "ta" : m[1] === "SI" ? "si" : script, n);
}

/** Display name of a sample: "SI-001", "SI-001-2" for paragraph 2 of a split form, " p2" for later pages. */
export function sampleLabel(s: { code: string; pageNo: number; part?: number | null }): string {
  return `${s.code}${s.part ? `-${s.part}` : ""}${s.pageNo > 1 ? ` p${s.pageNo}` : ""}`;
}

/** Sort order for samples: code, then page, then paragraph. */
export function compareSamples(
  a: { participantCode: string; pageNo: number; part?: number | null },
  b: { participantCode: string; pageNo: number; part?: number | null },
): number {
  return a.participantCode.localeCompare(b.participantCode) || a.pageNo - b.pageNo || (a.part ?? 0) - (b.part ?? 0);
}
