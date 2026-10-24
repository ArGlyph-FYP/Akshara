import { describe, expect, it } from "vitest";
import { STALE_PENDING_MS, planBatch, sampleCoverage, type BatchSample, type CoverageItem } from "@/lib/assign";

const NOW = 1_000_000_000_000;

/** n writers, each with paragraph 1 and paragraph 2 (ids w0-1, w0-2, …). */
function writers(n: number, anchors: string[] = []): BatchSample[] {
  return Array.from({ length: n }, (_, i) =>
    [1, 2].map((part) => ({ id: `w${i}-${part}`, part, writerId: `w${i}`, isAnchor: anchors.includes(`w${i}-${part}`) })),
  ).flat();
}

const done = (raterId: string, sampleId: string, extra: Partial<CoverageItem> = {}): CoverageItem => ({
  raterId,
  sampleId,
  kind: "normal",
  status: "done",
  position: 0,
  createdAt: NOW - 1000,
  batch: 1,
  ...extra,
});

const base = { batchSize: 10, maxPerSample: 10, seed: "t", now: NOW, readerId: "me" };

describe("planBatch", () => {
  it("gives 5 of text 1, then 5 of text 2", () => {
    const plan = planBatch({ ...base, samples: writers(20), existing: [] });
    expect(plan).toHaveLength(10);
    const parts = plan.map((a) => a.sampleId.endsWith("-2") ? 2 : 1);
    expect(parts).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
    expect(plan.every((a) => a.batch === 1 && a.kind === "normal")).toBe(true);
    expect(plan.map((a) => a.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("avoids both paragraphs of one writer in a form", () => {
    const plan = planBatch({ ...base, samples: writers(20), existing: [] });
    const ws = plan.map((a) => a.sampleId.split("-")[0]);
    expect(new Set(ws).size).toBe(10);
  });

  it("picks the least-rated samples first", () => {
    const samples = writers(10);
    // Everything except w0-1..w4-1 and w5-2..w9-2 already has 3 ratings.
    const fresh = new Set([0, 1, 2, 3, 4].map((i) => `w${i}-1`).concat([5, 6, 7, 8, 9].map((i) => `w${i}-2`)));
    const existing = samples.filter((s) => !fresh.has(s.id)).flatMap((s) => ["a", "b", "c"].map((r) => done(r, s.id)));
    const plan = planBatch({ ...base, samples, existing });
    expect(new Set(plan.map((a) => a.sampleId))).toEqual(fresh);
  });

  it("never hands out a sample at the cap", () => {
    const samples = writers(3);
    const existing = ["a", "b"].flatMap((r) => samples.filter((s) => s.id !== "w0-1").map((s) => done(r, s.id)));
    const plan = planBatch({ ...base, samples, existing, maxPerSample: 2 });
    expect(plan.map((a) => a.sampleId)).toEqual(["w0-1"]);
  });

  it("returns nothing when every sample is full", () => {
    const samples = writers(2);
    const existing = samples.map((s) => done("a", s.id));
    expect(planBatch({ ...base, samples, existing, maxPerSample: 1 })).toEqual([]);
  });

  it("ignores stale pending items and skipped items for coverage", () => {
    const cov = sampleCoverage(
      [
        done("a", "s1"),
        done("b", "s1", { status: "pending", createdAt: NOW - 1000 }),
        done("c", "s1", { status: "pending", createdAt: NOW - STALE_PENDING_MS - 1 }),
        done("d", "s1", { status: "skipped" }),
        done("e", "s1", { kind: "repeat" }),
      ],
      NOW,
    );
    expect(cov.get("s1")).toBe(2);
  });

  it("never repeats a sample across a reader's forms and numbers the next form", () => {
    const samples = writers(20);
    const first = planBatch({ ...base, samples, existing: [] });
    const existing = first.map((a) => done("me", a.sampleId, { position: a.position }));
    const second = planBatch({ ...base, samples, existing, seed: "u" });
    expect(second).toHaveLength(10);
    expect(second.every((a) => a.batch === 2)).toBe(true);
    expect(second[0].position).toBe(10);
    const firstIds = new Set(first.map((a) => a.sampleId));
    expect(second.some((a) => firstIds.has(a.sampleId))).toBe(false);
  });

  it("fills from the other text when one runs short", () => {
    const samples = writers(10).filter((s) => s.part === 1 || ["w0-2", "w1-2"].includes(s.id));
    const plan = planBatch({ ...base, samples, existing: [] });
    expect(plan).toHaveLength(10);
    expect(plan.filter((a) => a.sampleId.endsWith("-2"))).toHaveLength(2);
    // Text-1 block still comes first.
    expect(plan.slice(0, 8).every((a) => a.sampleId.endsWith("-1"))).toBe(true);
  });

  it("puts anchors first in the first form only, outside the 10", () => {
    const samples = writers(20, ["w19-1"]);
    const plan = planBatch({ ...base, samples, existing: [] });
    expect(plan[0]).toMatchObject({ sampleId: "w19-1", kind: "anchor" });
    expect(plan.filter((a) => a.kind === "normal")).toHaveLength(10);
    const existing = plan.map((a) => done("me", a.sampleId, { position: a.position, kind: a.kind }));
    expect(planBatch({ ...base, samples, existing }).some((a) => a.kind === "anchor")).toBe(false);
  });

  it("adds a blinded repeat at the end of its own block", () => {
    const plan = planBatch({ ...base, samples: writers(20), existing: [], repeatFraction: 0.1 });
    const rep = plan.filter((a) => a.kind === "repeat");
    expect(rep).toHaveLength(1);
    const at = plan.indexOf(rep[0]);
    const orig = plan.findIndex((a) => a.sampleId === rep[0].sampleId && a.kind === "normal");
    expect(at - orig).toBeGreaterThan(2);
    const sameText = (id: string) => id.slice(-1);
    expect(sameText(plan[at - 1].sampleId)).toBe(sameText(rep[0].sampleId));
  });

  it("is deterministic for a seed", () => {
    const a = planBatch({ ...base, samples: writers(20), existing: [] });
    const b = planBatch({ ...base, samples: writers(20), existing: [] });
    expect(a).toEqual(b);
  });
});
