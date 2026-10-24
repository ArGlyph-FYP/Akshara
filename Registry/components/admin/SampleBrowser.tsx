"use client";

import { Anchor, CheckCircle2, Circle, CircleDashed, ImageOff, LayoutGrid, List, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sampleLabel } from "@/lib/codes";
import { QC_LABEL, RATING_LABEL, type RatingState, type SampleRow, type StudyRef } from "@/lib/dataset-types";
import { cn } from "@/lib/utils";

export interface Filters {
  q: string;
  phase: "all" | "pilot" | "main";
  qc: "all" | "uploaded" | "qc_ok" | "rejected" | "excluded";
  rating: "all" | RatingState;
  study: "all" | "none" | string;
  anchors: boolean;
}

export const DEFAULT_FILTERS: Filters = { q: "", phase: "all", qc: "all", rating: "all", study: "all", anchors: false };

export function applyFilters(rows: SampleRow[], f: Filters): SampleRow[] {
  const q = f.q.trim().toUpperCase().replace(/\s+/g, "");
  return rows.filter(
    (r) =>
      (!q || sampleLabel(r).replace(/[-\s]/g, "").includes(q.replace(/-/g, "")) || r.id.includes(f.q.trim())) &&
      (f.phase === "all" || r.phase === f.phase) &&
      (f.qc === "all" || r.status === f.qc) &&
      (f.rating === "all" || r.rating === f.rating) &&
      (f.study === "all" || (f.study === "none" ? r.studyIds.length === 0 : r.studyIds.includes(f.study))) &&
      (!f.anchors || r.isAnchor),
  );
}

const QC_TONE: Record<SampleRow["status"], string> = {
  uploaded: "bg-muted text-muted-foreground",
  qc_ok: "bg-success/10 text-success",
  rejected: "bg-foreground/10 text-foreground",
  excluded: "bg-destructive/10 text-destructive",
};

export function RatingDot({ row }: { row: SampleRow }) {
  const label =
    row.assigned === 0 ? "Not assigned to anyone" : `${RATING_LABEL[row.rating]}: ${row.done} of ${row.assigned} ratings`;
  const Icon = row.rating === "rated" ? CheckCircle2 : row.rating === "in_progress" ? CircleDashed : Circle;
  return (
    <span title={label} className={cn("inline-flex items-center gap-1 text-xs tabular-nums", row.rating === "rated" ? "text-success" : row.rating === "in_progress" ? "text-primary" : "text-muted-foreground")}>
      <Icon className="size-3.5" />
      {row.assigned > 0 && `${row.done}/${row.assigned}`}
    </span>
  );
}

