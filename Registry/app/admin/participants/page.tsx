import { ActionForm } from "@/components/ActionForm";
import { ScriptTabs, parseScript } from "@/components/ScriptTabs";
import { listParticipants, listSamples } from "@/lib/data";
import { day } from "@/lib/ui";
import { issueCodes, purge, registerCode, reinstate, saveNotes, setConsent, setPhase, withdraw } from "./actions";


export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const script = parseScript(sp.script);
  const [participants, samples] = await Promise.all([listParticipants(script), listSamples(script ? { script } : {})]);
  const scanCount = new Map<string, number>();
  for (const s of samples) scanCount.set(s.participantCode, (scanCount.get(s.participantCode) ?? 0) + 1);

  const consented = participants.filter((p) => p.consentReceivedAt && p.status === "active").length;
  const withdrawn = participants.filter((p) => p.status === "withdrawn").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Participants</h1>
          <p className="text-sm text-muted">
            Codes only. Names stay on the paper consent forms, which are never scanned.
          </p>
        </div>
        <ScriptTabs base="/admin/participants" current={script} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="h2">Issue new codes</h2>
          <p className="mb-3 text-xs text-muted">Takes the next free numbers. Write them on the forms before handing them out.</p>
          <ActionForm action={issueCodes} className="flex flex-wrap items-end gap-2">
            <ScriptSelect />
            <PhaseSelect />
            <div className="w-20">
              <label className="label">How many</label>
              <input name="count" type="number" min={1} max={200} defaultValue={10} className="input" />
            </div>
            <button className="btn btn-primary">Issue</button>
          </ActionForm>
        </div>
        <div className="card">
          <h2 className="h2">Register an existing code</h2>
          <p className="mb-3 text-xs text-muted">For a form that already has a code written on it.</p>
          <ActionForm action={registerCode} className="flex flex-wrap items-end gap-2">
            <div className="w-28">
              <label className="label">Code</label>
              <input name="code" placeholder="SI-001" required className="input" />
            </div>
            <PhaseSelect />
            <label className="flex items-center gap-1.5 pb-2 text-sm">
              <input type="checkbox" name="consent" /> Consent form received
            </label>
            <button className="btn btn-primary">Register</button>
          </ActionForm>
        </div>
      </div>

      <p className="text-sm text-muted">
        {participants.length} codes · {consented} with consent · {withdrawn} withdrawn
      </p>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Phase</th>
              <th>Consent</th>
              <th>Scans</th>
              <th>Status</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.code} className={p.status === "withdrawn" ? "bg-stone-50 text-muted" : ""}>
                <td className="font-mono font-medium">{p.code}</td>
                <td>
                  <ActionForm action={setPhase} className="flex gap-1">
                    <input type="hidden" name="code" value={p.code} />
                    <select name="phase" defaultValue={p.phase} className="input w-24 py-0.5">
                      <option value="pilot">pilot</option>
                      <option value="main">main</option>
                    </select>
                    <button className="btn btn-sm">Set</button>
                  </ActionForm>
                </td>
                <td>
                  <ActionForm action={setConsent} className="flex items-center gap-2">
                    <input type="hidden" name="code" value={p.code} />
                    {p.consentReceivedAt ? (
                      <>
                        <span className="pill bg-emerald-50 text-emerald-800" title={`Checked by ${p.consentVerifiedBy}`}>
                          ✓ {day(p.consentReceivedAt)}
                        </span>
                        <input type="hidden" name="received" value="0" />
                        <button className="text-xs text-muted underline">undo</button>
                      </>
                    ) : (
                      <>
                        <input type="hidden" name="received" value="1" />
                        <button className="btn btn-sm">Mark received</button>
                      </>
                    )}
                  </ActionForm>
                </td>
                <td>{scanCount.get(p.code) ?? 0}</td>
                <td>
                  {p.status === "withdrawn" ? (
                    <span className="pill bg-red-50 text-red-700">withdrawn {day(p.withdrawnAt)}</span>
                  ) : (
                    <span className="pill bg-stone-100 text-stone-700">active</span>
                  )}
                </td>
                <td className="min-w-48">
                  <ActionForm action={saveNotes} className="flex gap-1">
                    <input type="hidden" name="code" value={p.code} />
                    <input name="notes" defaultValue={p.notes} className="input py-0.5" />
                    <button className="btn btn-sm">Save</button>
                  </ActionForm>
                </td>
                <td>
                  {p.status === "active" ? (
                    <ActionForm
                      action={withdraw}
                      confirm={`Withdraw ${p.code}? Their samples will be excluded from rating and exports.`}
                    >
                      <input type="hidden" name="code" value={p.code} />
                      <button className="btn btn-sm btn-danger">Withdraw</button>
                    </ActionForm>
                  ) : (
                    <div className="flex gap-1">
                      <ActionForm action={reinstate}>
                        <input type="hidden" name="code" value={p.code} />
                        <button className="btn btn-sm">Reinstate</button>
                      </ActionForm>
                      <ActionForm
                        action={purge}
                        confirm={`Permanently delete all scans, ratings and survey responses for ${p.code}? This cannot be undone.`}
                      >
                        <input type="hidden" name="code" value={p.code} />
                        <button className="btn btn-sm btn-danger">Delete data</button>
                      </ActionForm>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {participants.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted">
                  No participants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScriptSelect() {
  return (
    <div className="w-28">
      <label className="label">Script</label>
      <select name="script" className="input" defaultValue="si">
        <option value="si">Sinhala (SI)</option>
        <option value="ta">Tamil (TA)</option>
      </select>
    </div>
  );
}

function PhaseSelect() {
  return (
    <div className="w-28">
      <label className="label">Phase</label>
      <select name="phase" className="input" defaultValue="main">
        <option value="pilot">Pilot (A)</option>
        <option value="main">Main (B)</option>
      </select>
    </div>
  );
}
