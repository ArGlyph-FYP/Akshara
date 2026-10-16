import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { col, listSurveys } from "@/lib/data";
import { SCRIPT_LABEL } from "@/lib/types";
import { createSurvey } from "./actions";

export default async function SurveysPage() {
  const surveys = await listSurveys();
  const counts = await Promise.all(
    surveys.map(async (s) => {
      const [r, rd] = await Promise.all([
        col.surveys().doc(s.id).collection("responses").count().get(),
        col.surveys().doc(s.id).collection("readers").count().get(),
      ]);
      return { responses: r.data().count, readers: rd.data().count };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Phase A perception survey</h1>
        <p className="text-sm text-muted">
          Native readers open a share link (no account needed), confirm they are 18+, then score pilot samples and
          say what makes each one look good or bad. Their reasons feed the thematic coding that defines the rubric.
        </p>
      </div>

      <div className="card">
        <h2 className="h2 mb-3">New survey</h2>
        <ActionForm action={createSurvey} className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <label className="label">Script</label>
            <select name="script" className="input" defaultValue="si">
              <option value="si">Sinhala</option>
              <option value="ta">Tamil</option>
            </select>
          </div>
          <div className="w-72">
            <label className="label">Title</label>
            <input name="title" required className="input" placeholder="Sinhala handwriting perception" />
          </div>
          <button className="btn btn-primary">Create</button>
        </ActionForm>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Script</th>
              <th>Samples</th>
              <th>Readers</th>
              <th>Responses</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {surveys.map((s, i) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/admin/surveys/${s.id}`} className="font-medium text-accent hover:underline">
                    {s.title}
                  </Link>
                </td>
                <td>{SCRIPT_LABEL[s.script]}</td>
                <td>{s.sampleIds.length}</td>
                <td>{counts[i].readers}</td>
                <td>{counts[i].responses}</td>
                <td>
                  {s.open ? (
                    <span className="pill bg-emerald-50 text-emerald-800">open</span>
                  ) : (
                    <span className="pill bg-stone-100 text-stone-700">closed</span>
                  )}
                </td>
              </tr>
            ))}
            {surveys.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">
                  No surveys yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
