import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { getSample, getSettings, listCriteria, listUsers, col } from "@/lib/data";
import type { Rating } from "@/lib/types";
import { STATUS_STYLE, day } from "@/lib/ui";
import { setAnchor, setStatus } from "../actions";

export default async function SampleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sample = await getSample(id);
  if (!sample) notFound();
  const [settings, criteria, users, ratingSnap] = await Promise.all([
    getSettings(),
    listCriteria(sample.script),
    listUsers(),
    col.ratings().where("sampleId", "==", id).get(),
  ]);
  const ratings = ratingSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Rating).sort((a, b) => a.submittedAt - b.submittedAt);
  const alias = Object.fromEntries(users.map((u) => [u.uid, u.alias]));
  const crit = Object.fromEntries(criteria.map((c) => [c.id, c]));

  return (
    <div className="space-y-4">
      <Link href={`/admin/samples?script=${sample.script}`} className="text-sm text-muted hover:text-ink">
        ← Samples
      </Link>
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="card p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/image/${sample.id}`} alt="" className="w-full" />
        </div>
        <div className="space-y-4">
          <div className="card space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <h1 className="h1 font-mono">
                {sample.participantCode} <span className="text-muted">p{sample.pageNo}</span>
              </h1>
              <span className={`pill ${STATUS_STYLE[sample.status]}`}>{sample.status}</span>
            </div>
            <dl className="grid grid-cols-2 gap-y-1 text-xs">
              <dt className="text-muted">Sample ID</dt>
              <dd className="font-mono">{sample.id}</dd>
              <dt className="text-muted">Writer ID</dt>
              <dd className="font-mono">{sample.writerId}</dd>
              <dt className="text-muted">Phase</dt>
              <dd>{sample.phase}</dd>
              <dt className="text-muted">Pixels</dt>
              <dd>
                {sample.width} × {sample.height}
              </dd>
              <dt className="text-muted">Uploaded</dt>
              <dd>
                {day(sample.uploadedAt)} by {sample.uploadedBy}
              </dd>
            </dl>
            {sample.status !== "excluded" && (
              <div className="flex gap-2 pt-1">
                {(["qc_ok", "rejected", "uploaded"] as const)
                  .filter((s) => s !== sample.status)
                  .map((s) => (
                    <ActionForm key={s} action={setStatus}>
                      <input type="hidden" name="ids" value={sample.id} />
                      <input type="hidden" name="status" value={s} />
                      <button className="btn btn-sm">{s === "qc_ok" ? "Approve" : s === "rejected" ? "Reject" : "Reset to unchecked"}</button>
                    </ActionForm>
                  ))}
              </div>
            )}
          </div>

          <div className="card text-sm">
            <h2 className="h2">Calibration anchor</h2>
            <p className="mb-3 text-xs text-muted">
              Anchors are shown to every rater of this script first. After rating, raters see these reference scores.
              Anchor ratings are flagged as <code>kind=anchor</code> in exports.
            </p>
            <ActionForm action={setAnchor} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={sample.id} />
              <label className="flex basis-full items-center gap-1.5">
                <input type="checkbox" name="isAnchor" value="1" defaultChecked={sample.isAnchor} /> Use as anchor
              </label>
              <div className="w-24">
                <label className="label">Overall ({settings.overallScale.min}–{settings.overallScale.max})</label>
                <input name="overall" type="number" min={settings.overallScale.min} max={settings.overallScale.max} defaultValue={sample.anchorScores?.overall ?? ""} className="input" />
              </div>
              <div className="w-24">
                <label className="label">Legibility ({settings.legibilityScale.min}–{settings.legibilityScale.max})</label>
                <input name="legibility" type="number" min={settings.legibilityScale.min} max={settings.legibilityScale.max} defaultValue={sample.anchorScores?.legibility ?? ""} className="input" />
              </div>
              <div className="basis-full">
                <label className="label">Explanation shown to raters</label>
                <textarea name="note" rows={2} defaultValue={sample.anchorScores?.note ?? ""} className="input" />
              </div>
              <button className="btn btn-primary">Save</button>
            </ActionForm>
          </div>

          <div className="card text-sm">
            <h2 className="h2 mb-2">Ratings ({ratings.length})</h2>
            {ratings.length === 0 ? (
              <p className="text-xs text-muted">None yet.</p>
            ) : (
              <table className="table text-xs">
                <thead>
                  <tr>
                    <th>Rater</th>
                    <th>Kind</th>
                    <th>Overall</th>
                    <th>Legib.</th>
                    <th>Regions</th>
                  </tr>
                </thead>
                <tbody>
                  {ratings.map((r) => (
                    <tr key={r.id} title={Object.entries(r.criterionScores).map(([k, v]) => `${crit[k]?.key ?? k}: ${v}`).join("\n")}>
                      <td>{alias[r.raterId] ?? "?"}</td>
                      <td>{r.kind}</td>
                      <td>{r.overall}</td>
                      <td>{r.legibility}</td>
                      <td>{r.regions.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
