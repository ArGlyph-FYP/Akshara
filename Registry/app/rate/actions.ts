"use server";

import { run } from "@/lib/action";
import { assertStaff } from "@/lib/auth";
import { newId } from "@/lib/codes";
import { col, criteriaFor, db, getSample, getStudy } from "@/lib/data";
import { assignNextBatch } from "@/lib/public";
import { ALTERATIONS, DECORATIONS, FLAGS, ISSUE_TAGS, PARTS, type Alterations, type Decoration } from "@/lib/rubric/si";
import type { Assignment, Rating, Region, Scale } from "@/lib/types";

export interface RatingInput {
  assignmentId: string;
  overall: number;
  /** Rubric studies. */
  legibility?: number;
  criterionScores?: Record<string, number>;
  regions?: Region[];
  /** Main study: decoration flag (D) and crossings-out / overwriting. */
  decoration?: Decoration | null;
  alterations?: Alterations | null;
  /** Perception studies. */
  likedText?: string;
  dislikedText?: string;
  comment?: string;
  durationMs: number;
}

const inScale = (v: unknown, s: Scale) => Number.isInteger(v) && (v as number) >= s.min && (v as number) <= s.max;
const clamp = (v: number) => Math.min(1, Math.max(0, Number(v) || 0));
const clampBox = (g: Region) => ({ x: clamp(g.x), y: clamp(g.y), w: clamp(g.w), h: clamp(g.h) });

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
      batch: a.batch ?? null,
      position: a.position,
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
      const regions: Region[] = (input.regions ?? []).slice(0, 50).map((g) => {
        if (g.tone !== "good" && g.tone !== "weak") throw new Error("Every marked part needs to be good or could be better");
        return { criterionId: "", tone: g.tone, ...clampBox(g), note: String(g.note ?? "").slice(0, 300) };
      });
      rating = { ...base, legibility: null, criterionScores: {}, regions, likedText, dislikedText, rubricVersion: null };
    } else {
      if (!inScale(input.legibility, study.legibilityScale ?? { min: 1, max: 5 })) throw new Error("Choose a legibility score");
      const criteria = await criteriaFor(study.script, study.rubricVersion ?? 1);
      const scores: Record<string, number> = {};
      for (const c of criteria) {
        const v = input.criterionScores?.[c.id];
        if (!inScale(v, { min: c.scaleMin, max: c.scaleMax })) throw new Error(`Score “${c.labelEn}”`);
        scores[c.id] = v as number;
      }
      // Sinhala forms (Rubric v1) also ask for the decoration and alterations flags.
      const decoration = input.decoration ?? null;
      const alterations = input.alterations ?? null;
      if (decoration !== null && !DECORATIONS.includes(decoration)) throw new Error("Bad decoration answer");
      if (alterations !== null && !ALTERATIONS.includes(alterations)) throw new Error("Bad alterations answer");
      if (study.script === "si" && (decoration === null || alterations === null)) throw new Error("සැරසිලි සහ කපා හැරීම් ප්‍රශ්නවලට පිළිතුරු දෙන්න");
      const keyOf = new Map(criteria.map((c) => [c.id, c.key]));
      const flags = new Set<string>(FLAGS.map((f) => f.value));
      const parts = new Set(PARTS.map((p) => p.value));
      const regions: Region[] = (input.regions ?? []).slice(0, 100).map((g) => {
        const flag = g.flag && flags.has(g.flag) ? g.flag : null;
        if (!flag && !keyOf.has(g.criterionId)) throw new Error("Every region needs a criterion");
        const tags = flag ? null : ISSUE_TAGS[keyOf.get(g.criterionId)!];
        const issueTag = g.issueTag && tags?.some((t) => t.value === g.issueTag) ? g.issueTag : null;
        const part = !flag && keyOf.get(g.criterionId) === "a1" && g.part && parts.has(g.part) ? g.part : null;
        return {
          criterionId: flag ? "" : g.criterionId,
          ...clampBox(g),
          note: String(g.note ?? "").slice(0, 300),
          issueTag,
          part,
          severity: g.severity === 3 ? 3 : 2,
          flag,
        };
      });
      rating = {
        ...base,
        legibility: input.legibility as number,
        criterionScores: scores,
        regions,
        likedText: "",
        dislikedText: "",
        decoration,
        alterations,
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

/** The reader recognised the writer (their own, family or a friend): leave the item unrated. */
export async function skipItem(assignmentId: string) {
  return run(async () => {
    const s = await assertStaff();
    const ref = col.assignments().doc(assignmentId);
    await db().runTransaction(async (tx) => {
      const a = (await tx.get(ref)).data() as Omit<Assignment, "id"> | undefined;
      if (!a || a.raterId !== s.uid) throw new Error("This item isn't assigned to you");
      if (a.status !== "pending") return;
      tx.update(ref, { status: "skipped" });
    });
  });
}

/** Main study: gives the reader another form of samples. Returns where to go next, or a message when none are left. */
export async function requestMoreBatch(studyId: string): Promise<{ next?: string; error?: string }> {
  try {
    const s = await assertStaff();
    const study = await getStudy(studyId);
    // A paused link takes no new work; readers can still finish the form they have.
    if (!study || !study.open || !study.publicOpen || study.type !== "rubric") return { error: "closed" };
    const n = await assignNextBatch(study, s.uid);
    if (!n) return { error: "full" };
    return { next: `/rate/next?study=${study.id}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
