"use server";

import { revalidatePath } from "next/cache";
import { run, str } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { col, db } from "@/lib/data";
import type { SampleStatus } from "@/lib/types";

const STATUSES: SampleStatus[] = ["uploaded", "qc_ok", "rejected"];

export async function setStatus(_: unknown, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const status = str(fd, "status") as SampleStatus;
    if (!STATUSES.includes(status)) throw new Error("Bad status");
    const ids = str(fd, "ids").split(",").filter(Boolean);
    const batch = db().batch();
    for (const id of ids) batch.update(col.samples().doc(id), { status });
    await batch.commit();
    revalidatePath("/admin/samples");
    return ids.length > 1 ? `${ids.length} samples marked ${status}` : undefined;
  });
}

export async function setAnchor(_: unknown, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const id = str(fd, "id");
    const isAnchor = str(fd, "isAnchor") === "1";
    const n = (k: string) => (str(fd, k) === "" ? null : Number(str(fd, k)));
    await col.samples().doc(id).update({
      isAnchor,
      anchorScores: isAnchor ? { overall: n("overall"), legibility: n("legibility"), note: str(fd, "note") } : null,
    });
    revalidatePath(`/admin/samples/${id}`);
    revalidatePath("/admin/samples");
    return isAnchor ? "Saved as calibration anchor" : "No longer an anchor";
  });
}
