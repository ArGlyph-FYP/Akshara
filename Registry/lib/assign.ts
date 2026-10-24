import { seededRandom, shuffle } from "./random";
import type { AssignmentKind } from "./types";

export interface AssignSample {
  id: string;
  isAnchor: boolean;
}

export interface ExistingAssignment {
  raterId: string;
  sampleId: string;
  kind: AssignmentKind;
  position: number;
}

export interface NewAssignment {
  raterId: string;
  sampleId: string;
  kind: AssignmentKind;
  position: number;
}

export interface AssignInput {
  /** Samples of one script that are ready to rate. */
  samples: AssignSample[];
  /** Active raters for that script. */
  raterIds: string[];
  existing: ExistingAssignment[];
  ratersPerSample: number;
  /** 0–0.5: share of each rater's new items repeated later, blinded. */
  repeatFraction: number;
  seed: string;
  /** Minimum number of items between an item and its repeat. */
  minRepeatGap?: number;
}

export interface AssignResult {
  assignments: NewAssignment[];
  warnings: string[];
}

/**
 * Plans new rating assignments for one script, adding to what already exists:
 * - every rater gets each calibration anchor (first in their new batch)
 * - each non-anchor sample is topped up to `ratersPerSample` distinct raters, least-loaded raters first
 * - a share of each rater's new items is repeated later in their queue (kind "repeat")
 * The plan is deterministic for a given seed.
 */
export function planAssignments(input: AssignInput): AssignResult {
  const rand = seededRandom(input.seed);
  const gap = input.minRepeatGap ?? 5;
  const repeatFraction = Math.min(Math.max(input.repeatFraction, 0), 0.5);
  const warnings: string[] = [];
  const raterIds = [...new Set(input.raterIds)];

  if (raterIds.length === 0) {
    return { assignments: [], warnings: ["No active raters for this script."] };
  }

  const has = new Set<string>(); // raterId:sampleId for anchor/normal items
  const coverage = new Map<string, Set<string>>(); // sampleId -> raters (normal)
  const load = new Map<string, number>(raterIds.map((r) => [r, 0]));
  const maxPos = new Map<string, number>(raterIds.map((r) => [r, -1]));

  for (const a of input.existing) {
    maxPos.set(a.raterId, Math.max(maxPos.get(a.raterId) ?? -1, a.position));
    if (a.kind === "repeat") continue;
    has.add(`${a.raterId}:${a.sampleId}`);
    if (a.kind === "normal") {
      if (!coverage.has(a.sampleId)) coverage.set(a.sampleId, new Set());
      coverage.get(a.sampleId)!.add(a.raterId);
      if (load.has(a.raterId)) load.set(a.raterId, load.get(a.raterId)! + 1);
    }
  }

  const newAnchors = new Map<string, string[]>(raterIds.map((r) => [r, []]));
  const newNormals = new Map<string, string[]>(raterIds.map((r) => [r, []]));

  for (const s of input.samples.filter((s) => s.isAnchor)) {
    for (const r of raterIds) {
      if (!has.has(`${r}:${s.id}`)) newAnchors.get(r)!.push(s.id);
    }
  }

  const target = Math.max(1, Math.floor(input.ratersPerSample));
  let short = 0;
  for (const s of shuffle(input.samples.filter((s) => !s.isAnchor), rand)) {
    const covered = coverage.get(s.id) ?? new Set<string>();
    const need = target - covered.size;
    if (need <= 0) continue;
    const candidates = raterIds
      .filter((r) => !covered.has(r) && !has.has(`${r}:${s.id}`))
      .map((r) => ({ r, load: load.get(r)!, tie: rand() }))
      .sort((a, b) => a.load - b.load || a.tie - b.tie)
      .slice(0, need);
    if (candidates.length < need) short++;
    for (const { r } of candidates) {
      newNormals.get(r)!.push(s.id);
      load.set(r, load.get(r)! + 1);
    }
  }
  if (short > 0) {
    warnings.push(
      `${short} sample(s) could not reach ${target} raters because only ${raterIds.length} rater(s) are available.`,
    );
  }

  const assignments: NewAssignment[] = [];
  for (const r of raterIds) {
    const anchors = newAnchors.get(r)!;
    const normals = shuffle(newNormals.get(r)!, rand);
    const seq: { sampleId: string; kind: AssignmentKind }[] = [
      ...anchors.map((id) => ({ sampleId: id, kind: "anchor" as const })),
      ...normals.map((id) => ({ sampleId: id, kind: "normal" as const })),
    ];

    // Repeat originals come from the first half of the normal items so there is room for a gap.
    const repeatCount = Math.round(normals.length * repeatFraction);
    const firstHalf = normals.slice(0, Math.ceil(normals.length / 2));
    const repeats = shuffle(firstHalf, rand).slice(0, repeatCount);
    for (const sampleId of repeats) {
      const orig = seq.findIndex((x) => x.sampleId === sampleId && x.kind === "normal");
      const earliest = Math.min(orig + gap + 1, seq.length);
      const at = earliest + Math.floor(rand() * (seq.length - earliest + 1));
      seq.splice(at, 0, { sampleId, kind: "repeat" });
    }

    const base = maxPos.get(r)! + 1;
    seq.forEach((x, i) => assignments.push({ raterId: r, sampleId: x.sampleId, kind: x.kind, position: base + i }));
  }

  return { assignments, warnings };
}

