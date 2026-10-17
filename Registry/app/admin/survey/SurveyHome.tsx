"use client";

import { ClipboardList, Globe, MessageSquareText, Plus, Ruler } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SCRIPT_LABEL, STUDY_LABEL, type Criterion, type Script, type StudyType } from "@/lib/types";
import { CriteriaEditor } from "./CriteriaEditor";

export interface StudyCard {
  id: string;
  title: string;
  type: StudyType;
  open: boolean;
  publicOpen: boolean;
  samples: number;
  raters: number;
  done: number;
  total: number;
  createdAt: number;
}

export function SurveyHome({
  script,
  studies,
  criteria,
  rubricVersion,
  tab,
}: {
  script: Script;
  studies: StudyCard[];
  criteria: Criterion[];
  rubricVersion: number;
  tab: "studies" | "criteria";
}) {
  const router = useRouter();
  return (
    <div>
      <PageHeader
        title="Survey"
        description="Studies use samples from the Dataset. A perception study asks readers for a score and their reasons (Phase A); a rubric study collects criterion scores and weak-region boxes (Phase C)."
      >
        <Button asChild>
          <Link href="/admin/survey/new">
            <Plus /> New study
          </Link>
        </Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={(v) => router.replace(v === "criteria" ? "/admin/survey?tab=criteria" : "/admin/survey")}>
        <TabsList className="mb-4">
          <TabsTrigger value="studies">
            <ClipboardList /> Studies <span className="text-muted-foreground tabular-nums">{studies.length}</span>
          </TabsTrigger>
          <TabsTrigger value="criteria">
            <Ruler /> Rubric criteria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="studies">
          {studies.length === 0 ? (
            <EmptyState icon={<MessageSquareText className="size-5" />} title={`No ${SCRIPT_LABEL[script]} studies yet`}>
              Start with a <b>perception</b> study on pilot samples. Choose <b>New study</b>, or select samples in the
              Dataset and choose “Use in survey”.
            </EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {studies.map((s) => {
                const pct = s.total ? Math.round((100 * s.done) / s.total) : 0;
                return (
                  <Link key={s.id} href={`/admin/survey/${s.id}`} className="group rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium group-hover:text-primary">{s.title}</h3>
                      <Badge variant={s.open ? "secondary" : "outline"} className={s.open ? "bg-success/10 text-success" : ""}>
                        {s.open ? "Open" : "Closed"}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-normal">
                        {STUDY_LABEL[s.type]}
                      </Badge>
                      {s.publicOpen && (
                        <Badge variant="outline" className="border-primary/30 font-normal text-primary">
                          <Globe /> public link
                        </Badge>
                      )}
                      {s.samples} samples · {s.raters} raters
                    </div>
                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="tabular-nums">
                          {s.done} / {s.total} ratings · {pct}%
                        </span>
                      </div>
                      <Progress value={pct} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="criteria">
          <CriteriaEditor script={script} criteria={criteria} version={rubricVersion} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
