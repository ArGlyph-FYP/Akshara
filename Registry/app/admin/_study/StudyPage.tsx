"use client";

import { ClipboardList, Plus, Ruler } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SCRIPT_LABEL, STUDY_PATH } from "@/lib/types";
import { COPY } from "./copy";
import { CriteriaEditor } from "./CriteriaEditor";
import type { StudyPageData } from "./load";
import { SetupView } from "./SetupView";
import { StudyView } from "./StudyView";

/**
 * The Perception study and Main study pages. Each can hold several surveys, each with its own samples and link:
 * the picker in the header switches between them and "New survey" opens the setup for another one.
 */
export function StudyPage({ data, tab, creating }: { data: StudyPageData; tab?: "study" | "criteria"; creating?: boolean }) {
  const router = useRouter();
  const copy = COPY[data.type];
  const path = STUDY_PATH[data.type];
  const setup = creating || !data.study;
  const body = setup ? (
    <SetupView
      key="new"
      data={data}
      onOpenCriteria={data.type === "rubric" ? () => router.push(`${path}?tab=criteria`) : undefined}
      onCancel={data.study ? () => router.push(`${path}?id=${data.study!.id}`) : undefined}
    />
  ) : (
    <StudyView key={data.study!.id} data={data} study={data.study!} />
  );

  return (
    <div>
      <PageHeader title={`${SCRIPT_LABEL[data.script]} ${copy.noun}`} description={copy.description}>
        {data.rounds.length > 0 && !setup && (
          <Select value={data.study?.id} onValueChange={(id) => router.push(`${path}?id=${id}`)}>
            <SelectTrigger className="w-64" aria-label="Survey">
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
        {data.study && !setup && (
          <Button onClick={() => router.push(`${path}?new=1`)}>
            <Plus /> New survey
          </Button>
        )}
      </PageHeader>

      {data.type === "rubric" ? (
        <Tabs
          value={tab ?? "study"}
          onValueChange={(v) => router.replace(v === "criteria" ? `${path}?tab=criteria` : data.study ? `${path}?id=${data.study.id}` : path)}
        >
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
