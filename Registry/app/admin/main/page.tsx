import { requireAdmin } from "@/lib/auth";
import { currentScript } from "@/lib/script";
import { loadStudyPage } from "../_study/load";
import { StudyPage } from "../_study/StudyPage";

export const dynamic = "force-dynamic";

export default async function MainStudyPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireAdmin();
  const script = await currentScript(s.user);
  const q = await searchParams;
  const data = await loadStudyPage(script, "rubric", q.id);
  return <StudyPage data={data} tab={q.tab === "criteria" ? "criteria" : "study"} creating={q.new === "1"} />;
}
