"use client";

import { ArrowLeft, ArrowRight, Check, Dices, Globe, Loader2, MessageSquareText, Ruler, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DEFAULT_FILTERS, FilterBar, SampleGrid, useSampleSelection } from "@/components/admin/SampleBrowser";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { PICK_KEY, type SampleRow, type StudyRef } from "@/lib/dataset-types";
import { seededRandom, shuffle } from "@/lib/random";
import { DEFAULT_SCALES, SCRIPT_LABEL, type Scale, type Script, type StudyType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createStudy } from "../study-actions";

export interface RaterOption {
  uid: string;
  name: string;
  email: string;
  alias: string;
  role: string;
}

const STEPS = ["Study", "Samples", "Raters"] as const;

export function NewStudyWizard({
  script,
  rows,
  studies,
  raters,
  criteriaCount,
}: {
  script: Script;
  rows: SampleRow[];
  studies: StudyRef[];
  raters: RaterOption[];
  criteriaCount: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<StudyType>("perception");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [overall, setOverall] = useState<Scale>(DEFAULT_SCALES.overall);
  const [legibility, setLegibility] = useState<Scale>(DEFAULT_SCALES.legibility);
  const sel = useSampleSelection(rows, { ...DEFAULT_FILTERS, phase: "pilot" });
  const [randomN, setRandomN] = useState(20);
  const [raterIds, setRaterIds] = useState<Set<string>>(new Set(raters.filter((r) => r.role === "rater").map((r) => r.uid)));
  const [mode, setMode] = useState<"public" | "random" | "manual">("public");
  const [perReader, setPerReader] = useState("");
  const [perSample, setPerSample] = useState(3);
  const [repeatPct, setRepeatPct] = useState(10);
  const [busy, setBusy] = useState(false);
  const fromDataset = useRef(false);

  // Samples picked in the Dataset ("Use in survey → New study").
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PICK_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PICK_KEY);
      const { script: s, ids } = JSON.parse(raw) as { script: Script; ids: string[] };
      if (s !== script) return;
      const valid = new Set(rows.map((r) => r.id));
      const picked = ids.filter((id) => valid.has(id));
      if (!picked.length) return;
      fromDataset.current = true;
      sel.setSelected(new Set(picked));
      sel.setFilters(DEFAULT_FILTERS);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sensible defaults per study type (filters not reset when samples came from the Dataset).
  useEffect(() => {
    setMode(type === "perception" ? "public" : "random");
    if (fromDataset.current) return;
    sel.setFilters(type === "perception" ? { ...DEFAULT_FILTERS, phase: "pilot" } : { ...DEFAULT_FILTERS, phase: "main", qc: "qc_ok" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const n = sel.selected.size;
  const r = raterIds.size;
  const estimate = mode === "public" ? 0 : mode === "manual" ? n * r : Math.min(perSample, r) * n + Math.round(((n * Math.min(perSample, r)) / Math.max(r, 1)) * (repeatPct / 100)) * r;

  const stepError = useMemo(() => {
    if (step === 0) {
      if (!title.trim()) return "Give the study a title";
      if (type === "rubric" && criteriaCount === 0) return "Add rubric criteria first (Survey → Rubric criteria)";
      if (overall.max <= overall.min) return "Check the score scale";
    }
    if (step === 1 && n === 0) return "Select at least one sample";
    if (step === 2 && mode !== "public" && r === 0) return "Choose at least one rater";
    return null;
  }, [step, title, type, criteriaCount, overall, n, r, mode]);

  function pickRandom() {
    const pool = shuffle(sel.filtered.map((x) => x.id), seededRandom(Date.now()));
    sel.setSelected(new Set(pool.slice(0, Math.max(1, randomN))));
  }

  async function create() {
    setBusy(true);
    const res = await createStudy({
      script,
      type,
      title,
      instructions,
      overallScale: overall,
      legibilityScale: type === "rubric" ? legibility : null,
      sampleIds: [...sel.selected],
      plan: { mode, raterIds: mode === "public" ? [] : [...raterIds], ratersPerSample: perSample, repeatPct },
      perReader: perReader.trim() ? Number(perReader) : null,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(mode === "public" ? "Study created · public link is on" : `Study created · ${res.created} rating items assigned`, {
      description: res.warnings.join(" ") || undefined,
    });
    router.push(`/admin/survey/${res.id}`);
    router.refresh();
  }

  return (
    <div className="pb-24">
      <Link href="/admin/survey" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Survey
      </Link>
      <PageHeader title="New study" description={`${SCRIPT_LABEL[script]} · uses samples from the Dataset`} />

      <ol className="mb-6 flex items-center gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1",
                i === step ? "border-primary bg-brand-soft font-medium text-primary" : i < step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className={cn("grid size-5 place-items-center rounded-full text-xs", i < step ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {i < step ? <Check className="size-3" /> : i + 1}
              </span>
              {s}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-border" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="max-w-3xl space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <TypeCard
              active={type === "perception"}
              onClick={() => setType("perception")}
              icon={<MessageSquareText />}
              title="Perception study"
              text="Phase A. Readers give one score and say in their own words what looks good or bad. Feeds the thematic coding."
            />
            <TypeCard
              active={type === "rubric"}
              onClick={() => setType("rubric")}
              icon={<Ruler />}
              title="Rubric rating"
              text={`Phase C. Overall, legibility, each rubric criterion and weak-region boxes.${criteriaCount === 0 ? " Needs rubric criteria first." : ` Uses ${criteriaCount} criteria.`}`}
            />
          </div>
          <div className="grid gap-4 rounded-xl border bg-card p-4">
            <div>
              <Label className="mb-1.5">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "perception" ? "Sinhala perception pilot" : "Sinhala main rating round 1"} />
            </div>
            <div>
              <Label className="mb-1.5">Instructions shown to raters (any language)</Label>
              <Textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-6">
              <ScaleField label={type === "perception" ? "Score scale" : "Overall scale"} value={overall} onChange={setOverall} />
              {type === "rubric" && <ScaleField label="Legibility scale" value={legibility} onChange={setLegibility} />}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm">
            <span className="font-medium tabular-nums">{n} selected</span>
            {type === "perception" && <span className="text-xs text-muted-foreground">(10–15 is a good size for a perception survey)</span>}
            <Button variant="outline" size="sm" onClick={sel.selectAll}>
              Select all {sel.filtered.length} shown
            </Button>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={pickRandom}>
                <Dices /> Pick
              </Button>
              <Input type="number" min={1} className="h-7 w-16" value={randomN} onChange={(e) => setRandomN(Number(e.target.value))} />
              <span className="text-muted-foreground">at random from shown</span>
            </div>
            {n > 0 && (
              <Button variant="ghost" size="sm" onClick={sel.clear}>
                Clear
              </Button>
            )}
          </div>
          <FilterBar filters={sel.filters} setFilters={sel.setFilters} studies={studies} total={rows.length} shown={sel.filtered.length} />
          <SampleGrid rows={sel.filtered} studies={studies} selected={sel.selected} onToggle={sel.toggle} onOpen={(row) => sel.toggle(row.id)} />
        </div>
      )}

      {step === 2 && (
        <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border bg-card p-4">
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="gap-3">
              <label className={cn("flex cursor-pointer gap-3 rounded-lg border p-3", mode === "public" && "border-primary bg-brand-soft/50")}>
                <RadioGroupItem value="public" className="mt-0.5" />
                <span className="flex-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Globe className="size-4" /> Public link: anyone can join
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Share one link. Each person enters their name and details, then rates straight away; no login needed.
                    The system hands out samples so every sample collects as many readers as possible.
                  </span>
                  {mode === "public" && (
                    <span className="mt-3 block">
                      <Label className="mb-1 text-xs text-muted-foreground">Samples per reader</Label>
                      <span className="flex items-center gap-2">
                        <Input type="number" min={1} className="w-24" placeholder={`all ${n}`} value={perReader} onChange={(e) => setPerReader(e.target.value)} />
                        <span className="text-xs text-muted-foreground">Leave empty: every reader rates all {n}. With a number, least-rated samples go first.</span>
                      </span>
                    </span>
                  )}
                </span>
              </label>
              <label className={cn("flex cursor-pointer gap-3 rounded-lg border p-3", mode === "manual" && "border-primary bg-brand-soft/50")}>
                <RadioGroupItem value="manual" className="mt-0.5" />
                <span>
                  <span className="block font-medium">Chosen rater accounts rate every sample</span>
                  <span className="text-sm text-muted-foreground">For raters you created on the Raters tab.</span>
                </span>
              </label>
              <label className={cn("flex cursor-pointer gap-3 rounded-lg border p-3", mode === "random" && "border-primary bg-brand-soft/50")}>
                <RadioGroupItem value="random" className="mt-0.5" />
                <span className="flex-1">
                  <span className="block font-medium">Chosen rater accounts, random and balanced</span>
                  <span className="text-sm text-muted-foreground">Each sample goes to N of them, spreading the load evenly.</span>
                  {mode === "random" && (
                    <span className="mt-3 flex flex-wrap gap-4">
                      <span>
                        <Label className="mb-1 text-xs text-muted-foreground">Raters per sample</Label>
                        <Input type="number" min={1} className="w-20" value={perSample} onChange={(e) => setPerSample(Number(e.target.value))} />
                      </span>
                      <span>
                        <Label className="mb-1 text-xs text-muted-foreground">Blinded repeats %</Label>
                        <Input type="number" min={0} max={50} className="w-20" value={repeatPct} onChange={(e) => setRepeatPct(Number(e.target.value))} />
                      </span>
                    </span>
                  )}
                </span>
              </label>
            </RadioGroup>
            <div className="rounded-lg bg-muted/60 p-3 text-sm">
              <div className="font-medium">Summary</div>
              <p className="text-muted-foreground">
                {type === "perception" ? "Perception" : "Rubric"} study “{title || "untitled"}” with {n} samples.{" "}
                {mode === "public" ? (
                  <>
                    You&apos;ll get a link to share; each reader rates <b className="text-foreground">{perReader.trim() ? Math.min(Number(perReader) || n, n) : n}</b> samples.
                  </>
                ) : (
                  <>
                    {r} raters, about <b className="text-foreground">{estimate}</b> rating items
                    {mode === "random" && r > 0 && <> (~{Math.ceil(estimate / r)} per rater)</>}.
                  </>
                )}
              </p>
            </div>
          </div>

          {mode !== "public" && (
            <div className="rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="flex items-center gap-2 font-medium">
                  <Users className="size-4" /> Raters
                </span>
                <Button variant="ghost" size="sm" onClick={() => setRaterIds(r === raters.length ? new Set() : new Set(raters.map((x) => x.uid)))}>
                  {r === raters.length ? "None" : "All"}
                </Button>
              </div>
              {raters.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  No {SCRIPT_LABEL[script]} raters yet. Create them in <Link href="/admin/raters" className="text-primary underline">Raters</Link>.
                </p>
              ) : (
                <div className="max-h-96 divide-y overflow-y-auto">
                  {raters.map((x) => (
                    <label key={x.uid} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/40">
                      <Checkbox
                        checked={raterIds.has(x.uid)}
                        onCheckedChange={() =>
                          setRaterIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(x.uid)) next.delete(x.uid);
                            else next.add(x.uid);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{x.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{x.email}</span>
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{x.alias}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur md:pl-64">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 md:px-8">
          <span className="text-sm text-destructive">{stepError}</span>
          <div className="ml-auto flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={busy}>
                <ArrowLeft /> Back
              </Button>
            )}
            {step < 2 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!!stepError}>
                Next <ArrowRight />
              </Button>
            ) : (
              <Button onClick={create} disabled={!!stepError || busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Check />} Create study
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TypeCard({ active, onClick, icon, title, text }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string }) {
  return (
    <button
      onClick={onClick}
      className={cn("flex gap-3 rounded-xl border bg-card p-4 text-left transition", active ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/40")}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-4", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        {icon}
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}

function ScaleField({ label, value, onChange }: { label: string; value: Scale; onChange: (s: Scale) => void }) {
  return (
    <div>
      <Label className="mb-1.5">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input type="number" className="w-16" value={value.min} onChange={(e) => onChange({ ...value, min: Number(e.target.value) })} />
        <span className="text-muted-foreground">to</span>
        <Input type="number" className="w-16" value={value.max} onChange={(e) => onChange({ ...value, max: Number(e.target.value) })} />
      </div>
    </div>
  );
}
