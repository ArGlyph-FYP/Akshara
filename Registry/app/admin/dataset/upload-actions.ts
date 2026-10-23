"use server";

import { revalidatePath } from "next/cache";
import { run } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { newId, newWriterId, normaliseCode, sampleLabel } from "@/lib/codes";
import { col, db } from "@/lib/data";
import { ACCEPTED_TYPES } from "@/lib/filenames";
import { adminBucket, storageEmulated } from "@/lib/firebase/admin";
import { SCRIPTS, type Participant, type Phase, type Sample, type Script } from "@/lib/types";

const MAX_BYTES = 25 * 1024 * 1024;

export interface ScanMeta {
  code: string;
  pageNo: number;
  contentType: string;
  size: number;
  width: number;
  height: number;
  register: boolean;
  replace: boolean;
  phase: Phase;
  /** Paragraph number when a form page is split (1, 2, …); omitted for a whole page. */
  part?: number | null;
  /** Where this crop sits on the original page, as fractions (0–1). */
  crop?: { x: number; y: number; w: number; h: number } | null;
  /** Original page saved with preparePage(). */
  pageId?: string | null;
}

const ID_RE = /^[0-9a-z]{16}$/;

function cleanPart(meta: ScanMeta) {
  const part = meta.part == null ? null : Number(meta.part);
  if (part !== null && !(Number.isInteger(part) && part >= 1 && part <= 9)) throw new Error("Bad paragraph number");
  let crop: ScanMeta["crop"] = null;
  if (meta.crop) {
    const { x, y, w, h } = meta.crop;
    const ok = [x, y, w, h].every((v) => typeof v === "number" && v >= 0 && v <= 1) && w > 0 && h > 0;
    if (!ok) throw new Error("Bad crop box");
    crop = { x, y, w, h };
  }
  const pageId = meta.pageId ?? null;
  if (pageId !== null && !ID_RE.test(pageId)) throw new Error("Bad page id");
  return { part, crop, pageId };
}

/** Checks a planned upload. Registers nothing and writes nothing. */
async function check(meta: ScanMeta) {
  const ext = ACCEPTED_TYPES[meta.contentType];
  if (!ext) throw new Error("Only JPEG or PNG scans are accepted");
  if (!(meta.size > 0) || meta.size > MAX_BYTES) throw new Error("File must be under 25 MB");
  if (!(meta.width > 0 && meta.height > 0)) throw new Error("Could not read the image size");
  const parsed = normaliseCode(meta.code);
  if (!parsed) throw new Error("Invalid code");
  const pageNo = Math.max(1, Math.floor(Number(meta.pageNo) || 1));
  const { part, crop, pageId } = cleanPart(meta);
  const label = sampleLabel({ code: parsed.code, pageNo, part });

  const participant = (await col.participants().doc(parsed.code).get()).data() as Participant | undefined;
  if (!participant && !meta.register) throw new Error(`${parsed.code} is not registered`);
  if (participant?.status === "withdrawn") throw new Error(`${parsed.code} has withdrawn`);
  if (participant && !participant.consentReceivedAt) throw new Error(`Consent not recorded for ${parsed.code}`);

  // Older samples have no `part` field, so match it here rather than in the query.
  const existing = await col.samples().where("participantCode", "==", parsed.code).where("pageNo", "==", pageNo).get();
  const old = existing.docs.find((d) => ((d.data().part as number | null | undefined) ?? null) === part);
  if (old) {
    if (!meta.replace) throw new Error(`${label} already uploaded`);
    const rated = await col.ratings().where("sampleId", "==", old.id).limit(1).get();
    if (!rated.empty) throw new Error(`${label} already has ratings; can't replace`);
  }
  return { ext, parsed, pageNo, part, crop, pageId, participant, old };
}

/** After the file is in Storage: registers the code if asked, replaces the old page, writes the sample. */
async function finalize(meta: ScanMeta, id: string, uploadedBy: string) {
  const { ext, parsed, pageNo, part, crop, pageId, old } = await check(meta);
  const imagePath = `scans/${parsed.script}/${id}.${ext}`;
  const [exists] = await adminBucket().file(imagePath).exists();
  if (!exists) throw new Error("Upload did not reach storage; try again");
  const thumbPath = thumbPathFor(parsed.script, id);
  const [hasThumb] = await adminBucket().file(thumbPath).exists();
  const sourcePath = pageId ? pagePathFor(parsed.script, pageId) : null;
  if (sourcePath) {
    const [hasPage] = await adminBucket().file(sourcePath).exists();
    if (!hasPage) throw new Error("The original page did not reach storage; try again");
  }

  const pRef = col.participants().doc(parsed.code);
  let participant = (await pRef.get()).data() as Participant | undefined;
  if (!participant) {
    participant = {
      code: parsed.code,
      script: parsed.script,
      phase: meta.phase === "pilot" ? "pilot" : "main",
      consentReceivedAt: Date.now(),
      consentVerifiedBy: uploadedBy,
      status: "active",
      withdrawnAt: null,
      writerId: newWriterId(),
      notes: "Registered during bulk upload",
      createdAt: Date.now(),
    };
    const p = participant;
    await db().runTransaction(async (tx) => {
      const counterRef = col.counters().doc(parsed.script);
      const next = ((await tx.get(counterRef)).data()?.nextNumber as number | undefined) ?? 1;
      tx.set(pRef, p);
      if (parsed.number >= next) tx.set(counterRef, { nextNumber: parsed.number + 1 }, { merge: true });
    });
  }

  if (old) {
    for (const key of ["imagePath", "thumbPath"] as const) {
      const p = old.data()[key] as string | null | undefined;
      if (p && p !== imagePath && p !== thumbPath) await adminBucket().file(p).delete({ ignoreNotFound: true });
    }
    await old.ref.delete();
    // The original page is shared by its paragraphs; delete it only when nothing else uses it.
    const oldSource = old.data().sourcePath as string | null | undefined;
    if (oldSource && oldSource !== sourcePath) {
      const users = await col.samples().where("sourcePath", "==", oldSource).limit(1).get();
      if (users.empty) await adminBucket().file(oldSource).delete({ ignoreNotFound: true });
    }
  }

  const sample: Omit<Sample, "id"> = {
    participantCode: parsed.code,
    writerId: participant.writerId,
    script: participant.script,
    phase: participant.phase,
    pageNo,
    part,
    sourcePath,
    crop,
    imagePath,
    thumbPath: hasThumb ? thumbPath : null,
    contentType: meta.contentType,
    width: Math.round(meta.width),
    height: Math.round(meta.height),
    status: "uploaded",
    isAnchor: false,
    anchorScores: null,
    uploadedAt: Date.now(),
    uploadedBy,
  };
  await col.samples().doc(id).set(sample);
  revalidatePath("/admin/dataset");
}

