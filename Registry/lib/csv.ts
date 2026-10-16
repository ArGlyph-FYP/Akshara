type Cell = string | number | boolean | null | undefined;

function escape(v: Cell): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with a header row. UTF-8 BOM so Excel shows Sinhala/Tamil text correctly. */
export function toCsv(columns: string[], rows: Record<string, Cell>[]): string {
  const lines = [columns.map(escape).join(",")];
  for (const row of rows) lines.push(columns.map((c) => escape(row[c])).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
