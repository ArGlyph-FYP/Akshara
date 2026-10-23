"use client";

import { CheckCircle2, CloudUpload, FileText, Images, Loader2, TriangleAlert, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normaliseCode } from "@/lib/codes";
import { ACCEPTED_TYPES, parseScanFilename } from "@/lib/filenames";
import type { Script } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FormUploadPane } from "./FormUploadPane";
import type { ScanMeta } from "./upload-actions";
import { sendScan } from "./upload-client";

export type Known = Record<string, { consent: boolean; withdrawn: boolean }>;

interface Row {
  key: string;
  file: File;
  code: string;
  pageNo: number;
  state: "ready" | "uploading" | "done" | "error";
  message?: string;
}

/** A ~480 px wide JPEG preview made in the browser, so the dataset grid loads fast. */
async function makeThumb(bmp: ImageBitmap): Promise<Blob | null> {
  const w = Math.min(480, bmp.width);
  const h = Math.round((bmp.height * w) / bmp.width);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8));
}

export function UploadDialog({ known, script }: { known: Known; script: Script }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [register, setRegister] = useState(false);
  const [replace, setReplace] = useState(false);
  const [phase, setPhase] = useState<"main" | "pilot">("main");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<"forms" | "images">("forms");

  function addFiles(list: FileList | File[]) {
    const next: Row[] = Array.from(list).map((file) => {
      const parsed = parseScanFilename(file.name);
      return { key: `${file.name}-${file.size}-${file.lastModified}`, file, code: parsed?.code ?? "", pageNo: parsed?.pageNo ?? 1, state: "ready" };
    });
    setRows((prev) => {
      const seen = new Set(prev.map((r) => r.key));
      return [...prev, ...next.filter((r) => !seen.has(r.key))];
    });
  }

  const update = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function problem(r: Row): string | null {
    if (!ACCEPTED_TYPES[r.file.type]) return "Not a JPEG/PNG";
    const c = normaliseCode(r.code);
    if (!c) return "Type the code";
    const k = known[c.code];
    if (!k) return register ? null : "New code: tick 'register new codes'";
    if (k.withdrawn) return "Writer withdrew";
    if (!k.consent) return "Consent not recorded";
    const dup = rows.filter((o) => normaliseCode(o.code)?.code === c.code && o.pageNo === r.pageNo).length > 1;
    return dup ? "Same code + page twice" : null;
  }

  const pending = rows.filter((r) => r.state === "ready" || r.state === "error");
  const ready = pending.filter((r) => !problem(r));
  const done = rows.filter((r) => r.state === "done").length;

  async function uploadOne(r: Row) {
    const bmp = await createImageBitmap(r.file);
    const thumb = await makeThumb(bmp);
    const meta: ScanMeta = {
      code: r.code,
      pageNo: r.pageNo,
      contentType: r.file.type,
      size: r.file.size,
      width: bmp.width,
      height: bmp.height,
      register,
      replace,
      phase,
    };
    bmp.close();
    return sendScan(meta, r.file, thumb);
  }

  async function uploadAll() {
    setBusy(true);
    let ok = 0;
    for (const r of ready) {
      update(r.key, { state: "uploading", message: undefined });
      try {
        const res = await uploadOne(r);
        if (res?.error) update(r.key, { state: "error", message: res.error });
        else {
          ok++;
          update(r.key, { state: "done" });
        }
      } catch (e) {
        update(r.key, { state: "error", message: e instanceof Error ? e.message : String(e) });
      }
    }
    setBusy(false);
    if (ok) toast.success(`${ok} scan${ok === 1 ? "" : "s"} uploaded`);
    router.refresh();
  }

  const options = (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
      <label className="flex items-center gap-2">
        <Checkbox checked={register} disabled={busy} onCheckedChange={(v) => setRegister(!!v)} />
        Register new codes: I confirm their consent forms were received
      </label>
      {register && (
        <div className="flex items-center gap-2">
          <Label className="text-muted-foreground">as</Label>
          <Select value={phase} disabled={busy} onValueChange={(v) => setPhase(v as "main" | "pilot")}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">Main phase</SelectItem>
              <SelectItem value="pilot">Pilot phase</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <label className="flex items-center gap-2">
        <Checkbox checked={replace} disabled={busy} onCheckedChange={(v) => setReplace(!!v)} />
        Replace samples already uploaded (if not yet rated)
      </label>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        setOpen(o);
        if (!o) setRows((p) => p.filter((r) => r.state !== "done"));
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload /> Upload scans
        </Button>
      </DialogTrigger>
      <DialogContent className={cn("max-h-[94vh] gap-4 overflow-y-auto", mode === "forms" ? "sm:max-w-6xl" : "sm:max-w-3xl")}>
        <DialogHeader>
          <DialogTitle>Upload scans</DialogTitle>
          <DialogDescription>
            {mode === "forms" ? (
              <>Scanned Akshara forms: each page is split into its two paragraphs, saved as e.g. SI-001-1 and SI-001-2.</>
            ) : (
              <>
                Whole pages as one sample each. Name files like <code className="rounded bg-muted px-1">SI-001.jpg</code> or{" "}
                <code className="rounded bg-muted px-1">TA-014_p2.png</code> to match them automatically. JPEG or PNG, 300 dpi recommended.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => !busy && setMode(v as "forms" | "images")}>
          <TabsList>
            <TabsTrigger value="forms" disabled={busy}>
              <FileText /> Forms (2 paragraphs)
            </TabsTrigger>
            <TabsTrigger value="images" disabled={busy}>
              <Images /> Single images
            </TabsTrigger>
          </TabsList>
          <TabsContent value="forms" className="mt-3 space-y-3" forceMount hidden={mode !== "forms"}>
            {options}
            <FormUploadPane
              script={script}
              known={known}
              register={register}
              replace={replace}
              phase={phase}
              busy={busy}
              setBusy={setBusy}
              onUploaded={() => router.refresh()}
            />
          </TabsContent>
          <TabsContent value="images" className="mt-3 space-y-4">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-sm transition",
                dragging ? "border-primary bg-brand-soft" : "hover:border-primary/40 hover:bg-muted/40",
              )}
            >
              <CloudUpload className="size-7 text-muted-foreground" />
              <span className="font-medium">Drop scans here, or click to choose</span>
              <span className="text-xs text-muted-foreground">You can select many files at once</span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>

            {rows.length > 0 && (
              <>
                {options}

                <div className="-mx-1 max-h-[38vh] overflow-y-auto px-1">
                  <div className="divide-y rounded-lg border">
                    {rows.map((r) => {
                      const p = r.state === "ready" ? problem(r) : null;
                      const c = normaliseCode(r.code);
                      return (
                        <div key={r.key} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <span className="min-w-0 flex-1 truncate" title={r.file.name}>
                            {r.file.name}
                            <span className="ml-2 text-xs text-muted-foreground">{(r.file.size / 1024 / 1024).toFixed(1)} MB</span>
                          </span>
                          <Input
                            className="h-7 w-24 font-mono"
                            value={r.code}
                            placeholder="SI-001"
                            disabled={r.state === "done" || busy}
                            onChange={(e) => update(r.key, { code: e.target.value })}
                            onBlur={(e) => {
                              const n = normaliseCode(e.target.value);
                              if (n) update(r.key, { code: n.code });
                            }}
                          />
                          <Input
                            type="number"
                            min={1}
                            className="h-7 w-14"
                            title="Page"
                            value={r.pageNo}
                            disabled={r.state === "done" || busy}
                            onChange={(e) => update(r.key, { pageNo: Math.max(1, Number(e.target.value) || 1) })}
                          />
                          <span className="w-48 text-right text-xs">
                            {r.state === "done" && (
                              <span className="inline-flex items-center gap-1 text-success">
                                <CheckCircle2 className="size-3.5" /> Uploaded
                              </span>
                            )}
                            {r.state === "uploading" && (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Loader2 className="size-3.5 animate-spin" /> Uploading
                              </span>
                            )}
                            {r.state === "error" && <span className="text-destructive">{r.message}</span>}
                            {r.state === "ready" &&
                              (p ? (
                                <span className="inline-flex items-center gap-1 text-foreground">
                                  <TriangleAlert className="size-3.5" /> {p}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">{c?.script === "ta" ? "Tamil · ready" : "Sinhala · ready"}</span>
                              ))}
                          </span>
                          {r.state !== "uploading" && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              disabled={busy}
                              aria-label="Remove"
                              onClick={() => setRows((prev) => prev.filter((o) => o.key !== r.key))}
                            >
                              <X />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <DialogFooter className="items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">
                {rows.length > 0 && `${done} uploaded · ${ready.length} ready · ${pending.length - ready.length} need attention`}
              </span>
              <Button onClick={uploadAll} disabled={busy || ready.length === 0}>
                {busy ? <Loader2 className="animate-spin" /> : <Upload />}
                {busy ? "Uploading…" : `Upload ${ready.length || ""}`.trim()}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
