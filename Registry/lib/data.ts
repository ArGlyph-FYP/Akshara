import "server-only";
import type { Query } from "firebase-admin/firestore";
import { cache } from "react";
import { compareSamples } from "./codes";
import { adminDb } from "./firebase/admin";
import { rubricCriteria } from "./rubric/criteria";
import {
  datasetOf,
  initialDatasetId,
  INITIAL_DATASET_NAME,
  type Assignment,
  type Criterion,
  type Dataset,
  type Participant,
  type Rating,
  type Sample,
  type Script,
  type Study,
  type UserDoc,
} from "./types";

export const db = () => adminDb();
export const col = {
  users: () => db().collection("users"),
  participants: () => db().collection("participants"),
  counters: () => db().collection("counters"),
  samples: () => db().collection("samples"),
  assignments: () => db().collection("assignments"),
  ratings: () => db().collection("ratings"),
  studies: () => db().collection("studies"),
  datasets: () => db().collection("datasets"),
};

async function all<T>(q: Query, withId = true): Promise<T[]> {
  const snap = await q.get();
  return snap.docs.map((d) => (withId ? ({ id: d.id, ...d.data() } as T) : (d.data() as T)));
}

export async function listUsers(): Promise<(UserDoc & { uid: string })[]> {
  const snap = await col.users().get();
  return snap.docs
    .map((d) => ({ uid: d.id, ...(d.data() as UserDoc) }))
    .sort((a, b) => a.alias.localeCompare(b.alias));
}

export async function listParticipants(script?: Script): Promise<Participant[]> {
  const q = script ? col.participants().where("script", "==", script) : col.participants();
  const rows = await all<Participant>(q, false);
  return rows.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * The script's datasets, oldest first. The first call creates the "Initial dataset" and files every
 * existing scan and survey of the script under it.
 */
export const listDatasets = cache(async (script: Script): Promise<Dataset[]> => {
  const rows = await all<Dataset>(col.datasets().where("script", "==", script));
  if (!rows.some((d) => d.id === initialDatasetId(script))) rows.push(await createInitialDataset(script));
  return rows.sort((a, b) => a.createdAt - b.createdAt);
});

export async function getDataset(id: string): Promise<Dataset | null> {
  const snap = await col.datasets().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Dataset) : null;
}

async function createInitialDataset(script: Script): Promise<Dataset> {
  const id = initialDatasetId(script);
  const doc: Omit<Dataset, "id"> = { script, name: INITIAL_DATASET_NAME, createdAt: 0, createdBy: "system" };
  await col.datasets().doc(id).set(doc);
  // Write the datasetId onto older scans and surveys (the app also treats a missing one as the initial dataset).
  const [samples, studies] = await Promise.all([
    col.samples().where("script", "==", script).get(),
    col.studies().where("script", "==", script).get(),
  ]);
  const untagged = [...samples.docs, ...studies.docs].filter((d) => !d.data().datasetId).map((d) => d.ref);
  for (let i = 0; i < untagged.length; i += 450) {
    const batch = db().batch();
    untagged.slice(i, i + 450).forEach((r) => batch.update(r, { datasetId: id }));
    await batch.commit();
  }
  return { id, ...doc };
}

/** Samples of one dataset. */
export async function listDatasetSamples(script: Script, datasetId: string): Promise<Sample[]> {
  return (await listSamples({ script })).filter((s) => datasetOf(s) === datasetId);
}

export async function listSamples(filter: Partial<Pick<Sample, "script" | "phase" | "status">> = {}): Promise<Sample[]> {
  let q: Query = col.samples();
  for (const [k, v] of Object.entries(filter)) if (v) q = q.where(k, "==", v);
  const rows = await all<Sample>(q);
  return rows.sort(compareSamples);
}

export async function getSample(id: string): Promise<Sample | null> {
  const snap = await col.samples().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Sample) : null;
}

/** Loads only the given samples (cheaper than listing a whole script's samples). Missing ones are skipped. */
export async function getSamplesByIds(ids: string[]): Promise<Sample[]> {
  const out: Sample[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const snaps = await db().getAll(...ids.slice(i, i + 300).map((id) => col.samples().doc(id)));
    for (const d of snaps) if (d.exists) out.push({ id: d.id, ...d.data() } as Sample);
  }
  return out;
}

/** Loads only the given users. Missing ones are skipped. */
export async function getUsersByIds(uids: string[]): Promise<(UserDoc & { uid: string })[]> {
  const out: (UserDoc & { uid: string })[] = [];
  for (let i = 0; i < uids.length; i += 300) {
    const snaps = await db().getAll(...uids.slice(i, i + 300).map((id) => col.users().doc(id)));
    for (const d of snaps) if (d.exists) out.push({ uid: d.id, ...(d.data() as UserDoc) });
  }
  return out;
}

/** The fixed main-study criteria (A1–A8, Rubric v1). */
export function criteriaFor(script: Script): Criterion[] {
  return rubricCriteria(script);
}

export async function listAssignments(
  filter: { raterId?: string; script?: Script; sampleId?: string; studyId?: string } = {},
): Promise<Assignment[]> {
  let q: Query = col.assignments();
  for (const [k, v] of Object.entries(filter)) if (v) q = q.where(k, "==", v);
  const rows = await all<Assignment>(q);
  return rows.sort((a, b) => a.position - b.position);
}

export async function listRatings(
  filter: { raterId?: string; script?: Script; studyId?: string; sampleId?: string } = {},
): Promise<Rating[]> {
  let q: Query = col.ratings();
  for (const [k, v] of Object.entries(filter)) if (v) q = q.where(k, "==", v);
  return all<Rating>(q);
}

export async function listStudies(script?: Script): Promise<Study[]> {
  const q = script ? col.studies().where("script", "==", script) : col.studies();
  const rows = await all<Study>(q);
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getStudyByPublicToken(token: string): Promise<Study | null> {
  const snap = await col.studies().where("publicToken", "==", token).limit(1).get();
  const d = snap.docs[0];
  return d ? ({ id: d.id, ...d.data() } as Study) : null;
}

export async function getStudy(id: string): Promise<Study | null> {
  const snap = await col.studies().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Study) : null;
}

/** Active raters (role rater, plus admins who rate) for a script. */
export async function ratersFor(script: Script) {
  return (await listUsers()).filter((u) => u.active && u.scripts.includes(script));
}

/** A rater's queue for one study, in order, plus the next pending item. */
export async function raterQueue(raterId: string, studyId: string) {
  const items = await listAssignments({ raterId, studyId });
  const next = items.find((a) => a.status === "pending") ?? null;
  // Skipped items (reader recognised the writer) count as finished for progress.
  return { items, next, done: items.filter((a) => a.status !== "pending").length };
}
