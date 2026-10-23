import "server-only";
import { createHash } from "node:crypto";
import { planForNewReader, type ExistingAssignment } from "./assign";
import { col, db, getSamplesByIds, listAssignments } from "./data";
import type { Assignment, Sample, Study } from "./types";

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

/**
 * Gives a reader their samples in a public study (only the first time; later visits keep their queue).
 * Returns how many items they have in the study.
 */
export async function assignPublicReader(study: Study, uid: string): Promise<number> {
  const mine = await listAssignments({ studyId: study.id, raterId: uid });
  if (mine.length) return mine.length;
  const samples = (await usableStudySamples(study)).map((s) => ({ id: s.id, isAnchor: study.type === "rubric" && s.isAnchor }));
  const others = samples.filter((s) => !s.isAnchor).length;

  // Coverage (how many readers each sample already has) only matters when readers get a subset of the samples.
  // Then read just the two fields it needs; when everyone rates everything, skip reading other readers' items.
  let existing: ExistingAssignment[] = [];
  if (study.perReader && study.perReader < others) {
    const snap = await col.assignments().where("studyId", "==", study.id).select("sampleId", "kind").get();
    existing = snap.docs.map((d) => ({ raterId: "", position: -1, sampleId: d.get("sampleId"), kind: d.get("kind") }));
  }
  const planned = planForNewReader({
    samples,
    readerId: uid,
    existing,
    perReader: study.perReader ?? null,
    seed: `${study.id}:${uid}`,
    repeatFraction: study.type === "rubric" ? (study.repeatPct ?? 0) / 100 : 0,
  });

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
      if (i === 0 && (e as { code?: number }).code === 6 /* ALREADY_EXISTS */) {
        return (await listAssignments({ studyId: study.id, raterId: uid })).length || planned.length;
      }
      throw e;
    }
  }
  return planned.length;
}
