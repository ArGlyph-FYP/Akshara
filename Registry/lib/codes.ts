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

const alnum = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 8);
const idAlphabet = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);

/** Random writer ID, unrelated to the participant code. */
export const newWriterId = () => `w_${alnum()}`;
export const newId = () => idAlphabet();
export const newShareToken = customAlphabet("23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", 12);
