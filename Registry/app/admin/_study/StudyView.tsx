"use client";

import { Anchor, ArrowLeft, Check, Copy, Download, ExternalLink, Eye, ImagePlus, Link2, MessageSquareText, MoreHorizontal, Settings2, Trash2, UserX, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/admin/Confirm";
import { EmptyState, Stat } from "@/components/admin/PageHeader";
import { Thumb } from "@/components/admin/SampleBrowser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { sampleLabel } from "@/lib/codes";
import { MAIN_DEFAULTS, SCRIPT_LABEL, STUDY_PATH, surveyPath, type Study } from "@/lib/types";
import { cn } from "@/lib/utils";
import { addSamplesToStudy, deleteStudy, removeReader, removeSamplesFromStudy, setStudyStatus, updateStudy } from "./actions";
import { COPY } from "./copy";
import type { ItemInfo, StudyPageData } from "./load";
import { markCounts, ResponsesDialog } from "./ResponsesDialog";
import { SamplePicker } from "./SamplePicker";
import { STATUS, surveyStatus as statusOf, type SurveyStatus } from "./status";

type StudyStatus = SurveyStatus;

const when = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function StudyView({ data, study }: { data: StudyPageData; study: Study }) {
  const router = useRouter();
  const copy = COPY[data.type];
  const main = data.type === "rubric";
  const [confirmDialog, ask] = useConfirm();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<{ sampleId: string; itemId: string | null } | null>(null);
  const [readerFilter, setReaderFilter] = useState("all");
  const [tab, setTab] = useState("readers");
  const status = statusOf(study);

  const reader = useMemo(() => Object.fromEntries(data.readers.map((r) => [r.uid, r])), [data.readers]);
  const sample = useMemo(() => Object.fromEntries(data.samples.map((s) => [s.id, s])), [data.samples]);
  const criteria = useMemo(
    () => data.criteria.filter((c) => c.rubricVersion === (study.rubricVersion ?? 0)).sort((a, b) => a.order - b.order),
    [data.criteria, study.rubricVersion],
  );
  const name = (uid: string) => reader[uid]?.name ?? "Removed reader";
  const code = (sid: string) => (sample[sid] ? sampleLabel(sample[sid]) : "Removed sample");

  const done = data.items.filter((i) => i.status === "done");
  const pct = data.items.length ? Math.round((100 * done.length) / data.items.length) : 0;
  const bySample = (sid: string) => done.filter((i) => i.sampleId === sid && i.kind !== "repeat");
  const coverage = data.samples.map((s) => bySample(s.id).length);
  const finished = data.readers.filter((r) => data.items.every((i) => i.raterId !== r.uid || i.status !== "pending")).length;
  // Main study: how many samples have reached the target number of ratings (and the cap, where they stop going out).
  const target = study.targetPerSample ?? MAIN_DEFAULTS.targetPerSample;
  const cap = study.maxPerSample === undefined ? MAIN_DEFAULTS.maxPerSample : study.maxPerSample;
  const regular = data.samples.filter((s) => !s.isAnchor).map((s) => bySample(s.id).length);
  const atTarget = regular.filter((n) => n >= target).length;
  const low = Math.min(3, target);
  const coverageBands = [
    { label: `under ${low}`, n: regular.filter((n) => n < low).length },
    ...(target > low ? [{ label: `${low}–${target - 1}`, n: regular.filter((n) => n >= low && n < target).length }] : []),
    { label: cap ? `${target}–${cap - 1}` : `${target}+`, n: regular.filter((n) => n >= target && (!cap || n < cap)).length },
    ...(cap ? [{ label: `full (${cap})`, n: regular.filter((n) => n >= cap).length }] : []),
  ];

  async function call(p: Promise<{ ok?: boolean; error?: string }>, msg?: string) {
    const r = await p;
    if (!r.ok) {
      toast.error(r.error ?? "Something went wrong");
      return false;
    }
    if (msg) toast.success(msg);
    router.refresh();
    return true;
  }

  const responses = done
    .filter((i) => readerFilter === "all" || i.raterId === readerFilter)
    .sort((a, b) => b.rating!.submittedAt - a.rating!.submittedAt);

  return (
    <div className="space-y-6">
      <Link href={STUDY_PATH[data.type]} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All {copy.listNoun}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{study.title}</h1>
            <Badge variant={status === "open" ? "default" : "outline"}>{STATUS[status].label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {SCRIPT_LABEL[study.script]} {copy.noun} · created {when(study.createdAt)}
            {study.rubricVersion && ` · rubric v${study.rubricVersion}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => call(setStudyStatus(study.id, v as StudyStatus), `Survey: ${STATUS[v as StudyStatus].label.toLowerCase()}`)}>
            <SelectTrigger className="w-44" aria-label="Study status">
              <SelectValue>{STATUS[status].label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS) as StudyStatus[]).map((k) => (
                <SelectItem key={k} value={k}>
                  <span>
                    <span className="block">{STATUS[k].label}</span>
                    <span className="block text-xs text-muted-foreground">{STATUS[k].hint}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Settings2 /> Edit settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAdding(true)}>
                <ImagePlus /> Add samples
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/export?only=study&study=${study.id}`}>
                  <Download /> Download responses (CSV)
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  ask({
                    title: "Delete this survey?",
                    description: "Only possible before anyone has submitted a response. Its share link stops working.",
                    confirmLabel: "Delete survey",
                    destructive: true,
                    onConfirm: async () => {
                      const r = await deleteStudy(study.id);
                      if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
                      toast.success("Survey deleted");
                      router.push(STUDY_PATH[data.type]);
                    },
                  })
                }
              >
                <Trash2 /> Delete survey
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ShareCard study={study} status={status} invite={copy.invite} onReopen={() => call(setStudyStatus(study.id, "open"), "Link is open")} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Readers joined" value={data.readers.length} />
        <Stat label="Finished" value={`${finished} / ${data.readers.length}`} tone={finished && finished === data.readers.length ? "good" : undefined} />
        {main ? (
          <Stat label={`Samples at target (${target}+ ratings)`} value={`${atTarget} / ${regular.length}`} tone={regular.length && atTarget === regular.length ? "good" : undefined} />
        ) : (
          <Stat label="Readers per sample" value={coverage.length ? (Math.min(...coverage) === Math.max(...coverage) ? coverage[0] : `${Math.min(...coverage)}–${Math.max(...coverage)}`) : "–"} />
        )}
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Responses</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-xl font-semibold tabular-nums">{done.length}</span>
            <Progress value={pct} className="flex-1" aria-label={`${pct}% of handed-out items done`} />
          </div>
        </div>
      </div>

      {main && regular.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-card px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Ratings per sample:</span>
          {coverageBands.map((b) => (
            <span key={b.label}>
              <b className="tabular-nums">{b.n}</b> <span className="text-muted-foreground">{b.label}</span>
            </span>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            Forms of {study.perReader ?? MAIN_DEFAULTS.formSize}, least-rated first{cap ? `; a sample stops going out at ${cap}` : ""}.
          </span>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="readers">
            <Users /> Readers <Count n={data.readers.length} />
          </TabsTrigger>
          <TabsTrigger value="samples">
            <ImagePlus /> Samples <Count n={data.samples.length} />
          </TabsTrigger>
          <TabsTrigger value="responses">
            <MessageSquareText /> Responses <Count n={done.length} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="readers" className="mt-4">
          {data.readers.length === 0 ? (
            <EmptyState icon={<Users className="size-5" />} title="Nobody has joined yet">
              Share the link above. Readers appear here as soon as they start.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Reader</th>
                    <th className="px-4 py-2 font-medium">Details</th>
                    <th className="px-4 py-2 font-medium">Progress</th>
                    <th className="px-4 py-2 font-medium">Joined</th>
                    <th className="w-10 px-2 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.readers.map((r) => {
                    const mine = data.items.filter((i) => i.raterId === r.uid);
                    const d = mine.filter((i) => i.status !== "pending").length;
                    return (
                      <tr key={r.uid}>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.alias}
                            {r.contact && ` · ${r.contact}`}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {[
                            r.age ? `${r.age} y` : r.ageGroup,
                            r.occupation,
                            r.training === "done" ? "Took tour" : r.training === "skipped" ? "Skipped tour" : null,
                            r.nativeReader === true ? "First language" : r.nativeReader === false ? "Not first language" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") ||
                            (r.public ? "–" : "Login account")}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Progress value={(100 * d) / Math.max(mine.length, 1)} className="w-24" aria-label={`${d} of ${mine.length}`} />
                            <span className="text-xs tabular-nums">
                              {d === mine.length ? <Check className="inline size-3.5 text-success" /> : `${d}/${mine.length}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted-foreground">{when(r.joinedAt)}</td>
                        <td className="px-2 py-2.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={d === 0}
                                onSelect={() => {
                                  setReaderFilter(r.uid);
                                  setTab("responses");
                                }}
                              >
                                <Eye /> See responses
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() =>
                                  ask({
                                    title: `Remove ${r.name}?`,
                                    description: `Deletes their ${d} response${d === 1 ? "" : "s"} in this study (for spam or test runs).${r.public ? " Their browser can't join again." : ""}`,
                                    confirmLabel: "Remove reader",
                                    destructive: true,
                                    onConfirm: () => call(removeReader(study.id, r.uid), "Reader removed"),
                                  })
                                }
                              >
                                <UserX /> Remove reader
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="samples" className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <p className="flex-1 text-sm text-muted-foreground">New readers get these samples. Readers who already joined keep the set they were given.</p>
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <ImagePlus /> Add samples
            </Button>
          </div>
          <div className="divide-y rounded-xl border bg-card">
            {data.samples.map((s) => {
              const its = bySample(s.id);
              const avg = its.length ? its.reduce((a, i) => a + i.rating!.overall, 0) / its.length : null;
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Thumb id={s.id} className="h-12 w-9 shrink-0 rounded" contain={!!s.part} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-mono font-medium">
                      {code(s.id)}
                      {main && s.isAnchor && (
                        <Badge variant="outline" className="font-sans font-normal">
                          <Anchor /> anchor
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {its.length} response{its.length === 1 ? "" : "s"}
                      {main && !s.isAnchor && ` of ${target}`}
                      {avg !== null && ` · average ${avg.toFixed(1)}`}
                      {main && s.part && ` · text ${s.part}`}
                    </div>
                  </div>
                  {main && !s.isAnchor && (
                    <Badge variant={its.length >= target ? "default" : "outline"} className="tabular-nums" title={`${its.length} of ${target} ratings`}>
                      {its.length}/{target}
                    </Badge>
                  )}
                  <Button variant="outline" size="sm" disabled={!its.length} onClick={() => setViewing({ sampleId: s.id, itemId: null })}>
                    <Eye /> View
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${code(s.id)} from the study`}
                    onClick={() =>
                      ask({
                        title: `Remove ${code(s.id)} from this study?`,
                        description: "Readers who haven't rated it yet won't see it. Responses already given are kept.",
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

        <TabsContent value="responses" className="mt-4">
          {done.length === 0 ? (
            <EmptyState icon={<MessageSquareText className="size-5" />} title="No responses yet" />
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <Select value={readerFilter} onValueChange={setReaderFilter}>
                  <SelectTrigger className="w-56" aria-label="Filter by reader">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All readers</SelectItem>
                    {data.readers.map((r) => (
                      <SelectItem key={r.uid} value={r.uid}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">Click a row to see the scan with the boxes.</span>
              </div>
              <ResponsesTable items={responses} main={main} code={code} name={name} criteriaCount={criteria.length} onOpen={(i) => setViewing({ sampleId: i.sampleId, itemId: i.id })} />
            </>
          )}
        </TabsContent>
      </Tabs>

      {viewing && (
        <ResponsesDialog
          type={data.type}
          title={code(viewing.sampleId)}
          sampleId={viewing.sampleId}
          items={done.filter((i) => i.sampleId === viewing.sampleId)}
          criteria={criteria}
          focus={viewing.itemId}
          onFocus={(itemId) => setViewing({ ...viewing, itemId })}
          onClose={() => setViewing(null)}
          readerName={name}
        />
      )}

      <SamplePicker
        open={adding}
        onOpenChange={setAdding}
        title="Add samples"
        hint="Samples already in the study stay. New readers get the added ones."
        rows={data.rows.filter((r) => !study.sampleIds.includes(r.id))}
        refs={data.refs}
        initial={new Set()}
        filters={copy.filters}
        confirmLabel={(k) => `Add ${k} sample${k === 1 ? "" : "s"}`}
        onConfirm={async (ids) => {
          if (!ids.length) return setAdding(false);
          const r = await addSamplesToStudy(study.id, ids);
          if (!r.ok) return toast.error(r.error);
          toast.success(`Added ${r.added} sample${r.added === 1 ? "" : "s"}`);
          setAdding(false);
          router.refresh();
        }}
      />

      <SettingsDialog open={editing} onOpenChange={setEditing} study={study} onSave={(patch) => call(updateStudy(study.id, patch), "Saved")} />
      {confirmDialog}
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="text-muted-foreground tabular-nums">{n}</span>;
}

function ShareCard({ study, status, invite, onReopen }: { study: Study; status: StudyStatus; invite: string; onReopen: () => void }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = study.publicToken && origin ? `${origin}${surveyPath(study.script, study.publicToken)}` : "";
  const copyText = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it by hand.");
    }
  };

  return (
    <section className={cn("rounded-xl border p-4", status === "open" ? "border-primary/30 bg-brand-soft/40" : "bg-card")}>
      <div className="flex flex-wrap items-center gap-2">
        <Link2 className="size-4 text-primary" />
        <h3 className="font-medium">Link for readers</h3>
        <span className="text-sm text-muted-foreground">
          {status === "open"
            ? "Send it to anyone. They enter their name and details and start rating; no account needed."
            : status === "full"
              ? "Closed to new readers. People who already joined can still finish."
              : "The study is closed, so the link doesn't work right now."}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} className={cn("min-w-0 flex-1 bg-card font-mono text-sm", status !== "open" && "text-muted-foreground")} />
        {status === "open" ? (
          <>
            <Button onClick={() => copyText(url, "Link copied")} disabled={!url}>
              <Copy /> Copy link
            </Button>
            <Button variant="outline" onClick={() => copyText(`${invite} ${url}`, "Invite message copied")} disabled={!url}>
              <MessageSquareText /> Copy invite message
            </Button>
            <Button variant="outline" size="icon" asChild aria-label="Open the link in a new tab">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink />
              </a>
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onReopen}>
            Open to new readers
          </Button>
        )}
      </div>
    </section>
  );
}

function ResponsesTable({
  items,
  main,
  code,
  name,
  criteriaCount,
  onOpen,
}: {
  items: ItemInfo[];
  main: boolean;
  code: (sid: string) => string;
  name: (uid: string) => string;
  criteriaCount: number;
  onOpen: (i: ItemInfo) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Sample</th>
            <th className="px-3 py-2 font-medium">Reader</th>
            <th className="px-3 py-2 font-medium">Score</th>
            {main ? (
              <>
                <th className="px-3 py-2 font-medium">Legibility</th>
                <th className="px-3 py-2 font-medium">Criteria scored</th>
                <th className="px-3 py-2 font-medium">Weak regions</th>
                <th className="px-3 py-2 font-medium">Comment</th>
              </>
            ) : (
              <>
                <th className="px-3 py-2 font-medium">Looks good because…</th>
                <th className="px-3 py-2 font-medium">Could be better because…</th>
                <th className="px-3 py-2 font-medium">Boxes</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((i) => {
            const r = i.rating!;
            return (
              <tr
                key={i.id}
                tabIndex={0}
                className="cursor-pointer align-top outline-none hover:bg-muted/40 focus-visible:bg-muted/60"
                onClick={() => onOpen(i)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(i))}
              >
                <td className="px-3 py-2 font-mono whitespace-nowrap">
                  {code(i.sampleId)}
                  {i.kind !== "normal" && <span className="ml-1 font-sans text-xs text-muted-foreground">({i.kind})</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{name(i.raterId)}</td>
                <td className="px-3 py-2 tabular-nums">{r.overall}</td>
                {main ? (
                  <>
                    <td className="px-3 py-2 tabular-nums">{r.legibility ?? "–"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                      {Object.keys(r.criterionScores).length} / {criteriaCount}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.regions.length}</td>
                    <td className="max-w-xs px-3 py-2 text-muted-foreground">{r.comment}</td>
                  </>
                ) : (
                  <>
                    <td className="max-w-sm px-3 py-2">{r.liked}</td>
                    <td className="max-w-sm px-3 py-2">{r.disliked}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{markCounts(r.regions)}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SettingsDialog({
  open,
  onOpenChange,
  study,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  study: Study;
  onSave: (patch: {
    title: string;
    instructions: string;
    perReader: number | null;
    repeatPct?: number;
    targetPerSample?: number | null;
    maxPerSample?: number | null;
  }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(study.title);
  const [instructions, setInstructions] = useState(study.instructions);
  const [perReader, setPerReader] = useState(study.perReader ? String(study.perReader) : "");
  const [repeatPct, setRepeatPct] = useState(study.repeatPct ?? 10);
  const main = study.type === "rubric";
  const capOf = (st: Study) => (st.maxPerSample === undefined ? String(MAIN_DEFAULTS.maxPerSample) : st.maxPerSample ? String(st.maxPerSample) : "");
  const [targetPer, setTargetPer] = useState(String(study.targetPerSample ?? MAIN_DEFAULTS.targetPerSample));
  const [maxPer, setMaxPer] = useState(capOf(study));
  useEffect(() => {
    if (!open) return;
    setTitle(study.title);
    setInstructions(study.instructions);
    setPerReader(study.perReader ? String(study.perReader) : "");
    setRepeatPct(study.repeatPct ?? 10);
    setTargetPer(String(study.targetPerSample ?? MAIN_DEFAULTS.targetPerSample));
    setMaxPer(capOf(study));
  }, [open, study]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Survey settings</DialogTitle>
          <DialogDescription>Changes to samples per reader and repeats apply to readers who join from now on.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="set-title" className="mb-1.5">
              Title shown to readers
            </Label>
            <Input id="set-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="set-instr" className="mb-1.5">
              Instructions
            </Label>
            <Textarea id="set-instr" rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <Label htmlFor="set-per" className="mb-1.5">
                {main ? "Samples per form" : "Samples per reader"}
              </Label>
              <Input
                id="set-per"
                type="number"
                min={1}
                className="w-28"
                placeholder={main ? String(MAIN_DEFAULTS.formSize) : `all ${study.sampleIds.length}`}
                value={perReader}
                onChange={(e) => setPerReader(e.target.value)}
              />
            </div>
            {main && (
              <>
                <div>
                  <Label htmlFor="set-target" className="mb-1.5">
                    Target per sample
                  </Label>
                  <Input id="set-target" type="number" min={1} className="w-24" value={targetPer} onChange={(e) => setTargetPer(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="set-max" className="mb-1.5">
                    Max per sample
                  </Label>
                  <Input id="set-max" type="number" min={1} className="w-24" placeholder="no cap" value={maxPer} onChange={(e) => setMaxPer(e.target.value)} />
                </div>
              </>
            )}
            {study.type === "rubric" && (
              <div>
                <Label htmlFor="set-rep" className="mb-1.5">
                  Blinded repeats %
                </Label>
                <Input id="set-rep" type="number" min={0} max={50} className="w-20" value={repeatPct} onChange={(e) => setRepeatPct(Number(e.target.value))} />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              const ok = await onSave({
                title,
                instructions,
                perReader: perReader.trim() ? Number(perReader) : null,
                ...(main
                  ? { repeatPct, targetPerSample: targetPer.trim() ? Number(targetPer) : null, maxPerSample: maxPer.trim() ? Number(maxPer) : null }
                  : {}),
              });
              if (ok) onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
