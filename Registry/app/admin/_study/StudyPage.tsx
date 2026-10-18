"use client";

import { ClipboardList, Ruler } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SCRIPT_LABEL, STUDY_PATH } from "@/lib/types";
import { COPY } from "./copy";
import { CriteriaEditor } from "./CriteriaEditor";
import type { StudyPageData } from "./load";
import { SetupView } from "./SetupView";
import { StudyView } from "./StudyView";

/** The Perception study and Main study pages: setup until started, then the share link and results. */
export function StudyPage({ data, tab }: { data: StudyPageData; tab?: "study" | "criteria" }) {
  const router = useRouter();
  const copy = COPY[data.type];
  const path = STUDY_PATH[data.type];
  const body = data.study ? (
    <StudyView key={data.study.id} data={data} study={data.study} />
  ) : (
    <SetupView data={data} onOpenCriteria={data.type === "rubric" ? () => router.push(`${path}?tab=criteria`) : undefined} />
  );

  return (
    <div>
      <PageHeader title={`${SCRIPT_LABEL[data.script]} ${copy.noun}`} description={copy.description}>
        {data.rounds.length > 1 && (
          <Select value={data.study?.id} onValueChange={(id) => router.push(`${path}?id=${id}`)}>
            <SelectTrigger className="w-56" aria-label="Round">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {data.rounds.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.title} · {new Date(r.createdAt).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </PageHeader>

      {data.type === "rubric" ? (
        <Tabs value={tab ?? "study"} onValueChange={(v) => router.replace(v === "criteria" ? `${path}?tab=criteria` : path)}>
          <TabsList className="mb-5">
            <TabsTrigger value="study">
              <ClipboardList /> Study
            </TabsTrigger>
            <TabsTrigger value="criteria">
              <Ruler /> Rubric criteria
            </TabsTrigger>
          </TabsList>
          <TabsContent value="study">{body}</TabsContent>
          <TabsContent value="criteria">
            <CriteriaEditor script={data.script} criteria={data.criteria} version={data.rubricVersion} />
          </TabsContent>
        </Tabs>
      ) : (
        body
      )}
    </div>
  );
}
