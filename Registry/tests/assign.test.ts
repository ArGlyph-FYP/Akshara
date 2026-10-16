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
