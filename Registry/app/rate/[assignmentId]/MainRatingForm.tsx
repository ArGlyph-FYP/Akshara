"use client";

import { Anchor, Check, ChevronDown, Eraser, Eye, EyeOff, Hand, Info, Layers, Loader2, PanelRightClose, SquareDashedMousePointer, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageAnnotator, MARK_STYLE, colorFor, type Box } from "@/components/ImageAnnotator";
import { ScoreButtons } from "@/components/ScoreButtons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { submitRating } from "../actions";

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

/** A box on the page; `uid` is a page-only key (kept stable when boxes are removed) and is not saved. */
type Mark = Region & { uid: number };
const toRegion = ({ uid, ...r }: Mark): Region => (void uid, r);

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
  const [regions, setRegions] = useState<Mark[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  /** Boxes the rater has hidden for now (by uid); hidden boxes are still saved. */
  const [hiddenUids, setHiddenUids] = useState<Set<number>>(new Set());
  /** Whole layers (A1, A2, … or a flag) the rater has hidden for now. */
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(new Set());
  const nextUid = useRef(1);
  const [tag, setTag] = useState(criteria[0]?.id ?? `${FLAG_PREFIX}${FLAGS[0].value}`);
  /** How strongly boxes show over the scan (0 = hidden), and the last visible level for the eye toggle. */
  const [opacity, setOpacity] = useState(1);
  const [shownOpacity, setShownOpacity] = useState(1);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(props.position === 1);
  const [feedback, setFeedback] = useState<{ overall: number | null; legibility: number | null; note: string } | null>(null);

  const keyOf = Object.fromEntries(criteria.map((c) => [c.id, c.key]));
  const code = (id: string) => criterionText(keyOf[id] ?? "")?.code ?? criteria.find((c) => c.id === id)?.labelEn ?? "?";
  const boxLabel = (r: Region) => (r.flag ? (FLAGS.find((f) => f.value === r.flag)?.label ?? r.flag) : code(r.criterionId));
  /** Each criterion has its own colour (same as the admin view); flags are dashed near-black. */
  const tagColor = (t: string) =>
    t.startsWith(FLAG_PREFIX) ? MARK_STYLE.weak.color : colorFor(Math.max(0, criteria.findIndex((c) => c.id === t)));
  const regionTag = (r: Region) => (r.flag ? `${FLAG_PREFIX}${r.flag}` : r.criterionId);
  const isHidden = (r: Mark) => hiddenUids.has(r.uid) || hiddenTags.has(regionTag(r));
  /** Layers: A1–A8 always, then flags that have boxes, with their box counts. */
  const layers = [...new Set([...criteria.map((c) => c.id), ...regions.map(regionTag)])]
    .map((t) => ({ tag: t, count: regions.filter((r) => regionTag(r) === t).length }))
    .sort((a, b) => layerOrder(a.tag) - layerOrder(b.tag));
  function layerOrder(t: string) {
    const i = criteria.findIndex((c) => c.id === t);
    return i >= 0 ? i : criteria.length + FLAGS.findIndex((f) => `${FLAG_PREFIX}${f.value}` === t);
  }
  const layerLabel = (t: string) =>
    t.startsWith(FLAG_PREFIX) ? (FLAGS.find((f) => `${FLAG_PREFIX}${f.value}` === t)?.label ?? t) : code(t);
  const toggleLayer = (t: string) =>
    setHiddenTags((h) => {
      const n = new Set(h);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  const showMarks = () => opacity === 0 && setOpacity(shownOpacity || 1);
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
      if (e.key === "m") setDrawMode(false);
      if (e.key === "Escape") {
        setDrawMode(false);
        setSelected(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected !== null) removeRegion(selected);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, regions]);

  function addRegion(b: Box) {
    const flag = tag.startsWith(FLAG_PREFIX) ? tag.slice(FLAG_PREFIX.length) : null;
    const uid = nextUid.current++;
    setRegions((r) => [...r, { uid, ...b, criterionId: flag ? "" : tag, flag, issueTag: null, part: null, severity: 2, note: "" }]);
    // Drawing into a hidden layer shows that layer again, so the new box is visible.
    setHiddenTags((h) => {
      if (!h.has(tag)) return h;
      const n = new Set(h);
      n.delete(tag);
      return n;
    });
    setSelected(regions.length);
    showMarks();
  }

  const toggleHidden = (uid: number) =>
    setHiddenUids((h) => {
      const n = new Set(h);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });

  // On wide screens the list of boxes scrolls on its own: bring the selected box to its top (without moving the page).
  const listRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const row = selected === null ? null : document.getElementById(`mark-${regions[selected]?.uid}`);
    if (!list || !row || !window.matchMedia("(min-width: 1024px)").matches) return;
    list.scrollTo({ top: row.offsetTop - 40, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  /** Removes one box (or all of them) with an Undo in the toast, so a slip costs nothing. */
  function removeRegion(i: number | "all") {
    const before = regions;
    const beforeSel = selected;
    if (i === "all") {
      setRegions([]);
      setSelected(null);
    } else {
      setRegions((rs) => rs.filter((_, j) => j !== i));
      setSelected((s) => (s === null || s === i ? null : s > i ? s - 1 : s));
    }
    toast(i === "all" ? "කොටු සියල්ල ඉවත් කළා" : "කොටුව ඉවත් කළා", {
      action: { label: "Undo", onClick: () => (setRegions(before), setSelected(beforeSel)) },
    });
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
      regions: regions.map(toRegion),
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
    <main className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-w-0 flex-col gap-2 lg:h-[calc(100vh-5rem)]">
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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-1.5">
          <div className="flex rounded-md border p-0.5" role="radiogroup" aria-label="Tool">
            <button
              type="button"
              role="radio"
              aria-checked={!drawMode}
              title="Move / zoom (M)"
              onClick={() => setDrawMode(false)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-sm",
                !drawMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Hand className="size-4" /> Move
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={drawMode}
              title="Draw a box (D)"
              onClick={() => {
                setDrawMode(true);
                showMarks();
              }}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-sm",
                drawMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <SquareDashedMousePointer className="size-4" /> දුර්වල තැනක් සලකුණු කරන්න
            </button>
          </div>
          {regions.length > 0 && (
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={opacity === 0 ? "කොටු පෙන්වන්න" : "කොටු සඟවන්න"}
                title={opacity === 0 ? "කොටු පෙන්වන්න" : "කොටු සඟවන්න"}
                onClick={() => (opacity === 0 ? showMarks() : (setShownOpacity(opacity), setOpacity(0)))}
              >
                {opacity === 0 ? <EyeOff /> : <Eye />}
              </Button>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(opacity * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  setOpacity(v);
                  if (v > 0) setShownOpacity(v);
                }}
                aria-label="කොටුවල පැහැදිලිකම"
                title="කොටුවල පැහැදිලිකම"
                className="w-20 accent-primary sm:w-28"
              />
            </div>
          )}
        </div>
        {drawMode && (
          <div className="shrink-0 space-y-1.5 rounded-lg border bg-card p-2">
            <p className="text-xs font-medium">කුමක් ගැනද? තෝරා, රූපයේ දුර්වල තැන වටා කොටුවක් අඳින්න.</p>
            <TagPanel value={tag} onChange={setTag} criteria={criteria} color={tagColor} />
          </div>
        )}
        <p className="px-0.5 text-xs text-muted-foreground">
          {drawMode
            ? "Move තෝරා රූපය ඇදගෙන යන්න. Zoom කිරීමට + / − බොත්තම් හෝ ඇඟිලි දෙක භාවිත කරන්න."
            : "අනිවාර්ය නොවේ. Zoom කිරීමට + / − බොත්තම් හෝ ඇඟිලි දෙක භාවිත කරන්න; රූපය ඇදගෙන යා හැක."}
        </p>
        <div className="flex flex-col gap-2 lg:min-h-[200px] lg:flex-1 lg:flex-row">
          <div className="min-w-0 lg:flex-1">
          <ImageAnnotator
            src={props.imageSrc}
            heightClass="h-[45vh] lg:h-full"
            minScale={1}
            fitHeightBelow={1024}
            drawMode={drawMode}
            onDraw={addRegion}
            selected={selected}
            onSelect={setSelected}
            showLabels
            onRemove={removeRegion}
            overlayOpacity={opacity}
            draftColor={tagColor(tag)}
            boxes={regions.map((r, i) => ({
              ...r,
              color: tagColor(regionTag(r)),
              dashed: !!r.flag,
              label: `${boxLabel(r)}${r.severity === 3 && !r.flag ? " · 3" : ""}`,
              hidden: isHidden(r),
              dim: selected !== null && selected !== i,
            }))}
          />
          </div>
          <LayersPanel
            layers={layers.map(({ tag: t }) => ({
              tag: t,
              label: layerLabel(t),
              name: t.startsWith(FLAG_PREFIX) ? undefined : criterionText(keyOf[t] ?? "")?.label,
              color: tagColor(t),
              dashed: t.startsWith(FLAG_PREFIX),
              boxes: regions.flatMap((r, i) => (regionTag(r) === t ? [{ i, uid: r.uid, hidden: hiddenUids.has(r.uid) }] : [])),
            }))}
            hiddenTags={hiddenTags}
            allHidden={opacity === 0}
            selected={selected}
            onToggleAll={() => (opacity === 0 ? showMarks() : (setShownOpacity(opacity), setOpacity(0)))}
            onToggleLayer={toggleLayer}
            onToggleBox={(uid, t) => {
              // A box in a hidden layer: show the layer again, with this box visible.
              if (hiddenTags.has(t)) {
                toggleLayer(t);
                if (hiddenUids.has(uid)) toggleHidden(uid);
              } else toggleHidden(uid);
            }}
            onSelect={(i) => setSelected(selected === i ? null : i)}
            onRemove={removeRegion}
          />
        </div>
        {regions.length > 0 && (
          <section ref={listRef} className="relative shrink-0 rounded-lg border bg-card lg:max-h-[45%] lg:overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card px-2.5 py-1.5">
              <span className="text-sm font-semibold">දුර්වල තැන් ({regions.length})</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">— එකක් tap කර විස්තර තෝරන්න</span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => removeRegion("all")}>
                <Eraser /> සියල්ල clear කරන්න
              </Button>
            </div>
            <ul className="divide-y">
              {regions.map((r, i) => {
                const open = selected === i;
                const hiddenNow = isHidden(r);
                const key = keyOf[r.criterionId];
                const issue = r.flag ? null : ISSUE_TAGS[key]?.find((t) => t.value === r.issueTag)?.label;
                return (
                  <li key={r.uid} id={`mark-${r.uid}`} className={cn(open && "bg-muted/40")}>
                    <div className="flex items-center gap-2 px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => setSelected(open ? null : i)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                        aria-expanded={open}
                      >
                        <Dot color={tagColor(regionTag(r))} dashed={!!r.flag} />
                        <span className={cn("min-w-0 truncate", hiddenNow && "text-muted-foreground line-through")}>
                          <b className="font-semibold">{boxLabel(r)}</b>
                          {!r.flag && <span className="text-muted-foreground"> · {criterionText(key ?? "")?.label}</span>}
                        </span>
                        {issue && <span className="hidden min-w-0 truncate text-xs text-muted-foreground md:inline">— {issue}</span>}
                        {!r.flag && (
                          <span className="ml-auto shrink-0 rounded border px-1.5 text-xs tabular-nums" title="බරපතලකම">
                            {r.severity ?? 2}
                          </span>
                        )}
                        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition", r.flag && "ml-auto", open && "rotate-180")} />
                      </button>
                      <Button variant="ghost" size="icon-sm" aria-label="කොටුව clear කරන්න" title="Clear" onClick={() => removeRegion(i)}>
                        <X />
                      </Button>
                    </div>
                    {open && (
                      <RegionEditor
                        region={r}
                        criteria={criteria}
                        color={tagColor}
                        criterionKey={key}
                        onPatch={(p) => patch(i, p)}
                        onDone={() => setSelected(null)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
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

/** A button in a choice panel; filled with `color` (or the primary blue) when chosen. */
function Chip(props: {
  active: boolean;
  onClick: () => void;
  color?: string;
  dashed?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  const fill = props.color ?? "var(--primary)";
  return (
    <button
      type="button"
      aria-pressed={props.active}
      title={props.title}
      onClick={props.onClick}
      className={cn(
        "flex min-h-8 min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs leading-snug transition",
        props.active ? "text-white shadow-sm" : "bg-card hover:bg-muted",
      )}
      style={props.active ? { background: fill, borderColor: fill } : undefined}
    >
      {props.color && <Dot color={props.active ? "#fff" : props.color} dashed={props.dashed} />}
      <span className="min-w-0">{props.children}</span>
    </button>
  );
}

/** Picks what a box is about: one of A1–A8 (each in its own colour), or a flag (folded away until needed). */
function TagPanel(props: { value: string; onChange: (v: string) => void; criteria: C[]; color: (tag: string) => string }) {
  const [flagsOpen, setFlagsOpen] = useState(props.value.startsWith(FLAG_PREFIX));
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {props.criteria.map((c) => {
          const t = criterionText(c.key);
          return (
            <Chip key={c.id} active={props.value === c.id} color={props.color(c.id)} onClick={() => props.onChange(c.id)}>
              <b className="font-semibold">{t?.code ?? c.labelEn}</b> {t?.label ?? c.labelLocal}
            </Chip>
          );
        })}
      </div>
      {flagsOpen ? (
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3">
          {FLAGS.map((f) => {
            const v = `${FLAG_PREFIX}${f.value}`;
            return (
              <Chip key={v} active={props.value === v} color={props.color(v)} dashed onClick={() => props.onChange(v)}>
                {f.label}
              </Chip>
            );
          })}
        </div>
      ) : (
        <button type="button" className="text-xs text-primary hover:underline" onClick={() => setFlagsOpen(true)}>
          + වෙනත් ලකුණු (කියවිය නොහැකි අකුර, කපා හැරීම, සැරසිලි…)
        </button>
      )}
    </div>
  );
}

/**
 * Photoshop-style layers beside the scan: one layer per criterion (or flag) that has boxes. The eye shows or hides
 * the whole layer; open a layer to show/hide, select or clear its boxes one by one. Hidden boxes are still saved.
 */
function LayersPanel(props: {
  className?: string;
  layers: { tag: string; label: string; name?: string; color: string; dashed: boolean; boxes: { i: number; uid: number; hidden: boolean }[] }[];
  hiddenTags: Set<string>;
  allHidden: boolean;
  selected: number | null;
  onToggleAll: () => void;
  onToggleLayer: (tag: string) => void;
  onToggleBox: (uid: number, tag: string) => void;
  onSelect: (i: number) => void;
  onRemove: (i: number) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Folded by default so the scan gets the full width; the rater's choice is remembered on this device.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("akshara.layersPanel") === "open") setExpanded(true);
    } catch {}
  }, []);
  const setPanel = (v: boolean) => {
    setExpanded(v);
    try {
      localStorage.setItem("akshara.layersPanel", v ? "open" : "closed");
    } catch {}
  };
  // Open the layer of the selected box, so it can be seen in the list.
  const selectedTag = props.layers.find((l) => l.boxes.some((b) => b.i === props.selected))?.tag;
  useEffect(() => {
    if (selectedTag) setOpen((o) => (o.has(selectedTag) ? o : new Set(o).add(selectedTag)));
  }, [selectedTag, props.selected]);
  const toggleOpen = (t: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  const eye = (on: boolean, faded = false) =>
    on ? <Eye className={cn("size-4", faded && "opacity-40")} /> : <EyeOff className="size-4 opacity-60" />;

  // Folded: a thin strip (a row on phones) with the open button and one quick show/hide button per layer.
  if (!expanded) {
    return (
      <section
        aria-label="ස්ථර"
        className={cn(
          "flex shrink-0 flex-wrap items-center gap-1 rounded-lg border bg-card p-1 lg:w-11 lg:flex-col lg:flex-nowrap lg:overflow-y-auto",
          props.className,
        )}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="ස්ථර පෙන්වන්න"
          title="ස්ථර (layers) පෙන්වන්න"
          aria-expanded={false}
          onClick={() => setPanel(true)}
        >
          <Layers />
        </Button>
        <span className="hidden h-px w-6 bg-border lg:block" />
        {props.layers.map((l) => {
          const off = props.hiddenTags.has(l.tag);
          const empty = l.boxes.length === 0;
          return (
            <button
              key={l.tag}
              type="button"
              disabled={empty}
              aria-pressed={!off}
              aria-label={off ? `${l.label} පෙන්වන්න` : `${l.label} සඟවන්න`}
              title={empty ? `${l.label}: කොටු නැත` : `${l.label} (${l.boxes.length}) — ${off ? "පෙන්වන්න" : "සඟවන්න"}`}
              onClick={() => props.onToggleLayer(l.tag)}
              className={cn(
                "relative flex h-7 min-w-8 shrink-0 items-center justify-center rounded-md border-2 px-1 text-[11px] font-semibold transition",
                empty ? "border-transparent text-muted-foreground/50" : off ? "bg-card text-muted-foreground line-through" : "text-white",
                l.dashed && "border-dashed",
              )}
              style={empty ? undefined : { borderColor: l.color, background: off ? undefined : l.color }}
            >
              {l.dashed ? "!" : l.label}
              {!empty && (
                <span className="absolute -top-1.5 -right-1.5 rounded-full bg-foreground px-1 text-[9px] leading-tight text-background tabular-nums">
                  {l.boxes.length}
                </span>
              )}
            </button>
          );
        })}
      </section>
    );
  }

  return (
    <section
      aria-label="ස්ථර"
      className={cn("flex shrink-0 flex-col overflow-hidden rounded-lg border bg-card lg:w-64", props.className)}
    >
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <Layers className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">ස්ථර</span>
        <span className="text-xs text-muted-foreground">(layers)</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="order-last"
          aria-label="ස්ථර හකුළන්න"
          title="හකුළන්න (scan එක ලොකු කරන්න)"
          aria-expanded
          onClick={() => setPanel(false)}
        >
          <PanelRightClose />
        </Button>
        {props.layers.some((l) => l.boxes.length > 0) && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            aria-label={props.allHidden ? "සියලු කොටු පෙන්වන්න" : "සියලු කොටු සඟවන්න"}
            title={props.allHidden ? "සියලු කොටු පෙන්වන්න" : "සියලු කොටු සඟවන්න"}
            onClick={props.onToggleAll}
          >
            {eye(!props.allHidden)}
          </Button>
        )}
      </div>
      {props.layers.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">කොටු තවම නැත. ඔබ අඳින කොටු මෙහි ස්ථර ලෙස පෙනේ.</p>
      ) : (
        <ul className={cn("divide-y overflow-y-auto", props.allHidden && "opacity-50")}>
          {props.layers.map((l) => {
            const off = props.hiddenTags.has(l.tag);
            const empty = l.boxes.length === 0;
            const isOpen = open.has(l.tag) && !empty;
            return (
              <li key={l.tag}>
                <div className={cn("flex items-center gap-0.5 px-1 py-0.5", empty && "text-muted-foreground")}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={empty}
                    aria-pressed={!off}
                    aria-label={off ? `${l.label} පෙන්වන්න` : `${l.label} සඟවන්න`}
                    title={off ? "මෙම ස්ථරය පෙන්වන්න" : "මෙම ස්ථරය සඟවන්න"}
                    onClick={() => props.onToggleLayer(l.tag)}
                  >
                    {eye(!off)}
                  </Button>
                  <button
                    type="button"
                    disabled={empty}
                    onClick={() => toggleOpen(l.tag)}
                    aria-expanded={isOpen}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left text-sm enabled:hover:bg-muted",
                      off && "text-muted-foreground",
                    )}
                  >
                    <Dot color={l.color} dashed={l.dashed} />
                    <b className="shrink-0 font-semibold">{l.label}</b>
                    {l.name && <span className="min-w-0 truncate text-xs text-muted-foreground">{l.name}</span>}
                    <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 text-xs tabular-nums">{l.boxes.length}</span>
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition", empty && "invisible", isOpen && "rotate-180")} />
                  </button>
                </div>
                {isOpen && (
                  <ul className="pb-1">
                    {l.boxes.map((b, n) => {
                      const sel = props.selected === b.i;
                      return (
                        <li
                          key={b.uid}
                          className={cn("flex items-center gap-0.5 py-0.5 pr-1 pl-4", sel && "bg-brand-soft")}
                        >
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={b.hidden || off ? "පෙන්වන්න" : "සඟවන්න"}
                            title={b.hidden || off ? "පෙන්වන්න" : "සඟවන්න"}
                            onClick={() => props.onToggleBox(b.uid, l.tag)}
                          >
                            {eye(!b.hidden, off)}
                          </Button>
                          <button
                            type="button"
                            onClick={() => props.onSelect(b.i)}
                            className={cn(
                              "flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left text-xs hover:bg-muted",
                              (b.hidden || off) && "text-muted-foreground line-through",
                              sel && "font-semibold",
                            )}
                          >
                            <span
                              aria-hidden
                              className={cn("inline-block size-3 shrink-0 rounded-[2px] border-2", l.dashed && "border-dashed")}
                              style={{ borderColor: l.color }}
                            />
                            {l.label} · {n + 1}
                          </button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="කොටුව clear කරන්න"
                            title="Clear"
                            onClick={() => props.onRemove(b.i)}
                          >
                            <X />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Dot({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", dashed && "border-[1.5px] border-dashed bg-transparent")}
      style={dashed ? { borderColor: color } : { background: color }}
    />
  );
}

/** Details of one box, opened from the list under the scan: what it is about, issue, letter part, severity, note. */
function RegionEditor(props: {
  region: Region;
  criteria: C[];
  color: (tag: string) => string;
  criterionKey: string | undefined;
  onPatch: (p: Partial<Region>) => void;
  onDone: () => void;
}) {
  const r = props.region;
  const value = r.flag ? `${FLAG_PREFIX}${r.flag}` : r.criterionId;
  const tags = r.flag ? [] : (ISSUE_TAGS[props.criterionKey ?? ""] ?? []);
  const [changing, setChanging] = useState(false);
  return (
    <div className="space-y-2.5 border-l-4 px-3 pt-1 pb-3" style={{ borderLeftColor: props.color(value) }}>
      {changing ? (
        <Field label="කුමක් ගැනද?">
          <TagPanel
            value={value}
            onChange={(v) => {
              props.onPatch(
                v.startsWith(FLAG_PREFIX)
                  ? { flag: v.slice(FLAG_PREFIX.length), criterionId: "", issueTag: null, part: null }
                  : { flag: null, criterionId: v, issueTag: null, part: null },
              );
              setChanging(false);
            }}
            criteria={props.criteria}
            color={props.color}
          />
        </Field>
      ) : (
        <button type="button" className="text-xs text-primary hover:underline" onClick={() => setChanging(true)}>
          නිර්ණායකය වෙනස් කරන්න
        </button>
      )}
      {tags.length > 0 && (
        <Field label="ගැටලුව">
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <Chip key={t.value} active={r.issueTag === t.value} onClick={() => props.onPatch({ issueTag: r.issueTag === t.value ? null : t.value })}>
                {t.label}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      {props.criterionKey === "a1" && (
        <Field label="අකුරේ කොටස (අනිවාර්ය නොවේ)">
          <div className="flex flex-wrap gap-1">
            {PARTS.map((p) => (
              <Chip key={p.value} active={r.part === p.value} onClick={() => props.onPatch({ part: r.part === p.value ? null : p.value })}>
                {p.label}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      {!r.flag && (
        <Field label="බරපතලකම">
          <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="බරපතලකම">
            {([2, 3] as const).map((sv) => (
              <Chip key={sv} active={r.severity === sv} onClick={() => props.onPatch({ severity: sv })}>
                <b>{sv}</b> · {SEVERITY[sv]}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      <div className="flex gap-2">
        <Input
          className="h-8 flex-1 text-sm"
          placeholder="සටහන (අනිවාර්ය නොවේ)"
          value={r.note}
          onChange={(e) => props.onPatch({ note: e.target.value })}
        />
        <Button size="sm" onClick={props.onDone}>
          <Check /> හරි
        </Button>
      </div>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{props.label}</p>
      {props.children}
    </div>
  );
}
