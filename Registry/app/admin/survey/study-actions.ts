"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { planAllToAll, planAssignments, type NewAssignment } from "@/lib/assign";
import { assertAdmin } from "@/lib/auth";
import { newId, newPublicToken } from "@/lib/codes";
import { col, currentCriteria, db, getStudy, listAssignments, listRatings, listSamples, ratersFor } from "@/lib/data";
import type { Assignment, Scale, Script, Study, StudyType } from "@/lib/types";

type Result<T = object> = ({ ok: true } & T) | { ok?: false; error: string };

function fail(e: unknown): { error: string } {
  return { error: e instanceof Error ? e.message : String(e) };
}

function checkScale(s: Scale, name: string): Scale {
  const min = Math.round(Number(s?.min));
  const max = Math.round(Number(s?.max));
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || max - min > 20) throw new Error(`${name}: choose a valid range`);
  return { min, max };
}

export interface AssignPlan {
  /** "public": no accounts now; readers sign up via the study's public link. */
  mode: "random" | "manual" | "public" | "none";
  raterIds: string[];
  /** Random mode only. */
  ratersPerSample?: number;
  repeatPct?: number;
}

/** Usable samples of the study's script (withdrawn and rejected scans are never assigned). */
async function usableSamples(script: Script, ids: string[]) {
  const wanted = new Set(ids);
  return (await listSamples({ script })).filter(
    (s) => wanted.has(s.id) && s.imagePath && s.status !== "excluded" && s.status !== "rejected",
  );
}

async function writeAssignments(study: Study, planned: NewAssignment[]) {
  const now = Date.now();
  for (let i = 0; i < planned.length; i += 450) {
    const batch = db().batch();
    for (const a of planned.slice(i, i + 450)) {
      const doc: Omit<Assignment, "id"> = { ...a, studyId: study.id, script: study.script, status: "pending", createdAt: now };
      batch.set(col.assignments().doc(newId()), doc);
    }
    await batch.commit();
  }
}

/** Plans and writes assignments for (some of) a study's samples. Only adds what's missing. */
async function assign(study: Study, plan: AssignPlan, sampleIds?: string[]) {
  if (plan.mode === "none" || plan.mode === "public") return { created: 0, warnings: [] as string[] };
  const raters = await ratersFor(study.script);
  const allowed = new Set(raters.map((r) => r.uid));
  const raterIds = plan.raterIds.filter((id) => allowed.has(id));
  if (raterIds.length === 0) throw new Error("Choose at least one rater for this script");
  const samples = await usableSamples(study.script, sampleIds ?? study.sampleIds);
  if (samples.length === 0) throw new Error("No usable samples to assign");
  const existing = await listAssignments({ studyId: study.id });
  const input = samples.map((s) => ({ id: s.id, isAnchor: study.type === "rubric" && s.isAnchor }));
  const seed = `${study.id}-${Date.now()}`;
  let planned: NewAssignment[];
  let warnings: string[] = [];
  if (plan.mode === "manual") {
    planned = planAllToAll({ samples: input, raterIds, existing, seed });
  } else {
    const n = Math.round(Number(plan.ratersPerSample ?? 3));
    if (n < 1 || n > 50) throw new Error("Raters per sample must be 1–50");
    const r = planAssignments({
      samples: input,
      raterIds,
      existing,
      ratersPerSample: n,
      repeatFraction: Math.min(50, Math.max(0, Number(plan.repeatPct ?? 0))) / 100,
      seed,
    });
    planned = r.assignments;
    warnings = r.warnings;
  }
  await writeAssignments(study, planned);
  return { created: planned.length, warnings };
}

export async function createStudy(input: {
  script: Script;
  type: StudyType;
  title: string;
  instructions: string;
  overallScale: Scale;
  legibilityScale: Scale | null;
  sampleIds: string[];
  plan: AssignPlan;
  /** Public link: samples per reader (null = all). Used when plan.mode is "public". */
  perReader?: number | null;
}): Promise<Result<{ id: string; created: number; warnings: string[] }>> {
  try {
    await assertAdmin();
    if (input.script !== "si" && input.script !== "ta") throw new Error("Choose a script");
    if (input.type !== "perception" && input.type !== "rubric") throw new Error("Choose a study type");
    const title = String(input.title ?? "").trim().slice(0, 120);
    if (!title) throw new Error("Give the study a title");
    const samples = await usableSamples(input.script, input.sampleIds ?? []);
    if (samples.length === 0) throw new Error("Pick at least one sample (withdrawn or rejected scans can't be used)");

    let rubricVersion: number | null = null;
    if (input.type === "rubric") {
      const { version, criteria } = await currentCriteria(input.script);
      if (criteria.length === 0) throw new Error("Add rubric criteria first (Survey → Rubric criteria)");
      rubricVersion = version;
    }
    const id = newId();
    const study: Study = {
      id,
      script: input.script,
      type: input.type,
      title,
      instructions: String(input.instructions ?? "").slice(0, 4000),
      sampleIds: samples.map((s) => s.id),
      open: true,
      overallScale: checkScale(input.overallScale, "Score scale"),
      legibilityScale: input.type === "rubric" ? checkScale(input.legibilityScale ?? { min: 1, max: 5 }, "Legibility scale") : null,
      rubricVersion,
      publicToken: input.plan.mode === "public" ? newPublicToken() : null,
      publicOpen: input.plan.mode === "public",
      perReader: cleanPerReader(input.perReader),
      createdAt: Date.now(),
    };
    const { id: _omit, ...doc } = study;
    void _omit;
    await col.studies().doc(id).set(doc);
    const { created, warnings } = await assign(study, input.plan);
    revalidatePath("/admin", "layout");
    return { ok: true, id, created, warnings };
  } catch (e) {
    return fail(e);
  }
}

