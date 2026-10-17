import { requireAdmin } from "@/lib/auth";
import { getSettings, listAssignments, listCriteria, listStudies } from "@/lib/data";
import { currentScript } from "@/lib/script";
import { SurveyHome, type StudyCard } from "./SurveyHome";

export const dynamic = "force-dynamic";

export default async function SurveyPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireAdmin();
  const script = await currentScript(s.user);
  const [studies, assignments, criteria, settings] = await Promise.all([
    listStudies(script),
    listAssignments({ script }),
    listCriteria(script),
    getSettings(),
  ]);
  const cards: StudyCard[] = studies.map((st) => {
    const items = assignments.filter((a) => a.studyId === st.id);
    return {
      id: st.id,
      title: st.title,
      type: st.type,
      open: st.open,
      publicOpen: !!st.publicOpen,
      samples: st.sampleIds.length,
      raters: new Set(items.map((a) => a.raterId)).size,
      done: items.filter((a) => a.status === "done").length,
      total: items.length,
      createdAt: st.createdAt,
    };
  });
  return (
    <SurveyHome
      script={script}
      studies={cards}
      criteria={criteria}
      rubricVersion={settings.rubricVersion[script]}
      tab={(await searchParams).tab === "criteria" ? "criteria" : "studies"}
    />
  );
}
