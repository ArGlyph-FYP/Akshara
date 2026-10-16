import { redirect } from "next/navigation";
import { requireRater } from "@/lib/auth";
import { col, currentCriteria, getSettings, raterQueue } from "@/lib/data";
import type { Assignment } from "@/lib/types";
import { RatingForm } from "./RatingForm";

export default async function RateItem({ params }: { params: Promise<{ assignmentId: string }> }) {
  const s = await requireRater();
  const { assignmentId } = await params;
  const snap = await col.assignments().doc(assignmentId).get();
  const a = snap.exists ? ({ id: snap.id, ...snap.data() } as Assignment) : null;
  if (!a || a.raterId !== s.uid || !s.user.scripts.includes(a.script)) redirect("/rate");
  if (a.status === "done") redirect(`/rate/next?script=${a.script}`);

  const [settings, { criteria }, queue] = await Promise.all([getSettings(), currentCriteria(a.script), raterQueue(s.uid, a.script)]);

  return (
    <RatingForm
      // Only the opaque sample ID reaches the browser. Participant codes and repeat status are never sent.
      key={a.id}
      assignmentId={a.id}
      script={a.script}
      imageSrc={`/api/image/${a.sampleId}`}
      isCalibration={a.kind === "anchor"}
      position={queue.done + 1}
      total={queue.items.length}
      overallScale={settings.overallScale}
      legibilityScale={settings.legibilityScale}
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
