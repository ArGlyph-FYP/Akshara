"use server";

import { revalidatePath } from "next/cache";
import { num, run, str, type ActionResult } from "@/lib/action";
import { planAssignments } from "@/lib/assign";
import { assertAdmin } from "@/lib/auth";
import { newId } from "@/lib/codes";
import { col, db, eligibleForRating, getSettings, listAssignments } from "@/lib/data";
import type { Assignment, Script } from "@/lib/types";

function scale(fd: FormData, prefix: string) {
  const min = num(fd, `${prefix}Min`);
  const max = num(fd, `${prefix}Max`);
  if (max <= min) throw new Error(`${prefix}: max must be above min`);
  return { min, max };
}

export async function saveSettings(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const ratersPerSample = num(fd, "ratersPerSample");
    const repeatPct = num(fd, "repeatPct");
    if (ratersPerSample < 1 || ratersPerSample > 20) throw new Error("Raters per sample must be 1–20");
    if (repeatPct < 0 || repeatPct > 50) throw new Error("Repeats must be 0–50%");
    await col.settings().set(
      {
        ratersPerSample,
        repeatFraction: repeatPct / 100,
        overallScale: scale(fd, "overall"),
        legibilityScale: scale(fd, "legibility"),
        surveyScale: scale(fd, "survey"),
      },
      { merge: true },
    );
    revalidatePath("/admin/assignments");
    return "Settings saved";
  });
}

export async function generate(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const script = str(fd, "script") as Script;
    if (script !== "si" && script !== "ta") throw new Error("Bad script");
    const [settings, { ready, raters }, existing] = await Promise.all([
      getSettings(),
      eligibleForRating(script),
      listAssignments({ script }),
    ]);
    const { assignments, warnings } = planAssignments({
      samples: ready.map((s) => ({ id: s.id, isAnchor: s.isAnchor })),
      raterIds: raters.map((r) => r.uid),
      existing,
      ratersPerSample: settings.ratersPerSample,
      repeatFraction: settings.repeatFraction,
      seed: `${script}-${Date.now()}`,
    });
    const now = Date.now();
    for (let i = 0; i < assignments.length; i += 450) {
      const batch = db().batch();
      for (const a of assignments.slice(i, i + 450)) {
        const doc: Omit<Assignment, "id"> = { ...a, script, status: "pending", createdAt: now };
        batch.set(col.assignments().doc(newId()), doc);
      }
      await batch.commit();
    }
    revalidatePath("/admin/assignments");
    const parts = [`Created ${assignments.length} assignment(s).`, ...warnings];
    return parts.join(" ");
  });
}

/** Deletes a rater's unfinished items for a script, e.g. if they drop out. */
export async function clearPending(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const raterId = str(fd, "raterId");
    const script = str(fd, "script") as Script;
    const pending = (await listAssignments({ raterId, script })).filter((a) => a.status === "pending");
    for (let i = 0; i < pending.length; i += 450) {
      const batch = db().batch();
      pending.slice(i, i + 450).forEach((a) => batch.delete(col.assignments().doc(a.id)));
      await batch.commit();
    }
    revalidatePath("/admin/assignments");
    return `Removed ${pending.length} pending item(s). Run "Generate" to reassign their samples.`;
  });
}
