"use client";

import { ImageAnnotator, MARK_STYLE, colorFor } from "@/components/ImageAnnotator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MARK_LABEL, type Criterion, type Region, type StudyType } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ItemInfo } from "./load";

export function markCounts(regions: Region[]) {
  const good = regions.filter((r) => r.tone === "good").length;
  const weak = regions.filter((r) => r.tone === "weak").length;
  return good + weak ? [good && `${good} good`, weak && `${weak} to improve`].filter(Boolean).join(" · ") : "–";
}

/** One sample's responses, with every reader's boxes on the scan (or one reader's, when focused). */
export function ResponsesDialog({
  type,
  title,
  sampleId,
  items,
  criteria,
  focus,
  onFocus,
  onClose,
  readerName,
}: {
  type: StudyType;
  title: string;
  sampleId: string;
  items: ItemInfo[];
  criteria: Criterion[];
  focus: string | null;
  onFocus: (itemId: string | null) => void;
  onClose: () => void;
  readerName: (uid: string) => string;
}) {
  const cIndex = new Map(criteria.map((c, i) => [c.id, i]));
  const cLabel = (id: string) => criteria[cIndex.get(id) ?? -1]?.labelEn ?? "Unknown criterion";
  const regionLabel = (r: Region) => (type === "perception" ? MARK_LABEL[r.tone ?? "weak"] : cLabel(r.criterionId));
  const style = (r: Region) => (type === "perception" ? MARK_STYLE[r.tone ?? "weak"] : { color: colorFor(cIndex.get(r.criterionId) ?? 0), dashed: false });
  const boxes = items
    .filter((i) => !focus || i.id === focus)
    .flatMap((i) => i.rating!.regions.map((r) => ({ ...r, ...style(r), label: `${readerName(i.raterId)}: ${r.note || regionLabel(r)}` })));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="font-mono">{title}</DialogTitle>
          <DialogDescription>
            {items.length} response{items.length === 1 ? "" : "s"}.{" "}
            {type === "perception" ? (
              <>
                <Swatch color={MARK_STYLE.good.color} /> looks good · <Swatch color={MARK_STYLE.weak.color} dashed /> could be better.
              </>
            ) : (
              "Box colours follow the criteria."
            )}{" "}
            Hover a box to see who marked it and why.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <ImageAnnotator src={`/api/image/${sampleId}`} boxes={boxes} heightClass="h-[50vh] lg:h-[70vh]" />
          <div className="space-y-2 lg:max-h-[70vh] lg:overflow-y-auto">
            {focus && items.length > 1 && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => onFocus(null)}>
                Show everyone&apos;s boxes
              </Button>
            )}
            {items.map((i) => {
              const r = i.rating!;
              return (
                <button
                  key={i.id}
                  type="button"
                  aria-pressed={focus === i.id}
                  onClick={() => onFocus(focus === i.id ? null : i.id)}
                  className={cn(
                    "block w-full space-y-1.5 rounded-lg border p-3 text-left text-sm transition",
                    focus === i.id ? "border-primary bg-brand-soft/40" : "hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{readerName(i.raterId)}</span>
                    {i.kind !== "normal" && <Badge variant="outline">{i.kind}</Badge>}
                    <Badge variant="secondary" className="ml-auto tabular-nums" title="Overall score">
                      {r.overall}
                    </Badge>
                    {r.legibility !== null && (
                      <Badge variant="outline" className="tabular-nums" title="Legibility">
                        L {r.legibility}
                      </Badge>
                    )}
                  </div>
                  {r.liked && (
                    <p>
                      <span className="text-muted-foreground">Good: </span>
                      {r.liked}
                    </p>
                  )}
                  {r.disliked && (
                    <p>
                      <span className="text-muted-foreground">Could be better: </span>
                      {r.disliked}
                    </p>
                  )}
                  {Object.keys(r.criterionScores).length > 0 && (
                    <ul className="grid grid-cols-2 gap-x-3 text-xs">
                      {criteria
                        .filter((c) => r.criterionScores[c.id] !== undefined)
                        .map((c) => (
                          <li key={c.id} className="flex justify-between gap-2">
                            <span className="truncate text-muted-foreground">{c.labelEn}</span>
                            <span className="tabular-nums">{r.criterionScores[c.id]}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                  {r.comment && <p className="text-muted-foreground">“{r.comment}”</p>}
                  {r.regions.some((g) => g.note) && (
                    <ul className="list-inside list-disc text-xs text-muted-foreground">
                      {r.regions
                        .filter((g) => g.note)
                        .map((g, k) => (
                          <li key={k}>
                            {regionLabel(g)}: {g.note}
                          </li>
                        ))}
                    </ul>
                  )}
                  {type === "perception" && <p className="text-xs text-muted-foreground">Boxes: {markCounts(r.regions)}</p>}
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Swatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return <span className={cn("inline-block size-2.5 rounded-sm border-2 align-middle", dashed && "border-dashed")} style={{ borderColor: color }} />;
}
