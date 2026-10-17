"use client";

import { ArrowLeft, Copy, Download, Globe, MoreHorizontal, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/admin/Confirm";
import { EmptyState, Stat } from "@/components/admin/PageHeader";
import { Thumb } from "@/components/admin/SampleBrowser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SCRIPT_LABEL, STUDY_LABEL, type AssignmentKind, type Study } from "@/lib/types";
import { cn } from "@/lib/utils";
import { addRaterToSample, assignStudy, deleteStudy, removeAssignment, removeSamplesFromStudy, setPublicLink, updateStudy } from "../study-actions";

export interface StudyData {
  study: Study;
  samples: { id: string; code: string; pageNo: number }[];
  raters: { uid: string; name: string; email: string; alias: string; role: string; public: boolean; nativeReader: boolean | null }[];
  items: {
    id: string;
    raterId: string;
    sampleId: string;
    kind: AssignmentKind;
    status: "pending" | "done";
    rating: {
      overall: number;
      legibility: number | null;
      liked: string;
      disliked: string;
      regions: number;
      criteria: string;
      durationMs: number;
      submittedAt: number;
    } | null;
  }[];
}

export function StudyDetail({ data }: { data: StudyData }) {
  const { study } = data;
  const router = useRouter();
  const [confirmDialog, ask] = useConfirm();
  const [editing, setEditing] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [title, setTitle] = useState(study.title);
  const [instructions, setInstructions] = useState(study.instructions);
  const refresh = () => router.refresh();

  const rater = useMemo(() => Object.fromEntries(data.raters.map((r) => [r.uid, r])), [data.raters]);
  const sample = useMemo(() => Object.fromEntries(data.samples.map((s) => [s.id, s])), [data.samples]);
  const done = data.items.filter((i) => i.status === "done").length;
  const pct = data.items.length ? Math.round((100 * done) / data.items.length) : 0;
  const raterIds = [...new Set(data.items.map((i) => i.raterId))];
  const unassigned = data.samples.filter((s) => !data.items.some((i) => i.sampleId === s.id)).length;
  const doneBySample = data.samples.map((s) => data.items.filter((i) => i.sampleId === s.id && i.kind !== "repeat" && i.status === "done").length);
  const coverage = doneBySample.length
    ? { min: Math.min(...doneBySample), max: Math.max(...doneBySample), avg: doneBySample.reduce((a, b) => a + b, 0) / doneBySample.length }
    : { min: 0, max: 0, avg: 0 };
  const publicReaders = raterIds.filter((uid) => rater[uid]?.public).length;

  async function call(p: Promise<{ ok?: boolean; error?: string }>, msg?: string) {
    const r = await p;
    if (!r.ok) {
      toast.error(r.error ?? "Something went wrong");
      return false;
    }
    if (msg) toast.success(msg);
    refresh();
    return true;
  }

  const label = (uid: string) => rater[uid]?.name ?? "Removed rater";
  const code = (sid: string) => (sample[sid] ? `${sample[sid].code}${sample[sid].pageNo > 1 ? ` p${sample[sid].pageNo}` : ""}` : sid);

  return (
    <div>
      <Link href="/admin/survey" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Survey
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{study.title}</h1>
            <Badge variant="outline">{STUDY_LABEL[study.type]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {SCRIPT_LABEL[study.script]} · score {study.overallScale.min}–{study.overallScale.max}
            {study.legibilityScale && ` · legibility ${study.legibilityScale.min}–${study.legibilityScale.max}`}
            {study.rubricVersion && ` · rubric v${study.rubricVersion}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
            <Switch checked={study.open} onCheckedChange={(open) => call(updateStudy(study.id, { open }), open ? "Study opened" : "Study closed")} />
            {study.open ? "Open to raters" : "Closed"}
          </label>
          <Button variant="outline" onClick={() => setAssignOpen(true)}>
            <UserPlus /> Assign
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil /> Edit title & instructions
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/export?only=study&study=${study.id}`}>
                  <Download /> Download responses (CSV)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/dataset">
                  <Plus /> Add samples (from Dataset)
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  ask({
                    title: "Delete this study?",
                    description: "Only possible while nobody has submitted a rating. Its rater queues are removed.",
                    confirmLabel: "Delete study",
                    destructive: true,
                    onConfirm: async () => {
                      if (await call(deleteStudy(study.id), "Study deleted")) router.push("/admin/survey");
                    },
                  })
                }
              >
                <Trash2 /> Delete study
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <PublicLinkCard
        study={study}
        readers={publicReaders}
        onSave={(open, perReader) => call(setPublicLink(study.id, { open, perReader }), open ? "Public link is on" : "Public link is off")}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Samples" value={data.samples.length} />
        <Stat
          label="Readers per sample (done)"
          value={data.samples.length ? `${coverage.min}–${coverage.max}` : "–"}
        />
        <Stat label="Raters" value={raterIds.length} />
        <Stat label="Ratings done" value={`${done} / ${data.items.length}`} tone={pct === 100 && data.items.length ? "good" : undefined} />
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Progress</div>
          <div className="mt-2 flex items-center gap-2">
            <Progress value={pct} />
            <span className="text-sm tabular-nums">{pct}%</span>
          </div>
        </div>
      </div>

      {data.items.length === 0 ? (
        <EmptyState icon={study.publicOpen ? <Globe className="size-5" /> : <UserPlus className="size-5" />} title={study.publicOpen ? "Waiting for the first reader" : "No raters assigned yet"}>
          {study.publicOpen ? (
            "Share the public link above. Readers appear here as soon as they start."
          ) : (
            <Button className="mt-3" onClick={() => setAssignOpen(true)}>
              Assign raters
            </Button>
          )}
        </EmptyState>
      ) : (
        <Tabs defaultValue="raters">
          <TabsList className="mb-4">
            <TabsTrigger value="raters">By rater</TabsTrigger>
            <TabsTrigger value="samples">
              By sample {unassigned > 0 && <Badge variant="secondary" className="bg-warning/15">{unassigned} unassigned</Badge>}
            </TabsTrigger>
            <TabsTrigger value="responses">Responses ({done})</TabsTrigger>
          </TabsList>

          <TabsContent value="raters">
            <div className="divide-y rounded-xl border bg-card">
              {raterIds.map((uid) => {
                const mine = data.items.filter((i) => i.raterId === uid);
                const d = mine.filter((i) => i.status === "done").length;
                return (
                  <div key={uid} className="flex items-center gap-4 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 truncate font-medium">
                        {label(uid)}
                        {rater[uid]?.public && <Badge variant="outline" className="font-normal">via link</Badge>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[rater[uid]?.email, rater[uid]?.nativeReader === false && "not a first-language reader"].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="hidden w-48 items-center gap-2 sm:flex">
                      <Progress value={(100 * d) / mine.length} />
                    </div>
                    <span className="w-20 text-right tabular-nums">
                      {d} / {mine.length}
                    </span>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="samples">
            <div className="divide-y rounded-xl border bg-card">
              {data.samples.map((s) => {
                const its = data.items.filter((i) => i.sampleId === s.id && i.kind !== "repeat");
                const have = new Set(its.map((i) => i.raterId));
                const addable = data.raters.filter((r) => !have.has(r.uid) && !r.public);
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <Thumb id={s.id} className="h-12 w-9 shrink-0 rounded" />
                    <span className="w-24 font-mono font-medium">{code(s.id)}</span>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {its.length === 0 && <span className="text-xs text-muted-foreground">No raters</span>}
                      {its.map((i) => (
                        <span
                          key={i.id}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                            i.status === "done" ? "border-success/30 bg-success/10 text-success" : "bg-muted/40",
                          )}
                        >
                          {label(i.raterId)}
                          {i.status === "done" ? ` · ${i.rating?.overall}` : ""}
                          {i.status === "pending" && (
                            <button aria-label="Remove" className="opacity-60 hover:opacity-100" onClick={() => call(removeAssignment(i.id), "Removed from queue")}>
                              <X className="size-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    {addable.length > 0 && (
                      <Select value="" onValueChange={(uid) => call(addRaterToSample(study.id, s.id, uid), `Added ${rater[uid]?.name}`)}>
                        <SelectTrigger size="sm" className="w-36">
                          <SelectValue placeholder="+ Add rater" />
                        </SelectTrigger>
                        <SelectContent>
                          {addable.map((r) => (
                            <SelectItem key={r.uid} value={r.uid}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove sample from study"
                      onClick={() =>
                        ask({
                          title: `Remove ${code(s.id)} from this study?`,
                          description: "Unfinished items for it are removed. Completed ratings are kept.",
                          confirmLabel: "Remove",
                          destructive: true,
                          onConfirm: () => call(removeSamplesFromStudy(study.id, [s.id]), "Sample removed"),
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="responses">
            {done === 0 ? (
              <EmptyState title="No responses yet" />
            ) : (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Sample</th>
                      <th className="px-3 py-2 font-medium">Rater</th>
                      <th className="px-3 py-2 font-medium">Score</th>
                      {study.type === "perception" ? (
                        <>
                          <th className="px-3 py-2 font-medium">Looks good because…</th>
                          <th className="px-3 py-2 font-medium">Looks bad because…</th>
                        </>
                      ) : (
                        <>
                          <th className="px-3 py-2 font-medium">Legibility</th>
                          <th className="px-3 py-2 font-medium">Criteria</th>
                          <th className="px-3 py-2 font-medium">Regions</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.items
                      .filter((i) => i.rating)
                      .sort((a, b) => b.rating!.submittedAt - a.rating!.submittedAt)
                      .map((i) => (
                        <tr key={i.id} className="align-top">
                          <td className="px-3 py-2 font-mono whitespace-nowrap">
                            {code(i.sampleId)}
                            {i.kind !== "normal" && <span className="ml-1 text-xs text-muted-foreground">({i.kind})</span>}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{label(i.raterId)}</td>
                          <td className="px-3 py-2 tabular-nums">{i.rating!.overall}</td>
                          {study.type === "perception" ? (
                            <>
                              <td className="max-w-sm px-3 py-2">{i.rating!.liked}</td>
                              <td className="max-w-sm px-3 py-2">{i.rating!.disliked}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2 tabular-nums">{i.rating!.legibility}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{i.rating!.criteria}</td>
                              <td className="px-3 py-2 tabular-nums">{i.rating!.regions}</td>
                            </>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <AssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        raters={data.raters.filter((r) => !r.public)}
        already={new Set(raterIds)}
        samples={data.samples.length}
        onAssign={async (plan) => {
          const r = await assignStudy(study.id, plan);
          if (!r.ok) return toast.error(r.error);
          toast.success(r.created ? `Assigned ${r.created} new rating items` : "Everyone already has these samples", {
            description: r.warnings.join(" ") || undefined,
          });
          setAssignOpen(false);
          refresh();
        }}
      />

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit study</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5">Instructions for raters</Label>
              <Textarea rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={async () => (await call(updateStudy(study.id, { title, instructions }), "Saved")) && setEditing(false)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}

function AssignDialog({
  open,
  onOpenChange,
  raters,
  already,
  samples,
  onAssign,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  raters: StudyData["raters"];
  already: Set<string>;
  samples: number;
  onAssign: (plan: { mode: "random" | "manual"; raterIds: string[]; ratersPerSample: number; repeatPct: number }) => Promise<unknown>;
}) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"random" | "manual">("manual");
  const [perSample, setPerSample] = useState(3);
  const [repeatPct, setRepeatPct] = useState(10);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setIds(new Set(already.size ? already : raters.map((r) => r.uid)));
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign raters</DialogTitle>
          <DialogDescription>Only adds what&apos;s missing. Run it again after adding samples or raters ({samples} samples now).</DialogDescription>
        </DialogHeader>
        <div className="max-h-56 divide-y overflow-y-auto rounded-lg border">
          {raters.map((r) => (
            <label key={r.uid} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
              <Checkbox
                checked={ids.has(r.uid)}
                onCheckedChange={() =>
                  setIds((p) => {
                    const n = new Set(p);
                    if (n.has(r.uid)) n.delete(r.uid);
                    else n.add(r.uid);
                    return n;
                  })
                }
              />
              <span className="flex-1 truncate">{r.name}</span>
              {already.has(r.uid) && <span className="text-xs text-muted-foreground">in study</span>}
            </label>
          ))}
          {raters.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No raters for this script yet.</p>}
        </div>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as "random" | "manual")} className="gap-2">
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="manual" /> Every chosen rater gets every sample
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="random" /> Random, balanced
          </label>
        </RadioGroup>
        {mode === "random" && (
          <div className="flex gap-4">
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">Raters per sample</Label>
              <Input type="number" min={1} className="w-20" value={perSample} onChange={(e) => setPerSample(Number(e.target.value))} />
            </div>
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">Blinded repeats %</Label>
              <Input type="number" min={0} max={50} className="w-20" value={repeatPct} onChange={(e) => setRepeatPct(Number(e.target.value))} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!ids.size || busy}
            onClick={async () => {
              setBusy(true);
              await onAssign({ mode, raterIds: [...ids], ratersPerSample: perSample, repeatPct });
              setBusy(false);
            }}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublicLinkCard({
  study,
  readers,
  onSave,
}: {
  study: Study;
  readers: number;
  onSave: (open: boolean, perReader: number | null) => Promise<unknown>;
}) {
  const [perReader, setPerReader] = useState(study.perReader ? String(study.perReader) : "");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = study.publicToken && origin ? `${origin}/join/${study.publicToken}` : "";
  const per = perReader.trim() ? Number(perReader) : null;
  return (
    <div className={cn("mb-6 rounded-xl border bg-card p-4", study.publicOpen && "border-primary/30 bg-brand-soft/30")}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 font-medium">
          <Globe className="size-4" /> Public link
        </span>
        <span className="text-sm text-muted-foreground">
          Anyone with the link can join as a reader. {readers} joined so far.
        </span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <Switch checked={!!study.publicOpen} onCheckedChange={(open) => onSave(open, per)} />
          {study.publicOpen ? "On" : "Off"}
        </label>
      </div>
      {study.publicOpen && url && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border bg-card px-3 py-1.5 text-sm">{url}</code>
          <Button
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              toast.success("Link copied");
            }}
          >
            <Copy /> Copy link
          </Button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Samples per new reader</span>
        <Input type="number" min={1} className="h-7 w-20" placeholder={`all ${study.sampleIds.length}`} value={perReader} onChange={(e) => setPerReader(e.target.value)} />
        <Button variant="outline" size="sm" onClick={() => onSave(!!study.publicOpen, per)}>
          Save
        </Button>
        <span className="text-xs text-muted-foreground">Empty = all samples. With a number, the least-rated samples are handed out first.</span>
      </div>
    </div>
  );
}
