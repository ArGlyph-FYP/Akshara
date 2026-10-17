import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getStudy, listAssignments, listCriteria, listRatings, listSamples, ratersFor } from "@/lib/data";
import { StudyDetail, type StudyData } from "./StudyDetail";

export const dynamic = "force-dynamic";

export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const study = await getStudy(id);
  if (!study) notFound();
  const [assignments, ratings, samples, raters, criteria] = await Promise.all([
    listAssignments({ studyId: id }),
    listRatings({ studyId: id }),
    listSamples({ script: study.script }),
    ratersFor(study.script),
    listCriteria(study.script),
  ]);
  const inStudy = new Set(study.sampleIds);
  const ratingByAssignment = new Map(ratings.map((r) => [r.assignmentId, r]));
  const data: StudyData = {
    study,
    samples: samples.filter((s) => inStudy.has(s.id)).map((s) => ({ id: s.id, code: s.participantCode, pageNo: s.pageNo })),
    raters: raters.map((r) => ({
      uid: r.uid,
      name: r.displayName,
      email: r.email,
      alias: r.alias,
      role: r.role,
      public: !!r.public,
      nativeReader: r.nativeReader ?? null,
    })),
    items: assignments.map((a) => {
      const r = ratingByAssignment.get(a.id);
      return {
        id: a.id,
        raterId: a.raterId,
        sampleId: a.sampleId,
        kind: a.kind,
        status: a.status,
        rating: r
          ? {
              overall: r.overall,
              legibility: r.legibility,
              liked: r.likedText,
              disliked: r.dislikedText,
              regions: r.regions.length,
              criteria: Object.entries(r.criterionScores).map(([cid, v]) => `${criteria.find((c) => c.id === cid)?.key ?? cid}: ${v}`).join(", "),
              durationMs: r.durationMs,
              submittedAt: r.submittedAt,
            }
          : null,
      };
    }),
  };
  return <StudyDetail data={data} />;
}
