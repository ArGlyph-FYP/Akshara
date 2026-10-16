import Link from "next/link";
import { getSettings, listAssignments, listParticipants, listSamples, listSurveys, listUsers, col } from "@/lib/data";
import { SCRIPTS, SCRIPT_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [participants, samples, assignments, users, surveys, settings] = await Promise.all([
    listParticipants(),
    listSamples(),
    listAssignments(),
    listUsers(),
    listSurveys(),
    getSettings(),
  ]);
  const surveyCounts = await Promise.all(
    surveys.map(async (s) => ({ s, n: (await col.surveys().doc(s.id).collection("responses").count().get()).data().count })),
  );

  return (
    <div className="space-y-6">
      <h1 className="h1">Dashboard</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        {SCRIPTS.map((script) => {
          const ps = participants.filter((p) => p.script === script);
          const active = ps.filter((p) => p.status === "active");
          const ss = samples.filter((s) => s.script === script);
          const main = ss.filter((s) => s.phase === "main");
          const as = assignments.filter((a) => a.script === script);
          const done = as.filter((a) => a.status === "done").length;
          const coverage = new Map<string, number>();
          for (const a of as) if (a.kind === "normal" && a.status === "done") coverage.set(a.sampleId, (coverage.get(a.sampleId) ?? 0) + 1);
          const approvedMain = main.filter((s) => s.status === "qc_ok" && !s.isAnchor);
          const fullyRated = approvedMain.filter((s) => (coverage.get(s.id) ?? 0) >= settings.ratersPerSample).length;
          const raters = users.filter((u) => u.active && u.role === "rater" && u.scripts.includes(script)).length;
          const sv = surveyCounts.filter((x) => x.s.script === script);

          return (
            <section key={script} className="card space-y-4">
              <h2 className="h2">{SCRIPT_LABEL[script]}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Codes issued" value={ps.length} sub={`${ps.filter((p) => p.status === "withdrawn").length} withdrawn`} />
                <Stat label="Consent received" value={active.filter((p) => p.consentReceivedAt).length} sub={`${active.filter((p) => !p.consentReceivedAt).length} waiting`} />
                <Stat label="Main scans" value={main.length} sub={`${main.filter((s) => s.status === "uploaded").length} to check`} />
                <Stat label="Pilot scans" value={ss.length - main.length} />
              </div>
              <Bar label="Main samples fully rated" n={fullyRated} total={approvedMain.length} hint={`target ${settings.ratersPerSample} raters each`} />
              <Bar label="Rating items done" n={done} total={as.length} hint={`${raters} active raters`} />
              <Bar label="Writers toward ~60 target" n={new Set(approvedMain.map((s) => s.participantCode)).size} total={60} />
              <div className="text-sm">
                <span className="text-muted">Survey responses: </span>
                {sv.length === 0 ? (
                  <Link href="/admin/surveys" className="text-accent hover:underline">
                    create a survey
                  </Link>
                ) : (
                  sv.map(({ s, n }) => (
                    <Link key={s.id} href={`/admin/surveys/${s.id}`} className="mr-3 text-accent hover:underline">
                      {s.title}: {n} {s.open ? "(open)" : "(closed)"}
                    </Link>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-md bg-stone-50 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Bar({ label, n, total, hint }: { label: string; n: number; total: number; hint?: string }) {
  const pct = total ? Math.min(100, (100 * n) / total) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>
          {label} {hint && <span className="text-muted">· {hint}</span>}
        </span>
        <span className="tabular-nums">
          {n} / {total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
