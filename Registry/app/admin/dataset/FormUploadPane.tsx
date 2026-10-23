"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, CloudUpload, Loader2, RotateCcw, Trash2, TriangleAlert, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normaliseCode, parseFormCode, sampleLabel } from "@/lib/codes";
import type { Box } from "@/lib/form-split";
import { SCRIPT_LABEL, type Phase, type Script } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BoxEditor, ZoomRegion } from "./BoxEditor";
import { cropPage, FORM_TYPES, loadFormPages, type FormPage } from "./form-pages";
import { sendPage, sendScan } from "./upload-client";
import type { Known } from "./UploadDialog";

interface PageRow extends FormPage {
  code: string;
  parts: [Box, Box];
  /** The admin has opened this page, so the code and boxes were looked at. */
  seen: boolean;
  state: "ready" | "uploading" | "done" | "error";
  message?: string;
  /** Kept across retries so a failed upload doesn't store the page twice or redo finished paragraphs. */
  pageId?: string;
  partsDone: number[];
}

const PARTS = [1, 2] as const;

export function FormUploadPane({
  script,
  known,
  register,
  replace,
  phase,
  busy,
  setBusy,
  onUploaded,
}: {
  script: Script;
  known: Known;
  register: boolean;
  replace: boolean;
  phase: Phase;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onUploaded: () => void;
}) {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);

  // Free the page images when the dialog goes away.
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const update = (key: string, patch: Partial<PageRow>) => setPages((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    const added: PageRow[] = [];
    for (const file of files) {
      setReading(file.name);
      try {
        const loaded = await loadFormPages(file);
        for (const p of loaded) {
          urls.current.push(p.url);
          added.push({ ...p, code: "", parts: p.layout.parts, seen: false, state: "ready", partsDone: [] });
        }
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setReading(null);
    if (!added.length) return;
    setPages((prev) => {
      const seen = new Set(prev.map((p) => p.key));
      return [...prev, ...added.filter((p) => !seen.has(p.key))];
    });
    if (!current) open(added[0].key, [...pages, ...added]);
  }

  /** Opens a page; a new page gets the next code after the one before it, for the admin to confirm. */
  function open(key: string, list = pages) {
    setCurrent(key);
    const i = list.findIndex((p) => p.key === key);
    const p = list[i];
    if (!p || p.seen) return;
    let code = p.code;
    if (!code) {
      const prev = list.slice(0, i).reverse().find((o) => parseFormCode(o.code, script));
      const n = prev && normaliseCode(parseFormCode(prev.code, script)!);
      if (n) code = parseFormCode(String(n.number + 1), n.script) ?? "";
    }
    setPages((all) => all.map((o) => (o.key === key ? { ...o, seen: true, code } : o)));
    requestAnimationFrame(() => codeInput.current?.select());
  }

  const codeOf = (p: PageRow) => parseFormCode(p.code, script);

  function problem(p: PageRow): string | null {
    const code = codeOf(p);
    if (!p.seen) return "Not checked yet";
    if (!code) return "Type the code";
    const k = known[code];
    if (!k && !register) return "New code: tick 'register new codes'";
    if (k?.withdrawn) return "Writer withdrew";
    if (k && !k.consent) return "Consent not recorded";
    if (pages.filter((o) => codeOf(o) === code && o.state !== "done").length > 1) return "Same code on two pages";
    return null;
  }

  const pending = pages.filter((p) => p.state === "ready" || p.state === "error");
  const ready = pending.filter((p) => !problem(p));
  const done = pages.filter((p) => p.state === "done").length;
  const page = pages.find((p) => p.key === current) ?? null;
  const pageIdx = page ? pages.indexOf(page) : -1;

  function go(step: number) {
    const next = pages[pageIdx + step];
    if (page) {
      const c = codeOf(page);
      if (c) update(page.key, { code: c });
    }
    if (next) open(next.key);
  }

  function remove(key: string) {
    const p = pages.find((o) => o.key === key);
    if (p) URL.revokeObjectURL(p.url);
    const rest = pages.filter((o) => o.key !== key);
    setPages(rest);
    if (current === key) setCurrent(rest[Math.min(pageIdx, rest.length - 1)]?.key ?? null);
  }

  async function uploadOne(p: PageRow) {
    const code = codeOf(p)!;
    const codeScript = normaliseCode(code)!.script;
    const bmp = await createImageBitmap(p.blob);
    try {
      let pageId = p.pageId;
      if (!pageId) {
        pageId = await sendPage(codeScript, p.blob);
        update(p.key, { pageId });
      }
      const doneParts = [...p.partsDone];
      for (const part of PARTS) {
        if (doneParts.includes(part)) continue;
        const box = p.parts[part - 1];
        const crop = await cropPage(bmp, box);
        const res = await sendScan(
          {
            code,
            pageNo: 1,
            part,
            crop: box,
            pageId,
            contentType: "image/jpeg",
            size: crop.blob.size,
            width: crop.width,
            height: crop.height,
            register,
            replace,
            phase,
          },
          crop.blob,
          crop.thumb,
        );
        if (res?.error) throw new Error(`${sampleLabel({ code, pageNo: 1, part })}: ${res.error}`);
        doneParts.push(part);
        update(p.key, { partsDone: [...doneParts] });
      }
    } finally {
      bmp.close();
    }
  }

  async function uploadAll() {
    setBusy(true);
    let ok = 0;
    for (const p of ready) {
      update(p.key, { state: "uploading", message: undefined });
      try {
        await uploadOne(p);
        ok++;
        update(p.key, { state: "done", code: codeOf(p)! });
      } catch (e) {
        update(p.key, { state: "error", message: e instanceof Error ? e.message : String(e) });
      }
    }
    setBusy(false);
    if (ok) toast.success(`${ok} form${ok === 1 ? "" : "s"} uploaded as ${ok * 2} samples`);
    onUploaded();
  }

  const code = page ? codeOf(page) : null;
  const locked = !page || busy || page.state === "done" || page.state === "uploading";

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 text-sm transition",
          pages.length ? "py-3" : "flex-col py-8",
          dragging ? "border-primary bg-brand-soft" : "hover:border-primary/40 hover:bg-muted/40",
        )}
      >
        {reading ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : <CloudUpload className="size-6 text-muted-foreground" />}
        <div className={cn(!pages.length && "text-center")}>
          <div className="font-medium">{reading ? `Reading ${reading}…` : "Drop scanned forms here, or click to choose"}</div>
          <div className="text-xs text-muted-foreground">
            PDF (every page is one form), JPEG or PNG. Each form becomes two samples: paragraph 1 and paragraph 2.
          </div>
        </div>
        <input
          type="file"
          accept={[...FORM_TYPES, ".pdf"].join(",")}
          multiple
          className="hidden"
          disabled={!!reading || busy}
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {pages.length > 0 && (
        <div className="grid gap-3 md:grid-cols-[210px_1fr]">
          <div className="max-h-[62vh] overflow-y-auto rounded-lg border">
            {pages.map((p, i) => {
              const prob = p.state === "ready" ? problem(p) : null;
              const c = codeOf(p);
              return (
                <button
                  key={p.key}
                  onClick={() => open(p.key)}
                  className={cn("block w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50", p.key === current && "bg-brand-soft")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium">{c ?? <span className="text-muted-foreground">Page {i + 1}</span>}</span>
                    {p.state === "done" && <CheckCircle2 className="size-4 text-success" />}
                    {p.state === "uploading" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                  </div>
                  <div className="truncate text-xs text-muted-foreground" title={p.fileName}>
                    {p.fileName}
                    {p.index > 1 || p.fileName.toLowerCase().endsWith(".pdf") ? ` · p${p.index}` : ""}
                  </div>
                  {p.state === "error" && <div className="mt-0.5 text-xs text-destructive">{p.message}</div>}
                  {prob && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs">
                      <TriangleAlert className="size-3" /> {prob}
                    </div>
                  )}
                  {!prob && p.state === "ready" && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{p.layout.confidence === "check" ? "Ready · auto-split was unsure" : "Ready"}</div>
                  )}
                </button>
              );
            })}
          </div>

          {page && (
            <div className="flex min-w-0 gap-4">
              <BoxEditor
                key={page.key}
                src={page.url}
                aspect={page.width / page.height}
                boxes={page.parts}
                labels={PARTS.map((n) => `${code ?? "?"}-${n}`)}
                onChange={(i, box) => {
                  if (locked) return;
                  const parts = [...page.parts] as [Box, Box];
                  parts[i] = box;
                  update(page.key, { parts });
                }}
                className="h-[62vh] shrink-0"
              />

              <div className="min-w-0 flex-1 space-y-4 text-sm">
                <div className="space-y-1.5">
                  <Label htmlFor="form-code">Participant code</Label>
                  <ZoomRegion src={page.url} box={page.layout.code} aspect={page.width / page.height} className="w-full max-w-64" />
                  <Input
                    id="form-code"
                    ref={codeInput}
                    className="max-w-64 font-mono"
                    value={page.code}
                    placeholder={`${script === "ta" ? "TA" : "SI"}-001`}
                    disabled={locked}
                    onChange={(e) => update(page.key, { code: e.target.value })}
                    onBlur={() => {
                      if (code) update(page.key, { code });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        go(1);
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Type what&apos;s written in the box: <span className="font-mono">S001</span>, <span className="font-mono">1</span> or{" "}
                    <span className="font-mono">SI-001</span> all work ({SCRIPT_LABEL[script]} unless it says TA/SI). Press Enter for the next page.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="font-medium">Paragraphs</div>
                  {page.layout.note ? (
                    <p className="flex gap-1.5 text-xs">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {page.layout.note}. Check the boxes and drag them if needed.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Found automatically. Drag a box or its edges to adjust.</p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={locked}
                    onClick={() => update(page.key, { parts: page.layout.parts })}
                  >
                    <RotateCcw /> Reset boxes
                  </Button>
                </div>

                {page.state === "error" && <p className="text-xs text-destructive">{page.message}</p>}

                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <Button variant="outline" size="sm" disabled={pageIdx <= 0} onClick={() => go(-1)}>
                    <ChevronLeft /> Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={pageIdx >= pages.length - 1} onClick={() => go(1)}>
                    Next <ChevronRight />
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {pageIdx + 1} / {pages.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    disabled={busy || page.state === "uploading"}
                    onClick={() => remove(page.key)}
                  >
                    <Trash2 /> Remove page
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-xs text-muted-foreground">
          {pages.length > 0 && `${done} uploaded · ${ready.length} ready · ${pending.length - ready.length} need attention`}
        </span>
        <Button onClick={uploadAll} disabled={busy || ready.length === 0}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />}
          {busy ? "Uploading…" : ready.length ? `Upload ${ready.length} form${ready.length === 1 ? "" : "s"} (${ready.length * 2} samples)` : "Upload"}
        </Button>
      </div>
    </div>
  );
}