function cleanPerReader(v: unknown): number | null {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : null;
}

/** Turns a study's public sign-up link on/off and sets how many samples each new reader gets. */
export async function setPublicLink(studyId: string, input: { open: boolean; perReader?: number | null }): Promise<Result<{ token: string }>> {
  try {
    await assertAdmin();
    const study = await loadStudy(studyId);
    const token = study.publicToken || newPublicToken();
    await col.studies().doc(studyId).update({
      publicToken: token,
      publicOpen: !!input.open,
      ...(input.perReader !== undefined ? { perReader: cleanPerReader(input.perReader) } : {}),
    });
    revalidatePath(`/admin/survey/${studyId}`);
    return { ok: true, token };
  } catch (e) {
    return fail(e);
  }
}

async function loadStudy(id: string) {
  const s = await getStudy(id);
  if (!s) throw new Error("Study not found");
  return s;
}

export async function assignStudy(studyId: string, plan: AssignPlan): Promise<Result<{ created: number; warnings: string[] }>> {
  try {
    await assertAdmin();
    const study = await loadStudy(studyId);
    const r = await assign(study, plan);
    revalidatePath(`/admin/survey/${studyId}`);
    return { ok: true, ...r };
  } catch (e) {
    return fail(e);
  }
}

export async function updateStudy(studyId: string, patch: { title?: string; instructions?: string; open?: boolean }): Promise<Result> {
  try {
    await assertAdmin();
    await loadStudy(studyId);
    const upd: Record<string, unknown> = {};
    if (patch.title !== undefined) {
      const t = patch.title.trim().slice(0, 120);
      if (!t) throw new Error("Title can't be empty");
      upd.title = t;
    }
    if (patch.instructions !== undefined) upd.instructions = patch.instructions.slice(0, 4000);
    if (patch.open !== undefined) upd.open = !!patch.open;
    await col.studies().doc(studyId).update(upd);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addSamplesToStudy(studyId: string, sampleIds: string[]): Promise<Result<{ added: number }>> {
  try {
    await assertAdmin();
    const study = await loadStudy(studyId);
    const fresh = (await usableSamples(study.script, sampleIds)).map((s) => s.id).filter((id) => !study.sampleIds.includes(id));
    if (fresh.length) await col.studies().doc(studyId).update({ sampleIds: FieldValue.arrayUnion(...fresh) });
    revalidatePath("/admin", "layout");
    return { ok: true, added: fresh.length };
  } catch (e) {
    return fail(e);
  }
}

/** Removes samples from a study, with their unfinished items. Completed ratings are kept. */
export async function removeSamplesFromStudy(studyId: string, sampleIds: string[]): Promise<Result<{ removed: number }>> {
  try {
    await assertAdmin();
    await loadStudy(studyId);
    const drop = new Set(sampleIds);
    const pending = (await listAssignments({ studyId })).filter((a) => drop.has(a.sampleId) && a.status === "pending");
    for (let i = 0; i < pending.length; i += 450) {
      const batch = db().batch();
      pending.slice(i, i + 450).forEach((a) => batch.delete(col.assignments().doc(a.id)));
      await batch.commit();
    }
    if (sampleIds.length) await col.studies().doc(studyId).update({ sampleIds: FieldValue.arrayRemove(...sampleIds) });
    revalidatePath("/admin", "layout");
    return { ok: true, removed: sampleIds.length };
  } catch (e) {
    return fail(e);
  }
}

/** Manual tweak: give one sample to one more rater. */
export async function addRaterToSample(studyId: string, sampleId: string, raterId: string): Promise<Result> {
  try {
    await assertAdmin();
    const study = await loadStudy(studyId);
    if (!study.sampleIds.includes(sampleId)) throw new Error("Sample isn't in this study");
    const r = await assign(study, { mode: "manual", raterIds: [raterId] }, [sampleId]);
    if (r.created === 0) throw new Error("That rater already has this sample");
    revalidatePath(`/admin/survey/${studyId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Manual tweak: remove an unfinished item. */
export async function removeAssignment(assignmentId: string): Promise<Result> {
  try {
    await assertAdmin();
    const ref = col.assignments().doc(assignmentId);
    const a = (await ref.get()).data() as Assignment | undefined;
    if (!a) throw new Error("Already removed");
    if (a.status === "done") throw new Error("Already rated; completed ratings are kept");
    await ref.delete();
    revalidatePath(`/admin/survey/${a.studyId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Deletes a study that has no completed ratings (otherwise close it instead). */
export async function deleteStudy(studyId: string): Promise<Result> {
  try {
    await assertAdmin();
    await loadStudy(studyId);
    const ratings = await listRatings({ studyId });
    if (ratings.length) throw new Error(`This study has ${ratings.length} rating(s). Close it instead of deleting.`);
    const items = await listAssignments({ studyId });
    for (let i = 0; i < items.length; i += 450) {
      const batch = db().batch();
      items.slice(i, i + 450).forEach((a) => batch.delete(col.assignments().doc(a.id)));
      await batch.commit();
    }
    await col.studies().doc(studyId).delete();
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
