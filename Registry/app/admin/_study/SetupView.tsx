"use client";

import { Anchor, ImagePlus, Link2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Thumb } from "@/components/admin/SampleBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sampleLabel } from "@/lib/codes";
import { PICK_KEY } from "@/lib/dataset-types";
import { MAIN_DEFAULTS, SCRIPT_LABEL, STUDY_PATH, SURVEY_LANG } from "@/lib/types";
import { startStudy } from "./actions";
import type { StudyPageData } from "./load";
import { SamplePicker } from "./SamplePicker";
import { COPY } from "./copy";

/** The "new survey" screen: pick samples, name it, create it and get its link. */
export function SetupView({ data }: { data: StudyPageData }) {
  const router = useRouter();
  const copy = COPY[data.type];
  const main = data.type === "rubric";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState(false);
  const [title, setTitle] = useState(
    `${SCRIPT_LABEL[data.script]} ${main ? "main study" : "perception"} survey ${data.rounds.length + 1}`,
  );
  const [instructions, setInstructions] = useState("");
  const [perReader, setPerReader] = useState("");
  const [repeatPct, setRepeatPct] = useState(10);
  const [targetPer, setTargetPer] = useState(String(MAIN_DEFAULTS.targetPerSample));
  const [maxPer, setMaxPer] = useState(String(MAIN_DEFAULTS.maxPerSample));
  const [busy, setBusy] = useState(false);

  const rowById = useMemo(() => new Map(data.rows.map((r) => [r.id, r])), [data.rows]);
  const picked = [...selected].map((id) => rowById.get(id)).filter((r) => !!r);
  const anchors = picked.filter((r) => r.isAnchor).length;
  const n = picked.length;
  const others = n - anchors;
  const per = perReader.trim() ? Math.min(Number(perReader) || n, others) : main ? Math.min(MAIN_DEFAULTS.formSize, others) : others;
  const text2 = picked.filter((r) => !r.isAnchor && r.part === 2).length;
  const text1 = others - text2;

  // Samples chosen in the Dataset ("Add to study").
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PICK_KEY);
      if (!raw) return;
      const pick = JSON.parse(raw) as { script: string; type?: string; ids: string[] };
      if (pick.script !== data.script || (pick.type ?? "perception") !== data.type) return;
      sessionStorage.removeItem(PICK_KEY);
      setSelected(new Set(pick.ids.filter((id) => rowById.has(id))));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const problem =
    n === 0 ? "Choose the samples first" : null;

  async function start() {
    setBusy(true);
    const res = await startStudy({
      script: data.script,
      type: data.type,
      title,
      instructions,
      sampleIds: [...selected],
      perReader: perReader.trim() ? Number(perReader) : null,
      repeatPct,
      ...(main ? { targetPerSample: targetPer.trim() ? Number(targetPer) : null, maxPerSample: maxPer.trim() ? Number(maxPer) : null } : {}),
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Survey created. Share its link with your readers.");
    router.push(`${STUDY_PATH[data.type]}/${res.id}`);
  }

  return (
    <div className="grid max-w-5xl items-start gap-4 lg:grid-cols-[1fr_360px]">
      <section className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <Step n={1} />
          <div className="min-w-0 flex-1">
            <h2 className="font-medium">Samples</h2>
            <p className="text-sm text-muted-foreground">{copy.sampleHint}</p>
          </div>
          <Button variant={n ? "outline" : "default"} onClick={() => setPicking(true)}>
            <ImagePlus /> {n ? "Change samples" : "Choose samples"}
          </Button>
        </div>
        {n === 0 ? (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="m-4 grid w-[calc(100%-2rem)] place-items-center rounded-lg border border-dashed py-14 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            No samples chosen yet
          </button>
        ) : (
          <div className="p-4">
            <p className="mb-3 text-sm">
              <b className="tabular-nums">{n}</b> sample{n === 1 ? "" : "s"}
              {main && anchors > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · <Anchor className="inline size-3.5" /> {anchors} calibration anchor{anchors === 1 ? "" : "s"}, shown first to every reader
                </span>
              )}
              {main && (
                <span className="text-muted-foreground">
                  {" "}
                  · text 1: <b className="text-foreground tabular-nums">{text1}</b> · text 2: <b className="text-foreground tabular-nums">{text2}</b>
                </span>
              )}
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
              {picked.slice(0, 48).map((r) => (
                <div key={r.id} className="space-y-1">
                  <Thumb id={r.id} v={r.imageV} className="aspect-[3/4] rounded-md border" contain={!!r.part} />
                  <div className="truncate text-center font-mono text-[11px] text-muted-foreground">{sampleLabel(r)}</div>
                </div>
              ))}
            </div>
            {n > 48 && <p className="mt-2 text-xs text-muted-foreground">and {n - 48} more</p>}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <Step n={2} />
          <h2 className="font-medium">Settings</h2>
        </div>
        <div>
          <Label htmlFor="st-title" className="mb-1.5">
            Title shown to readers
          </Label>
          <Input id="st-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="st-instr" className="mb-1.5">
            Instructions <span className="font-normal text-muted-foreground">(optional, any language)</span>
          </Label>
          <Textarea id="st-instr" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="st-per" className="mb-1.5">
            {main ? "Samples per form" : "Samples per reader"}
          </Label>
          <Input
            id="st-per"
            type="number"
            min={1}
            className="w-28"
            placeholder={main ? String(MAIN_DEFAULTS.formSize) : n ? `all ${n}` : "all"}
            value={perReader}
            onChange={(e) => setPerReader(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {main
              ? "Half text 1, half text 2, least-rated first. When raters finish a form they can ask for another."
              : "Leave empty so everyone rates every sample. With a number, the least-rated samples go out first."}
          </p>
        </div>
        {main && (
          <>
            <div className="flex gap-4">
              <div>
                <Label htmlFor="st-target" className="mb-1.5">
                  Target per sample
                </Label>
                <Input id="st-target" type="number" min={1} className="w-24" value={targetPer} onChange={(e) => setTargetPer(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="st-max" className="mb-1.5">
                  Max per sample
                </Label>
                <Input id="st-max" type="number" min={1} className="w-24" placeholder="no cap" value={maxPer} onChange={(e) => setMaxPer(e.target.value)} />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">Ratings each sample should get, and the number at which it stops going out.</p>
            <div>
              <Label htmlFor="st-rep" className="mb-1.5">
                Blinded repeats
              </Label>
              <div className="flex items-center gap-2">
                <Input id="st-rep" type="number" min={0} max={50} className="w-20" value={repeatPct} onChange={(e) => setRepeatPct(Number(e.target.value))} />
                <span className="text-sm text-muted-foreground">% of each reader&apos;s samples shown again later</span>
              </div>
            </div>
            <div className="rounded-lg bg-muted/60 p-3 text-sm">
              Questions are fixed (Rubric v1, in Sinhala): overall look, decoration, crossings-out, A1–A8 and legibility, each 1–10, plus optional weak-spot boxes.
            </div>
          </>
        )}

        <div className="border-t pt-4">
          <p className="mb-3 text-sm text-muted-foreground">
            {n ? (
              <>
                Each {main ? "form has" : "reader rates"} <b className="text-foreground">{per}</b> sample{per === 1 ? "" : "s"}
                {main && anchors > 0 && <> plus {anchors} anchor{anchors === 1 ? "" : "s"}</>}. You get a /{SURVEY_LANG[data.script]}/survey/… link to share straight away.
              </>
            ) : (
              <>You get a /{SURVEY_LANG[data.script]}/survey/… link to share straight away.</>
            )}
          </p>
          <Button className="h-10 w-full" onClick={start} disabled={!!problem || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Link2 />} Create survey and get link
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => router.push(STUDY_PATH[data.type])} disabled={busy}>
            Cancel
          </Button>
          {problem && <p className="mt-2 text-center text-xs text-muted-foreground">{problem}</p>}
        </div>
      </section>

      <SamplePicker
        open={picking}
        onOpenChange={setPicking}
        title={`Choose ${SCRIPT_LABEL[data.script]} samples`}
        hint={copy.sampleHint}
        rows={data.rows}
        refs={data.refs}
        initial={selected}
        filters={copy.filters}
        confirmLabel={(k) => `Use ${k} sample${k === 1 ? "" : "s"}`}
        onConfirm={(ids) => {
          setSelected(new Set(ids));
          setPicking(false);
        }}
      />
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n}</span>;
}
