import "server-only";
import type { Query } from "firebase-admin/firestore";
import { compareSamples } from "./codes";
import { adminDb } from "./firebase/admin";
import { rubricCriteria } from "./rubric/criteria";
import {
  type Assignment,
  type Criterion,
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