/**
 * Manual mode: every chosen rater gets every chosen sample they don't already have in this study.
 * Anchors go first, the rest in a per-rater random order, appended after each rater's existing queue.
 */
export function planAllToAll(input: {
  samples: AssignSample[];
  raterIds: string[];
  existing: ExistingAssignment[];
  seed: string;
}): NewAssignment[] {
  const rand = seededRandom(input.seed);
  const out: NewAssignment[] = [];
  for (const r of [...new Set(input.raterIds)]) {
    const mine = input.existing.filter((a) => a.raterId === r);
    const have = new Set(mine.filter((a) => a.kind !== "repeat").map((a) => a.sampleId));
    const base = mine.reduce((m, a) => Math.max(m, a.position), -1) + 1;
    const todo = input.samples.filter((s) => !have.has(s.id));
    const ordered = [
      ...todo.filter((s) => s.isAnchor),
      ...shuffle(todo.filter((s) => !s.isAnchor), rand),
    ];
    ordered.forEach((s, i) =>
      out.push({ raterId: r, sampleId: s.id, kind: s.isAnchor ? "anchor" : "normal", position: base + i }),
    );
  }
  return out;
}

/**
 * Public link: plans one new reader's queue. Calibration anchors they haven't seen come first (kind "anchor").
 * Other samples are chosen least-covered first (random among ties), so every sample collects as many readers
 * as possible; `perReader` caps them (null = all) and their order is shuffled. With `repeatFraction`, a share of
 * those items is shown again later in the queue, blinded (kind "repeat"), at least `minRepeatGap` items apart.
 */
export function planForNewReader(input: {
  samples: AssignSample[];
  readerId: string;
  existing: ExistingAssignment[];
  perReader: number | null;
  seed: string;
  repeatFraction?: number;
  minRepeatGap?: number;
}): NewAssignment[] {
  const rand = seededRandom(input.seed);
  const coverage = new Map(input.samples.map((s) => [s.id, 0]));
  for (const a of input.existing) {
    if (a.kind !== "repeat" && coverage.has(a.sampleId)) coverage.set(a.sampleId, coverage.get(a.sampleId)! + 1);
  }
  const mine = new Set(input.existing.filter((a) => a.raterId === input.readerId).map((a) => a.sampleId));
  const fresh = input.samples.filter((s) => !mine.has(s.id));
  const anchors = fresh.filter((s) => s.isAnchor);
  const candidates = fresh
    .filter((s) => !s.isAnchor)
    .map((s) => ({ s, cov: coverage.get(s.id)!, tie: rand() }))
    .sort((a, b) => a.cov - b.cov || a.tie - b.tie);
  const n = input.perReader && input.perReader > 0 ? Math.min(input.perReader, candidates.length) : candidates.length;
  const normals = shuffle(candidates.slice(0, n).map((c) => c.s.id), rand);

  const seq: { sampleId: string; kind: AssignmentKind }[] = [
    ...anchors.map((s) => ({ sampleId: s.id, kind: "anchor" as const })),
    ...normals.map((id) => ({ sampleId: id, kind: "normal" as const })),
  ];
  const gap = input.minRepeatGap ?? 5;
  const repeatCount = Math.round(normals.length * Math.min(Math.max(input.repeatFraction ?? 0, 0), 0.5));
  for (const sampleId of shuffle(normals.slice(0, Math.ceil(normals.length / 2)), rand).slice(0, repeatCount)) {
    const orig = seq.findIndex((x) => x.sampleId === sampleId && x.kind === "normal");
    const earliest = Math.min(orig + gap + 1, seq.length);
    const at = earliest + Math.floor(rand() * (seq.length - earliest + 1));
    seq.splice(at, 0, { sampleId, kind: "repeat" });
  }

  const base = input.existing.filter((a) => a.raterId === input.readerId).reduce((m, a) => Math.max(m, a.position), -1) + 1;
  return seq.map((x, i) => ({ raterId: input.readerId, sampleId: x.sampleId, kind: x.kind, position: base + i }));
}

export interface BatchSample {
  id: string;
  isAnchor: boolean;
  /** Paragraph number of a split form page: 1 = text 1, 2 = text 2 (null = whole page, treated as text 1). */
  part: number | null;
  writerId: string;
}

/** Items of a study, as far as coverage is concerned. */
export interface CoverageItem {
  raterId: string;
  sampleId: string;
  kind: AssignmentKind;
  status: "pending" | "done" | "skipped";
  position: number;
  createdAt: number;
  batch?: number;
}

export interface BatchItem extends NewAssignment {
  batch: number;
}

