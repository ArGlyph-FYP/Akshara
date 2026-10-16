import Link from "next/link";
import { requireRater } from "@/lib/auth";
import { currentCriteria, getSettings, raterQueue } from "@/lib/data";
import { SCRIPT_LABEL } from "@/lib/types";

export default async function RateHome() {
  const s = await requireRater();
  const settings = await getSettings();
  const queues = await Promise.all(
    s.user.scripts.map(async (script) => ({
      script,
      ...(await raterQueue(s.uid, script)),
      criteria: (await currentCriteria(script)).criteria,
    })),
  );

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="h1">Welcome, {s.user.displayName}</h1>
        <p className="mt-1 text-sm text-muted">
          Rate how the handwriting <b>looks</b>: its visual quality and neatness. Don&apos;t judge spelling or
          content. Score legibility separately. Use the full scale, and mark the specific places that lower the
          score.
        </p>
      </div>

      {queues.length === 0 && <p className="card text-sm">You have no scripts assigned yet. Contact the research team.</p>}

      {queues.map((q) => (
        <section key={q.script} className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="h2">{SCRIPT_LABEL[q.script]}</h2>
              <p className="text-sm text-muted">
                {q.items.length === 0 ? "No items assigned yet." : `${q.done} of ${q.items.length} done`}
              </p>
            </div>
            {q.next ? (
              <Link href={`/rate/${q.next.id}`} className="btn btn-primary">
                {q.done === 0 ? "Start" : "Continue"}
              </Link>
            ) : (
              q.items.length > 0 && <span className="pill bg-emerald-50 text-emerald-800">All done, thank you!</span>
            )}
          </div>
          {q.items.length > 0 && (
            <div className="h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full bg-accent" style={{ width: `${(100 * q.done) / q.items.length}%` }} />
            </div>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Scoring guide</summary>
            <ul className="mt-2 space-y-2">
              <li>
                <b>Overall aesthetic</b> {settings.overallScale.min}–{settings.overallScale.max}: how good the
                handwriting looks as a whole.
              </li>
              <li>
                <b>Legibility</b> {settings.legibilityScale.min}–{settings.legibilityScale.max}: how easy it is to
                read, rated separately from how it looks.
              </li>
              {q.criteria.map((c) => (
                <li key={c.id}>
                  <b>{c.labelEn}</b> {c.labelLocal && <span>({c.labelLocal})</span>} · {c.level} · {c.scaleMin}–
                  {c.scaleMax}
                  {c.description && <p className="text-muted">{c.description}</p>}
                </li>
              ))}
            </ul>
          </details>
        </section>
      ))}
    </main>
  );
}
