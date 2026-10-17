"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImageAnnotator } from "@/components/ImageAnnotator";
import { ScoreButtons } from "@/components/ScoreButtons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { Scale } from "@/lib/types";
import { submitRating } from "../actions";

/** Phase A: one score plus open-text reasons. */
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <ImageAnnotator src={props.imageSrc} heightClass="h-[60vh] lg:h-[calc(100vh-8rem)]" />
      </div>
      <aside className="space-y-4 lg:pt-9">
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
