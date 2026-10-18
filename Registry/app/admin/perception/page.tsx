import { requireAdmin } from "@/lib/auth";
import { currentScript } from "@/lib/script";
import { loadStudyPage } from "../_study/load";
import { StudyPage } from "../_study/StudyPage";

export const dynamic = "force-dynamic";

export default async function PerceptionPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireAdmin();
  const script = await currentScript(s.user);
  const data = await loadStudyPage(script, "perception", (await searchParams).id);
  return <StudyPage data={data} />;
}
