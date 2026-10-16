import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { ScriptTabs, parseScript } from "@/components/ScriptTabs";
import { listSamples } from "@/lib/data";
import type { Phase, SampleStatus } from "@/lib/types";
import { STATUS_STYLE } from "@/lib/ui";
import { setStatus } from "./actions";


export default async function SamplesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const script = parseScript(sp.script);
  const phase = (["pilot", "main"].includes(sp.phase) ? sp.phase : undefined) as Phase | undefined;
  const status = (Object.keys(STATUS_STYLE).includes(sp.status) ? sp.status : undefined) as SampleStatus | undefined;
  const samples = await listSamples({ script, phase, status });
  const toApprove = samples.filter((s) => s.status === "uploaded").map((s) => s.id);

  const link = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { script, phase, status, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/admin/samples?${q}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Samples</h1>
          <p className="text-sm text-muted">Check each scan is complete and readable, then approve it for rating.</p>
        </div>
        <ScriptTabs base="/admin/samples" current={script} params={{ phase, status }} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Phase:</span>
        {[undefined, "pilot", "main"].map((p) => (
          <Link key={p ?? "all"} href={link({ phase: p })} className={`pill ${phase === p ? "bg-accent text-white" : "bg-white border border-line"}`}>
            {p ?? "all"}
          </Link>
        ))}
        <span className="ml-3 text-muted">Status:</span>
        {[undefined, "uploaded", "qc_ok", "rejected", "excluded"].map((s) => (
          <Link key={s ?? "all"} href={link({ status: s })} className={`pill ${status === s ? "bg-accent text-white" : "bg-white border border-line"}`}>
            {s ?? "all"}
          </Link>
        ))}
        {toApprove.length > 0 && (
          <ActionForm action={setStatus} className="ml-auto" confirm={`Approve ${toApprove.length} sample(s) without opening them?`}>
            <input type="hidden" name="ids" value={toApprove.join(",")} />
            <input type="hidden" name="status" value="qc_ok" />
            <button className="btn btn-sm">Approve all {toApprove.length} unchecked</button>
          </ActionForm>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {samples.map((s) => (
          <div key={s.id} className="card flex flex-col gap-2 p-2">
            <Link href={`/admin/samples/${s.id}`} className="block aspect-[1/1.414] overflow-hidden rounded bg-stone-100">
              {s.imagePath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/image/${s.id}`} alt={`${s.participantCode} page ${s.pageNo}`} loading="lazy" className="h-full w-full object-cover object-top" />
              )}
            </Link>
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-medium">
                {s.participantCode}
                {s.pageNo > 1 && ` p${s.pageNo}`}
              </span>
              <span className={`pill ${STATUS_STYLE[s.status]}`}>{s.status}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted">
              {s.phase}
              {s.isAnchor && <span className="pill bg-sky-50 text-sky-800">anchor</span>}
            </div>
            {s.status !== "excluded" && (
              <div className="flex gap-1">
                {(["qc_ok", "rejected"] as const)
                  .filter((st) => st !== s.status)
                  .map((st) => (
                    <ActionForm key={st} action={setStatus} className="flex-1">
                      <input type="hidden" name="ids" value={s.id} />
                      <input type="hidden" name="status" value={st} />
                      <button className="btn btn-sm w-full">{st === "qc_ok" ? "Approve" : "Reject"}</button>
                    </ActionForm>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {samples.length === 0 && <p className="py-10 text-center text-sm text-muted">No samples match.</p>}
    </div>
  );
}
