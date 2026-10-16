"use server";

import { revalidatePath } from "next/cache";
import { run } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { newId, newWriterId, normaliseCode } from "@/lib/codes";
import { col, db } from "@/lib/data";
import { ACCEPTED_TYPES } from "@/lib/filenames";
import { adminBucket, storageEmulated } from "@/lib/firebase/admin";
import type { Participant, Phase, Sample } from "@/lib/types";

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

  const participant = (await col.participants().doc(parsed.code).get()).data() as Participant | undefined;
  if (!participant && !meta.register) throw new Error(`${parsed.code} is not registered`);
  if (participant?.status === "withdrawn") throw new Error(`${parsed.code} has withdrawn`);
  if (participant && !participant.consentReceivedAt) throw new Error(`Consent not recorded for ${parsed.code}`);

  const existing = await col.samples().where("participantCode", "==", parsed.code).where("pageNo", "==", pageNo).get();
  const old = existing.docs[0];
  if (old) {
    if (!meta.replace) throw new Error(`${parsed.code} page ${pageNo} already uploaded`);
    const rated = await col.ratings().where("sampleId", "==", old.id).limit(1).get();
    if (!rated.empty) throw new Error(`${parsed.code} page ${pageNo} already has ratings; can't replace`);
  }
  return { ext, parsed, pageNo, participant, old };
}

/** After the file is in Storage: registers the code if asked, replaces the old page, writes the sample. */
async function finalize(meta: ScanMeta, id: string, uploadedBy: string) {
  const { ext, parsed, pageNo, old } = await check(meta);
  const imagePath = `scans/${parsed.script}/${id}.${ext}`;
  const [exists] = await adminBucket().file(imagePath).exists();
  if (!exists) throw new Error("Upload did not reach storage; try again");

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
    const oldPath = old.data().imagePath as string | null;
    if (oldPath && oldPath !== imagePath) await adminBucket().file(oldPath).delete({ ignoreNotFound: true });
    await old.ref.delete();
  }

  const sample: Omit<Sample, "id"> = {
    participantCode: parsed.code,
    writerId: participant.writerId,
    script: participant.script,
    phase: participant.phase,
    pageNo,
    imagePath,
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
  revalidatePath("/admin/samples");
}

/**
 * Step 1: validate and get a short-lived signed URL so the browser uploads straight to Storage.
 * (Hosting platforms like Vercel cap request bodies at ~4.5 MB, so scans never pass through the server.)
 * On the emulator, signed URLs aren't available, so the page falls back to uploadScanDirect.
 */
export async function prepareUpload(meta: ScanMeta): Promise<{ error?: string; id?: string; url?: string; direct?: boolean }> {
  try {
    await assertAdmin();
    const { ext, parsed } = await check(meta);
    const id = newId();
    if (storageEmulated()) return { id, direct: true };
    const [url] = await adminBucket()
      .file(`scans/${parsed.script}/${id}.${ext}`)
      .getSignedUrl({ version: "v4", action: "write", expires: Date.now() + 15 * 60 * 1000, contentType: meta.contentType });
    return { id, url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Step 2: after the browser's PUT succeeded. */
export async function completeUpload(meta: ScanMeta, id: string) {
  return run(async () => {
    const s = await assertAdmin();
    if (!/^[0-9a-z]{16}$/.test(id)) throw new Error("Bad upload id");
    await finalize(meta, id, s.user.email);
  });
}

/** Emulator only: the file comes through the server action. */
export async function uploadScanDirect(meta: ScanMeta, id: string, fd: FormData) {
  return run(async () => {
    const s = await assertAdmin();
    if (!storageEmulated()) throw new Error("Direct upload is only for the local emulator");
    if (!/^[0-9a-z]{16}$/.test(id)) throw new Error("Bad upload id");
    const file = fd.get("file");
    if (!(file instanceof File)) throw new Error("No file");
    const { ext, parsed } = await check(meta);
    await adminBucket()
      .file(`scans/${parsed.script}/${id}.${ext}`)
      .save(Buffer.from(await file.arrayBuffer()), { contentType: meta.contentType, resumable: false });
    await finalize(meta, id, s.user.email);
  });
}
