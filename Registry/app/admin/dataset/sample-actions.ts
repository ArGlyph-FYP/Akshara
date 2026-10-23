"use server";

import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { run, str } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { AUTO_REGISTER_NOTE } from "@/lib/codes";
import { col, db, getSample, listAssignments, listRatings, listStudies, listUsers } from "@/lib/data";
import { adminBucket } from "@/lib/firebase/admin";
import type { Participant, Sample, SampleStatus } from "@/lib/types";

const STATUSES: SampleStatus[] = ["uploaded", "qc_ok", "rejected"];

export async function setStatus(_: unknown, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const status = str(fd, "status") as SampleStatus;
    if (!STATUSES.includes(status)) throw new Error("Bad status");
    const ids = str(fd, "ids").split(",").filter(Boolean);
    const batch = db().batch();
    for (const id of ids) batch.update(col.samples().doc(id), { status });
    await batch.commit();
    revalidatePath("/admin/dataset");
    return ids.length > 1 ? `${ids.length} samples marked ${status}` : undefined;
  });
}

/** Firestore batches hold at most 500 writes. */
async function deleteAll(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db().batch();
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

/**
 * Reject = remove from the dataset for good: the sample, its image files, its rating work and ratings,
 * and its place in studies. The original form page goes once no paragraph uses it, and a writer that was
 * only created by the upload goes once it has no samples left.
 */
export async function deleteSamples(_: unknown, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const ids = str(fd, "ids").split(",").filter(Boolean);
    if (!ids.length) throw new Error("Nothing selected");
    const studies = await listStudies();
    const bucket = adminBucket();
    const pages = new Set<string>();
    const codes = new Set<string>();
    let deleted = 0;
    let ratings = 0;
    for (const id of ids) {
      const snap = await col.samples().doc(id).get();
      if (!snap.exists) continue;
      const s = snap.data() as Sample;
      const [r, a] = await Promise.all([col.ratings().where("sampleId", "==", id).get(), col.assignments().where("sampleId", "==", id).get()]);
      ratings += r.size;
      await deleteAll([...r.docs, ...a.docs].map((d) => d.ref));
      const batch = db().batch();
      for (const st of studies) {
        if (st.sampleIds.includes(id)) batch.update(col.studies().doc(st.id), { sampleIds: FieldValue.arrayRemove(id) });
      }
      batch.delete(snap.ref);
      await batch.commit();
      for (const p of [s.imagePath, s.thumbPath]) if (p) await bucket.file(p).delete({ ignoreNotFound: true });
      if (s.sourcePath) pages.add(s.sourcePath);
      codes.add(s.participantCode);
      deleted++;
    }
    for (const p of pages) {
      const users = await col.samples().where("sourcePath", "==", p).limit(1).get();
      if (users.empty) await bucket.file(p).delete({ ignoreNotFound: true });
    }
    for (const code of codes) {
      const ref = col.participants().doc(code);
      const p = (await ref.get()).data() as Participant | undefined;
      if (p?.notes !== AUTO_REGISTER_NOTE) continue;
      const left = await col.samples().where("participantCode", "==", code).limit(1).get();
      if (left.empty) await ref.delete();
    }
    revalidatePath("/admin/dataset");
    return `Deleted ${deleted} sample${deleted === 1 ? "" : "s"}${ratings ? ` and ${ratings} rating${ratings === 1 ? "" : "s"}` : ""}`;
  });
}

export async function setAnchor(_: unknown, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const id = str(fd, "id");
    const isAnchor = str(fd, "isAnchor") === "1";
    const n = (k: string) => (str(fd, k) === "" ? null : Number(str(fd, k)));
    await col.samples().doc(id).update({
      isAnchor,
      anchorScores: isAnchor ? { overall: n("overall"), legibility: n("legibility"), note: str(fd, "note") } : null,
    });
    revalidatePath("/admin/dataset");
    return isAnchor ? "Saved as calibration anchor" : "No longer an anchor";
  });
}

export interface SampleDetail {
  id: string;
  code: string;
  writerId: string;
  pageNo: number;
  phase: string;
  status: string;
  width: number;
  height: number;
  uploadedAt: number;
  uploadedBy: string;
  consentReceivedAt: number | null;
  /** Split forms: where this paragraph sits on the original page, if the page was kept. */
  crop: { x: number; y: number; w: number; h: number } | null;
  hasPage: boolean;
  rated: boolean;
  imageV: number;
  isAnchor: boolean;
  anchorScores: { overall: number | null; legibility: number | null; note: string } | null;
  items: {
    rater: string;
    study: string;
    studyType: string;
    kind: string;
    status: "pending" | "done";
    overall?: number;
    legibility?: number | null;
    liked?: string;
    disliked?: string;
    regions?: number;
  }[];
}

/** Everything shown in the Dataset side panel for one sample. */
export async function sampleDetail(id: string): Promise<SampleDetail | { error: string }> {
  try {
    await assertAdmin();
    const sample = await getSample(id);
    if (!sample) return { error: "Sample not found" };
    const [participant, assignments, ratings, users, studies] = await Promise.all([
      col.participants().doc(sample.participantCode).get(),
      listAssignments({ sampleId: id }),
      listRatings({ sampleId: id }),
      listUsers(),
      listStudies(sample.script),
    ]);
    const alias = Object.fromEntries(users.map((u) => [u.uid, `${u.alias} · ${u.displayName}`]));
    const study = Object.fromEntries(studies.map((s) => [s.id, s]));
    const byAssignment = new Map(ratings.map((r) => [r.assignmentId, r]));
    return {
      id,
      code: sample.participantCode,
      writerId: sample.writerId,
      pageNo: sample.pageNo,
      phase: sample.phase,
      status: sample.status,
      width: sample.width,
      height: sample.height,
      uploadedAt: sample.uploadedAt,
      uploadedBy: sample.uploadedBy,
      consentReceivedAt: (participant.data()?.consentReceivedAt as number | null) ?? null,
      crop: sample.crop ?? null,
      hasPage: !!sample.sourcePath,
      rated: ratings.length > 0,
      imageV: sample.editedAt ?? sample.uploadedAt,
      isAnchor: sample.isAnchor,
      anchorScores: sample.anchorScores,
      items: assignments.map((a) => {
        const r = byAssignment.get(a.id);
        return {
          rater: alias[a.raterId] ?? "?",
          study: study[a.studyId]?.title ?? "(deleted study)",
          studyType: study[a.studyId]?.type ?? "",
          kind: a.kind,
          status: a.status,
          ...(r
            ? { overall: r.overall, legibility: r.legibility, liked: r.likedText, disliked: r.dislikedText, regions: r.regions.length }
            : {}),
        };
      }),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
