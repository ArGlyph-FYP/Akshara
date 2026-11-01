import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getStudy } from "@/lib/data";
import { currentDataset, currentScript } from "@/lib/script";
import { datasetOf } from "@/lib/types";
import { loadStudyPage } from "../../_study/load";
import { SurveyDetail } from "../../_study/StudyPage";

export const dynamic = "force-dynamic";

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  const { id } = await params;
  const study = await getStudy(id);
  if (!study || study.type !== "rubric") notFound();
  // After switching Sinhala/Tamil or the dataset in the sidebar, go back to that dataset's list.
  if (study.script !== (await currentScript(s.user))) redirect("/admin/main");
  const { dataset } = await currentDataset(study.script);
  if (datasetOf(study) !== dataset.id) redirect("/admin/main");
  return <SurveyDetail data={await loadStudyPage(study.script, dataset, "rubric", id)} />;
}
