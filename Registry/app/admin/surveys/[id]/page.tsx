import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { getSurvey, listSamples, listSurveyReaders, listSurveyResponses } from "@/lib/data";
import { readerAlias } from "@/lib/export";
import { SCRIPT_LABEL } from "@/lib/types";
import { STATUS_STYLE } from "@/lib/ui";
import { setSurveyOpen, updateSurvey } from "../actions";

export default async function SurveyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const survey = await getSurvey(id);
  if (!survey) notFound();
  const [pilot, responses, readers] = await Promise.all([
    listSamples({ script: survey.script, phase: "pilot" }),
    listSurveyResponses(id),
    listSurveyReaders(id),
  ]);
  const candidates = pilot.filter((s) => s.status === "uploaded" || s.status === "qc_ok");
  const codeOf = Object.fromEntries(pilot.map((s) => [s.id, `${s.participantCode}${s.pageNo > 1 ? ` p${s.pageNo}` : ""}`]));
  const perSample = new Map<string, number>();
  for (const r of responses) perSample.set(r.sampleId, (perSample.get(r.sampleId) ?? 0) + 1);
  const finished = readers.filter(
    (rd) => responses.filter((r) => r.respondentUid === rd.uid).length >= survey.sampleIds.length,
  ).length;

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const shareUrl = `${origin}/survey/${survey.shareToken}`;

  return (
    <div className="space-y-6">
      <Link href="/admin/surveys" className="text-sm text-muted hover:text-ink">
        ← Surveys
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="h1">{survey.title}</h1>
          <p className="text-sm text-muted">
            {SCRIPT_LABEL[survey.script]} · {survey.sampleIds.length} samples · {readers.length} readers ({finished}{" "}
            finished) · {responses.length} responses
          </p>
        </div>
        <ActionForm action={setSurveyOpen} className="flex items-center gap-2">
          <input type="hidden" name="id" value={survey.id} />
          <input type="hidden" name="open" value={survey.open ? "0" : "1"} />
          {survey.open ? (
            <span className="pill bg-emerald-50 text-emerald-800">open</span>
          ) : (
            <span className="pill bg-stone-100 text-stone-700">closed</span>
          )}
          <button className="btn">{survey.open ? "Close survey" : "Open survey"}</button>
        </ActionForm>
      </div>

      <div className="card flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Share link:</span>
        <code className="rounded bg-stone-100 px-2 py-1 break-all">{shareUrl}</code>
        <CopyButton text={shareUrl} />
        <a
          href={`/api/export?scripts=${survey.script}&only=survey&survey=${survey.id}`}
          className="btn btn-sm ml-auto"
        >
          Download responses (CSV)
        </a>
      </div>

      <ActionForm action={updateSurvey} className="card space-y-4">
        <input type="hidden" name="id" value={survey.id} />
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Title</label>
            <input name="title" defaultValue={survey.title} className="input" />
          </div>
          <div className="md:row-span-2">
            <label className="label">Instructions shown to readers (any language)</label>
            <textarea name="instructions" rows={4} defaultValue={survey.instructions} className="input" />
          </div>
        </div>
        <div>
          <h2 className="h2">Pilot samples</h2>
          <p className="mb-2 text-xs text-muted">
            Only pilot-phase {SCRIPT_LABEL[survey.script]} scans can be used, which keeps them out of the main dataset.
            Each reader sees the ticked samples in their own random order.
          </p>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted">
              No pilot samples yet. Register pilot codes on Participants, then upload their scans.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {candidates.map((s) => (
                <label key={s.id} className="card flex cursor-pointer flex-col gap-1 p-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                  <div className="aspect-[1/1.414] overflow-hidden rounded bg-stone-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/image/${s.id}`} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" name="sampleIds" value={s.id} defaultChecked={survey.sampleIds.includes(s.id)} />
                    <span className="font-mono">{codeOf[s.id]}</span>
                    <span className={`pill ml-auto ${STATUS_STYLE[s.status]}`}>{s.status}</span>
                  </div>
                  <span className="text-xs text-muted">{perSample.get(s.id) ?? 0} responses</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-primary">Save survey</button>
      </ActionForm>

      <div className="card overflow-x-auto p-0">
        <h2 className="h2 px-4 pt-4">Latest responses</h2>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>Sample</th>
              <th>Reader</th>
              <th>Score</th>
              <th>Looks good because…</th>
              <th>Looks bad because…</th>
            </tr>
          </thead>
          <tbody>
            {responses
              .sort((a, b) => b.submittedAt - a.submittedAt)
              .slice(0, 100)
              .map((r) => (
                <tr key={`${r.respondentUid}_${r.sampleId}`}>
                  <td className="font-mono whitespace-nowrap">{codeOf[r.sampleId] ?? r.sampleId}</td>
                  <td className="font-mono">{readerAlias(r.respondentUid)}</td>
                  <td>{r.overall}</td>
                  <td className="max-w-sm">{r.likedText}</td>
                  <td className="max-w-sm">{r.dislikedText}</td>
                </tr>
              ))}
            {responses.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted">
                  No responses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
