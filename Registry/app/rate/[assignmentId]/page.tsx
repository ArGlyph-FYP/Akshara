import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRater } from "@/lib/auth";
import { col, criteriaFor, getStudy, raterQueue } from "@/lib/data";
import type { Assignment } from "@/lib/types";
import { PerceptionForm } from "./PerceptionForm";
import { RatingForm } from "./RatingForm";

export default async function RateItem({ params }: { params: Promise<{ assignmentId: string }> }) {
  const s = await requireRater();
  const { assignmentId } = await params;
  const snap = await col.assignments().doc(assignmentId).get();
  const a = snap.exists ? ({ id: snap.id, ...snap.data() } as Assignment) : null;
  if (!a || a.raterId !== s.uid) redirect("/rate");
  if (a.status === "done") redirect(`/rate/next?study=${a.studyId}`);
  const study = await getStudy(a.studyId);
  if (!study || !study.open) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">This study is closed</h1>
        <Link href="/rate" className="btn mt-4">
          Back
        </Link>
      </main>
    );
  }
  const queue = await raterQueue(s.uid, study.id);
  const common = {
    assignmentId: a.id,
    studyId: study.id,
    // Only the opaque sample ID reaches the browser. Participant codes and repeat status are never sent.
    imageSrc: `/api/image/${a.sampleId}`,
    position: queue.done + 1,
    total: queue.items.length,
  };

  if (study.type === "perception") {
    return <PerceptionForm key={a.id} {...common} title={study.title} scale={study.overallScale} instructions={study.instructions} />;
  }
  const criteria = await criteriaFor(study.script, study.rubricVersion ?? 1);
  return (
    <RatingForm
      key={a.id}
      {...common}
      isCalibration={a.kind === "anchor"}
      overallScale={study.overallScale}
      legibilityScale={study.legibilityScale ?? { min: 1, max: 5 }}
      criteria={criteria.map((c) => ({
        id: c.id,
        labelEn: c.labelEn,
        labelLocal: c.labelLocal,
        description: c.description,
        level: c.level,
        min: c.scaleMin,
        max: c.scaleMax,
      }))}
    />
  );
}
