import { describe, expect, it } from "vitest";
import { planAssignments, type NewAssignment } from "@/lib/assign";

const samples = (n: number, anchors = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, isAnchor: i < anchors }));
const raters = ["r1", "r2", "r3", "r4"];

function byRater(as: NewAssignment[]) {
  const m = new Map<string, NewAssignment[]>();
  for (const a of as) m.set(a.raterId, [...(m.get(a.raterId) ?? []), a]);
  for (const list of m.values()) list.sort((a, b) => a.position - b.position);
  return m;
}

describe("planAssignments", () => {
  it("gives every sample exactly N distinct raters", () => {
    const { assignments, warnings } = planAssignments({
      samples: samples(40),
      raterIds: raters,
      existing: [],
      ratersPerSample: 3,
      repeatFraction: 0,
      seed: "t",
    });
    expect(warnings).toEqual([]);
    const per = new Map<string, Set<string>>();
    for (const a of assignments) per.set(a.sampleId, (per.get(a.sampleId) ?? new Set()).add(a.raterId));
    expect(per.size).toBe(40);
    for (const set of per.values()) expect(set.size).toBe(3);
  });

  it("balances load across raters", () => {
    const { assignments } = planAssignments({
      samples: samples(40),
      raterIds: raters,
      existing: [],
      ratersPerSample: 3,
      repeatFraction: 0,
      seed: "t",
    });
    const counts = [...byRater(assignments).values()].map((l) => l.length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("puts anchors first for every rater", () => {
    const { assignments } = planAssignments({
      samples: samples(20, 2),
      raterIds: raters,
      existing: [],
      ratersPerSample: 2,
      repeatFraction: 0.1,
      seed: "t",
    });
    for (const list of byRater(assignments).values()) {
      expect(list.slice(0, 2).every((a) => a.kind === "anchor")).toBe(true);
      expect(list.filter((a) => a.kind === "anchor")).toHaveLength(2);
    }
  });

  it("adds the requested share of repeats, later in the queue and never adjacent", () => {
    const { assignments } = planAssignments({
      samples: samples(80),
      raterIds: raters,
      existing: [],
      ratersPerSample: 3,
      repeatFraction: 0.1,
      seed: "x",
      minRepeatGap: 5,
    });
    for (const list of byRater(assignments).values()) {
      const normals = list.filter((a) => a.kind === "normal");
      const repeats = list.filter((a) => a.kind === "repeat");
      expect(repeats.length).toBe(Math.round(normals.length * 0.1));
      for (const r of repeats) {
        const orig = list.findIndex((a) => a.sampleId === r.sampleId && a.kind === "normal");
        const rep = list.indexOf(r);
        expect(rep - orig).toBeGreaterThan(5);
      }
      // positions are contiguous
      list.forEach((a, i) => expect(a.position).toBe(i));
    }
  });

  it("only tops up what's missing when run again", () => {
    const first = planAssignments({
      samples: samples(10),
      raterIds: raters,
      existing: [],
      ratersPerSample: 2,
      repeatFraction: 0,
      seed: "a",
    });
    const again = planAssignments({
      samples: samples(12),
      raterIds: raters,
      existing: first.assignments,
      ratersPerSample: 2,
      repeatFraction: 0,
      seed: "b",
    });
    expect(new Set(again.assignments.map((a) => a.sampleId))).toEqual(new Set(["s10", "s11"]));
    expect(again.assignments).toHaveLength(4);
    // new items continue after each rater's existing positions
    const maxBefore = new Map<string, number>();
    for (const a of first.assignments) maxBefore.set(a.raterId, Math.max(maxBefore.get(a.raterId) ?? -1, a.position));
    for (const a of again.assignments) expect(a.position).toBeGreaterThan(maxBefore.get(a.raterId) ?? -1);
  });

  it("warns when there are fewer raters than required", () => {
    const { assignments, warnings } = planAssignments({
      samples: samples(5),
      raterIds: ["r1", "r2"],
      existing: [],
      ratersPerSample: 3,
      repeatFraction: 0,
      seed: "t",
    });
    expect(assignments).toHaveLength(10);
    expect(warnings[0]).toMatch(/could not reach 3/);
  });

  it("is deterministic for a seed", () => {
    const run = () =>
      planAssignments({ samples: samples(30, 1), raterIds: raters, existing: [], ratersPerSample: 3, repeatFraction: 0.2, seed: "same" });
    expect(run()).toEqual(run());
  });
});

describe("planAllToAll", () => {
  it("gives every rater every sample once, anchors first, appended after existing items", async () => {
    const { planAllToAll } = await import("@/lib/assign");
    const existing = [{ raterId: "r1", sampleId: "s0", kind: "normal" as const, position: 4 }];
    const out = planAllToAll({ samples: samples(5, 1), raterIds: ["r1", "r2"], existing, seed: "m" });
    const r1 = out.filter((a) => a.raterId === "r1").sort((a, b) => a.position - b.position);
    const r2 = out.filter((a) => a.raterId === "r2").sort((a, b) => a.position - b.position);
    expect(r2.map((a) => a.sampleId).sort()).toEqual(["s0", "s1", "s2", "s3", "s4"]);
    expect(r2[0]).toMatchObject({ sampleId: "s0", kind: "anchor", position: 0 });
    // r1 already had s0, so it gets the other 4 starting after position 4
    expect(r1.map((a) => a.sampleId).sort()).toEqual(["s1", "s2", "s3", "s4"]);
    expect(r1[0].position).toBe(5);
  });
});

describe("planForNewReader", () => {
  it("gives a new reader every sample when perReader is null", async () => {
    const { planForNewReader } = await import("@/lib/assign");
    const out = planForNewReader({ samples: samples(12), readerId: "p1", existing: [], perReader: null, seed: "x" });
    expect(new Set(out.map((a) => a.sampleId)).size).toBe(12);
    expect(out.map((a) => a.position).sort((a, b) => a - b)).toEqual([...Array(12).keys()]);
  });

  it("with a cap, spreads readers so coverage stays within 1", async () => {
    const { planForNewReader } = await import("@/lib/assign");
    const existing: { raterId: string; sampleId: string; kind: "normal"; position: number }[] = [];
    for (let r = 0; r < 7; r++) {
      const got = planForNewReader({ samples: samples(10), readerId: `p${r}`, existing, perReader: 4, seed: `s${r}` });
      expect(got).toHaveLength(4);
      existing.push(...(got as typeof existing));
    }
    const cov = new Map<string, number>();
    for (const a of existing) cov.set(a.sampleId, (cov.get(a.sampleId) ?? 0) + 1);
    const counts = [...Array(10).keys()].map((i) => cov.get(`s${i}`) ?? 0);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(28);
  });

  it("never repeats a sample for the same reader", async () => {
    const { planForNewReader } = await import("@/lib/assign");
    const existing = [{ raterId: "p1", sampleId: "s0", kind: "normal" as const, position: 0 }];
    const out = planForNewReader({ samples: samples(3), readerId: "p1", existing, perReader: null, seed: "y" });
    expect(out.map((a) => a.sampleId).sort()).toEqual(["s1", "s2"]);
    expect(Math.min(...out.map((a) => a.position))).toBe(1);
  });
});
