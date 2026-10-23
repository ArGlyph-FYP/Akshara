"use client";

import { detectForm, toGray, type Box, type FormLayout } from "@/lib/form-split";

/** One scanned form page, ready for review. */
export interface FormPage {
  key: string;
  fileName: string;
  /** 1-based page within the uploaded file (PDFs can hold many forms). */
  index: number;
  /** Full-resolution page as JPEG (the original file when it already was one). */
  blob: Blob;
  url: string;
  width: number;
  height: number;
  layout: FormLayout;
}

const TARGET_WIDTH = 2480; // A4 at 300 dpi
const MAX_SIDE = 5000;
const ANALYSIS_WIDTH = 1240; // ~150 dpi is enough to find the paragraphs

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("This browser can't process images");
  return { c, ctx };
}

const toJpeg = (c: HTMLCanvasElement, quality = 0.95) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", quality));

function analyse(src: CanvasImageSource, w: number, h: number): FormLayout {
  const aw = Math.min(ANALYSIS_WIDTH, w);
  const ah = Math.round((h * aw) / w);
  const { ctx } = canvas(aw, ah);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, aw, ah);
  ctx.drawImage(src, 0, 0, aw, ah);
  return detectForm(toGray(ctx.getImageData(0, 0, aw, ah).data, aw, ah), aw, ah);
}

async function fromPdf(file: File): Promise<FormPage[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const pages: FormPage[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(TARGET_WIDTH / base.width, MAX_SIDE / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const { c, ctx } = canvas(Math.round(viewport.width), Math.round(viewport.height));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvas: c, viewport }).promise;
      const blob = await toJpeg(c);
      pages.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${i}`,
        fileName: file.name,
        index: i,
        blob,
        url: URL.createObjectURL(blob),
        width: c.width,
        height: c.height,
        layout: analyse(c, c.width, c.height),
      });
      page.cleanup();
      c.width = c.height = 0; // free the pixels right away
    }
  } finally {
    await task.destroy();
  }
  return pages;
}

async function fromImage(file: File): Promise<FormPage[]> {
  const bmp = await createImageBitmap(file);
  try {
    let blob: Blob = file;
    if (file.type !== "image/jpeg") {
      const { c, ctx } = canvas(bmp.width, bmp.height);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(bmp, 0, 0);
      blob = await toJpeg(c);
    }
    return [
      {
        key: `${file.name}-${file.size}-${file.lastModified}-1`,
        fileName: file.name,
        index: 1,
        blob,
        url: URL.createObjectURL(blob),
        width: bmp.width,
        height: bmp.height,
        layout: analyse(bmp, bmp.width, bmp.height),
      },
    ];
  } finally {
    bmp.close();
  }
}

export const FORM_TYPES = ["application/pdf", "image/jpeg", "image/png"];

/** Opens a scanned PDF (every page) or image and finds the paragraphs on each page. */
export function loadFormPages(file: File): Promise<FormPage[]> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) return fromPdf(file);
  if (FORM_TYPES.includes(file.type)) return fromImage(file);
  return Promise.reject(new Error("Use PDF, JPEG or PNG"));
}

export interface Crop {
  blob: Blob;
  thumb: Blob | null;
  width: number;
  height: number;
}

/** Cuts one box out of the full-resolution page, plus a small preview for the grid. */
export async function cropPage(bmp: ImageBitmap, box: Box): Promise<Crop> {
  const sx = Math.max(0, Math.round(box.x * bmp.width));
  const sy = Math.max(0, Math.round(box.y * bmp.height));
  const w = Math.max(1, Math.min(bmp.width - sx, Math.round(box.w * bmp.width)));
  const h = Math.max(1, Math.min(bmp.height - sy, Math.round(box.h * bmp.height)));
  const { c, ctx } = canvas(w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, sx, sy, w, h, 0, 0, w, h);
  const blob = await toJpeg(c);
  const tw = Math.min(480, w);
  const th = Math.max(1, Math.round((h * tw) / w));
  const t = canvas(tw, th);
  t.ctx.drawImage(c, 0, 0, tw, th);
  const thumb = await toJpeg(t.c, 0.8).catch(() => null);
  c.width = c.height = 0;
  return { blob, thumb, width: w, height: h };
}
