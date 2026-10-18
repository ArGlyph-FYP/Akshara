import { CheckCircle2, ClipboardCheck, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { requireRater } from "@/lib/auth";
import { getStudy, listAssignments } from "@/lib/data";
import { SCRIPT_LABEL, type Study } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RateHome() {
  const s = await requireRater();
  const items = await listAssignments({ raterId: s.uid });
  const byStudy = new Map<string, typeof items>();
  for (const a of items) byStudy.set(a.studyId, [...(byStudy.get(a.studyId) ?? []), a]);
  const studies = (await Promise.all([...byStudy.keys()].map((id) => getStudy(id)))).filter(Boolean) as Study[];
  studies.sort((a, b) => Number(b.open) - Number(a.open) || b.createdAt - a.createdAt);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {s.user.displayName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Judge how the handwriting <b>looks</b>, not spelling or content. There are no right answers; go with your
          honest impression.
        </p>
      </div>

      {studies.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Nothing to rate here yet. Open the study link the research team sent you to begin.
        </div>
      )}

      {studies.map((st) => {
        const mine = (byStudy.get(st.id) ?? []).sort((a, b) => a.position - b.position);
        const done = mine.filter((a) => a.status === "done").length;
        const next = mine.find((a) => a.status === "pending");
        const Icon = st.type === "perception" ? MessageSquareText : ClipboardCheck;
        return (
          <section key={st.id} className="space-y-4 rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-primary">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{st.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {SCRIPT_LABEL[st.script]} · {st.type === "perception" ? "score and your reasons" : "score, legibility and qualities"} · {done} of {mine.length} done
                </p>
              </div>
              {!st.open ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Closed</span>
              ) : next ? (
                <Button asChild>
                  <Link href={`/rate/${next.id}`}>{done === 0 ? "Start" : "Continue"}</Link>
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1 text-sm text-success">
                  <CheckCircle2 className="size-4" /> All done, thank you!
                </span>
              )}
            </div>
            <Progress value={mine.length ? (100 * done) / mine.length : 0} />
            {st.instructions && <p className="text-sm whitespace-pre-line text-muted-foreground">{st.instructions}</p>}
          </section>
        );
      })}
    </main>
  );
}
