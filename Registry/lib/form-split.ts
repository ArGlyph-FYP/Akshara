/**
 * Finds the two handwritten paragraphs on a scanned Akshara form page.
 *
 * Works on a grayscale copy of the page (about 150 dpi is plenty) and returns boxes as fractions (0–1)
 * of the page, so they can be applied to the full-resolution scan. Steps:
 *  1. Find the printed horizontal rules; the writing box is the tallest gap between two of them.
 *  2. Find its left and right borders (long vertical lines).
 *  3. Inside the box, measure ink per row. The largest blank strip between ink is the paragraph break.
 *  4. Fit each paragraph's box to its ink, with a small margin.
 * Anything it can't find falls back to the form's printed layout and is flagged for checking.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FormLayout {
  /** Paragraph 1 and paragraph 2, as fractions of the page. */
  parts: [Box, Box];
  /** Where the participant code is written (top right). */
  code: Box;
  /** Inside of the writing box. */
  writing: Box;
  /** "check" when the split is a guess (no clear blank line, or the box wasn't found). */
  confidence: "ok" | "check";
  note: string | null;
}

/** Printed layout of the A4 form, used when detection fails. */
const TEMPLATE = {
  writing: { x: 0.092, y: 0.365, w: 0.846, h: 0.565 },
  code: { x: 0.74, y: 0.03, w: 0.23, h: 0.07 },
};

const LINE_DARK = 210; // printed rules can be faint grey in scans
const INK_DARK = 170; // pen strokes

/** Longest run of dark pixels along a line, bridging tiny gaps and tolerating a little skew. */
function longestRun(len: number, isDark: (i: number) => boolean, maxGap: number): number {
  let best = 0;
  let cur = 0;
  let miss = 0;
  for (let i = 0; i < len; i++) {
    if (isDark(i)) {
      cur += 1 + miss;
      miss = 0;
      if (cur > best) best = cur;
    } else if (++miss > maxGap) {
      cur = 0;
      miss = 0;
    }
  }
  return best;
}

