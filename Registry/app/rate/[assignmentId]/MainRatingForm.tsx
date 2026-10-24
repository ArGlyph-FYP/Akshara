"use client";

import { Anchor, ChevronDown, Info, Loader2, SquareDashedMousePointer, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ImageAnnotator, MARK_STYLE, type Box } from "@/components/ImageAnnotator";
import { ScoreButtons } from "@/components/ScoreButtons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ALTERATIONS,
  ALTERATIONS_Q,
  BAND_HOWTO,
  BAND_NAMES,
  BAND_RANGES,
  COMMENT_Q,
  CRITERIA_INTRO,
  DECORATION_Q,
  DECORATIONS,
  FLAGS,
  INSTRUCTIONS,
  ISSUE_TAGS,
  LEGIBILITY,
  OVERALL,
  PARTS,
  SEVERITY,
  bandIndex,
  criterionText,
  type Alterations,
  type Bands,
  type Decoration,
} from "@/lib/rubric/si";
import type { Region, Scale } from "@/lib/types";
import { cn } from "@/lib/utils";
import { skipItem, submitRating } from "../actions";

interface C {
  id: string;
  key: string;
  labelEn: string;
  labelLocal: string;
  description: string;
  min: number;
  max: number;
}

/** Box tag: a criterion id, or "flag:<value>" for a flag (illegible, copy error, …). */
const FLAG_PREFIX = "flag:";

/**
 * Main study, Sinhala (Rubric v1): one page per paragraph with O, decoration and alterations flags, A1–A8, L,
 * optional weak-region boxes (criterion, issue tag, severity) and a comment.
 */
