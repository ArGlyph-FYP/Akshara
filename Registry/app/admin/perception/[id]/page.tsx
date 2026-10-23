import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getStudy } from "@/lib/data";
import { currentScript } from "@/lib/script";
import { loadStudyPage } from "../../_study/load";
import { SurveyDetail } from "../../_study/StudyPage";

export const dynamic = "force-dynamic";

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  const { id } = await params;
  const study = await getStudy(id);
  if (!study || study.type !== "perception") notFound();
  // After switching Sinhala/Tamil in the sidebar, go back to that language's list.
  if (study.script !== (await currentScript(s.user))) redirect("/admin/perception");
  return <SurveyDetail data={await loadStudyPage(study.script, "perception", id)} />;
}
