import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { currentScript } from "@/lib/script";
import { loadSurveyList } from "../_study/load";
import { SurveyList } from "../_study/StudyPage";

export const dynamic = "force-dynamic";

export default async function PerceptionSurveys({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const q = await searchParams;
  // Older links: ?id=… and ?new=1
  if (q.id) redirect(`/admin/perception/${q.id}`);
  if (q.new) redirect("/admin/perception/new");
  const s = await requireAdmin();
  const script = await currentScript(s.user);
  return <SurveyList script={script} type="perception" surveys={await loadSurveyList(script, "perception")} />;
}
