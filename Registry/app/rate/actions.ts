"use server";

import { run } from "@/lib/action";
import { assertStaff } from "@/lib/auth";
import { newId } from "@/lib/codes";
import { col, criteriaFor, db, getSample, getStudy } from "@/lib/data";
import { assignNextBatch } from "@/lib/public";
import { rubricVersionFor } from "@/lib/rubric/criteria";
import { formRubric } from "@/lib/rubric/form";
import type { Assignment, Rating, Region, Scale } from "@/lib/types";

export interface RatingInput {
  assignmentId: string;
  /** Null only with `unscorable`. */
  overall: number | null;
  /** Rubric studies. */
  legibility?: number | null;
  criterionScores?: Record<string, number>;
  regions?: Region[];
  /** Sinhala v12: criteria answered "not applicable", a copying error, or an image that can't be judged (with a reason). */
  notApplicable?: string[];
  copyError?: boolean;
  unscorable?: boolean;
  unscorableReason?: string;
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

    // Only a Sinhala main-study paragraph can be marked unscorable; then every other answer stays blank.
    const unscorable = study.type === "rubric" && study.script === "si" && input.unscorable === true;
    const unscorableReason = unscorable ? String(input.unscorableReason ?? "").trim().slice(0, 500) : "";
    if (unscorable && !unscorableReason) throw new Error("ඇගයිය නොහැකි වීමට හේතුව ලියන්න");
    if (!unscorable && !inScale(input.overall, study.overallScale)) throw new Error("Choose a score");
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
      overall: unscorable ? null : (input.overall as number),
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
    } else if (unscorable) {
      rating = {
        ...base,
        legibility: null,
        criterionScores: {},
        regions: [],
        likedText: "",
        dislikedText: "",
        notApplicable: [],
        copyError: input.copyError === true,
        unscorable: true,
        unscorableReason,
        rubricVersion: rubricVersionFor(study.script),
      };
    } else {
      if (!inScale(input.legibility, study.legibilityScale ?? { min: 1, max: 5 })) throw new Error("Choose a legibility score");
      const criteria = criteriaFor(study.script);
      const na = new Set((input.notApplicable ?? []).filter((k) => criteria.some((c) => c.id === k)));
      const scores: Record<string, number> = {};
      for (const c of criteria) {
        if (na.has(c.id)) continue;
        const v = input.criterionScores?.[c.id];
        if (!inScale(v, { min: c.scaleMin, max: c.scaleMax })) throw new Error(`Answer “${c.labelEn}”`);
        scores[c.id] = v as number;
      }
      // Box tags, flags and letter parts follow the study's script (Sinhala A1–A8, Tamil C1–C8).
      const rubric = formRubric(study.script);
      const keyOf = new Map(criteria.map((c) => [c.id, c.key]));
      const flags = new Set<string>(rubric.flags.map((f) => f.value));
      const parts = new Set(rubric.parts.map((p) => p.value));
      const regions: Region[] = (input.regions ?? []).slice(0, 100).map((g) => {
        const flag = g.flag && flags.has(g.flag) ? g.flag : null;
        if (!flag && !keyOf.has(g.criterionId)) throw new Error("Every region needs a criterion");
        const tags = flag ? null : rubric.issueTags[keyOf.get(g.criterionId)!];
        const issueTag = g.issueTag && tags?.some((t) => t.value === g.issueTag) ? g.issueTag : null;
        const part = !flag && keyOf.get(g.criterionId) === rubric.partsKey && g.part && parts.has(g.part) ? g.part : null;
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
        ...(study.script === "si" ? { notApplicable: [...na], copyError: input.copyError === true, unscorable: false, unscorableReason: "" } : {}),
        // The form shown is fixed in code, so the version is the current one for the script (not the study's).
        rubricVersion: rubricVersionFor(study.script),
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

/** Records whether the rater took the short tour or skipped it (kept for analysis). */
export async function recordTraining(choice: "done" | "skipped") {
  return run(async () => {
    const s = await assertStaff();
    if (choice !== "done" && choice !== "skipped") throw new Error("Bad choice");
    // A rater who took the tour once stays "done".
    if (s.user.training === "done") return;
    await col.users().doc(s.uid).update({ training: choice });
  });
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
