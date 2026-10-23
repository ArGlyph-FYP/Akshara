"use client";

import type { Script } from "@/lib/types";
import { completeUpload, preparePage, prepareUpload, uploadPageDirect, uploadScanDirect, type ScanMeta } from "./upload-actions";

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
