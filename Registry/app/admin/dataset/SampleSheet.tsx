"use client";

import { Anchor, Check, Crop, Loader2, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Confirm } from "@/components/admin/Confirm";
import { ImageAnnotator } from "@/components/ImageAnnotator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { act } from "@/lib/client-action";
import { sampleLabel } from "@/lib/codes";
import { QC_LABEL, type SampleRow } from "@/lib/dataset-types";
import type { Box } from "@/lib/form-split";
import type { SampleStatus } from "@/lib/types";
import { BoxEditor, ZoomRegion } from "./BoxEditor";
import { deleteSamples, sampleDetail, setAnchor, setStatus, type SampleDetail } from "./sample-actions";
import { changeFormCode } from "./upload-actions";
import { recropSample } from "./upload-client";

const when = (t: number | null) =>
  t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

export function SampleSheet({ row, onClose }: { row: SampleRow | null; onClose: () => void }) {
  const router = useRouter();
  const [detail, setDetail] = useState<SampleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchorState] = useState({ on: false, overall: "", legibility: "", note: "" });
  const [codeDraft, setCodeDraft] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  /** Paragraph box being adjusted on the original page; null when not editing. */
  const [edit, setEdit] = useState<{ box: Box; aspect: number } | null>(null);
  const [savingBox, setSavingBox] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const current = useRef<string | null>(null);
  current.current = row?.id ?? null;

  async function load(id: string) {
    setError(null);
    const d = await sampleDetail(id);
    if ("error" in d) return setError(d.error);
    setDetail(d);
    setCodeDraft(d.code);
    setAnchorState({
      on: d.isAnchor,
      overall: d.anchorScores?.overall?.toString() ?? "",
      legibility: d.anchorScores?.legibility?.toString() ?? "",
      note: d.anchorScores?.note ?? "",
    });
  }

  useEffect(() => {
    setDetail(null);
    setEdit(null);
    setLoadingPage(false);
    if (row) void load(row.id);
  }, [row]);

  async function qc(status: SampleStatus) {
    if (!row) return;
    if (await act(setStatus, { ids: row.id, status }, `Marked ${QC_LABEL[status].toLowerCase()}`)) {
      await load(row.id);
      router.refresh();
    }
  }

  async function saveCode() {
    if (!row) return;
    setSavingCode(true);
    if (await act(changeFormCode, { id: row.id, code: codeDraft })) {
      await load(row.id);
      router.refresh();
    }
    setSavingCode(false);
  }

  function startBoxEdit() {
    if (!row || !detail?.crop) return;
    const box = detail.crop;
    const id = row.id;
    setLoadingPage(true);
    const img = new Image();
    img.onload = () => {
      setLoadingPage(false);
      // Ignore a late load if the panel moved on to another sample meanwhile.
      if (current.current === id) setEdit({ box, aspect: img.naturalWidth / img.naturalHeight });
    };
    img.onerror = () => {
      setLoadingPage(false);
      toast.error("Could not load the original page");
    };
    img.src = `/api/image/${row.id}?size=page`;
  }

  async function saveBox() {
    if (!row || !edit) return;
    setSavingBox(true);
    try {
      await recropSample(row.id, edit.box);
      toast.success("Paragraph re-cut");
      setEdit(null);
      await load(row.id);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
    setSavingBox(false);
  }

  const label = row && sampleLabel({ code: detail?.code ?? row.code, pageNo: row.pageNo, part: row.part });

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="w-full gap-0 overflow-y-auto sm:max-w-[min(1100px,96vw)]!"
        onEscapeKeyDown={(e) => {
          // Escape leaves box editing first, instead of closing the panel and losing the edit.
          if (edit && !savingBox) setEdit(null);
          if (edit) e.preventDefault();
        }}
      >
        <SheetHeader className="border-b">
          <SheetTitle className="font-mono text-lg">
            {label}
          </SheetTitle>
          <SheetDescription>
            {detail ? `${detail.phase} phase · ${detail.width}×${detail.height}px · uploaded ${when(detail.uploadedAt)}` : " "}
            {row?.part && (
              <>
                {" · "}
                <a href={`/api/image/${row.id}?size=page`} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
                  Paragraph {row.part} of the scanned form: open full page
                </a>
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        {row && (
          <div className="grid gap-5 p-4 lg:grid-cols-[1fr_320px]">
            {edit ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-full" style={{ maxWidth: `calc(66vh * ${edit.aspect})` }}>
                  <BoxEditor
                    src={`/api/image/${row.id}?size=page`}
                    aspect={edit.aspect}
                    boxes={[edit.box]}
                    labels={[label ?? ""]}
                    onChange={(_, box) => !savingBox && setEdit({ ...edit, box })}
                    className="w-full"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={saveBox} disabled={savingBox}>
                    {savingBox ? <Loader2 className="animate-spin" /> : <Check />} Save new box
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEdit(null)} disabled={savingBox}>
                    Cancel
                  </Button>
                  <span className="text-xs text-muted-foreground">Drag on the page to draw a new box, or drag the box, its edges or corners.</span>
                </div>
                <div className="w-full space-y-1">
                  <div className="text-xs text-muted-foreground">Will be saved as:</div>
                  <div style={{ width: `min(100%, calc(12rem * ${(edit.box.w * edit.aspect) / edit.box.h}))` }}>
                    <ZoomRegion src={`/api/image/${row.id}?size=page`} box={edit.box} aspect={edit.aspect} className="w-full" />
                  </div>
                </div>
              </div>
            ) : (
              <ImageAnnotator
                key={detail?.imageV ?? row.imageV}
                src={`/api/image/${row.id}?v=${detail?.imageV ?? row.imageV}`}
                heightClass="h-[70vh]"
              />
            )}

            <div className="space-y-5 text-sm">
              {error && <p className="text-destructive">{error}</p>}
              {!detail && !error && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </div>
              )}
              {detail && (
                <>
                  <section className="space-y-2">
                    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Writer</h3>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                      <dt className="text-muted-foreground">Code</dt>
                      <dd className="font-mono">{detail.code}</dd>
                      <dt className="text-muted-foreground">Writer ID</dt>
                      <dd className="font-mono">{detail.writerId}</dd>
                      <dt className="text-muted-foreground">Consent</dt>
                      <dd>{when(detail.consentReceivedAt)}</dd>
                      <dt className="text-muted-foreground">Uploaded by</dt>
                      <dd className="truncate">{detail.uploadedBy}</dd>
                    </dl>
                  </section>

                  {detail.hasPage && (
                    <section className="space-y-2 rounded-lg border p-3">
                      <h3 className="font-medium">Fix this form</h3>
                      <div className="space-y-1">
                        <Label htmlFor="fix-code" className="text-xs text-muted-foreground">
                          Participant code (moves both paragraphs of this page)
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="fix-code"
                            className="font-mono"
                            value={codeDraft}
                            disabled={savingCode}
                            onChange={(e) => setCodeDraft(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && codeDraft !== detail.code && void saveCode()}
                          />
                          <Button size="sm" variant="outline" className="h-9" disabled={savingCode || !codeDraft.trim() || codeDraft === detail.code} onClick={saveCode}>
                            {savingCode && <Loader2 className="animate-spin" />} Change
                          </Button>
                        </div>
                      </div>
                      {detail.crop && (
                        <div className="space-y-1">
                          <Button size="sm" variant="outline" disabled={detail.rated || !!edit || loadingPage} onClick={startBoxEdit}>
                            {loadingPage ? <Loader2 className="animate-spin" /> : <Crop />} Adjust paragraph box
                          </Button>
                          {detail.rated && <p className="text-xs text-muted-foreground">Already rated, so the box can&apos;t change.</p>}
                        </div>
                      )}
                    </section>
                  )}

                  <section className="space-y-2">
                    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Quality check</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{QC_LABEL[detail.status as SampleStatus]}</Badge>
                    </div>
                    {detail.status !== "excluded" && (
                      <div className="flex flex-wrap gap-2">
                        {detail.status !== "qc_ok" && (
                          <Button size="sm" onClick={() => qc("qc_ok")}>
                            <Check /> Approve
                          </Button>
                        )}
                        <Confirm
                          title={`Reject and delete ${label}?`}
                          description={
                            <>
                              The scan is removed from the dataset and from storage, and taken out of any survey. This can&apos;t be undone.
                              {detail.items.some((i) => i.status === "done") &&
                                ` Its ${detail.items.filter((i) => i.status === "done").length} rating(s) are deleted too.`}
                            </>
                          }
                          confirmLabel="Reject and delete"
                          destructive
                          onConfirm={async () => {
                            if (await act(deleteSamples, { ids: row.id })) {
                              onClose();
                              router.refresh();
                            }
                          }}
                        >
                          <Button size="sm" variant="outline">
                            <X /> Reject
                          </Button>
                        </Confirm>
                        {detail.status !== "uploaded" && (
                          <Button size="sm" variant="ghost" onClick={() => qc("uploaded")}>
                            <RotateCcw /> Unchecked
                          </Button>
                        )}
                      </div>
                    )}
                  </section>

                  <section className="space-y-2 rounded-lg border p-3">
                    <label className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Anchor className="size-4" /> Calibration anchor
                      </span>
                      <Switch checked={anchor.on} onCheckedChange={(on) => setAnchorState({ ...anchor, on })} />
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Shown first to every rater in rubric studies; after rating it they see your reference scores.
                    </p>
                    {anchor.on && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="mb-1 text-xs text-muted-foreground">Overall</Label>
                          <Input type="number" value={anchor.overall} onChange={(e) => setAnchorState({ ...anchor, overall: e.target.value })} />
                        </div>
                        <div>
                          <Label className="mb-1 text-xs text-muted-foreground">Legibility</Label>
                          <Input type="number" value={anchor.legibility} onChange={(e) => setAnchorState({ ...anchor, legibility: e.target.value })} />
                        </div>
                        <div className="col-span-2">
                          <Label className="mb-1 text-xs text-muted-foreground">Explanation for raters</Label>
                          <Textarea rows={2} value={anchor.note} onChange={(e) => setAnchorState({ ...anchor, note: e.target.value })} />
                        </div>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (await act(setAnchor, { id: row.id, isAnchor: anchor.on, overall: anchor.overall, legibility: anchor.legibility, note: anchor.note })) {
                          router.refresh();
                        }
                      }}
                    >
                      Save anchor
                    </Button>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Ratings ({detail.items.filter((i) => i.status === "done").length} of {detail.items.length})
                    </h3>
                    {detail.items.length === 0 && <p className="text-muted-foreground">Not in any rater&apos;s queue yet.</p>}
                    <div className="space-y-2">
                      {detail.items.map((it, i) => (
                        <div key={i} className="rounded-lg border p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">{it.rater}</span>
                            {it.status === "done" ? (
                              <Badge variant="secondary" className="bg-success/10 text-success">
                                {it.overall}
                                {it.legibility != null && ` · L${it.legibility}`}
                              </Badge>
                            ) : (
                              <Badge variant="outline">pending</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {it.study}
                            {it.kind !== "normal" && ` · ${it.kind}`}
                            {!!it.regions && ` · ${it.regions} region${it.regions === 1 ? "" : "s"}`}
                          </div>
                          {(it.liked || it.disliked) && (
                            <div className="mt-1.5 space-y-0.5 text-xs">
                              {it.liked && <p><span className="text-success">+</span> {it.liked}</p>}
                              {it.disliked && <p><span className="text-destructive">−</span> {it.disliked}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
