import { describe, expect, it } from "vitest";
import { compareSamples, parseFormCode, sampleLabel } from "@/lib/codes";
import { detectForm, type Box } from "@/lib/form-split";

const W = 620;
const H = 877; // A4 proportions

/** A blank page with the form's printed rules and a writing box at y 316–819, x 54–584. */
function page() {
  const px = new Uint8Array(W * H).fill(250);
  const fill = (x0: number, y0: number, x1: number, y1: number, v = 30) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px[y * W + x] = v;
  };
  const hline = (y: number, x0 = 54, x1 = 584) => fill(x0, y, x1, y + 2, 120);
  const vline = (x: number, y0: number, y1: number) => fill(x, y0, x + 2, y1, 120);
  hline(90, 30, 590); // header rule
  hline(115); // printed sample-text box
  hline(290);
  vline(54, 115, 290);
  vline(584, 115, 290);
  hline(316); // writing box
  hline(819);
  vline(54, 316, 820);
  vline(584, 316, 820);
  /** Fake handwriting: words on lines `lineH` apart, touching like real ascenders and descenders. */
  const writing = (y0: number, y1: number, x1 = 560) => {
    for (let y = y0; y < y1; y += 14) for (let x = 70; x < x1; x += 40) fill(x, y, x + 30, Math.min(y + 13, y1), 60);
  };
  return { px, writing };
}

const inside = (b: Box, y: number) => y / H >= b.y && y / H <= b.y + b.h;

describe("detectForm", () => {
  it("splits two paragraphs at the blank line", () => {
    const { px, writing } = page();
    writing(330, 430);
    writing(462, 580, 500);
    const r = detectForm(px, W, H);
    expect(r.confidence).toBe("ok");
    expect(r.note).toBeNull();
    const [p1, p2] = r.parts;
    expect(inside(p1, 331) && inside(p1, 429)).toBe(true);
    expect(inside(p1, 462)).toBe(false);
    expect(inside(p2, 463) && inside(p2, 579)).toBe(true);
    expect(inside(p2, 429)).toBe(false);
    // Boxes stay inside the writing box borders.
    for (const b of r.parts) {
      expect(b.x * W).toBeGreaterThan(55);
      expect((b.x + b.w) * W).toBeLessThan(584);
    }
    // Paragraph 2 is narrower, so its box is too.
    expect(p2.w).toBeLessThan(p1.w);
  });

  it("flags a page with no blank line between paragraphs", () => {
    const { px, writing } = page();
    writing(330, 580);
    const r = detectForm(px, W, H);
    expect(r.confidence).toBe("check");
    expect(r.note).toMatch(/No blank line/);
    expect(r.parts[0].y).toBeLessThan(r.parts[1].y);
  });

  it("falls back to the form layout on a blank page", () => {
    const r = detectForm(new Uint8Array(W * H).fill(255), W, H);
    expect(r.confidence).toBe("check");
    expect(r.note).toMatch(/Writing box not found/);
    expect(r.writing.y).toBeGreaterThan(0.3);
  });
});

describe("form codes", () => {
  it.each([
    ["S001", "si", "SI-001"],
    ["SI-S001", "si", "SI-001"],
    ["si - s001", "si", "SI-001"],
    ["1", "si", "SI-001"],
    ["042", "ta", "TA-042"],
    ["T014", "ta", "TA-014"],
    ["TA-14", "si", "TA-014"],
  ] as const)("reads %s", (raw, script, code) => {
    expect(parseFormCode(raw, script)).toBe(code);
  });

  it.each(["", "S", "0", "SI-", "AB-001", "S001x"])("rejects %j", (raw) => {
    expect(parseFormCode(raw, "si")).toBeNull();
  });

  it("labels and sorts paragraphs", () => {
    expect(sampleLabel({ code: "SI-001", pageNo: 1 })).toBe("SI-001");
    expect(sampleLabel({ code: "SI-001", pageNo: 1, part: 2 })).toBe("SI-001-2");
    expect(sampleLabel({ code: "SI-001", pageNo: 2, part: null })).toBe("SI-001 p2");
    const rows = [
      { participantCode: "SI-002", pageNo: 1, part: 1 },
      { participantCode: "SI-001", pageNo: 1, part: 2 },
      { participantCode: "SI-001", pageNo: 1, part: 1 },
    ];
    expect(rows.sort(compareSamples).map((r) => sampleLabel({ code: r.participantCode, ...r }))).toEqual(["SI-001-1", "SI-001-2", "SI-002-1"]);
  });
});
