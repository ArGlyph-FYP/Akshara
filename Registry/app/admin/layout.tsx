import { Sidebar, type StudyBadge } from "@/components/admin/Sidebar";
import { requireAdmin } from "@/lib/auth";
import { col, listStudies } from "@/lib/data";
import { currentScript } from "@/lib/script";
import type { StudyType, UserDoc } from "@/lib/types";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireAdmin();
  const script = await currentScript(s.user);
  const [samples, studies, admins] = await Promise.all([
    col.samples().where("script", "==", script).count().get(),
    listStudies(script),
    col.users().where("role", "==", "admin").get(),
  ]);
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
        samples={samples.data().count}
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
