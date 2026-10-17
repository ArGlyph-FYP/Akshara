"use client";

import { Anchor, Check, Loader2, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImageAnnotator } from "@/components/ImageAnnotator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { act } from "@/lib/client-action";
import { QC_LABEL, type SampleRow } from "@/lib/dataset-types";
import type { SampleStatus } from "@/lib/types";
import { sampleDetail, setAnchor, setStatus, type SampleDetail } from "./sample-actions";

const when = (t: number | null) =>
  t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

export function SampleSheet({ row, onClose }: { row: SampleRow | null; onClose: () => void }) {
  const router = useRouter();
  const [detail, setDetail] = useState<SampleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchorState] = useState({ on: false, overall: "", legibility: "", note: "" });

  async function load(id: string) {
    setError(null);
    const d = await sampleDetail(id);
    if ("error" in d) return setError(d.error);
    setDetail(d);
    setAnchorState({
      on: d.isAnchor,
      overall: d.anchorScores?.overall?.toString() ?? "",
      legibility: d.anchorScores?.legibility?.toString() ?? "",
      note: d.anchorScores?.note ?? "",
    });
  }

  useEffect(() => {
    setDetail(null);
    if (row) void load(row.id);
  }, [row]);

  async function qc(status: SampleStatus) {
    if (!row) return;
    if (await act(setStatus, { ids: row.id, status }, `Marked ${QC_LABEL[status].toLowerCase()}`)) {
      await load(row.id);
      router.refresh();
    }
  }

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-[min(1100px,96vw)]!">
        <SheetHeader className="border-b">
          <SheetTitle className="font-mono text-lg">
            {row?.code}
            {row && row.pageNo > 1 && <span className="text-muted-foreground"> · page {row.pageNo}</span>}
          </SheetTitle>
          <SheetDescription>
            {detail ? `${detail.phase} phase · ${detail.width}×${detail.height}px · uploaded ${when(detail.uploadedAt)}` : " "}
          </SheetDescription>
        </SheetHeader>

        {row && (
          <div className="grid gap-5 p-4 lg:grid-cols-[1fr_320px]">
            <ImageAnnotator src={`/api/image/${row.id}`} heightClass="h-[70vh]" />

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
                        {detail.status !== "rejected" && (
                          <Button size="sm" variant="outline" onClick={() => qc("rejected")}>
                            <X /> Reject
                          </Button>
                        )}
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