export function FilterBar({
  filters,
  setFilters,
  studies,
  total,
  shown,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  studies: StudyRef[];
  total: number;
  shown: number;
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters({ ...filters, [k]: v });
  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-56">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Search code, e.g. 012" className="pl-8" />
      </div>
      <FilterSelect
        value={filters.rating}
        onChange={(v) => set("rating", v as Filters["rating"])}
        label="Rating"
        options={[["all", "Any rating"], ["not_rated", "Not rated"], ["in_progress", "In progress"], ["rated", "Fully rated"]]}
      />
      <FilterSelect
        value={filters.qc}
        onChange={(v) => set("qc", v as Filters["qc"])}
        label="Check"
        options={[["all", "Any check"], ["uploaded", "Unchecked"], ["qc_ok", "Approved"], ["rejected", "Rejected"], ["excluded", "Withdrawn"]]}
      />
      <FilterSelect
        value={filters.phase}
        onChange={(v) => set("phase", v as Filters["phase"])}
        label="Phase"
        options={[["all", "Pilot + main"], ["pilot", "Pilot only"], ["main", "Main only"]]}
      />
      <FilterSelect
        value={filters.study}
        onChange={(v) => set("study", v)}
        label="Study"
        options={[["all", "In any or no study"], ["none", "Not in any study"], ...studies.map((s) => [s.id, `In: ${s.title}`] as [string, string])]}
      />
      <Button variant={filters.anchors ? "secondary" : "outline"} size="sm" onClick={() => set("anchors", !filters.anchors)} className="h-8">
        <Anchor /> Anchors
      </Button>
      {dirty && (
        <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)} className="h-8">
          <X /> Clear
        </Button>
      )}
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
        {shown === total ? `${total} samples` : `${shown} of ${total} samples`}
      </span>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={label} className={cn("h-8 min-w-36", value !== "all" && "border-primary/40 bg-brand-soft")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Thumbnail grid (or compact list) with infinite scroll and optional checkbox selection. */
export function SampleGrid({
  rows,
  studies,
  selected,
  onToggle,
  onOpen,
  layout = "grid",
}: {
  rows: SampleRow[];
  studies: StudyRef[];
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onOpen?: (row: SampleRow) => void;
  layout?: "grid" | "list";
}) {
  const [limit, setLimit] = useState(60);
  const sentinel = useRef<HTMLDivElement>(null);
  const studyTitle = useMemo(() => Object.fromEntries(studies.map((s) => [s.id, s.title])), [studies]);

  useEffect(() => setLimit(60), [rows]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setLimit((l) => l + 60), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [rows.length, limit]);

  const visible = rows.slice(0, limit);

  if (layout === "list") {
    return (
      <div className="overflow-hidden rounded-xl border bg-card">
        {visible.map((r) => (
          <div
            key={r.id}
            className={cn("flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-0 hover:bg-muted/50", selected?.has(r.id) && "bg-brand-soft/60")}
            onClick={() => onOpen?.(r)}
          >
            {onToggle && (
              <Checkbox checked={selected?.has(r.id)} onCheckedChange={() => onToggle(r.id)} onClick={(e) => e.stopPropagation()} />
            )}
            <Thumb id={r.id} v={r.imageV} className="h-12 w-9 rounded" contain={!!r.part} />
            <span className="w-24 font-mono font-medium">
              {sampleLabel(r)}
            </span>
            <span className="w-14 text-xs text-muted-foreground">{r.phase}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", QC_TONE[r.status])}>{QC_LABEL[r.status]}</span>
            <RatingDot row={r} />
            <span className="ml-auto hidden truncate text-xs text-muted-foreground md:block">
              {r.studyIds.map((s) => studyTitle[s]).join(" · ")}
            </span>
          </div>
        ))}
        <div ref={sentinel} />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {visible.map((r) => {
          const isSel = selected?.has(r.id);
          return (
            <div
              key={r.id}
              className={cn(
                "group relative cursor-pointer overflow-hidden rounded-xl border bg-card transition hover:shadow-md",
                isSel && "border-primary ring-2 ring-primary/30",
              )}
              onClick={() => onOpen?.(r)}
            >
              <Thumb id={r.id} v={r.imageV} className="aspect-[1/1.3] w-full" contain={!!r.part} />
              {onToggle && (
                <div
                  className={cn("absolute top-2 left-2 rounded-md bg-card/90 p-1 shadow-xs transition", !isSel && "opacity-0 group-hover:opacity-100", selected && selected.size > 0 && "opacity-100")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox checked={isSel} onCheckedChange={() => onToggle(r.id)} aria-label={`Select ${sampleLabel(r)}`} />
                </div>
              )}
              {r.isAnchor && (
                <Badge variant="secondary" className="absolute top-2 right-2 bg-card/90">
                  <Anchor /> anchor
                </Badge>
              )}
              <div className="space-y-1.5 border-t px-2.5 py-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-sm font-medium">
                    {sampleLabel(r)}
                  </span>
                  <RatingDot row={r} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", QC_TONE[r.status])}>{QC_LABEL[r.status]}</span>
                  <span className="text-[11px] text-muted-foreground">{r.phase}</span>
                  {r.studyIds.length > 0 && (
                    <span className="ml-auto truncate text-[11px] text-muted-foreground" title={r.studyIds.map((s) => studyTitle[s]).join(", ")}>
                      {r.studyIds.length} {r.studyIds.length === 1 ? "study" : "studies"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div ref={sentinel} className="h-1" />
    </>
  );
}

/** `contain` fits the whole image (wide paragraph crops); otherwise the top of the page fills the box. */
export function Thumb({ id, v, className, contain }: { id: string; v?: number; className?: string; contain?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("overflow-hidden bg-muted", className)}>
      {failed ? (
        <div className="grid h-full w-full place-items-center text-muted-foreground">
          <ImageOff className="size-5" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/image/${id}?size=thumb${v ? `&v=${v}` : ""}`} alt="" loading="lazy" onError={() => setFailed(true)} className={cn("h-full w-full", contain ? "bg-white object-contain" : "object-cover object-top")} />
      )}
    </div>
  );
}

export function LayoutToggle({ value, onChange }: { value: "grid" | "list"; onChange: (v: "grid" | "list") => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5">
      {(["grid", "list"] as const).map((v) => {
        const Icon = v === "grid" ? LayoutGrid : List;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            aria-label={`${v} view`}
            className={cn("grid size-7 place-items-center rounded-md", value === v ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

/** Hook: filters + selection over a set of rows. */
export function useSampleSelection(rows: SampleRow[], initial: Filters = DEFAULT_FILTERS) {
  const [filters, setFilters] = useState<Filters>(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAll = () => setSelected(new Set(filtered.map((r) => r.id)));
  const clear = () => setSelected(new Set());
  return { filters, setFilters, filtered, selected, setSelected, toggle, selectAll, clear };
}
