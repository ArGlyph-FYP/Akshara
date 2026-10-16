import { normaliseCode } from "./codes";
import type { Script } from "./types";

export interface ParsedScanName {
  code: string;
  script: Script;
  pageNo: number;
  ext: "jpg" | "png";
}

/**
 * Parses bulk-upload filenames: `SI-001.jpg`, `TA-012_p2.png`, `si-7_P1.JPEG`.
 * Page defaults to 1. Returns null for anything else.
 */
export function parseScanFilename(filename: string): ParsedScanName | null {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const m = base.match(/^((?:SI|TA)-?\d{1,4})(?:_p(\d{1,2}))?\.(jpe?g|png)$/i);
  if (!m) return null;
  const code = normaliseCode(m[1]);
  if (!code) return null;
  const pageNo = m[2] ? Number(m[2]) : 1;
  if (pageNo < 1) return null;
  const ext = m[3].toLowerCase() === "png" ? "png" : "jpg";
  return { code: code.code, script: code.script, pageNo, ext };
}

export const ACCEPTED_TYPES: Record<string, "jpg" | "png"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};
