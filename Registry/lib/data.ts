import "server-only";
import type { Query } from "firebase-admin/firestore";
import { adminDb } from "./firebase/admin";
import {
  DEFAULT_SETTINGS,
  type Assignment,
  type Criterion,
  type Participant,
  type Rating,
  type Sample,
  type Script,
  type Settings,
  type Survey,
  type SurveyReader,
  type SurveyResponse,
  type UserDoc,
} from "./types";

export const db = () => adminDb();
export const col = {
  users: () => db().collection("users"),
  participants: () => db().collection("participants"),
  counters: () => db().collection("counters"),
  samples: () => db().collection("samples"),
  criteria: () => db().collection("criteria"),
  settings: () => db().collection("settings").doc("global"),
  assignments: () => db().collection("assignments"),
  ratings: () => db().collection("ratings"),
  surveys: () => db().collection("surveys"),
};

async function all<T>(q: Query, withId = true): Promise<T[]> {
  const snap = await q.get();
  return snap.docs.map((d) => (withId ? ({ id: d.id, ...d.data() } as T) : (d.data() as T)));
}

export async function getSettings(): Promise<Settings> {
  const snap = await col.settings().get();
  const s = (snap.data() ?? {}) as Partial<Settings>;
  return { ...DEFAULT_SETTINGS, ...s, rubricVersion: { ...DEFAULT_SETTINGS.rubricVersion, ...s.rubricVersion } };
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
  return rows.sort((a, b) => a.participantCode.localeCompare(b.participantCode) || a.pageNo - b.pageNo);
}

export async function getSample(id: string): Promise<Sample | null> {
  const snap = await col.samples().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Sample) : null;
}

export async function listCriteria(script?: Script, onlyActive = false): Promise<Criterion[]> {
  let q: Query = col.criteria();
  if (script) q = q.where("script", "==", script);
  const rows = await all<Criterion>(q);
  return rows
    .filter((c) => !onlyActive || c.active)
    .sort((a, b) => a.script.localeCompare(b.script) || a.rubricVersion - b.rubricVersion || a.order - b.order);
}

/** Active criteria for the current rubric version of a script, in display order. */
export async function currentCriteria(script: Script): Promise<{ version: number; criteria: Criterion[] }> {
  const settings = await getSettings();
  const version = settings.rubricVersion[script];
  const criteria = (await listCriteria(script, true)).filter((c) => c.rubricVersion === version);
  return { version, criteria };
}

export async function listAssignments(filter: { raterId?: string; script?: Script; sampleId?: string } = {}): Promise<Assignment[]> {
  let q: Query = col.assignments();
  for (const [k, v] of Object.entries(filter)) if (v) q = q.where(k, "==", v);
  const rows = await all<Assignment>(q);
  return rows.sort((a, b) => a.position - b.position);
}

export async function listRatings(filter: { raterId?: string; script?: Script } = {}): Promise<Rating[]> {
  let q: Query = col.ratings();
  for (const [k, v] of Object.entries(filter)) if (v) q = q.where(k, "==", v);
  return all<Rating>(q);
}

export async function listSurveys(): Promise<Survey[]> {
  const rows = await all<Survey>(col.surveys());
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSurvey(id: string): Promise<Survey | null> {
  const snap = await col.surveys().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Survey) : null;
}

export async function getSurveyByToken(token: string): Promise<Survey | null> {
  const snap = await col.surveys().where("shareToken", "==", token).limit(1).get();
  const d = snap.docs[0];
  return d ? ({ id: d.id, ...d.data() } as Survey) : null;
}

export async function listSurveyResponses(surveyId: string): Promise<SurveyResponse[]> {
  return all<SurveyResponse>(col.surveys().doc(surveyId).collection("responses"), false);
}

export async function listSurveyReaders(surveyId: string): Promise<SurveyReader[]> {
  return all<SurveyReader>(col.surveys().doc(surveyId).collection("readers"), false);
}

/** Ready to rate: QC-approved main-phase samples (anchors may come from any phase) and active raters of the script. */
export async function eligibleForRating(script: Script) {
  const [samples, users] = await Promise.all([listSamples({ script }), listUsers()]);
  const ready = samples.filter((s) => s.status === "qc_ok" && (s.isAnchor || s.phase === "main"));
  const raters = users.filter((u) => u.active && u.role === "rater" && u.scripts.includes(script));
  return { ready, raters };
}

/** A rater's queue for one script, in order, plus the next pending item. */
export async function raterQueue(raterId: string, script: Script) {
  const items = await listAssignments({ raterId, script });
  const next = items.find((a) => a.status === "pending") ?? null;
  return { items, next, done: items.filter((a) => a.status === "done").length };
}

export const surveyResponseId = (uid: string, sampleId: string) => `${uid}_${sampleId}`;
