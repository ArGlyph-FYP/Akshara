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
