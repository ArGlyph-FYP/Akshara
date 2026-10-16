"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { run, str, type ActionResult } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { newId, newShareToken } from "@/lib/codes";
import { col, getSurvey, listSamples } from "@/lib/data";
import type { Script, Survey } from "@/lib/types";

export async function createSurvey(_: ActionResult, fd: FormData) {
  const res = await run(async () => {
    await assertAdmin();
    const script = str(fd, "script") as Script;
    if (script !== "si" && script !== "ta") throw new Error("Choose a script");
    const title = str(fd, "title");
    if (!title) throw new Error("Give the survey a title");
    const id = newId();
    const survey: Omit<Survey, "id"> = {
      script,
      title,
      instructions: str(fd, "instructions"),
      shareToken: newShareToken(),
      open: false,
      sampleIds: [],
      createdAt: Date.now(),
    };
    await col.surveys().doc(id).set(survey);
    return id;
  });
  if (res?.ok && res.message) redirect(`/admin/surveys/${res.message}`);
  return res;
}

export async function updateSurvey(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const id = str(fd, "id");
    const survey = await getSurvey(id);
    if (!survey) throw new Error("Survey not found");
    const wanted = fd.getAll("sampleIds").map(String);
    // Only pilot samples of the survey's script that passed or await QC, so the survey never leaks main-phase data.
    const allowed = new Set(
      (await listSamples({ script: survey.script, phase: "pilot" }))
        .filter((s) => s.status === "uploaded" || s.status === "qc_ok")
        .map((s) => s.id),
    );
    const sampleIds = wanted.filter((x) => allowed.has(x));
    await col.surveys().doc(id).update({
      title: str(fd, "title") || survey.title,
      instructions: str(fd, "instructions"),
      sampleIds,
    });
    revalidatePath(`/admin/surveys/${id}`);
    return `Saved (${sampleIds.length} samples)`;
  });
}

export async function setSurveyOpen(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const id = str(fd, "id");
    const open = str(fd, "open") === "1";
    const survey = await getSurvey(id);
    if (open && !survey?.sampleIds.length) throw new Error("Add samples before opening the survey");
    await col.surveys().doc(id).update({ open });
    revalidatePath(`/admin/surveys/${id}`);
    revalidatePath("/admin/surveys");
  });
}