/** Pending items older than this no longer hold a sample's place (the reader most likely left). */
export const STALE_PENDING_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * How many readers each sample has: done ratings, plus pending items handed out recently.
 * Repeats and anchors don't count, and skipped items (reader recognised the writer) don't either.
 */
export function sampleCoverage(items: CoverageItem[], now: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of items) {
    if (a.kind !== "normal") continue;
    if (a.status === "skipped") continue;
    if (a.status === "pending" && now - a.createdAt > STALE_PENDING_MS) continue;
    out.set(a.sampleId, (out.get(a.sampleId) ?? 0) + 1);
  }
  return out;
}

/**
 * Main study: plans one reader's next form (default 10 samples).
 * - Half text 1 (part 1), half text 2 (part 2); if one text runs short the other fills in.
 * - Least-covered samples first, random among ties; samples at `maxPerSample` are not handed out.
 * - Avoids both paragraphs of one writer in the same form when other samples are available.
 * - Order: calibration anchors (first form only), then the text-1 block, then the text-2 block, each shuffled.
 *   A share of items (`repeatFraction`) is shown again, blinded, at the end of its own block.
 */
export function planBatch(input: {
  samples: BatchSample[];
  readerId: string;
  /** Every item of the study (all readers). */
  existing: CoverageItem[];
  batchSize: number;
  maxPerSample: number | null;
  seed: string;
  repeatFraction?: number;
  now: number;
}): BatchItem[] {
  const rand = seededRandom(input.seed);
  const coverage = sampleCoverage(input.existing, input.now);
  const mineAll = input.existing.filter((a) => a.raterId === input.readerId);
  const had = new Set(mineAll.map((a) => a.sampleId));
  const batch = mineAll.reduce((m, a) => Math.max(m, a.batch ?? 1), 0) + 1;
  const base = mineAll.reduce((m, a) => Math.max(m, a.position), -1) + 1;
  const size = Math.max(1, Math.floor(input.batchSize));
  const cap = input.maxPerSample && input.maxPerSample > 0 ? input.maxPerSample : Infinity;

  const anchors = batch === 1 ? input.samples.filter((s) => s.isAnchor && !had.has(s.id)) : [];
  const open = input.samples
    .filter((s) => !s.isAnchor && !had.has(s.id) && (coverage.get(s.id) ?? 0) < cap)
    .map((s) => ({ s, cov: coverage.get(s.id) ?? 0, tie: rand() }))
    .sort((a, b) => a.cov - b.cov || a.tie - b.tie)
    .map((x) => x.s);
  const text1 = open.filter((s) => s.part !== 2);
  const text2 = open.filter((s) => s.part === 2);

  const writers = new Set<string>();
  const picked = new Set<string>();
  /** Takes up to n from a list in order, skipping writers already in the form unless `allowSameWriter`. */
  const take = (list: BatchSample[], n: number, allowSameWriter: boolean) => {
    const out: BatchSample[] = [];
    for (const s of list) {
      if (out.length >= n) break;
      if (picked.has(s.id)) continue;
      if (!allowSameWriter && writers.has(s.writerId)) continue;
      out.push(s);
      picked.add(s.id);
      writers.add(s.writerId);
    }
    return out;
  };
  const half1 = Math.ceil(size / 2);
  const half2 = size - half1;
  const a1 = take(text1, half1, false);
  const a2 = take(text2, half2, false);
  const missing = () => size - a1.length - a2.length;
  // Still short: allow the same writer, then let the other text fill the gap.
  a1.push(...take(text1, half1 - a1.length, true));
  a2.push(...take(text2, half2 - a2.length, true));
  for (const [list, got] of [[text1, a1], [text2, a2]] as const) {
    got.push(...take(list, missing(), false));
    got.push(...take(list, missing(), true));
  }

  const block1 = shuffle(a1.map((s) => s.id), rand);
  const block2 = shuffle(a2.map((s) => s.id), rand);
  const normals = [...block1, ...block2];
  if (normals.length === 0) return [];
  // Repeats come from the start of each block so a few items sit between an item and its repeat.
  const early = [...block1.slice(0, Math.max(0, block1.length - 2)), ...block2.slice(0, Math.max(0, block2.length - 2))];
  const repeatCount = Math.min(early.length, Math.round(normals.length * Math.min(Math.max(input.repeatFraction ?? 0, 0), 0.5)));
  const repeats = new Set(shuffle(early, rand).slice(0, repeatCount));

  type Step = { sampleId: string; kind: AssignmentKind };
  const blockSeq = (ids: string[]): Step[] => [
    ...ids.map((id) => ({ sampleId: id, kind: "normal" as const })),
    ...ids.filter((id) => repeats.has(id)).map((id) => ({ sampleId: id, kind: "repeat" as const })),
  ];
  const seq: Step[] = [
    ...anchors.map((s) => ({ sampleId: s.id, kind: "anchor" as const })),
    ...blockSeq(block1),
    ...blockSeq(block2),
  ];
  return seq.map((x, i) => ({ raterId: input.readerId, sampleId: x.sampleId, kind: x.kind, position: base + i, batch }));
}
