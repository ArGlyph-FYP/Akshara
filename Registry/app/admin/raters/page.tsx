import { ActionForm } from "@/components/ActionForm";
import { listAssignments, listUsers } from "@/lib/data";
import { SCRIPTS, SCRIPT_LABEL } from "@/lib/types";
import { inviteUser, makeLoginLink, updateUser } from "./actions";

export default async function RatersPage() {
  const [users, assignments] = await Promise.all([listUsers(), listAssignments()]);
  const progress = new Map<string, { done: number; total: number }>();
  for (const a of assignments) {
    const p = progress.get(a.raterId) ?? { done: 0, total: 0 };
    p.total++;
    if (a.status === "done") p.done++;
    progress.set(a.raterId, p);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Team & raters</h1>
        <p className="text-sm text-muted">
          Admins manage everything. Raters only see their own queue for the scripts ticked here, and never see
          participant codes. Exports identify raters only by alias.
        </p>
      </div>

      <div className="card">
        <h2 className="h2 mb-3">Add a person</h2>
        <ActionForm action={inviteUser} className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <label className="label">Email</label>
            <input name="email" type="email" required className="input" />
          </div>
          <div className="w-48">
            <label className="label">Name (internal only)</label>
            <input name="displayName" className="input" />
          </div>
          <div className="w-28">
            <label className="label">Role</label>
            <select name="role" className="input" defaultValue="rater">
              <option value="rater">Rater</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <fieldset className="flex gap-3 pb-2 text-sm">
            {SCRIPTS.map((s) => (
              <label key={s} className="flex items-center gap-1">
                <input type="checkbox" name="scripts" value={s} /> {SCRIPT_LABEL[s]}
              </label>
            ))}
          </fieldset>
          <button className="btn btn-primary">Add</button>
        </ActionForm>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Alias</th>
              <th>Email</th>
              <th>Name · role · scripts · active</th>
              <th>Progress</th>
              <th>Sign-in link</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const p = progress.get(u.uid);
              return (
                <tr key={u.uid} className={u.active ? "" : "text-muted"}>
                  <td className="font-mono">{u.alias}</td>
                  <td>{u.email}</td>
                  <td>
                    <ActionForm action={updateUser} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="uid" value={u.uid} />
                      <input name="displayName" defaultValue={u.displayName} className="input w-36 py-0.5" />
                      <select name="role" defaultValue={u.role} className="input w-24 py-0.5">
                        <option value="rater">rater</option>
                        <option value="admin">admin</option>
                      </select>
                      {SCRIPTS.map((s) => (
                        <label key={s} className="flex items-center gap-1 text-xs">
                          <input type="checkbox" name="scripts" value={s} defaultChecked={u.scripts.includes(s)} /> {s.toUpperCase()}
                        </label>
                      ))}
                      <select name="active" defaultValue={u.active ? "1" : "0"} className="input w-24 py-0.5">
                        <option value="1">active</option>
                        <option value="0">disabled</option>
                      </select>
                      <button className="btn btn-sm">Save</button>
                    </ActionForm>
                  </td>
                  <td className="whitespace-nowrap">{p ? `${p.done} / ${p.total}` : "—"}</td>
                  <td>
                    <ActionForm action={makeLoginLink} className="flex max-w-64 flex-col gap-1 break-all">
                      <input type="hidden" name="email" value={u.email} />
                      <button className="btn btn-sm self-start">Generate</button>
                    </ActionForm>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
