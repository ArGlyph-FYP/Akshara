"use client";

import { Check, ChevronDown, Download, FolderPlus, ImagePlus, MessagesSquare, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Stat } from "@/components/admin/PageHeader";
import { FilterBar, LayoutToggle, SampleGrid, useSampleSelection } from "@/components/admin/SampleBrowser";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { act } from "@/lib/client-action";
import { PICK_KEY, type SampleRow, type StudyRef } from "@/lib/dataset-types";
import { SCRIPT_LABEL, type Participant, type Script } from "@/lib/types";
import { addSamplesToStudy } from "../survey/study-actions";
import { setStatus } from "./sample-actions";
import { SampleSheet } from "./SampleSheet";
import { UploadDialog, type Known } from "./UploadDialog";
import { WritersSheet } from "./WritersSheet";

export function DatasetView({
  script,
  rows,
  studies,
  writers,
  scanCount,
  known,
}: {
  script: Script;
  rows: SampleRow[];
  studies: StudyRef[];
  writers: Participant[];
  scanCount: Record<string, number>;
  known: Known;
}) {
  const router = useRouter();
  const sel = useSampleSelection(rows);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState<SampleRow | null>(null);
  const ids = [...sel.selected];

  const approved = rows.filter((r) => r.status === "qc_ok").length;
  const unchecked = rows.filter((r) => r.status === "uploaded").length;
  const rated = rows.filter((r) => r.rating === "rated").length;
  const notRated = rows.filter((r) => r.rating === "not_rated").length;

  async function bulkStatus(status: "qc_ok" | "rejected") {
    if (await act(setStatus, { ids: ids.join(","), status })) {
      sel.clear();
      router.refresh();
    }
  }

  function newStudyFromSelection() {
    try {
      sessionStorage.setItem(PICK_KEY, JSON.stringify({ script, ids }));
    } catch {}
    router.push("/admin/survey/new?from=dataset");
  }

  async function addTo(study: StudyRef) {
    const r = await addSamplesToStudy(study.id, ids);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Added ${r.added} sample${r.added === 1 ? "" : "s"} to “${study.title}”`, {
      description: "Open the study and use “Assign” to give them to raters.",
      action: { label: "Open", onClick: () => router.push(`/admin/survey/${study.id}`) },
    });
    sel.clear();
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Dataset"
        description={`All ${SCRIPT_LABEL[script]} handwriting scans. Upload, check and browse them here; pick samples for a survey or rating study.`}
      >
        <WritersSheet script={script} writers={writers} scanCount={scanCount} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download /> Export <ChevronDown className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>{SCRIPT_LABEL[script]} dataset</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <a href={`/api/export?scripts=${script}&phases=main&qc=1&mode=public&images=0&surveys=1`}>
                <div>
                  <div>Labels only (ZIP)</div>
                  <div className="text-xs text-muted-foreground">CSV/JSON ratings, regions, perception answers</div>
                </div>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`/api/export?scripts=${script}&phases=main&qc=1&mode=public&images=1&surveys=1`}>
                <div>
                  <div>Public dataset with images (ZIP)</div>
                  <div className="text-xs text-muted-foreground">Writer IDs only; large sets: use npm run export:prod</div>
                </div>
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={`/api/export?scripts=${script}&phases=main,pilot&qc=0&mode=internal&images=0&surveys=1`}>
                <div>
                  <div>Internal labels, with codes</div>
                  <div className="text-xs text-muted-foreground">Team use only; includes pilot</div>
                </div>
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <UploadDialog known={known} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Writers" value={writers.filter((w) => w.status === "active").length} />
        <Stat label="Scans" value={rows.length} />
        <Stat label="Approved" value={approved} tone="good" />
        <Stat label="Need checking" value={unchecked} tone={unchecked ? "warn" : undefined} />
        <Stat label="Fully rated / not rated" value={`${rated} / ${notRated}`} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<ImagePlus className="size-5" />} title="No scans yet">
          Use <b>Upload scans</b> to add the first handwriting pages. Codes can be registered during upload, or in{" "}
          <b>Writers</b>.
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 flex items-start gap-2">
            <div className="flex-1">
              <FilterBar filters={sel.filters} setFilters={sel.setFilters} studies={studies} total={rows.length} shown={sel.filtered.length} />
            </div>
            <LayoutToggle value={layout} onChange={setLayout} />
          </div>

          {sel.filtered.length === 0 ? (
            <EmptyState title="Nothing matches these filters" />
          ) : (
            <SampleGrid rows={sel.filtered} studies={studies} selected={sel.selected} onToggle={sel.toggle} onOpen={setOpen} layout={layout} />
          )}
        </>
      )}

      {sel.selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 md:pl-64">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-lg">
            <span className="px-1 text-sm font-medium tabular-nums">{sel.selected.size} selected</span>
            {sel.selected.size < sel.filtered.length && (
              <Button variant="ghost" size="sm" onClick={sel.selectAll}>
                Select all {sel.filtered.length}
              </Button>
            )}
            <div className="mx-1 h-5 w-px bg-border" />
            <Button variant="outline" size="sm" onClick={() => bulkStatus("qc_ok")}>
              <Check /> Approve
            </Button>
            <Button variant="outline" size="sm" onClick={() => bulkStatus("rejected")}>
              <X /> Reject
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <MessagesSquare /> Use in survey <ChevronDown className="opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onSelect={newStudyFromSelection}>
                  <FolderPlus /> New study with these samples
                </DropdownMenuItem>
                {studies.length > 0 && <DropdownMenuSeparator />}
                {studies.length > 0 && <DropdownMenuLabel className="text-xs text-muted-foreground">Add to existing</DropdownMenuLabel>}
                {studies.map((s) => (
                  <DropdownMenuItem key={s.id} onSelect={() => addTo(s)}>
                    <span className="truncate">{s.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{s.type === "rubric" ? "rubric" : "perception"}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon-sm" onClick={sel.clear} aria-label="Clear selection">
              <X />
            </Button>
          </div>
        </div>
      )}

      <SampleSheet row={open} onClose={() => setOpen(null)} />
    </div>
  );
}
