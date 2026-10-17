"use server";

import { run } from "@/lib/action";
import { assertStaff } from "@/lib/auth";
import { newId } from "@/lib/codes";
import { col, criteriaFor, db, getSample, getStudy } from "@/lib/data";
import type { Assignment, Rating, Region, Scale } from "@/lib/types";

export interface RatingInput {
  assignmentId: string;
  overall: number;
  /** Rubric studies. */
  legibility?: number;
  criterionScores?: Record<string, number>;
  regions?: Region[];
  /** Perception studies. */
  likedText?: string;
  dislikedText?: string;
  comment?: string;
  durationMs: number;
}

const inScale = (v: unknown, s: Scale) => Number.isInteger(v) && (v as number) >= s.min && (v as number) <= s.max;

/** Saves one rating (either study type) and marks the queue item done. */
export async function submitRating(input: RatingInput) {
  let anchor: { overall: number | null; legibility: number | null; note: string } | null = null;
  const res = await run(async () => {
    const s = await assertStaff();
    const ref = col.assignments().doc(input.assignmentId);
    const a = (await ref.get()).data() as Omit<Assignment, "id"> | undefined;
    if (!a || a.raterId !== s.uid) throw new Error("This item isn't assigned to you");
    const study = await getStudy(a.studyId);
    if (!study) throw new Error("This study no longer exists");
    if (!study.open) throw new Error("This study has been closed by the research team");

    if (!inScale(input.overall, study.overallScale)) throw new Error("Choose a score");
    const base = {
      studyId: study.id,
      studyType: study.type,
      assignmentId: input.assignmentId,
      raterId: s.uid,
      sampleId: a.sampleId,
      script: a.script,
      kind: a.kind,
      overall: input.overall,
      durationMs: Math.max(0, Math.round(Number(input.durationMs) || 0)),
      comment: String(input.comment ?? "").slice(0, 1000),
      submittedAt: Date.now(),
    };

    let rating: Omit<Rating, "id">;
    if (study.type === "perception") {
      const likedText = String(input.likedText ?? "").trim().slice(0, 2000);
      const dislikedText = String(input.dislikedText ?? "").trim().slice(0, 2000);
      if (!likedText && !dislikedText) throw new Error("Please write at least one reason");
      rating = { ...base, legibility: null, criterionScores: {}, regions: [], likedText, dislikedText, rubricVersion: null };
    } else {
      if (!inScale(input.legibility, study.legibilityScale ?? { min: 1, max: 5 })) throw new Error("Choose a legibility score");
      const criteria = await criteriaFor(study.script, study.rubricVersion ?? 1);
      const scores: Record<string, number> = {};
      for (const c of criteria) {
        const v = input.criterionScores?.[c.id];
        if (!inScale(v, { min: c.scaleMin, max: c.scaleMax })) throw new Error(`Score “${c.labelEn}”`);
        scores[c.id] = v as number;
      }
      const ids = new Set(criteria.map((c) => c.id));
      const clamp = (v: number) => Math.min(1, Math.max(0, Number(v) || 0));
      const regions: Region[] = (input.regions ?? []).slice(0, 100).map((g) => {
        if (!ids.has(g.criterionId)) throw new Error("Every region needs a criterion");
        return { criterionId: g.criterionId, x: clamp(g.x), y: clamp(g.y), w: clamp(g.w), h: clamp(g.h), note: String(g.note ?? "").slice(0, 300) };
      });
      rating = {
        ...base,
        legibility: input.legibility as number,
        criterionScores: scores,
        regions,
        likedText: "",
        dislikedText: "",
        rubricVersion: study.rubricVersion,
      };
    }

    await db().runTransaction(async (tx) => {
      const fresh = (await tx.get(ref)).data() as Omit<Assignment, "id"> | undefined;
      if (!fresh) throw new Error("This item was removed by the research team");
      if (fresh.status !== "pending") throw new Error("Already submitted");
      tx.set(col.ratings().doc(newId()), rating);
      tx.update(ref, { status: "done" });
    });
    // No revalidatePath here: re-rendering this item's page would redirect away before the anchor feedback shows.
    if (a.kind === "anchor" && study.type === "rubric") {
      const sample = await getSample(a.sampleId);
      if (sample?.anchorScores) anchor = sample.anchorScores;
    }
  });
  return { ...res, anchor };
}
