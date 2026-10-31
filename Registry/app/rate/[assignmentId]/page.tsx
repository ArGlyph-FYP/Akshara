import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireRater } from "@/lib/auth";
import { col, criteriaFor, getSamplesByIds, getStudy, raterQueue } from "@/lib/data";
import type { Assignment } from "@/lib/types";
import { MainRatingForm } from "./MainRatingForm";
import { PerceptionForm } from "./PerceptionForm";
import { RatingForm } from "./RatingForm";

export default async function RateItem({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const [s, snap] = await Promise.all([requireRater(), col.assignments().doc(assignmentId).get()]);
  const a = snap.exists ? ({ id: snap.id, ...snap.data() } as Assignment) : null;
  if (!a || a.raterId !== s.uid) redirect("/rate");
  if (a.status !== "pending") redirect(`/rate/next?study=${a.studyId}`);
  const [study, queue] = await Promise.all([getStudy(a.studyId), raterQueue(s.uid, a.studyId)]);
  if (!study || !study.open) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">This study is closed</h1>
        <p className="mt-2 text-sm text-muted-foreground">Thank you for your help. The research team has stopped collecting responses.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/rate">Back</Link>
        </Button>
      </main>
    );
  }
  // The item that comes after this one, so the form can load it in the background and go straight there.
  // Without one, /rate/next decides (thank-you screen or the study list).
  const after = queue.items.find((x) => x.status === "pending" && x.id !== a.id);
  const common = {
    assignmentId: a.id,
    studyId: study.id,
    // Only the opaque sample ID reaches the browser. Participant codes and repeat status are never sent.
    imageSrc: `/api/image/${a.sampleId}`,
    // Place in the queue (not the done count), so a page loaded ahead of time shows the right number.
    position: queue.items.findIndex((x) => x.id === a.id) + 1,
    total: queue.items.length,
    next: after
      ? { href: `/rate/${after.id}`, imageSrc: `/api/image/${after.sampleId}` }
      : { href: `/rate/next?study=${study.id}`, imageSrc: null },
  };

  if (study.type === "perception") {
    return <PerceptionForm key={a.id} {...common} title={study.title} scale={study.overallScale} instructions={study.instructions} />;
  }
  const criteria = criteriaFor(study.script);

  if (study.script === "si") {
    // Progress counts within the current 10-sample form; the block (text 1 / text 2) comes from the paragraph number.
    const batch = a.batch ?? 1;
    const form = queue.items.filter((x) => (x.batch ?? 1) === batch);
    const at = form.findIndex((x) => x.id === a.id);
    const parts = new Map((await getSamplesByIds([...new Set(form.map((x) => x.sampleId))])).map((x) => [x.id, x.part ?? null]));
    const blockOf = (x: Assignment) => (x.kind === "anchor" ? null : parts.get(x.sampleId) === 2 ? 2 : 1);
    const block = blockOf(a);
    const prev = at > 0 ? form[at - 1] : null;
    return (
      <MainRatingForm
        key={a.id}
        {...common}
        position={at + 1}
        total={form.length}
        isCalibration={a.kind === "anchor"}
        block={block}
        blockChanged={block === 2 && !!prev && blockOf(prev) !== 2}
        title={study.title}
        instructions={study.instructions}
        overallScale={study.overallScale}
        legibilityScale={study.legibilityScale ?? { min: 1, max: 10 }}
        criteria={criteria.map((c) => ({
          id: c.id,
          key: c.key,
          labelEn: c.labelEn,
          labelLocal: c.labelLocal,
          description: c.description,
          min: c.scaleMin,
          max: c.scaleMax,
        }))}
      />
    );
  }

  return (
    <RatingForm
      key={a.id}
      {...common}
      isCalibration={a.kind === "anchor"}
      title={study.title}
      instructions={study.instructions}
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
