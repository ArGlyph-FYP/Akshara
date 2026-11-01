import { requireAdmin } from "@/lib/auth";
import { currentDataset, currentScript } from "@/lib/script";
import { loadStudyPage } from "../../_study/load";
import { NewSurvey } from "../../_study/StudyPage";

export const dynamic = "force-dynamic";

export default async function NewSurveyPage() {
  const s = await requireAdmin();
  const script = await currentScript(s.user);
  const { dataset } = await currentDataset(script);
  return <NewSurvey data={await loadStudyPage(script, dataset, "perception")} />;
}
