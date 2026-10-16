"use server";

import { run } from "@/lib/action";
import { assertStaff } from "@/lib/auth";
import { newId } from "@/lib/codes";
import { col, currentCriteria, db, getSample, getSettings } from "@/lib/data";
import type { Assignment, Rating, Region, Scale } from "@/lib/types";

export interface RatingInput {
  assignmentId: string;
  overall: number;
  legibility: number;
  criterionScores: Record<string, number>;
  regions: Region[];
  comment: string;
  durationMs: number;
}

const inScale = (v: number, s: Scale) => Number.isInteger(v) && v >= s.min && v <= s.max;

export async function submitRating(input: RatingInput) {
  let anchor: { overall: number | null; legibility: number | null; note: string } | null = null;
  const res = await run(async () => {
    const s = await assertStaff();
    const ref = col.assignments().doc(input.assignmentId);
    const a = (await ref.get()).data() as Omit<Assignment, "id"> | undefined;
    if (!a || a.raterId !== s.uid) throw new Error("This item isn't assigned to you");
    if (!s.user.scripts.includes(a.script)) throw new Error("You are not a rater for this script");

    const [settings, { version, criteria }, sample] = await Promise.all([
      getSettings(),
      currentCriteria(a.script),
      getSample(a.sampleId),
    ]);
    if (!inScale(input.overall, settings.overallScale)) throw new Error("Choose an overall score");
    if (!inScale(input.legibility, settings.legibilityScale)) throw new Error("Choose a legibility score");

    const scores: Record<string, number> = {};
    for (const c of criteria) {
      const v = input.criterionScores[c.id];
      if (!inScale(v, { min: c.scaleMin, max: c.scaleMax })) throw new Error(`Score "${c.labelEn}"`);
      scores[c.id] = v;
    }

    const ids = new Set(criteria.map((c) => c.id));
    const clamp = (v: number) => Math.min(1, Math.max(0, Number(v) || 0));
    const regions: Region[] = (input.regions ?? []).slice(0, 100).map((g) => {
      if (!ids.has(g.criterionId)) throw new Error("Every region needs a criterion");
      return { criterionId: g.criterionId, x: clamp(g.x), y: clamp(g.y), w: clamp(g.w), h: clamp(g.h), note: String(g.note ?? "").slice(0, 300) };
    });

    await db().runTransaction(async (tx) => {
      const fresh = (await tx.get(ref)).data() as Omit<Assignment, "id">;
      if (fresh.status !== "pending") throw new Error("Already submitted");
      const id = newId();
      const rating: Omit<Rating, "id"> = {
        assignmentId: input.assignmentId,
        raterId: s.uid,
        sampleId: a.sampleId,
        script: a.script,
        kind: a.kind,
        overall: input.overall,
        legibility: input.legibility,
        criterionScores: scores,
        regions,
        comment: String(input.comment ?? "").slice(0, 1000),
        durationMs: Math.max(0, Math.round(Number(input.durationMs) || 0)),
        rubricVersion: version,
        submittedAt: Date.now(),
      };
      tx.set(col.ratings().doc(id), rating);
      tx.update(ref, { status: "done" });
    });
    // No revalidatePath here: re-rendering this item's page would redirect away before the anchor feedback shows.
    if (a.kind === "anchor" && sample?.anchorScores) anchor = sample.anchorScores;
  });
  return { ...res, anchor };
}