const thumbPathFor = (script: string, id: string) => `scans/${script}/${id}_thumb.jpg`;
const pagePathFor = (script: string, pageId: string) => `scans/${script}/pages/${pageId}.jpg`;

/**
 * Step 1: validate and get a short-lived signed URL so the browser uploads straight to Storage.
 * (Hosting platforms like Vercel cap request bodies at ~4.5 MB, so scans never pass through the server.)
 * On the emulator, signed URLs aren't available, so the page falls back to uploadScanDirect.
 */
export async function prepareUpload(
  meta: ScanMeta,
): Promise<{ error?: string; id?: string; url?: string; thumbUrl?: string; direct?: boolean }> {
  try {
    await assertAdmin();
    const { ext, parsed } = await check(meta);
    const id = newId();
    if (storageEmulated()) return { id, direct: true };
    const expires = Date.now() + 15 * 60 * 1000;
    const [[url], [thumbUrl]] = await Promise.all([
      adminBucket()
        .file(`scans/${parsed.script}/${id}.${ext}`)
        .getSignedUrl({ version: "v4", action: "write", expires, contentType: meta.contentType }),
      adminBucket()
        .file(thumbPathFor(parsed.script, id))
        .getSignedUrl({ version: "v4", action: "write", expires, contentType: "image/jpeg" }),
    ]);
    return { id, url, thumbUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Step 2: after the browser's PUT succeeded. */
export async function completeUpload(meta: ScanMeta, id: string) {
  return run(async () => {
    const s = await assertAdmin();
    if (!ID_RE.test(id)) throw new Error("Bad upload id");
    await finalize(meta, id, s.user.email);
  });
}

/** Emulator only: the file comes through the server action. */
export async function uploadScanDirect(meta: ScanMeta, id: string, fd: FormData) {
  return run(async () => {
    const s = await assertAdmin();
    if (!storageEmulated()) throw new Error("Direct upload is only for the local emulator");
    if (!ID_RE.test(id)) throw new Error("Bad upload id");
    const file = fd.get("file");
    if (!(file instanceof File)) throw new Error("No file");
    const { ext, parsed } = await check(meta);
    await adminBucket()
      .file(`scans/${parsed.script}/${id}.${ext}`)
      .save(Buffer.from(await file.arrayBuffer()), { contentType: meta.contentType, resumable: false });
    const thumb = fd.get("thumb");
    if (thumb instanceof File) {
      await adminBucket()
        .file(thumbPathFor(parsed.script, id))
        .save(Buffer.from(await thumb.arrayBuffer()), { contentType: "image/jpeg", resumable: false });
    }
    await finalize(meta, id, s.user.email);
  });
}

/**
 * Split forms: stores the original page (JPEG) once, before its paragraphs are uploaded with `pageId`.
 * Returns a signed URL for the browser to PUT to, or `direct` on the emulator (then call uploadPageDirect).
 */
export async function preparePage(script: Script, size: number): Promise<{ error?: string; pageId?: string; url?: string; direct?: boolean }> {
  try {
    await assertAdmin();
    if (!SCRIPTS.includes(script)) throw new Error("Bad script");
    if (!(size > 0) || size > MAX_BYTES) throw new Error("Page must be under 25 MB");
    const pageId = newId();
    if (storageEmulated()) return { pageId, direct: true };
    const [url] = await adminBucket()
      .file(pagePathFor(script, pageId))
      .getSignedUrl({ version: "v4", action: "write", expires: Date.now() + 15 * 60 * 1000, contentType: "image/jpeg" });
    return { pageId, url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Emulator only: the original page comes through the server action. */
export async function uploadPageDirect(script: Script, pageId: string, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    if (!storageEmulated()) throw new Error("Direct upload is only for the local emulator");
    if (!SCRIPTS.includes(script)) throw new Error("Bad script");
    if (!ID_RE.test(pageId)) throw new Error("Bad page id");
    const file = fd.get("file");
    if (!(file instanceof File)) throw new Error("No file");
    if (file.size > MAX_BYTES) throw new Error("Page must be under 25 MB");
    await adminBucket()
      .file(pagePathFor(script, pageId))
      .save(Buffer.from(await file.arrayBuffer()), { contentType: "image/jpeg", resumable: false });
  });
}
