import "server-only";
import { planForNewReader } from "./assign";
import { newId } from "./codes";
import { col, db, listAssignments, listSamples } from "./data";
import type { Assignment, Study } from "./types";

export const publicLinkOpen = (s: Study | null): s is Study => !!s && s.open && !!s.publicOpen && !!s.publicToken;

/**
 * Gives a reader their samples in a public study (only the first time; later visits keep their queue).
 * Returns how many items they have in the study.
 */
export async function assignPublicReader(study: Study, uid: string): Promise<number> {
  const existing = await listAssignments({ studyId: study.id });
  const mine = existing.filter((a) => a.raterId === uid);
  if (mine.length) return mine.length;
  const wanted = new Set(study.sampleIds);
  const samples = (await listSamples({ script: study.script }))
    .filter((s) => wanted.has(s.id) && s.imagePath && s.status !== "excluded" && s.status !== "rejected")
    .map((s) => ({ id: s.id, isAnchor: false }));
  const planned = planForNewReader({ samples, readerId: uid, existing, perReader: study.perReader ?? null, seed: `${study.id}:${uid}` });
  const batch = db().batch();
  const now = Date.now();
  for (const a of planned) {
    const doc: Omit<Assignment, "id"> = { ...a, studyId: study.id, script: study.script, status: "pending", createdAt: now };
    batch.set(col.assignments().doc(newId()), doc);
  }
  await batch.commit();
  return planned.length;
}
