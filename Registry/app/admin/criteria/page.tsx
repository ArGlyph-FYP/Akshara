import { ActionForm } from "@/components/ActionForm";
import { ScriptTabs, parseScript } from "@/components/ScriptTabs";
import { getSettings, listCriteria } from "@/lib/data";
import { LEVELS, SCRIPT_LABEL, type Criterion } from "@/lib/types";
import { addCriterion, newRubricVersion, updateCriterion } from "./actions";

export default async function CriteriaPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const script = parseScript((await searchParams).script) ?? "si";
  const [settings, criteria] = await Promise.all([getSettings(), listCriteria(script)]);
  const version = settings.rubricVersion[script];
  const current = criteria.filter((c) => c.rubricVersion === version);
  const older = criteria.filter((c) => c.rubricVersion !== version);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Rubric criteria</h1>
          <p className="text-sm text-muted">
            The criteria raters score and tag regions with. Each script has its own rubric, so the Sinhala and Tamil
            criteria are evaluated independently.
          </p>
        </div>
        <ScriptTabs base="/admin/criteria" current={script} allowAll={false} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="pill bg-accent-soft text-accent">
          {SCRIPT_LABEL[script]} rubric v{version}
        </span>
        <ActionForm
          action={newRubricVersion}
          confirm={`Start v${version + 1}? Existing ratings stay linked to v${version}.`}
        >
          <input type="hidden" name="script" value={script} />
          <button className="btn btn-sm">Start new version</button>
        </ActionForm>
      </div>

      <div className="space-y-2">
        {current.map((c) => (
          <CriterionRow key={c.id} c={c} />
        ))}
        {current.length === 0 && <p className="text-sm text-muted">No criteria in this version yet.</p>}
      </div>

      <div className="card">
        <h2 className="h2 mb-3">Add criterion to v{version}</h2>
        <ActionForm action={addCriterion} className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <input type="hidden" name="script" value={script} />
          <CriterionFields />
          <div className="col-span-2 flex items-end md:col-span-6">
            <button className="btn btn-primary">Add</button>
          </div>
        </ActionForm>
      </div>

      {older.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm text-muted">Earlier versions ({older.length} criteria)</summary>
          <table className="table mt-2">
            <tbody>
              {older.map((c) => (
                <tr key={c.id}>
                  <td>v{c.rubricVersion}</td>
                  <td className="font-mono">{c.key}</td>
                  <td>{c.labelEn}</td>
                  <td>{c.labelLocal}</td>
                  <td>{c.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

function CriterionRow({ c }: { c: Criterion }) {
  return (
    <div className={`card ${c.active ? "" : "opacity-60"}`}>
      <ActionForm action={updateCriterion} className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <input type="hidden" name="id" value={c.id} />
        <CriterionFields c={c} />
        <div className="col-span-2 flex items-end gap-2 md:col-span-6">
          <select name="active" defaultValue={c.active ? "1" : "0"} className="input w-28">
            <option value="1">active</option>
            <option value="0">inactive</option>
          </select>
          <button className="btn">Save</button>
        </div>
      </ActionForm>
    </div>
  );
}

function CriterionFields({ c }: { c?: Criterion }) {
  return (
    <>
      <div>
        <label className="label">Key</label>
        <input name="key" required defaultValue={c?.key} placeholder="baseline_alignment" className="input font-mono" />
      </div>
      <div>
        <label className="label">Level</label>
        <select name="level" defaultValue={c?.level ?? "line"} className="input">
          {LEVELS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">English label</label>
        <input name="labelEn" defaultValue={c?.labelEn} className="input" />
      </div>
      <div>
        <label className="label">Local label</label>
        <input name="labelLocal" defaultValue={c?.labelLocal} className="input" />
      </div>
      <div className="flex gap-2">
        <div>
          <label className="label">Min</label>
          <input name="scaleMin" type="number" defaultValue={c?.scaleMin ?? 1} className="input" />
        </div>
        <div>
          <label className="label">Max</label>
          <input name="scaleMax" type="number" defaultValue={c?.scaleMax ?? 5} className="input" />
        </div>
      </div>
      <div>
        <label className="label">Order</label>
        <input name="order" type="number" defaultValue={c?.order ?? 0} className="input" />
      </div>
      <div className="col-span-2 md:col-span-6">
        <label className="label">Guidance shown to raters</label>
        <textarea name="description" rows={2} defaultValue={c?.description} className="input" />
      </div>
    </>
  );
}
