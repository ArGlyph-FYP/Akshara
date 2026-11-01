import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { currentDataset, currentScript } from "@/lib/script";
import { loadSurveyList } from "../_study/load";
import { SurveyList } from "../_study/StudyPage";

export const dynamic = "force-dynamic";

export default async function MainStudySurveys({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const q = await searchParams;
  // Older links: ?id=… and ?new=1
  if (q.id) redirect(`/admin/main/${q.id}`);
  if (q.new) redirect("/admin/main/new");
  const s = await requireAdmin();
  const script = await currentScript(s.user);
  const { dataset } = await currentDataset(script);
  const surveys = await loadSurveyList(script, dataset.id, "rubric");
  return <SurveyList script={script} dataset={dataset.name} type="rubric" surveys={surveys} />;
}
