import "server-only";
import { createHash } from "node:crypto";
import { planBatch, planForNewReader, type CoverageItem, type ExistingAssignment, type NewAssignment } from "./assign";
import { col, db, getSamplesByIds, listAssignments } from "./data";
import { MAIN_DEFAULTS, type Assignment, type Sample, type Study } from "./types";

export const publicLinkOpen = (s: Study | null): s is Study => !!s && s.open && !!s.publicOpen && !!s.publicToken;

/** The study's samples that can be handed out (withdrawn and rejected scans never are). */
export async function usableStudySamples(study: Study): Promise<Sample[]> {
  return (await getSamplesByIds(study.sampleIds)).filter((s) => s.imagePath && s.status !== "excluded" && s.status !== "rejected");
}

/**
 * Same reader + study + position always gives the same item ID, so if one reader's join runs twice at once
 * (double click, retry on a slow connection) the second one can't create a duplicate queue.
 */
const itemId = (studyId: string, uid: string, position: number) =>
  createHash("sha256").update(`${studyId}:${uid}:${position}`).digest("base64url").slice(0, 20);

/** Form size for a main study: perReader if set, otherwise 10. */
export const formSize = (study: Study) => (study.perReader && study.perReader > 0 ? study.perReader : MAIN_DEFAULTS.formSize);
export const maxPerSample = (study: Study) => (study.maxPerSample === undefined ? MAIN_DEFAULTS.maxPerSample : study.maxPerSample);

/**
 * Gives a reader their samples in a public study (only the first time; later visits keep their queue).
 * Returns how many items they have in the study.
 */
export async function assignPublicReader(study: Study, uid: string): Promise<number> {
  const mine = await listAssignments({ studyId: study.id, raterId: uid });
  if (mine.length) return mine.length;
  if (study.type === "rubric") return assignNextBatch(study, uid);
  const samples = (await usableStudySamples(study)).map((s) => ({ id: s.id, isAnchor: false }));

  // Coverage (how many readers each sample already has) only matters when readers get a subset of the samples.
  // Then read just the two fields it needs; when everyone rates everything, skip reading other readers' items.
  let existing: ExistingAssignment[] = [];
  if (study.perReader && study.perReader < samples.length) {
    const snap = await col.assignments().where("studyId", "==", study.id).select("sampleId", "kind").get();
    existing = snap.docs.map((d) => ({ raterId: "", position: -1, sampleId: d.get("sampleId"), kind: d.get("kind") }));
  }
  const planned = planForNewReader({
    samples,
    readerId: uid,
    existing,
    perReader: study.perReader ?? null,
    seed: `${study.id}:${uid}`,
  });
  return (await writeItems(study, uid, planned)) ?? (await listAssignments({ studyId: study.id, raterId: uid })).length;
}

/**
 * Main study: hands a reader their next form (10 samples by default, least-rated first, text 1 then text 2).
 * Returns how many new items they got (0 when every sample is full or they have rated them all).
 * If they still have an unfinished form, nothing new is added and its remaining count is returned.
 */
export async function assignNextBatch(study: Study, uid: string): Promise<number> {
  const snap = await col
    .assignments()
    .where("studyId", "==", study.id)
    .select("raterId", "sampleId", "kind", "status", "position", "createdAt", "batch")
    .get();
  const existing = snap.docs.map((d) => d.data() as CoverageItem);
  const open = existing.filter((a) => a.raterId === uid && a.status === "pending").length;
  if (open) return open;
  const samples = (await usableStudySamples(study)).map((s) => ({
    id: s.id,
    isAnchor: s.isAnchor,
    part: s.part ?? null,
    writerId: s.writerId,
  }));
  const planned = planBatch({
    samples,
    readerId: uid,
    existing,
    batchSize: formSize(study),
    maxPerSample: maxPerSample(study),
    seed: `${study.id}:${uid}:${existing.filter((a) => a.raterId === uid).length}`,
    repeatFraction: (study.repeatPct ?? 0) / 100,
    now: Date.now(),
  });
  if (!planned.length) return 0;
  const written = await writeItems(study, uid, planned);
  return written ?? (await listAssignments({ studyId: study.id, raterId: uid })).filter((a) => a.status === "pending").length;
}

/** Writes planned items. Returns null if another request already wrote this reader's items at these positions. */
async function writeItems(study: Study, uid: string, planned: (NewAssignment & { batch?: number })[]): Promise<number | null> {
  const now = Date.now();
  for (let i = 0; i < planned.length; i += 450) {
    const batch = db().batch();
    for (const a of planned.slice(i, i + 450)) {
      const doc: Omit<Assignment, "id"> = { ...a, studyId: study.id, script: study.script, status: "pending", createdAt: now };
      const ref = col.assignments().doc(itemId(study.id, uid, a.position));
      // create() fails if the first item already exists, i.e. another request is setting up this reader.
      if (i === 0) batch.create(ref, doc);
      else batch.set(ref, doc);
    }
    try {
      await batch.commit();
    } catch (e) {
      if (i === 0 && (e as { code?: number }).code === 6 /* ALREADY_EXISTS */) return null;
      throw e;
    }
  }
  return planned.length;
}
