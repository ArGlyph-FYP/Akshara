"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ImageAnnotator, colorFor, type Box } from "@/components/ImageAnnotator";
import { ScoreButtons } from "@/components/ScoreButtons";
import type { Region, Scale, Script } from "@/lib/types";
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

export function RatingForm(props: {
  assignmentId: string;
  script: Script;
  imageSrc: string;
  isCalibration: boolean;
  position: number;
  total: number;
  overallScale: Scale;
  legibilityScale: Scale;
  criteria: C[];
}) {
  const { criteria } = props;
  const router = useRouter();
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
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
    if (!tag) return setError("Add criteria to the rubric before marking regions");
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
    router.push(`/rate/next?script=${props.script}`);
  }

  return (
    <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-3 lg:grid-cols-[1fr_400px]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">
            Item {props.position} of {props.total}
          </span>
          {props.isCalibration && <span className="pill bg-sky-50 text-sky-800">Calibration item</span>}
          <div className="ml-auto flex items-center gap-2">
            <select className="input w-56 py-1" value={tag} onChange={(e) => setTag(e.target.value)} title="Criterion for new regions">
              {criteria.map((c) => (
                <option key={c.id} value={c.id}>
                  Tag: {c.labelEn}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`btn ${drawMode ? "btn-primary" : ""}`}
              onClick={() => setDrawMode((v) => !v)}
              disabled={criteria.length === 0}
              title="Shortcut: D"
            >
              {drawMode ? "Drawing: drag on the scan" : "Mark weak region"}
            </button>
          </div>
        </div>
        <ImageAnnotator
          src={props.imageSrc}
          drawMode={drawMode}
          onDraw={addRegion}
          selected={selected}
          onSelect={setSelected}
          boxes={regions.map((r) => ({ ...r, color: colorFor(cIndex[r.criterionId] ?? 0), label: label(r.criterionId) }))}
        />
        <p className="text-xs text-muted">
          Scroll or pinch to zoom, drag to move. Press <kbd>D</kbd> to toggle region drawing; select a box and press
          Delete to remove it.
        </p>
      </div>

      <aside className="space-y-4 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1">
        <section className="card space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Overall aesthetic quality</h3>
            <p className="text-xs text-muted">How good does this handwriting look as a whole?</p>
            <ScoreButtons scale={props.overallScale} value={overall} onChange={setOverall} lowLabel="poor" highLabel="excellent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Legibility</h3>
            <p className="text-xs text-muted">How easy is it to read? Rate this separately from how it looks.</p>
            <ScoreButtons scale={props.legibilityScale} value={legibility} onChange={setLegibility} lowLabel="hard" highLabel="easy" />
          </div>
        </section>

        {criteria.length > 0 && (
          <section className="card space-y-3">
            <h3 className="text-sm font-semibold">Criteria</h3>
            {criteria.map((c, i) => (
              <div key={c.id}>
                <div className="flex items-baseline gap-1.5 text-sm">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colorFor(i) }} />
                  <span className="font-medium">{c.labelEn}</span>
                  {c.labelLocal && <span className="text-muted">{c.labelLocal}</span>}
                  <span className="ml-auto text-[10px] tracking-wide text-muted uppercase">{c.level}</span>
                </div>
                {c.description && <p className="text-xs text-muted">{c.description}</p>}
                <ScoreButtons
                  scale={{ min: c.min, max: c.max }}
                  value={scores[c.id] ?? null}
                  onChange={(v) => setScores((s) => ({ ...s, [c.id]: v }))}
                />
              </div>
            ))}
          </section>
        )}

        <section className="card space-y-2">
          <h3 className="text-sm font-semibold">Weak regions ({regions.length})</h3>
          {regions.length === 0 && (
            <p className="text-xs text-muted">Optional. Use &quot;Mark weak region&quot; to box places that lower the score.</p>
          )}
          {regions.map((r, i) => (
            <div
              key={i}
              className={`space-y-1 rounded-md border p-2 ${selected === i ? "border-accent" : "border-line"}`}
              onClick={() => setSelected(i)}
            >
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorFor(cIndex[r.criterionId] ?? 0) }} />
                <select
                  className="input py-0.5"
                  value={r.criterionId}
                  onChange={(e) => setRegions((rs) => rs.map((x, j) => (j === i ? { ...x, criterionId: e.target.value } : x)))}
                >
                  {criteria.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.labelEn}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-xs text-red-700 underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRegions((rs) => rs.filter((_, j) => j !== i));
                    setSelected(null);
                  }}
                >
                  remove
                </button>
              </div>
              <input
                className="input py-0.5 text-xs"
                placeholder="Note (optional)"
                value={r.note}
                onChange={(e) => setRegions((rs) => rs.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
              />
            </div>
          ))}
        </section>

        <section className="card space-y-3">
          <div>
            <label className="label">Comment (optional)</label>
            <textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="button" className="btn btn-primary w-full py-2" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Submit & next"}
          </button>
        </section>
      </aside>

      {feedback && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="card max-w-md space-y-3">
            <h3 className="h2">Calibration reference</h3>
            <p className="text-sm">
              You gave overall <b>{overall}</b> and legibility <b>{legibility}</b>. The reference is overall{" "}
              <b>{feedback.overall ?? "–"}</b> and legibility <b>{feedback.legibility ?? "–"}</b>.
            </p>
            {feedback.note && <p className="text-sm text-muted">{feedback.note}</p>}
            <button className="btn btn-primary w-full" onClick={() => router.push(`/rate/next?script=${props.script}`)}>
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
