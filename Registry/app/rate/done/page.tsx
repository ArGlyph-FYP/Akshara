import { redirect } from "next/navigation";
import { surveyText } from "@/app/_survey/i18n";
import { requireRater } from "@/lib/auth";
import { getStudy, raterQueue } from "@/lib/data";
import { formSize } from "@/lib/public";
import { MoreButton } from "./MoreButton";

/** Main study: end of a form. Thanks the reader and offers another form of samples. */
export default async function FormDone({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRater();
  const id = (await searchParams).study;
  const study = id ? await getStudy(id) : null;
  if (!study || study.type !== "rubric") redirect("/rate");
  const { next, items } = await raterQueue(s.uid, study.id);
  if (next) redirect(`/rate/${next.id}`);
  const t = surveyText(study.script);
  const rated = items.filter((a) => a.status === "done" && a.kind !== "repeat").length;
  const canMore = study.open && !!study.publicOpen;
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t.doneTitle}</h1>
      <p className="text-sm text-muted-foreground">{t.doneBody(rated)}</p>
      {canMore ? (
        <>
          {rated >= 30 && <p className="rounded-lg bg-muted/60 p-3 text-sm">{t.breakNote}</p>}
          <MoreButton studyId={study.id} label={t.rateMore(formSize(study))} fullText={t.allFull} closedText={t.closedTitle} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t.closedBody}</p>
      )}
    </main>
  );
}