export function MainRatingForm(props: {
  assignmentId: string;
  studyId: string;
  imageSrc: string;
  isCalibration: boolean;
  /** 1 = text 1, 2 = text 2 (null for calibration samples). */
  block: number | null;
  /** First sample of the text-2 block in this form. */
  blockChanged: boolean;
  position: number;
  total: number;
  title: string;
  instructions: string;
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
  const [decoration, setDecoration] = useState<Decoration | null>(null);
  const [alterations, setAlterations] = useState<Alterations | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [tag, setTag] = useState(criteria[0]?.id ?? `${FLAG_PREFIX}${FLAGS[0].value}`);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(props.position === 1);
  const [skipping, setSkipping] = useState(false);
  const [feedback, setFeedback] = useState<{ overall: number | null; legibility: number | null; note: string } | null>(null);

  const keyOf = Object.fromEntries(criteria.map((c) => [c.id, c.key]));
  const code = (id: string) => criterionText(keyOf[id] ?? "")?.code ?? criteria.find((c) => c.id === id)?.labelEn ?? "?";
  const boxLabel = (r: Region) => (r.flag ? (FLAGS.find((f) => f.value === r.flag)?.label ?? r.flag) : code(r.criterionId));
  const next = () => router.push(`/rate/next?study=${props.studyId}`);

  const missing: { id: string; label: string }[] = [
    ...(overall === null ? [{ id: "q-O", label: OVERALL.code }] : []),
    ...(decoration === null ? [{ id: "q-D", label: DECORATION_Q.code }] : []),
    ...(alterations === null ? [{ id: "q-alt", label: ALTERATIONS_Q.label }] : []),
    ...criteria.filter((c) => scores[c.id] === undefined).map((c) => ({ id: `q-${c.id}`, label: code(c.id) })),
    ...(legibility === null ? [{ id: "q-L", label: LEGIBILITY.code }] : []),
  ];

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
    const flag = tag.startsWith(FLAG_PREFIX) ? tag.slice(FLAG_PREFIX.length) : null;
    setRegions((r) => [...r, { ...b, criterionId: flag ? "" : tag, flag, issueTag: null, part: null, severity: 2, note: "" }]);
    setSelected(regions.length);
  }

  const patch = (i: number, p: Partial<Region>) => setRegions((rs) => rs.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function submit() {
    if (missing.length) {
      setError(`තවම පිළිතුරු නොදුන්: ${missing.map((m) => m.label).join(", ")}`);
      document.getElementById(missing[0].id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    setError(null);
    const res = await submitRating({
      assignmentId: props.assignmentId,
      overall: overall!,
      legibility: legibility!,
      criterionScores: scores,
      decoration,
      alterations,
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

  async function skip() {
    setBusy(true);
    const res = await skipItem(props.assignmentId);
    if (res?.error) {
      setBusy(false);
      setSkipping(false);
      return setError(res.error);
    }
    next();
  }

  return (
    <main className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 lg:grid-cols-[1fr_420px]">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          {props.isCalibration ? (
            <Badge variant="secondary" className="bg-brand-soft text-primary">
              <Anchor /> ක්‍රමාංකන ඡේදය
            </Badge>
          ) : (
            props.block && (
              <Badge variant="secondary" className="bg-brand-soft text-primary">
                පාඨය {props.block}
              </Badge>
            )
          )}
          <span className="truncate text-muted-foreground">{props.title}</span>
          <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
            ඡේදය {props.position} / {props.total}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label="උපදෙස්" onClick={() => setHelp(true)}>
            <Info />
          </Button>
        </div>
        <Progress value={(100 * (props.position - 1)) / props.total} />
        {props.blockChanged && (
          <p className="rounded-lg border border-primary/30 bg-brand-soft px-3 py-2 text-sm">
            මෙතැන් සිට ඇත්තේ <b>වෙනත් පාඨයකි (පාඨය 2)</b>. එකම පාඨය විවිධ අය ලියූ ඡේද ඔබට පෙනේ.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={drawMode ? "default" : "outline"} onClick={() => setDrawMode((v) => !v)} title="D">
            <SquareDashedMousePointer /> {drawMode ? "අඳිමින්… නතර කිරීමට තට්ටු කරන්න" : "දුර්වල තැනක් සලකුණු කරන්න"}
          </Button>
          <TagSelect value={tag} onChange={setTag} criteria={criteria} code={code} className="w-48" />
          <span className="text-xs text-muted-foreground">
            {drawMode ? "දුර්වල තැන වටා කොටුවක් අඳින්න." : "අනිවාර්ය නොවේ. බොත්තම්වලින් හෝ ඇඟිලි දෙකෙන් විශාලනය කරන්න."}
          </span>
        </div>
        <ImageAnnotator
          src={props.imageSrc}
          heightClass="h-[55vh] lg:h-[calc(100vh-12rem)]"
          drawMode={drawMode}
          onDraw={addRegion}
          selected={selected}
          onSelect={setSelected}
          boxes={regions.map((r) => ({ ...r, ...(r.flag ? MARK_STYLE.weak : MARK_STYLE.good), label: boxLabel(r) }))}
        />
      </div>

      <aside className="space-y-4 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1">
        {props.instructions && props.position === 1 && (
          <p className="rounded-xl border bg-muted/60 p-3 text-sm whitespace-pre-line">{props.instructions}</p>
        )}

        <section className="space-y-4 rounded-xl border bg-card p-4">
          <ScoreQuestion
            id="q-O"
            code={OVERALL.code}
            label={OVERALL.label}
            question={OVERALL.question}
            help={OVERALL.help}
            bands={OVERALL.bands}
            scale={props.overallScale}
            value={overall}
            onChange={setOverall}
            low={OVERALL.low}
            high={OVERALL.high}
          />
          <Choice
            id="q-D"
            label={`${DECORATION_Q.label} (${DECORATION_Q.code})`}
            question={DECORATION_Q.question}
            options={DECORATIONS.map((v) => ({ value: v, label: DECORATION_Q.options[v] }))}
            value={decoration}
            onChange={setDecoration}
          />
          <Choice
            id="q-alt"
            label={ALTERATIONS_Q.label}
            question={ALTERATIONS_Q.question}
            options={ALTERATIONS.map((v) => ({ value: v, label: ALTERATIONS_Q.options[v] }))}
            value={alterations}
            onChange={setAlterations}
          />
        </section>

        {criteria.length > 0 && (
          <section className="space-y-4 rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{CRITERIA_INTRO}</p>
            {criteria.map((c) => {
              const text = criterionText(c.key);
              return (
                <ScoreQuestion
                  key={c.id}
                  id={`q-${c.id}`}
                  code={text?.code ?? ""}
                  label={text?.label ?? (c.labelLocal || c.labelEn)}
                  question=""
                  help={text?.lookFor ?? c.description}
                  helpLabel="බලන්න"
                  bands={text?.bands ?? null}
                  scale={{ min: c.min, max: c.max }}
                  value={scores[c.id] ?? null}
                  onChange={(v) => setScores((s) => ({ ...s, [c.id]: v }))}
                />
              );
            })}
          </section>
        )}

        <section className="rounded-xl border bg-card p-4">
          <ScoreQuestion
            id="q-L"
            code={LEGIBILITY.code}
            label={LEGIBILITY.label}
            question={LEGIBILITY.question}
            help=""
            bands={LEGIBILITY.bands}
            scale={props.legibilityScale}
            value={legibility}
            onChange={setLegibility}
            low={LEGIBILITY.low}
            high={LEGIBILITY.high}
          />
        </section>

        {regions.length > 0 && (
          <section className="space-y-2 rounded-xl border bg-card p-4">
            <Label>දුර්වල තැන් ({regions.length})</Label>
            {regions.map((r, i) => {
              const key = keyOf[r.criterionId];
              const tags = r.flag ? [] : (ISSUE_TAGS[key] ?? []);
              return (
                <div key={i} onClick={() => setSelected(i)} className={cn("space-y-1.5 rounded-lg border p-2", selected === i && "border-primary")}>
                  <div className="flex items-center gap-2">
                    <TagSelect
                      value={r.flag ? `${FLAG_PREFIX}${r.flag}` : r.criterionId}
                      onChange={(v) =>
                        v.startsWith(FLAG_PREFIX)
                          ? patch(i, { flag: v.slice(FLAG_PREFIX.length), criterionId: "", issueTag: null, part: null })
                          : patch(i, { flag: null, criterionId: v, issueTag: null, part: null })
                      }
                      criteria={criteria}
                      code={code}
                      className="min-w-0 flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="කොටුව ඉවත් කරන්න"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRegions((rs) => rs.filter((_, j) => j !== i));
                        setSelected(null);
                      }}
                    >
                      <X />
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <Select value={r.issueTag ?? ""} onValueChange={(v) => patch(i, { issueTag: v })}>
                      <SelectTrigger size="sm" className="w-full" aria-label="ගැටලුව">
                        <SelectValue placeholder="ගැටලුව තෝරන්න" />
                      </SelectTrigger>
                      <SelectContent>
                        {tags.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {key === "a1" && (
                    <Select value={r.part ?? ""} onValueChange={(v) => patch(i, { part: v })}>
                      <SelectTrigger size="sm" className="w-full" aria-label="අකුරේ කොටස">
                        <SelectValue placeholder="අකුරේ කොටස (අනිවාර්ය නොවේ)" />
                      </SelectTrigger>
                      <SelectContent>
                        {PARTS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!r.flag && (
                    <div className="flex gap-1" role="radiogroup" aria-label="බරපතලකම">
                      {([2, 3] as const).map((sv) => (
                        <button
                          key={sv}
                          type="button"
                          role="radio"
                          aria-checked={r.severity === sv}
                          onClick={() => patch(i, { severity: sv })}
                          className={cn(
                            "flex-1 rounded-md border px-2 py-1 text-left text-xs",
                            r.severity === sv ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50",
                          )}
                        >
                          <b>{sv}</b> · {SEVERITY[sv]}
                        </button>
                      ))}
                    </div>
                  )}
                  <Input className="h-8 text-sm" placeholder="සටහන (අනිවාර්ය නොවේ)" value={r.note} onChange={(e) => patch(i, { note: e.target.value })} />
                </div>
              );
            })}
          </section>
        )}

        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div>
            <Label htmlFor="rate-comment" className="mb-1.5 leading-snug">
              {COMMENT_Q} <span className="font-normal text-muted-foreground">(අනිවාර්ය නොවේ)</span>
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
            {props.position === props.total ? "අවසන් කරන්න" : "ඊළඟ"}
          </Button>
          {!props.isCalibration && (
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setSkipping(true)}
              disabled={busy}
            >
              මෙම අත් අකුරු හඳුනාගත්තා — මඟ හරින්න
            </button>
          )}
        </section>
      </aside>

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ඇගයීමට පෙර කියවන්න</DialogTitle>
            <DialogDescription>උපදෙස්</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {INSTRUCTIONS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="rounded-lg bg-muted/60 p-3 text-sm">
            <p className="mb-2">{BAND_HOWTO}</p>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
              {BAND_RANGES.map((r, i) => (
                <div key={r} className="contents">
                  <span className="font-medium tabular-nums">{r}</span>
                  <span>{BAND_NAMES[i]}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => setHelp(false)}>
              හරි, ආරම්භ කරමු
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={skipping} onOpenChange={(o) => !busy && setSkipping(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>මෙම ඡේදය මඟ හරින්නද?</DialogTitle>
            <DialogDescription>
              මෙය ඔබේම, ඔබේ පවුලේ අයෙකුගේ හෝ මිතුරෙකුගේ අත් අකුරු නම් පමණක් මඟ හරින්න. එය ඇගයීමට ගණන් නොගැනේ.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkipping(false)} disabled={busy}>
              නැත, ඇගයීමට
            </Button>
            <Button onClick={skip} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} ඔව්, මඟ හරින්න
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!feedback} onOpenChange={(o) => !o && next()}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>ක්‍රමාංකන යොමුව</DialogTitle>
            <DialogDescription>
              ඔබ සමස්ත අලංකාරයට <b>{overall}</b> සහ කියවීමේ පහසුවට <b>{legibility}</b> දුන්නා. පර්යේෂණ කණ්ඩායමේ යොමු ලකුණු: සමස්ත
              අලංකාරය <b>{feedback?.overall ?? "–"}</b>, කියවීමේ පහසුව <b>{feedback?.legibility ?? "–"}</b>.
            </DialogDescription>
          </DialogHeader>
          {feedback?.note && <p className="text-sm text-muted-foreground">{feedback.note}</p>}
          <DialogFooter>
            <Button className="w-full" onClick={next}>
              ඉදිරියට
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

/** A 1–10 question: code + label, optional question and expandable help, buttons, and the chosen band's description. */
function ScoreQuestion(props: {
  id: string;
  code: string;
  label: string;
  question: string;
  help: string;
  helpLabel?: string;
  bands: Bands | null;
  scale: Scale;
  value: number | null;
  onChange: (v: number) => void;
  low?: string;
  high?: string;
}) {
  const [open, setOpen] = useState(false);
  const tenPoint = props.scale.min === 1 && props.scale.max === 10;
  const band = props.value !== null && props.bands && tenPoint ? props.bands[bandIndex(props.value)] : null;
  return (
    <div id={props.id} className="scroll-mt-24">
      <div className="flex items-baseline gap-1.5 text-sm">
        {props.code && <span className="font-mono text-xs text-muted-foreground">{props.code}</span>}
        <span className="font-semibold">{props.label}</span>
        {(props.help || props.bands) && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-xs text-primary"
            aria-expanded={open}
          >
            {props.helpLabel ?? "විස්තර"} <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} />
          </button>
        )}
      </div>
      {props.question && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{props.question}</p>}
      {open && (
        <div className="mt-1.5 space-y-2 rounded-lg bg-muted/60 p-2.5 text-xs leading-relaxed">
          {props.help && <p>{props.help}</p>}
          {props.bands && tenPoint && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {props.bands.map((b, i) => (
                <div key={i} className="contents">
                  <dt className="font-medium tabular-nums">{BAND_RANGES[i]}</dt>
                  <dd>{b}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
      <ScoreButtons compact scale={props.scale} value={props.value} onChange={props.onChange} lowLabel={props.low} highLabel={props.high} />
      {band && (
        <p className="mt-1 text-xs text-primary">
          {BAND_NAMES[bandIndex(props.value!)]}: {band}
        </p>
      )}
    </div>
  );
}

/** A small single-choice question shown as buttons. */
function Choice<T extends string>(props: {
  id: string;
  label: string;
  question: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div id={props.id} className="scroll-mt-24">
      <p className="text-sm font-semibold">{props.label}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{props.question}</p>
      <div className="mt-1.5 flex flex-wrap gap-1" role="radiogroup">
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={props.value === o.value}
            onClick={() => props.onChange(o.value)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-xs font-medium transition",
              props.value === o.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Picks what a box is about: one of A1–A8, or a flag. */
function TagSelect(props: { value: string; onChange: (v: string) => void; criteria: C[]; code: (id: string) => string; className?: string }) {
  return (
    <Select value={props.value} onValueChange={props.onChange}>
      <SelectTrigger size="sm" className={props.className} aria-label="නිර්ණායකය">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>නිර්ණායක</SelectLabel>
          {props.criteria.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {props.code(c.id)} · {criterionText(c.key)?.label ?? (c.labelLocal || c.labelEn)}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>වෙනත් ලකුණු</SelectLabel>
          {FLAGS.map((f) => (
            <SelectItem key={f.value} value={`${FLAG_PREFIX}${f.value}`}>
              {f.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
