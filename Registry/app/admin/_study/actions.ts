"use server";

import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { newId, newPublicToken } from "@/lib/codes";
import { col, currentCriteria, db, getStudy, listAssignments, listRatings, listSamples } from "@/lib/data";
import { DEFAULT_SCALES, MAIN_DEFAULTS, MAIN_SCALE, SCRIPT_LABEL, type Script, type Study, type StudyType, type UserDoc } from "@/lib/types";
import type { SurveyStatus } from "./status";

type Result<T = object> = ({ ok: true } & T) | { ok?: false; error: string };

function fail(e: unknown): { error: string } {
  return { error: e instanceof Error ? e.message : String(e) };
}

function cleanPerReader(v: unknown): number | null {
  const n = Math.round(Number(v));
  return v !== null && v !== "" && Number.isFinite(n) && n > 0 ? Math.min(n, 500) : null;
}

/** Ratings per sample: a whole number 1–50, or null (no cap) when left empty. */
function cleanPerSample(v: unknown): number | null {
  const n = Math.round(Number(v));
  return v !== null && v !== "" && v !== undefined && Number.isFinite(n) && n > 0 ? Math.min(n, 50) : null;
}

function cleanRepeatPct(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(50, Math.max(0, n)) : 0;
}

/** Usable samples of a script (withdrawn and rejected scans are never handed out). */
async function usableSamples(script: Script, ids: string[]) {
  const wanted = new Set(ids);
  return (await listSamples({ script })).filter(
    (s) => wanted.has(s.id) && s.imagePath && s.status !== "excluded" && s.status !== "rejected",
  );
}

async function loadStudy(id: string) {
  const s = await getStudy(id);
  if (!s) throw new Error("Study not found");
  return s;
}

const refresh = () => revalidatePath("/admin", "layout");

