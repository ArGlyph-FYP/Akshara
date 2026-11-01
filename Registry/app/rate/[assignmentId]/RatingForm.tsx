"use client";

import { Anchor, Loader2, SquareDashedMousePointer, X } from "lucide-react";
import { useNextItem } from "@/lib/useNextItem";
import { useEffect, useRef, useState } from "react";
import { ImageAnnotator, colorFor, type Box } from "@/components/ImageAnnotator";
import { ScoreButtons } from "@/components/ScoreButtons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Region, Scale } from "@/lib/types";
import { cn } from "@/lib/utils";
import { submitRating } from "../actions";

interface C {
  id: string;
  labelEn: string;
  labelLocal: string;
  description: string;
  level: string;
  min: number;
  max: number;
}

/** Main study (Phase C): overall, legibility, every rubric criterion, and optional weak-region boxes. */
export function RatingForm(props: {
  assignmentId: string;
  studyId: string;
  imageSrc: string;
  isCalibration: boolean;
  position: number;
  total: number;
  next: { href: string; imageSrc: string | null };
  title: string;
  instructions: string;
  overallScale: Scale;
  legibilityScale: Scale;
  criteria: C[];
}) {
  const { criteria } = props;
  const started = useRef(Date.now());
  const [overall, setOverall] = useState<number | null>(null);
  const [legibility, setLegibility] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [regions, setRegions] = useState<Region[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [tag, setTag] = useState(criteria[0]?.id ?? "");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ overall: number | null; legibility: number | null; note: string } | null>(null);

  const cIndex = Object.fromEntries(criteria.map((c, i) => [c.id, i]));
  const label = (id: string) => criteria[cIndex[id]]?.labelEn ?? "?";
  const missing = [
    overall === null && "overall",
    legibility === null && "legibility",
    ...criteria.filter((c) => scores[c.id] === undefined).map((c) => c.labelEn),
  ].filter(Boolean) as string[];
  const next = useNextItem(props.next);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [role=combobox]")) return;
      if (e.key === "d") setDrawMode((v) => !v);
      if (e.key === "Escape") setDrawMode(false);
      if ((e.key === "Delete" || e.key === "Backspace") && selected !== null) {
        setRegions((r) => r.filter((_, i) => i !== selected));
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  function addRegion(b: Box) {
    if (!tag) return;
    setRegions((r) => [...r, { ...b, criterionId: tag, note: "" }]);
    setSelected(regions.length);
  }

  async function submit() {
    if (missing.length) return setError(`Still to score: ${missing.join(", ")}`);
    setBusy(true);
    setError(null);
    const res = await submitRating({
      assignmentId: props.assignmentId,
      overall: overall!,
      legibility: legibility!,
      criterionScores: scores,
      regions,
      comment,
      durationMs: Date.now() - started.current,
    });
    if (res.error) {
      setBusy(false);
      return setError(res.error);
    }
    if (res.anchor) {
      setBusy(false);
      return setFeedback(res.anchor);
    }
    next();
  }

  return (
    <main className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 lg:grid-cols-[1fr_400px]">
      <div className="space-y-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="truncate font-medium">{props.title}</span>
          {props.isCalibration && (
            <Badge variant="secondary" className="bg-brand-soft text-primary">
              <Anchor /> Calibration sample
            </Badge>
          )}
          <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
            {props.position} / {props.total}
          </span>
        </div>
        <Progress value={(100 * (props.position - 1)) / props.total} />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger size="sm" className="w-56" aria-label="Criterion for new boxes">
              <SelectValue placeholder="No criteria" />
            </SelectTrigger>
            <SelectContent>
              {criteria.map((c, i) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="size-2.5 rounded-full" style={{ background: colorFor(i) }} /> {c.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant={drawMode ? "default" : "outline"} onClick={() => setDrawMode((v) => !v)} disabled={!criteria.length} title="Shortcut: D">
            <SquareDashedMousePointer /> {drawMode ? "Drawing… tap to stop" : "Mark weak region"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {drawMode ? "Drag on the page to box the weak part." : "Optional. Zoom with the buttons or by pinching."}
          </span>
        </div>
        <ImageAnnotator
          src={props.imageSrc}
          heightClass="h-[60vh] lg:h-[calc(100vh-11rem)]"
          drawMode={drawMode}
          onDraw={addRegion}
          selected={selected}
          onSelect={setSelected}
          boxes={regions.map((r) => ({ ...r, color: colorFor(cIndex[r.criterionId] ?? 0), label: r.note || label(r.criterionId) }))}
        />
      </div>

      <aside className="space-y-4 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1 lg:pt-9">
        {props.instructions && props.position === 1 && (
          <p className="rounded-xl border bg-muted/60 p-3 text-sm whitespace-pre-line">{props.instructions}</p>
        )}
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <div>
            <h2 className="text-sm font-semibold">Overall, how good does it look?</h2>
            <p className="text-xs text-muted-foreground">Judge only how it looks, not spelling or content.</p>
            <ScoreButtons scale={props.overallScale} value={overall} onChange={setOverall} lowLabel="very poor" highLabel="excellent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">How easy is it to read?</h2>
            <p className="text-xs text-muted-foreground">Rate this separately from how it looks.</p>
            <ScoreButtons scale={props.legibilityScale} value={legibility} onChange={setLegibility} lowLabel="hard" highLabel="easy" />
          </div>
        </section>

        {criteria.length > 0 && (
          <section className="space-y-4 rounded-xl border bg-card p-4">
            {criteria.map((c, i) => (
              <div key={c.id}>
                <div className="flex items-baseline gap-1.5 text-sm">
                  <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: colorFor(i) }} />
                  <span className="font-semibold">{c.labelEn}</span>
                  {c.labelLocal && <span className="text-muted-foreground">{c.labelLocal}</span>}
                </div>
                {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                <ScoreButtons scale={{ min: c.min, max: c.max }} value={scores[c.id] ?? null} onChange={(v) => setScores((s) => ({ ...s, [c.id]: v }))} />
              </div>
            ))}
          </section>
        )}

        {regions.length > 0 && (
          <section className="space-y-2 rounded-xl border bg-card p-4">
            <Label>Weak regions ({regions.length})</Label>
            {regions.map((r, i) => (
              <div key={i} onClick={() => setSelected(i)} className={cn("space-y-1.5 rounded-lg border p-2", selected === i && "border-primary")}>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorFor(cIndex[r.criterionId] ?? 0) }} />
                  <Select value={r.criterionId} onValueChange={(v) => setRegions((rs) => rs.map((x, j) => (j === i ? { ...x, criterionId: v } : x)))}>
                    <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label="Criterion">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {criteria.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.labelEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove box"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRegions((rs) => rs.filter((_, j) => j !== i));
                      setSelected(null);
                    }}
                  >
                    <X />
                  </Button>
                </div>
                <Input
                  className="h-8 text-sm"
                  placeholder="Note (optional)"
                  value={r.note}
                  onChange={(e) => setRegions((rs) => rs.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                />
              </div>
            ))}
          </section>
        )}

        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div>
            <Label htmlFor="rate-comment" className="mb-1.5">
              Comment <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="rate-comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button className="h-10 w-full" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {props.position === props.total ? "Finish" : "Next"}
          </Button>
        </section>
      </aside>

      <Dialog open={!!feedback} onOpenChange={(o) => !o && next()}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Calibration reference</DialogTitle>
            <DialogDescription>
              You gave overall <b>{overall}</b> and legibility <b>{legibility}</b>. The research team&apos;s reference is overall{" "}
              <b>{feedback?.overall ?? "–"}</b> and legibility <b>{feedback?.legibility ?? "–"}</b>.
            </DialogDescription>
          </DialogHeader>
          {feedback?.note && <p className="text-sm text-muted-foreground">{feedback.note}</p>}
          <DialogFooter>
            <Button className="w-full" onClick={next}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
