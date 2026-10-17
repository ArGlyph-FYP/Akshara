"use server";

import { revalidatePath } from "next/cache";
import { run, str } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { col, db, getSample, listAssignments, listRatings, listStudies, listUsers } from "@/lib/data";
import type { SampleStatus } from "@/lib/types";

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
