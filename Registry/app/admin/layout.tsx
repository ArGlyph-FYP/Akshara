import { Sidebar } from "@/components/admin/Sidebar";
import { requireAdmin } from "@/lib/auth";
import { col } from "@/lib/data";
import { currentScript } from "@/lib/script";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireAdmin();
  const script = await currentScript(s.user);
  const [samples, studies, users] = await Promise.all([
    col.samples().where("script", "==", script).count().get(),
    col.studies().where("script", "==", script).count().get(),
    col.users().where("scripts", "array-contains", script).count().get(),
  ]);
  return (
    <div className="min-h-screen">
      <Sidebar
        script={script}
        counts={{ dataset: samples.data().count, survey: studies.data().count, raters: users.data().count }}
        user={{ name: s.user.displayName || s.user.email, email: s.user.email, canRate: s.user.scripts.length > 0 }}
      />
      <div className="md:pl-64">
        <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
