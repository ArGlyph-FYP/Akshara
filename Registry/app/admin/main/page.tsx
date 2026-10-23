import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { currentCriteria, listCriteria } from "@/lib/data";
import { currentScript } from "@/lib/script";
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
  const [surveys, criteria, { version }] = await Promise.all([loadSurveyList(script, "rubric"), listCriteria(script), currentCriteria(script)]);
  return (
    <SurveyList
      script={script}
      type="rubric"
      surveys={surveys}
      criteria={{ list: criteria, version }}
      tab={q.tab === "criteria" ? "criteria" : "surveys"}
    />
  );
}
