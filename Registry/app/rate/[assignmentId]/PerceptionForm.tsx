"use client";

import { Loader2, ThumbsUp, Wrench, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ImageAnnotator, MARK_STYLE, type Box } from "@/components/ImageAnnotator";
import { ScoreButtons } from "@/components/ScoreButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { MARK_LABEL, type MarkTone, type Region, type Scale } from "@/lib/types";
import { cn } from "@/lib/utils";
import { submitRating } from "../actions";

/** Phase A: one score, open-text reasons, and optional boxes on parts that look good or could be better. */
export function PerceptionForm(props: {
  assignmentId: string;
  studyId: string;
  imageSrc: string;
  position: number;
  total: number;
  title: string;
  scale: Scale;
  instructions: string;
}) {
  const router = useRouter();
  const started = useRef(Date.now());
  const [overall, setOverall] = useState<number | null>(null);
  const [liked, setLiked] = useState("");
  const [disliked, setDisliked] = useState("");
  const [marks, setMarks] = useState<Region[]>([]);
  const [drawing, setDrawing] = useState<MarkTone | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === "Escape") setDrawing(null);
      if ((e.key === "Delete" || e.key === "Backspace") && selected !== null) {
        setMarks((m) => m.filter((_, j) => j !== selected));
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  function add(b: Box) {
    if (!drawing) return;
    setMarks((m) => [...m, { ...b, criterionId: "", tone: drawing, note: "" }]);
    setSelected(marks.length);
  }

  function remove(i: number) {
    setMarks((m) => m.filter((_, j) => j !== i));
    setSelected(null);
  }

  async function submit() {
    if (overall === null) return setError("Choose a score");
    if (!liked.trim() && !disliked.trim()) return setError("Please write at least one reason");
    setBusy(true);
    setError(null);
    const res = await submitRating({
      assignmentId: props.assignmentId,
      overall,
      likedText: liked,
      dislikedText: disliked,
      regions: marks,
      durationMs: Date.now() - started.current,
    });
    if (res?.error) {
      setBusy(false);
      return setError(res.error);
    }
    router.push(`/rate/next?study=${props.studyId}`);
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="truncate font-medium">{props.title}</span>
          <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
            {props.position} / {props.total}
          </span>
        </div>
        <Progress value={(100 * (props.position - 1)) / props.total} />
        <div className="flex flex-wrap items-center gap-2">
          {(["good", "weak"] as const).map((tone) => (
            <Button
              key={tone}
              size="sm"
              variant={drawing === tone ? "default" : "outline"}
              onClick={() => setDrawing((d) => (d === tone ? null : tone))}
            >
              {tone === "good" ? <ThumbsUp /> : <Wrench />}
              {drawing === tone ? "Drawing… tap to stop" : `Mark: ${MARK_LABEL[tone].toLowerCase()}`}
            </Button>
          ))}
          <span className="text-xs text-muted-foreground">
            {drawing ? "Drag on the page to draw a box around the part." : "Optional: box the parts you mean."}
          </span>
        </div>
        <ImageAnnotator
          src={props.imageSrc}
          heightClass="h-[60vh] lg:h-[calc(100vh-11rem)]"
          drawMode={!!drawing}
          onDraw={add}
          selected={selected}
          onSelect={setSelected}
          boxes={marks.map((m) => ({ ...m, ...MARK_STYLE[m.tone!], label: m.note || MARK_LABEL[m.tone!] }))}
        />
      </div>
      <aside className="space-y-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pt-9">
        <div className="space-y-5 rounded-xl border bg-card p-4">
          {props.instructions && props.position === 1 && (
            <p className="rounded-lg bg-muted/60 p-3 text-sm whitespace-pre-line">{props.instructions}</p>
          )}
          <div>
            <h2 className="text-sm font-semibold">How good does this handwriting look?</h2>
            <p className="text-xs text-muted-foreground">Judge only how it looks, not spelling or content.</p>
            <ScoreButtons scale={props.scale} value={overall} onChange={setOverall} lowLabel="very poor" highLabel="excellent" />
          </div>
          <div>
            <Label className="mb-1.5">What makes it look good?</Label>
            <Textarea rows={3} value={liked} onChange={(e) => setLiked(e.target.value)} placeholder="Write in any language" />
          </div>
          <div>
            <Label className="mb-1.5">What makes it look bad, or could be better?</Label>
            <Textarea rows={3} value={disliked} onChange={(e) => setDisliked(e.target.value)} />
          </div>

          {marks.length > 0 && (
            <div className="space-y-2">
              <Label>Marked parts ({marks.length})</Label>
              {marks.map((m, i) => (
                <div
                  key={i}
                  onClick={() => setSelected(i)}
                  className={cn("space-y-1.5 rounded-lg border p-2", selected === i && "border-primary")}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className="size-3 shrink-0 rounded-sm border-2"
                      style={{ borderColor: MARK_STYLE[m.tone!].color, borderStyle: MARK_STYLE[m.tone!].dashed ? "dashed" : "solid" }}
                    />
                    <button
                      type="button"
                      className="font-medium hover:underline"
                      title="Switch"
                      onClick={() => setMarks((ms) => ms.map((x, j) => (j === i ? { ...x, tone: x.tone === "good" ? "weak" : "good" } : x)))}
                    >
                      {MARK_LABEL[m.tone!]}
                    </button>
                    <button
                      type="button"
                      aria-label="Remove box"
                      className="ml-auto text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(i);
                      }}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <Input
                    className="h-8 text-sm"
                    placeholder="Why? (optional)"
                    value={m.note}
                    onChange={(e) => setMarks((ms) => ms.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                  />
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="h-10 w-full" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {props.position === props.total ? "Finish" : "Next"}
          </Button>
        </div>
      </aside>
    </main>
  );
}
