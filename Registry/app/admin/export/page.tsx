import { buildExport } from "@/lib/export";
import { loadExportData } from "@/lib/exportData";
import { adminDb } from "@/lib/firebase/admin";
import { SCRIPTS, SCRIPT_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const { data } = await loadExportData(adminDb(), { includeSurveys: true });
  const preview = SCRIPTS.map((script) => ({
    script,
    main: buildExport(data, { scripts: [script], phases: ["main"], qcOnly: true, mode: "public", includeSurveys: false }).counts,
    pilot: buildExport(data, { scripts: [script], phases: ["pilot"], qcOnly: false, mode: "public", includeSurveys: true }).counts,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Download dataset</h1>
        <p className="text-sm text-muted">
          Withdrawn participants are always left out. A <b>public</b> export has no participant codes, only random
          writer IDs, and is the version to release. Use <b>internal</b> only inside the team.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {preview.map((p) => (
          <div key={p.script} className="card text-sm">
            <h2 className="h2 mb-2">{SCRIPT_LABEL[p.script]}</h2>
            <p>
              Main, approved: <b>{p.main.samples}</b> samples from {p.main.writers} writers · {p.main.ratings} ratings ·{" "}
              {p.main.regions} regions
            </p>
            <p className="text-muted">
              Pilot: {p.pilot.samples} samples · {p.pilot.survey_responses} survey responses
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="btn btn-primary btn-sm" href={`/api/export?scripts=${p.script}&phases=main&qc=1&mode=public&images=1`}>
                Public dataset (ZIP)
              </a>
              <a className="btn btn-sm" href={`/api/export?scripts=${p.script}&phases=main&qc=1&mode=public&images=0`}>
                Labels only
              </a>
              <a className="btn btn-sm" href={`/api/export?scripts=${p.script}&only=survey`}>
                Survey responses (CSV)
              </a>
            </div>
          </div>
        ))}
      </div>

      <form action="/api/export" method="get" className="card space-y-4 text-sm">
        <h2 className="h2">Custom export</h2>
        <div className="flex flex-wrap gap-8">
          <fieldset>
            <legend className="label">Scripts</legend>
            {SCRIPTS.map((s) => (
              <label key={s} className="mr-3 inline-flex items-center gap-1.5">
                <input type="checkbox" name="script" value={s} defaultChecked /> {SCRIPT_LABEL[s]}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className="label">Phases</legend>
            <label className="mr-3 inline-flex items-center gap-1.5">
              <input type="checkbox" name="phase" value="main" defaultChecked /> Main (B)
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" name="phase" value="pilot" /> Pilot (A)
            </label>
          </fieldset>
          <fieldset>
            <legend className="label">Samples</legend>
            <select name="qc" className="input" defaultValue="1">
              <option value="1">QC-approved only</option>
              <option value="0">Approved + unchecked</option>
            </select>
          </fieldset>
          <fieldset>
            <legend className="label">Identity</legend>
            <select name="mode" className="input" defaultValue="public">
              <option value="public">Public (writer IDs only)</option>
              <option value="internal">Internal (with participant codes)</option>
            </select>
          </fieldset>
          <fieldset>
            <legend className="label">Include</legend>
            <label className="mr-3 inline-flex items-center gap-1.5">
              <input type="checkbox" name="images" value="1" defaultChecked /> Images
            </label>
            <input type="hidden" name="images" value="0" />
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" name="surveys" value="1" /> Survey responses
            </label>
          </fieldset>
        </div>
        <button className="btn btn-primary">Download ZIP</button>
        <p className="text-xs text-muted">
          Contents: manifest.json (filters, counts, SHA-256 per image), samples.csv, ratings.csv, criterion_scores.csv,
          regions.json (COCO-style boxes), criteria.json, survey_responses.csv, images/. For the training pipeline you
          can also run <code>npm run export -- --out ../data</code>.
        </p>
      </form>
    </div>
  );
}