/** Groups indexes that are close together; returns [start, end] for each group. */
function groups(idx: number[], maxGap: number): [number, number][] {
  const out: [number, number][] = [];
  for (const i of idx) {
    const last = out[out.length - 1];
    if (last && i - last[1] <= maxGap) last[1] = i;
    else out.push([i, i]);
  }
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function detectForm(gray: ArrayLike<number>, W: number, H: number): FormLayout {
  const dark = (x: number, y: number, t: number) => gray[y * W + x] < t;
  const notes: string[] = [];

  // 1. Horizontal rules. A pixel counts if any pixel within ±2 rows is dark, so slightly tilted lines still read as one run.
  const lineMask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) lineMask[i] = gray[i] < LINE_DARK ? 1 : 0;
  const R = 2;
  const gap = Math.max(2, Math.round(W * 0.003));
  const ruleRows: number[] = [];
  const band = new Uint8Array(W);
  for (let y = R; y < H - R; y++) {
    band.fill(0);
    for (let k = -R; k <= R; k++) {
      const off = (y + k) * W;
      for (let x = 0; x < W; x++) band[x] |= lineMask[off + x];
    }
    if (longestRun(W, (x) => band[x] === 1, gap) > W * 0.5) ruleRows.push(y);
  }
  const rules = groups(ruleRows, Math.round(H * 0.005)).map(([a, b]) => Math.round((a + b) / 2));

  let top = Math.round(TEMPLATE.writing.y * H);
  let bottom = Math.round((TEMPLATE.writing.y + TEMPLATE.writing.h) * H);
  let boxFound = false;
  let bestGap = 0;
  for (let i = 0; i + 1 < rules.length; i++) {
    const g = rules[i + 1] - rules[i];
    if (g > bestGap && g > H * 0.3) {
      bestGap = g;
      top = rules[i];
      bottom = rules[i + 1];
      boxFound = true;
    }
  }
  if (!boxFound) notes.push("Writing box not found; used the form layout");

  // 2. Left and right borders: columns with a long vertical run between the two rules.
  let left = Math.round(TEMPLATE.writing.x * W);
  let right = Math.round((TEMPLATE.writing.x + TEMPLATE.writing.w) * W);
  if (boxFound) {
    const span = bottom - top;
    const vgap = Math.max(2, Math.round(H * 0.003));
    const score = (x: number) =>
      longestRun(span, (i) => {
        const y = top + i;
        for (let k = -R; k <= R; k++) {
          const xx = x + k;
          if (xx >= 0 && xx < W && lineMask[y * W + xx]) return true;
        }
        return false;
      }, vgap);
    const pick = (from: number, to: number) => {
      let best = -1;
      let at = -1;
      for (let x = from; x < to; x++) {
        const s = score(x);
        if (s > best) {
          best = s;
          at = x;
        }
      }
      return best > span * 0.25 ? at : -1;
    };
    const l = pick(Math.round(W * 0.02), Math.round(W * 0.3));
    const r = pick(Math.round(W * 0.7), Math.round(W * 0.98));
    if (l >= 0) left = l;
    if (r >= 0) right = r;
  }

  // Step inside the border so its line isn't counted as ink.
  const inset = Math.max(3, Math.round(W * 0.007));
  const x0 = left + inset;
  const x1 = right - inset;
  const y0 = top + inset;
  const y1 = bottom - inset;

  // 3. Ink per row inside the box.
  const minInk = Math.max(3, Math.round((x1 - x0) * 0.003));
  const inkRows: number[] = [];
  for (let y = y0; y < y1; y++) {
    let n = 0;
    for (let x = x0; x < x1; x++) if (dark(x, y, INK_DARK)) n++;
    if (n >= minInk) inkRows.push(y);
  }
  // Touching lines of handwriting merge into one band; specks are dropped.
  const bands = groups(inkRows, Math.round(H * 0.006)).filter(([a, b]) => b - a >= H * 0.005);

  let split: { from: number; to: number };
  let confident = boxFound;
  if (bands.length >= 2) {
    const gaps = bands.slice(1).map((b, i) => ({ from: bands[i][1], to: b[0] }));
    const sorted = [...gaps].sort((a, b) => b.to - b.from - (a.to - a.from));
    split = sorted[0];
    const h = split.to - split.from;
    const second = sorted[1] ? sorted[1].to - sorted[1].from : 0;
    if (h < H * 0.012 || h < second * 1.5) {
      confident = false;
      notes.push("The blank line between paragraphs is unclear");
    }
  } else {
    confident = false;
    notes.push(bands.length ? "No blank line found between paragraphs" : "No handwriting found");
    const a = bands[0]?.[0] ?? y0;
    const b = bands[0]?.[1] ?? y1;
    const mid = Math.round((a + b) / 2);
    split = { from: mid, to: mid };
  }

  // 4. Fit each paragraph to its ink.
  const first = bands[0]?.[0] ?? y0;
  const last = bands[bands.length - 1]?.[1] ?? y1;
  const padY = Math.round(H * 0.008);
  const halfGap = Math.floor((split.to - split.from) / 2);
  const pad = Math.min(padY, Math.max(0, halfGap));
  const ranges: [number, number][] = [
    [clamp(first - padY, y0, y1), clamp(split.from + pad, y0, y1)],
    [clamp(split.to - pad, y0, y1), clamp(last + padY, y0, y1)],
  ];
  const padX = Math.round(W * 0.012);
  const parts = ranges.map(([a, b]) => {
    let lo = x1;
    let hi = x0;
    for (let x = x0; x < x1; x++) {
      for (let y = a; y < b; y++) {
        if (dark(x, y, INK_DARK)) {
          if (x < lo) lo = x;
          if (x > hi) hi = x;
          break;
        }
      }
    }
    if (hi < lo) {
      lo = x0;
      hi = x1;
    }
    const xa = clamp(lo - padX, x0, x1);
    const xb = clamp(hi + padX, x0, x1);
    return { x: xa / W, y: a / H, w: (xb - xa) / W, h: Math.max(1, b - a) / H };
  }) as [Box, Box];

  return {
    parts,
    code: TEMPLATE.code,
    writing: { x: x0 / W, y: y0 / H, w: (x1 - x0) / W, h: (y1 - y0) / H },
    confidence: confident ? "ok" : "check",
    note: notes.length ? notes.join(". ") : null,
  };
}

/** Converts RGBA pixels (canvas ImageData) to grayscale. */
export function toGray(rgba: ArrayLike<number>, W: number, H: number): Uint8Array {
  const out = new Uint8Array(W * H);
  for (let i = 0, j = 0; i < W * H; i++, j += 4) out[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  return out;
}
