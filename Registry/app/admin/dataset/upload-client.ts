"use client";

import type { Box } from "@/lib/form-split";
import type { Script } from "@/lib/types";
import { cropPage } from "./form-pages";
import {
  completeRecrop,
  completeUpload,
  preparePage,
  prepareRecrop,
  prepareUpload,
  recropDirect,
  uploadPageDirect,
  uploadScanDirect,
  type ScanMeta,
} from "./upload-actions";

/** Uploads one sample image (and its preview) straight to Storage, then records it. */
export async function sendScan(meta: ScanMeta, file: Blob, thumb: Blob | null) {
  const prep = await prepareUpload(meta);
  if (prep.error || !prep.id) throw new Error(prep.error ?? "Upload failed");
  if (prep.direct) {
    const fd = new FormData();
    fd.set("file", new File([file], "scan", { type: meta.contentType }));
    if (thumb) fd.set("thumb", new File([thumb], "thumb.jpg", { type: "image/jpeg" }));
    return uploadScanDirect(meta, prep.id, fd);
  }
  const put = await fetch(prep.url!, { method: "PUT", headers: { "content-type": meta.contentType }, body: file });
  if (!put.ok) throw new Error(`Storage upload failed (${put.status})`);
  if (thumb && prep.thumbUrl) {
    await fetch(prep.thumbUrl, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: thumb }).catch(() => {});
  }
  return completeUpload(meta, prep.id);
}

/** Stores the original form page (JPEG) and returns its id, for the paragraphs cut from it. */
export async function sendPage(script: Script, page: Blob): Promise<string> {
  const prep = await preparePage(script, page.size);
  if (prep.error || !prep.pageId) throw new Error(prep.error ?? "Upload failed");
  if (prep.direct) {
    const fd = new FormData();
    fd.set("file", new File([page], "page.jpg", { type: "image/jpeg" }));
    const res = await uploadPageDirect(script, prep.pageId, fd);
    if (res?.error) throw new Error(res.error);
    return prep.pageId;
  }
  const put = await fetch(prep.url!, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: page });
  if (!put.ok) throw new Error(`Storage upload failed (${put.status})`);
  return prep.pageId;
}

/** Cuts a new paragraph box from a sample's original page and swaps it in (same sample, same id). */
export async function recropSample(id: string, box: Box) {
  const prep = await prepareRecrop(id);
  if (prep.error || !prep.newId) throw new Error(prep.error ?? "Could not start");
  const res = await fetch(prep.pageUrl ?? `/api/image/${id}?size=page`);
  if (!res.ok) throw new Error(`Could not load the original page (${res.status})`);
  const bmp = await createImageBitmap(await res.blob());
  let crop;
  try {
    crop = await cropPage(bmp, box);
  } finally {
    bmp.close();
  }
  const meta = { crop: box, width: crop.width, height: crop.height };
  if (prep.direct) {
    const fd = new FormData();
    fd.set("file", new File([crop.blob], "scan.jpg", { type: "image/jpeg" }));
    if (crop.thumb) fd.set("thumb", new File([crop.thumb], "thumb.jpg", { type: "image/jpeg" }));
    const r = await recropDirect(id, prep.newId, meta, fd);
    if (r?.error) throw new Error(r.error);
    return;
  }
  const put = await fetch(prep.url!, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: crop.blob });
  if (!put.ok) throw new Error(`Storage upload failed (${put.status})`);
  if (crop.thumb && prep.thumbUrl) {
    await fetch(prep.thumbUrl, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: crop.thumb }).catch(() => {});
  }
  const r = await completeRecrop(id, prep.newId, meta);
  if (r?.error) throw new Error(r.error);
}
