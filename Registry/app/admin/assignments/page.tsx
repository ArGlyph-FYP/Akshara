import { ActionForm } from "@/components/ActionForm";
import { eligibleForRating, getSettings, listAssignments } from "@/lib/data";
import { SCRIPTS, SCRIPT_LABEL, type Scale } from "@/lib/types";
import { clearPending, generate, saveSettings } from "./actions";

export default async function AssignmentsPage() {
  const [settings, assignments] = await Promise.all([getSettings(), listAssignments()]);
  const perScript = await Promise.all(SCRIPTS.map(async (s) => ({ script: s, ...(await eligibleForRating(s)) })));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Rating assignments</h1>
        <p className="text-sm text-muted">
          Generating tops every approved main-phase sample up to the target number of raters, puts calibration
          anchors first in each queue, and adds blinded repeats later in the queue. Running it again only adds
          what&apos;s missing, so run it after each upload batch.
        </p>
      </div>

      <div className="card">
        <h2 className="h2 mb-3">Settings</h2>
        <ActionForm action={saveSettings} className="flex flex-wrap items-end gap-4">
          <div className="w-32">
            <label className="label">Raters per sample</label>
            <input name="ratersPerSample" type="number" min={1} defaultValue={settings.ratersPerSample} className="input" />
          </div>
          <div className="w-32">
            <label className="label">Blinded repeats %</label>
            <input name="repeatPct" type="number" min={0} max={50} defaultValue={Math.round(settings.repeatFraction * 100)} className="input" />
          </div>
          <ScaleInput name="overall" label="Overall scale" scale={settings.overallScale} />
          <ScaleInput name="legibility" label="Legibility scale" scale={settings.legibilityScale} />
          <ScaleInput name="survey" label="Survey scale" scale={settings.surveyScale} />
          <button className="btn">Save settings</button>
        </ActionForm>
      </div>

      {perScript.map(({ script, ready, raters }) => {
        const mine = assignments.filter((a) => a.script === script);
        const covered = new Map<string, number>();
        for (const a of mine) if (a.kind === "normal") covered.set(a.sampleId, (covered.get(a.sampleId) ?? 0) + 1);
        const underCovered = ready.filter((s) => !s.isAnchor && (covered.get(s.id) ?? 0) < settings.ratersPerSample).length;
        const anchors = ready.filter((s) => s.isAnchor).length;
        return (
          <div key={script} className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="h2">{SCRIPT_LABEL[script]}</h2>
              <ActionForm action={generate} className="flex items-center gap-2">
                <input type="hidden" name="script" value={script} />
                <button className="btn btn-primary" disabled={raters.length === 0}>
                  Generate assignments
                </button>
              </ActionForm>
            </div>
            <p className="text-sm text-muted">
              {ready.length - anchors} approved samples ({underCovered} need more raters) · {anchors} anchors ·{" "}
              {raters.length} active raters · {mine.filter((a) => a.status === "done").length}/{mine.length} items done
            </p>
            {raters.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Rater</th>
                    <th>Done</th>
                    <th>Pending</th>
                    <th>Anchors</th>
                    <th>Repeats</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {raters.map((r) => {
                    const items = mine.filter((a) => a.raterId === r.uid);
                    const pending = items.filter((a) => a.status === "pending").length;
                    return (
                      <tr key={r.uid}>
                        <td>
                          <span className="font-mono">{r.alias}</span> <span className="text-muted">{r.displayName}</span>
                        </td>
                        <td>{items.length - pending}</td>
                        <td>{pending}</td>
                        <td>{items.filter((a) => a.kind === "anchor").length}</td>
                        <td>{items.filter((a) => a.kind === "repeat").length}</td>
                        <td>
                          {pending > 0 && (
                            <ActionForm action={clearPending} confirm={`Remove ${pending} pending item(s) from ${r.alias}?`}>
                              <input type="hidden" name="raterId" value={r.uid} />
                              <input type="hidden" name="script" value={script} />
                              <button className="btn btn-sm btn-danger">Clear pending</button>
                            </ActionForm>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScaleInput({ name, label, scale }: { name: string; label: string; scale: Scale }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-1">
        <input name={`${name}Min`} type="number" defaultValue={scale.min} className="input w-14" />
        <span className="text-muted">–</span>
        <input name={`${name}Max`} type="number" defaultValue={scale.max} className="input w-14" />
      </div>
    </div>
  );
}
