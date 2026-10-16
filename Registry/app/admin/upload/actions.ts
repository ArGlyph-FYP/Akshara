"use server";

import { revalidatePath } from "next/cache";
import { run, str, num } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { newId, newWriterId, normaliseCode } from "@/lib/codes";
import { col, db } from "@/lib/data";
import { ACCEPTED_TYPES } from "@/lib/filenames";
import { adminBucket } from "@/lib/firebase/admin";
import type { Participant, Phase, Sample } from "@/lib/types";

const MAX_BYTES = 25 * 1024 * 1024;

/** Uploads one scan. Called once per file by the upload page. */
export async function uploadScan(fd: FormData) {
  return run(async () => {
    const s = await assertAdmin();
    const file = fd.get("file");
    if (!(file instanceof File)) throw new Error("No file");
    const ext = ACCEPTED_TYPES[file.type];
    if (!ext) throw new Error("Only JPEG or PNG scans are accepted");
    if (file.size > MAX_BYTES) throw new Error("File is larger than 25 MB");

    const parsed = normaliseCode(str(fd, "code"));
    if (!parsed) throw new Error("Invalid code");
    const pageNo = num(fd, "pageNo", 1);
    const width = num(fd, "width");
    const height = num(fd, "height");
    const replace = str(fd, "replace") === "1";
    const register = str(fd, "register") === "1";
    const phase = (str(fd, "phase") || "main") as Phase;

    const pRef = col.participants().doc(parsed.code);
    let participant = (await pRef.get()).data() as Participant | undefined;
    if (!participant) {
      if (!register) throw new Error(`${parsed.code} is not registered`);
      participant = {
        code: parsed.code,
        script: parsed.script,
        phase,
        consentReceivedAt: Date.now(),
        consentVerifiedBy: s.user.email,
        status: "active",
        withdrawnAt: null,
        writerId: newWriterId(),
        notes: "Registered during bulk upload",
        createdAt: Date.now(),
      };
      await pRef.set(participant);
      const counterRef = col.counters().doc(parsed.script);
      await db().runTransaction(async (tx) => {
        const next = ((await tx.get(counterRef)).data()?.nextNumber as number | undefined) ?? 1;
        if (parsed.number >= next) tx.set(counterRef, { nextNumber: parsed.number + 1 }, { merge: true });
      });
    }
    if (participant.status === "withdrawn") throw new Error(`${parsed.code} has withdrawn`);
    if (!participant.consentReceivedAt) throw new Error(`Consent not recorded for ${parsed.code}`);

    const existing = await col.samples().where("participantCode", "==", parsed.code).where("pageNo", "==", pageNo).get();
    let id = newId();
    if (!existing.empty) {
      if (!replace) throw new Error(`${parsed.code} page ${pageNo} already uploaded`);
      id = existing.docs[0].id;
      const rated = await col.ratings().where("sampleId", "==", id).limit(1).get();
      if (!rated.empty) throw new Error(`${parsed.code} page ${pageNo} already has ratings; can't replace`);
      const old = existing.docs[0].data().imagePath as string | null;
      if (old) await adminBucket().file(old).delete({ ignoreNotFound: true });
    }

    const imagePath = `scans/${parsed.script}/${id}.${ext}`;
    await adminBucket()
      .file(imagePath)
      .save(Buffer.from(await file.arrayBuffer()), { contentType: file.type, resumable: false });

    const sample: Omit<Sample, "id"> = {
      participantCode: parsed.code,
      writerId: participant.writerId,
      script: participant.script,
      phase: participant.phase,
      pageNo,
      imagePath,
      contentType: file.type,
      width,
      height,
      status: "uploaded",
      isAnchor: false,
      anchorScores: null,
      uploadedAt: Date.now(),
      uploadedBy: s.user.email,
    };
    await col.samples().doc(id).set(sample);
    revalidatePath("/admin/samples");
    return `${parsed.code} p${pageNo}`;
  });
}
