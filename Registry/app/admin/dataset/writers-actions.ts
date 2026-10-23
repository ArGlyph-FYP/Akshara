"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { run, str, num, type ActionResult } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { formatCode, newWriterId, normaliseCode } from "@/lib/codes";
import { col, db, listStudies } from "@/lib/data";
import { adminBucket } from "@/lib/firebase/admin";
import type { Participant, Phase, Script } from "@/lib/types";

function phaseOf(v: string): Phase {
  if (v !== "pilot" && v !== "main") throw new Error("Choose a phase");
  return v;
}

function newParticipant(code: string, script: Script, phase: Phase, consentBy: string | null): Participant {
  const now = Date.now();
  return {
    code,
    script,
    phase,
    consentReceivedAt: consentBy ? now : null,
    consentVerifiedBy: consentBy,
    status: "active",
    withdrawnAt: null,
    writerId: newWriterId(),
    notes: "",
    createdAt: now,
  };
}

export async function issueCodes(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const script = str(fd, "script") as Script;
    if (script !== "si" && script !== "ta") throw new Error("Choose a script");
    const phase = phaseOf(str(fd, "phase"));
    const count = num(fd, "count");
    if (count < 1 || count > 200) throw new Error("Issue between 1 and 200 codes at a time");

    const issued = await db().runTransaction(async (tx) => {
      const counterRef = col.counters().doc(script);
      let next = ((await tx.get(counterRef)).data()?.nextNumber as number | undefined) ?? 1;
      const codes: string[] = [];
      while (codes.length < count) {
        const code = formatCode(script, next++);
        if (!(await tx.get(col.participants().doc(code))).exists) codes.push(code);
      }
      for (const code of codes) tx.set(col.participants().doc(code), newParticipant(code, script, phase, null));
      tx.set(counterRef, { nextNumber: next }, { merge: true });
      return codes;
    });
    revalidatePath("/admin/dataset");
    return `Issued ${issued[0]} – ${issued[issued.length - 1]}`;
  });
}

export async function registerCode(_: ActionResult, fd: FormData) {
  return run(async () => {
    const s = await assertAdmin();
    const parsed = normaliseCode(str(fd, "code"));
    if (!parsed) throw new Error("Codes look like SI-001 or TA-014");
    const phase = phaseOf(str(fd, "phase"));
    const consent = fd.get("consent") === "on";
    await db().runTransaction(async (tx) => {
      const ref = col.participants().doc(parsed.code);
      if ((await tx.get(ref)).exists) throw new Error(`${parsed.code} already exists`);
      const counterRef = col.counters().doc(parsed.script);
      const next = ((await tx.get(counterRef)).data()?.nextNumber as number | undefined) ?? 1;
      tx.set(ref, newParticipant(parsed.code, parsed.script, phase, consent ? s.user.email : null));
      if (parsed.number >= next) tx.set(counterRef, { nextNumber: parsed.number + 1 }, { merge: true });
    });
    revalidatePath("/admin/dataset");
    return `Registered ${parsed.code}`;
  });
}

export async function setConsent(_: ActionResult, fd: FormData) {
  return run(async () => {
    const s = await assertAdmin();
    const code = str(fd, "code");
    const received = str(fd, "received") === "1";
    await col.participants().doc(code).update({
      consentReceivedAt: received ? Date.now() : null,
      consentVerifiedBy: received ? s.user.email : null,
    });
    revalidatePath("/admin/dataset");
  });
}

export async function setPhase(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const code = str(fd, "code");
    const phase = phaseOf(str(fd, "phase"));
    const batch = db().batch();
    batch.update(col.participants().doc(code), { phase });
    const samples = await col.samples().where("participantCode", "==", code).get();
    samples.docs.forEach((d) => batch.update(d.ref, { phase }));
    await batch.commit();
    revalidatePath("/admin/dataset");
  });
}

export async function saveNotes(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    await col.participants().doc(str(fd, "code")).update({ notes: str(fd, "notes").slice(0, 500) });
    revalidatePath("/admin/dataset");
    return "Saved";
  });
}

/** Withdrawal: exclude samples and drop their pending rating work. Files stay until purged. */
export async function withdraw(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const code = str(fd, "code");
    const samples = await col.samples().where("participantCode", "==", code).get();
    const batch = db().batch();
    batch.update(col.participants().doc(code), { status: "withdrawn", withdrawnAt: Date.now() });
    for (const s of samples.docs) {
      batch.update(s.ref, { status: "excluded" });
      const pending = await col.assignments().where("sampleId", "==", s.id).where("status", "==", "pending").get();
      pending.docs.forEach((a) => batch.delete(a.ref));
    }
    await batch.commit();
    revalidatePath("/admin/dataset");
    return `${code} withdrawn. Their samples are excluded from rating and exports.`;
  });
}

export async function reinstate(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const code = str(fd, "code");
    const p = (await col.participants().doc(code).get()).data() as Participant | undefined;
    if (!p) throw new Error("Not found");
    const samples = await col.samples().where("participantCode", "==", code).get();
    const batch = db().batch();
    batch.update(col.participants().doc(code), { status: "active", withdrawnAt: null });
    samples.docs.filter((d) => d.data().imagePath).forEach((d) => batch.update(d.ref, { status: "uploaded" }));
    await batch.commit();
    revalidatePath("/admin/dataset");
  });
}

/** Permanently deletes a withdrawn participant's scans, ratings and survey responses. */
export async function purge(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const code = str(fd, "code");
    const p = (await col.participants().doc(code).get()).data() as Participant | undefined;
    if (p?.status !== "withdrawn") throw new Error("Withdraw the participant first");
    const samples = await col.samples().where("participantCode", "==", code).get();
    const studies = await listStudies();
    const bucket = adminBucket();
    for (const s of samples.docs) {
      for (const key of ["imagePath", "thumbPath", "sourcePath"]) {
        const path = s.data()[key] as string | null | undefined;
        if (path) await bucket.file(path).delete({ ignoreNotFound: true });
      }
      const batch = db().batch();
      (await col.ratings().where("sampleId", "==", s.id).get()).docs.forEach((d) => batch.delete(d.ref));
      (await col.assignments().where("sampleId", "==", s.id).get()).docs.forEach((d) => batch.delete(d.ref));
      for (const st of studies) {
        if (st.sampleIds.includes(s.id)) batch.update(col.studies().doc(st.id), { sampleIds: FieldValue.arrayRemove(s.id) });
      }
      batch.delete(s.ref);
      await batch.commit();
    }
    await col.participants().doc(code).update({ notes: `Data purged ${new Date().toISOString().slice(0, 10)}` });
    revalidatePath("/admin/dataset");
    return `Deleted ${samples.size} scan(s) and all their ratings for ${code}.`;
  });
}
