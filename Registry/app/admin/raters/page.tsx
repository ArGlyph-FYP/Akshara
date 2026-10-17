import { requireAdmin } from "@/lib/auth";
import { listAssignments, listUsers } from "@/lib/data";
import { currentScript } from "@/lib/script";
import { RatersView, type RaterRow } from "./RatersView";

export const dynamic = "force-dynamic";

export default async function RatersPage() {
  const s = await requireAdmin();
  const script = await currentScript(s.user);
  const [users, assignments] = await Promise.all([listUsers(), listAssignments()]);
  const rows: RaterRow[] = users.map((u) => {
    const mine = assignments.filter((a) => a.raterId === u.uid);
    return {
      uid: u.uid,
      name: u.displayName,
      email: u.email,
      alias: u.alias,
      role: u.role,
      scripts: u.scripts,
      active: u.active,
      done: mine.filter((a) => a.status === "done").length,
      total: mine.length,
      studies: new Set(mine.map((a) => a.studyId)).size,
      public: !!u.public,
      nativeReader: u.nativeReader ?? null,
      ageGroup: u.ageGroup ?? null,
    };
  });
  return <RatersView rows={rows} script={script} selfUid={s.uid} />;
}
