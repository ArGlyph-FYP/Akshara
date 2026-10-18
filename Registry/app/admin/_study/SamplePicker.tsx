"use client";

import { Dices, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FilterBar, SampleGrid, useSampleSelection, type Filters } from "@/components/admin/SampleBrowser";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SampleRow, StudyRef } from "@/lib/dataset-types";
import { seededRandom, shuffle } from "@/lib/random";

/** Large dialog for choosing Dataset samples: filters, thumbnails, select-all and random pick. */
export function SamplePicker({
  open,
  onOpenChange,
  title,
  hint,
  rows,
  refs,
  initial,
  filters,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  hint?: string;
  rows: SampleRow[];
  refs: StudyRef[];
  initial: Set<string>;
  filters: Filters;
  confirmLabel: (n: number) => string;
  onConfirm: (ids: string[]) => Promise<unknown> | void;
}) {
  const sel = useSampleSelection(rows, filters);
  const [randomN, setRandomN] = useState(12);
  const [busy, setBusy] = useState(false);
  const shownSelected = useMemo(() => sel.filtered.filter((r) => sel.selected.has(r.id)).length, [sel.filtered, sel.selected]);

  // Start from the caller's selection and filters each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    sel.setSelected(new Set(initial));
    sel.setFilters(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function pickRandom() {
    const pool = shuffle(
      sel.filtered.map((x) => x.id),
      seededRandom(Date.now()),
    );
    sel.setSelected(new Set(pool.slice(0, Math.max(1, randomN))));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] flex-col gap-3 sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {hint && <DialogDescription>{hint}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium tabular-nums">{sel.selected.size} selected</span>
          <Button variant="outline" size="sm" onClick={sel.selectAll} disabled={!sel.filtered.length}>
            Select all {sel.filtered.length} shown
          </Button>
          <span className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={pickRandom} disabled={!sel.filtered.length}>
              <Dices /> Pick
            </Button>
            <Input
              type="number"
              min={1}
              aria-label="How many to pick at random"
              className="h-7 w-16"
              value={randomN}
              onChange={(e) => setRandomN(Number(e.target.value))}
            />
            <span className="text-muted-foreground">at random</span>
          </span>
          {sel.selected.size > 0 && (
            <Button variant="ghost" size="sm" onClick={sel.clear}>
              Clear
            </Button>
          )}
          {shownSelected < sel.selected.size && (
            <span className="text-xs text-muted-foreground">{sel.selected.size - shownSelected} selected are hidden by the filters</span>
          )}
        </div>
        <FilterBar filters={sel.filters} setFilters={sel.setFilters} studies={refs} total={rows.length} shown={sel.filtered.length} />
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {sel.filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No samples match these filters.</p>
          ) : (
            <SampleGrid rows={sel.filtered} studies={refs} selected={sel.selected} onToggle={sel.toggle} onOpen={(row) => sel.toggle(row.id)} />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm([...sel.selected]);
              setBusy(false);
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel(sel.selected.size)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
