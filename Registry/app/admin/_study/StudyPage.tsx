"use client";

import { ArrowLeft, ChevronRight, ClipboardList, Copy, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/admin/Confirm";
import { EmptyState, PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SCRIPT_LABEL, STUDY_PATH, surveyPath, type Script, type StudyType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteStudy } from "./actions";
import { COPY } from "./copy";
import type { StudyPageData, SurveySummary } from "./load";
import { SetupView } from "./SetupView";
import { deleteDescription, STATUS } from "./status";
import { StudyView } from "./StudyView";

/** List screen: every survey of one type for the script, with a button to make a new one. */
export function SurveyList(props: {
  script: Script;
  /** Name of the dataset the list is for. */
  dataset: string;
  type: StudyType;
  surveys: SurveySummary[];
}) {
  const copy = COPY[props.type];
  const path = STUDY_PATH[props.type];
  const newButton = (
    <Button asChild>
      <Link href={`${path}/new`}>
        <Plus /> New survey
      </Link>
    </Button>
  );
  const list = props.surveys.length ? (
    <div className="divide-y rounded-xl border bg-card">
      {props.surveys.map((s) => (
        <SurveyRow key={s.id} survey={s} script={props.script} href={`${path}/${s.id}`} />
      ))}
    </div>
  ) : (
    <EmptyState icon={<ClipboardList className="size-5" />} title={`No ${copy.listNoun} yet`}>
      <p>Create one, choose the samples it uses, and you get a link to share with readers.</p>
      <div className="mt-4">{newButton}</div>
    </EmptyState>
  );

  return (
    <div>
      <PageHeader
        title={`${SCRIPT_LABEL[props.script]} ${copy.listNoun}`}
        description={
          <>
            <span className="font-medium text-foreground">{props.dataset}</span> · {copy.description}
          </>
        }
      >
        {newButton}
      </PageHeader>
      {list}
    </div>
  );
}

function SurveyRow({ survey: s, script, href }: { survey: SurveySummary; script: Script; href: string }) {
  const router = useRouter();
  const [confirmDialog, ask] = useConfirm();
  const pct = s.total ? Math.round((100 * s.done) / s.total) : 0;
  const remove = () =>
    ask({
      title: `Delete “${s.title}”?`,
      description: deleteDescription(s.done),
      confirmLabel: s.done ? `Delete survey and ${s.done} response(s)` : "Delete survey",
      destructive: true,
      onConfirm: async () => {
        const r = await deleteStudy(s.id, { withResponses: s.done > 0 });
        if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
        toast.success("Survey deleted");
        router.refresh();
      },
    });
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${surveyPath(script, s.token!)}`);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Open the survey to copy its link.");
    }
  }
  return (
    <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-muted/40">
      <div className="min-w-0 flex-1 basis-60">
        <div className="flex items-center gap-2">
          {/* The link covers the whole row; the copy button sits above it. */}
          <Link href={href} className="truncate font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring">
            {s.title}
          </Link>
          <Badge variant={s.status === "open" ? "default" : "outline"}>{STATUS[s.status].label}</Badge>
        </div>
        <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
          {s.token ? surveyPath(script, s.token) : "No link"} · created {new Date(s.createdAt).toLocaleDateString()}
        </div>
      </div>
      <div className="flex items-center gap-5 text-sm">
        <Figure label="Samples" value={s.samples} />
        <Figure label="Readers" value={s.readers} />
        <div className="w-32">
          <div className="text-xs text-muted-foreground">Responses</div>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">{s.done}</span>
            <Progress value={pct} className="flex-1" aria-label={`${pct}% done`} />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={copyLink}
          disabled={!s.token || s.status !== "open"}
          className={cn("relative z-10", s.status !== "open" && "invisible")}
        >
          <Copy /> Copy link
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={remove}
          aria-label={`Delete ${s.title}`}
          title="Delete survey"
          className="relative z-10 text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
        </Button>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
      {confirmDialog}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="w-16">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular-nums">{value}</div>
    </div>
  );
}

/** "New survey" screen. */
export function NewSurvey({ data }: { data: StudyPageData }) {
  const copy = COPY[data.type];
  return (
    <div>
      <Link href={STUDY_PATH[data.type]} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All {copy.listNoun}
      </Link>
      <PageHeader
        title={`New ${SCRIPT_LABEL[data.script]} ${copy.noun} survey`}
        description={
          <>
            Samples from <span className="font-medium text-foreground">{data.dataset.name}</span> · {copy.description}
          </>
        }
      />
      <SetupView data={data} />
    </div>
  );
}

/** One survey: its link, readers, samples and responses. */
export function SurveyDetail({ data }: { data: StudyPageData }) {
  return <StudyView key={data.study!.id} data={data} study={data.study!} />;
}
