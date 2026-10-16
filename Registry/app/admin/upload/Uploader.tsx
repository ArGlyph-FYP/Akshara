"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { normaliseCode } from "@/lib/codes";
import { ACCEPTED_TYPES, parseScanFilename } from "@/lib/filenames";
import { completeUpload, prepareUpload, uploadScanDirect, type ScanMeta } from "./actions";

type Known = Record<string, { consent: boolean; withdrawn: boolean }>;

interface Row {
  key: string;
  file: File;
  code: string;
  pageNo: number;
  state: "ready" | "uploading" | "done" | "error";
  message?: string;
}

export function Uploader({ known }: { known: Known }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [register, setRegister] = useState(false);
  const [replace, setReplace] = useState(false);
  const [phase, setPhase] = useState<"main" | "pilot">("main");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  function addFiles(list: FileList | File[]) {
    const next: Row[] = [];
    for (const file of Array.from(list)) {
      const parsed = parseScanFilename(file.name);
      next.push({
        key: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        code: parsed?.code ?? "",
        pageNo: parsed?.pageNo ?? 1,
        state: "ready",
      });
    }
    setRows((prev) => {
      const seen = new Set(prev.map((r) => r.key));
      return [...prev, ...next.filter((r) => !seen.has(r.key))];
    });
  }

  const update = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function problem(r: Row): string | null {
    if (!ACCEPTED_TYPES[r.file.type]) return "Not JPEG/PNG";
    const c = normaliseCode(r.code);
    if (!c) return "Enter a code";
    const k = known[c.code];
    if (!k) return register ? null : "Code not registered";
    if (k.withdrawn) return "Withdrawn";
    if (!k.consent) return "Consent not recorded";
    const dup = rows.filter((o) => normaliseCode(o.code)?.code === c.code && o.pageNo === r.pageNo).length > 1;
    return dup ? "Duplicate in this batch" : null;
  }

  const pending = rows.filter((r) => r.state === "ready" || r.state === "error");
  const blocked = pending.filter((r) => problem(r));
  const summary = useMemo(() => {
    const done = rows.filter((r) => r.state === "done").length;
    const failed = rows.filter((r) => r.state === "error").length;
    return { done, failed };
  }, [rows]);

  async function uploadAll() {
    setBusy(true);
    for (const r of pending) {
      if (problem(r)) continue;
      update(r.key, { state: "uploading", message: undefined });
      try {
        const bmp = await createImageBitmap(r.file);
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
        const prep = await prepareUpload(meta);
        if (prep.error || !prep.id) throw new Error(prep.error ?? "Upload failed");
        let res;
        if (prep.direct) {
          const fd = new FormData();
          fd.set("file", r.file);
          res = await uploadScanDirect(meta, prep.id, fd);
        } else {
          const put = await fetch(prep.url!, { method: "PUT", headers: { "content-type": r.file.type }, body: r.file });
          if (!put.ok) throw new Error(`Storage upload failed (${put.status})`);
          res = await completeUpload(meta, prep.id);
        }
        update(r.key, res?.error ? { state: "error", message: res.error } : { state: "done", message: undefined });
      } catch (e) {
        update(r.key, { state: "error", message: e instanceof Error ? e.message : String(e) });
      }
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
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
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 text-sm ${dragging ? "border-accent bg-accent-soft" : "border-line bg-white"}`}
      >
        <span className="font-medium">Drop scans here or click to choose</span>
        <span className="text-xs text-muted">You can select a whole folder&apos;s files at once</span>
        <input
          type="file"
          accept="image/jpeg,image/png"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = ""; // so picking the same file again still fires onChange
          }}
        />
      </label>

      {rows.length > 0 && (
        <>
          <div className="card flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={register} onChange={(e) => setRegister(e.target.checked)} />
              Register unknown codes (I confirm their consent forms were received)
            </label>
            {register && (
              <label className="flex items-center gap-1.5">
                Phase for new codes
                <select className="input w-24 py-0.5" value={phase} onChange={(e) => setPhase(e.target.value as "main" | "pilot")}>
                  <option value="main">main</option>
                  <option value="pilot">pilot</option>
                </select>
              </label>
            )}
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              Replace pages already uploaded (only if unrated)
            </label>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted">
                {summary.done} uploaded · {summary.failed} failed · {blocked.length} need attention
              </span>
              <button className="btn" onClick={() => setRows((p) => p.filter((r) => r.state !== "done"))} disabled={busy}>
                Clear uploaded
              </button>
              <button className="btn btn-primary" onClick={uploadAll} disabled={busy || pending.length === blocked.length}>
                {busy ? "Uploading…" : `Upload ${pending.length - blocked.length}`}
              </button>
            </div>
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Code</th>
                  <th>Page</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = r.state === "ready" ? problem(r) : null;
                  return (
                    <tr key={r.key}>
                      <td className="max-w-64 truncate" title={r.file.name}>{r.file.name}</td>
                      <td>
                        <input
                          className="input w-28 py-0.5 font-mono"
                          value={r.code}
                          placeholder="SI-001"
                          disabled={r.state === "done" || busy}
                          onChange={(e) => update(r.key, { code: e.target.value })}
                          onBlur={(e) => {
                            const c = normaliseCode(e.target.value);
                            if (c) update(r.key, { code: c.code });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          className="input w-16 py-0.5"
                          value={r.pageNo}
                          disabled={r.state === "done" || busy}
                          onChange={(e) => update(r.key, { pageNo: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      </td>
                      <td className="text-muted">{(r.file.size / 1024 / 1024).toFixed(1)} MB</td>
                      <td>
                        {r.state === "done" && <span className="pill bg-emerald-50 text-emerald-800">uploaded</span>}
                        {r.state === "uploading" && <span className="pill bg-stone-100">uploading…</span>}
                        {r.state === "error" && <span className="pill bg-red-50 text-red-700">{r.message}</span>}
                        {r.state === "ready" &&
                          (p ? (
                            <span className="pill bg-amber-50 text-amber-800">{p}</span>
                          ) : (
                            <span className="pill bg-stone-100 text-stone-700">ready</span>
                          ))}
                      </td>
                      <td>
                        {r.state !== "uploading" && (
                          <button
                            className="text-xs text-muted underline"
                            disabled={busy}
                            onClick={() => setRows((prev) => prev.filter((o) => o.key !== r.key))}
                          >
                            remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
