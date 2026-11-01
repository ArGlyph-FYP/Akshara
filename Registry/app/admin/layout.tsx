import { Sidebar, type StudyBadge } from "@/components/admin/Sidebar";
import { requireAdmin } from "@/lib/auth";
import { col, listStudies } from "@/lib/data";
import { currentDataset, currentScript } from "@/lib/script";
import { datasetOf, initialDatasetId, type Dataset, type StudyType, type UserDoc } from "@/lib/types";

const count = async (q: FirebaseFirestore.Query) => (await q.count().get()).data().count;

/** Scans in one dataset. Older scans may have no datasetId, so the initial dataset is "all the rest". */
async function scanCount(d: Dataset, all: Dataset[]) {
  if (d.id !== initialDatasetId(d.script)) return count(col.samples().where("datasetId", "==", d.id));
  const others = all.filter((x) => x.id !== d.id);
  const [total, ...rest] = await Promise.all([
    count(col.samples().where("script", "==", d.script)),
    ...others.map((x) => count(col.samples().where("datasetId", "==", x.id))),
  ]);
  return total - rest.reduce((a, b) => a + b, 0);
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireAdmin();
  const script = await currentScript(s.user);
  const { dataset, datasets } = await currentDataset(script);
  const [samples, allStudies, admins] = await Promise.all([
    scanCount(dataset, datasets),
    listStudies(script),
    col.users().where("role", "==", "admin").get(),
  ]);
  const studies = allStudies.filter((x) => datasetOf(x) === dataset.id);
  // "Live" while any survey of the type is running.
  const badge = (type: StudyType): StudyBadge => {
    const of = studies.filter((x) => x.type === type);
    if (!of.length) return null;
    if (of.some((x) => x.open && x.publicOpen)) return "open";
    return of.some((x) => x.open) ? "full" : "closed";
  };
  const team = admins.docs
    .map((d) => ({ uid: d.id, ...(d.data() as UserDoc) }))
    .filter((u) => u.active)
    .map((u) => ({ uid: u.uid, name: u.displayName || u.email, email: u.email, me: u.uid === s.uid }))
    .sort((a, b) => Number(b.me) - Number(a.me) || a.name.localeCompare(b.name));
  return (
    <div className="min-h-screen">
      <Sidebar
        script={script}
        dataset={dataset.id}
        datasets={datasets.map((d) => ({ id: d.id, name: d.name }))}
        samples={samples}
        studies={{ perception: badge("perception"), main: badge("rubric") }}
        team={team}
        user={{ name: s.user.displayName || s.user.email, email: s.user.email, canRate: s.user.scripts.length > 0 }}
      />
      <div className="md:pl-64">
        <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