async function deleteAll(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 450) {
    const batch = db().batch();
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

/**
 * Creates a perception or main-study survey with the chosen samples. Its share link is on straight away.
 * Score ranges aren't set by admins: they're fixed per study type (questions are being finalised per script).
 */
export async function startStudy(input: {
  script: Script;
  type: StudyType;
  title: string;
  instructions: string;
  sampleIds: string[];
  perReader: number | null;
  repeatPct: number;
  /** Main study only. */
  targetPerSample?: number | null;
  maxPerSample?: number | null;
}): Promise<Result<{ id: string }>> {
  try {
    await assertAdmin();
    if (input.script !== "si" && input.script !== "ta") throw new Error("Choose a script");
    if (input.type !== "perception" && input.type !== "rubric") throw new Error("Choose a study type");
    const samples = await usableSamples(input.script, input.sampleIds ?? []);
    if (samples.length === 0) throw new Error("Pick at least one sample (withdrawn or rejected scans can't be used)");

    let rubricVersion: number | null = null;
    if (input.type === "rubric") {
      const { version, criteria } = await currentCriteria(input.script);
      if (criteria.length === 0) throw new Error("Add the rubric criteria first (Rubric criteria tab)");
      rubricVersion = version;
    }
    const id = newId();
    const main = input.type === "rubric";
    const doc: Omit<Study, "id"> = {
      script: input.script,
      type: input.type,
      title: String(input.title ?? "").trim().slice(0, 120) || `${SCRIPT_LABEL[input.script]} ${input.type === "rubric" ? "main study" : "perception"} survey`,
      instructions: String(input.instructions ?? "").slice(0, 4000),
      sampleIds: samples.map((s) => s.id),
      open: true,
      overallScale: main ? MAIN_SCALE : DEFAULT_SCALES.overall,
      legibilityScale: main ? MAIN_SCALE : null,
      rubricVersion,
      publicToken: newPublicToken(),
      publicOpen: true,
      perReader: cleanPerReader(input.perReader) ?? (main ? MAIN_DEFAULTS.formSize : null),
      repeatPct: main ? cleanRepeatPct(input.repeatPct) : null,
      ...(main
        ? {
            targetPerSample: cleanPerSample(input.targetPerSample) ?? MAIN_DEFAULTS.targetPerSample,
            maxPerSample: input.maxPerSample === undefined ? MAIN_DEFAULTS.maxPerSample : cleanPerSample(input.maxPerSample),
          }
        : {}),
      createdAt: Date.now(),
    };
    await col.studies().doc(id).set(doc);
    refresh();
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function setStudyStatus(studyId: string, status: SurveyStatus): Promise<Result> {
  try {
    await assertAdmin();
    const study = await loadStudy(studyId);
    await col.studies().doc(studyId).update({
      open: status !== "closed",
      publicOpen: status === "open",
      publicToken: study.publicToken || newPublicToken(),
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateStudy(
  studyId: string,
  patch: {
    title?: string;
    instructions?: string;
    perReader?: number | null;
    repeatPct?: number;
    targetPerSample?: number | null;
    maxPerSample?: number | null;
  },
): Promise<Result> {
  try {
    await assertAdmin();
    const study = await loadStudy(studyId);
    const upd: Record<string, unknown> = {};
    if (patch.title !== undefined) {
      const t = patch.title.trim().slice(0, 120);
      if (!t) throw new Error("Title can't be empty");
      upd.title = t;
    }
    if (patch.instructions !== undefined) upd.instructions = patch.instructions.slice(0, 4000);
    if (patch.perReader !== undefined) upd.perReader = cleanPerReader(patch.perReader);
    if (patch.repeatPct !== undefined && study.type === "rubric") upd.repeatPct = cleanRepeatPct(patch.repeatPct);
    if (study.type === "rubric") {
      if (patch.perReader !== undefined) upd.perReader = cleanPerReader(patch.perReader) ?? MAIN_DEFAULTS.formSize;
      if (patch.targetPerSample !== undefined) upd.targetPerSample = cleanPerSample(patch.targetPerSample) ?? MAIN_DEFAULTS.targetPerSample;
      if (patch.maxPerSample !== undefined) upd.maxPerSample = cleanPerSample(patch.maxPerSample);
    }
    await col.studies().doc(studyId).update(upd);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Adds samples. Readers who join from now on get them; readers already in keep their set. */
export async function addSamplesToStudy(studyId: string, sampleIds: string[]): Promise<Result<{ added: number }>> {
  try {
    await assertAdmin();
    const study = await loadStudy(studyId);
    const fresh = (await usableSamples(study.script, sampleIds)).map((s) => s.id).filter((id) => !study.sampleIds.includes(id));
    if (fresh.length) await col.studies().doc(studyId).update({ sampleIds: FieldValue.arrayUnion(...fresh) });
    refresh();
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
    await deleteAll(pending.map((a) => col.assignments().doc(a.id)));
    if (sampleIds.length) await col.studies().doc(studyId).update({ sampleIds: FieldValue.arrayRemove(...sampleIds) });
    refresh();
    return { ok: true, removed: sampleIds.length };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Removes a reader from a study together with their responses (e.g. spam or a test run).
 * A public-link reader is also blocked from joining again from that browser.
 */
export async function removeReader(studyId: string, uid: string): Promise<Result> {
  try {
    const s = await assertAdmin();
    await loadStudy(studyId);
    const [items, ratings] = await Promise.all([listAssignments({ studyId, raterId: uid }), listRatings({ studyId, raterId: uid })]);
    await deleteAll([...items.map((a) => col.assignments().doc(a.id)), ...ratings.map((r) => col.ratings().doc(r.id))]);
    const user = (await col.users().doc(uid).get()).data() as UserDoc | undefined;
    if (user?.public && uid !== s.uid) await col.users().doc(uid).update({ active: false });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Deletes a study that has no responses yet (otherwise close it instead). */
export async function deleteStudy(studyId: string): Promise<Result> {
  try {
    await assertAdmin();
    await loadStudy(studyId);
    const ratings = await listRatings({ studyId });
    if (ratings.length) throw new Error(`This study has ${ratings.length} response(s). Close it instead of deleting.`);
    const items = await listAssignments({ studyId });
    await deleteAll(items.map((a) => col.assignments().doc(a.id)));
    await col.studies().doc(studyId).delete();
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
