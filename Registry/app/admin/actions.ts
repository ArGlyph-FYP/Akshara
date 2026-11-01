"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { newId } from "@/lib/codes";
import { col, getDataset, listDatasets } from "@/lib/data";
import { datasetCookie, SCRIPT_COOKIE } from "@/lib/script";
import type { Dataset, Script } from "@/lib/types";

type Result<T = object> = ({ ok: true } & T) | { ok?: false; error: string };

const YEAR = 60 * 60 * 24 * 365;

export async function setScript(script: string) {
  await assertAdmin();
  if (script !== "si" && script !== "ta") return;
  (await cookies()).set(SCRIPT_COOKIE, script, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/admin", "layout");
}

async function remember(d: Pick<Dataset, "id" | "script">) {
  (await cookies()).set(datasetCookie(d.script), d.id, { path: "/", maxAge: YEAR, sameSite: "lax" });
}

/** Chooses the dataset the admin pages show for its script. */
export async function setDataset(id: string): Promise<Result> {
  await assertAdmin();
  const d = await getDataset(String(id));
  if (!d) return { error: "Dataset not found" };
  await remember(d);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** A dataset name: 1–80 characters, not already used by another dataset of the same script. */
async function cleanName(script: Script, raw: unknown, except?: string): Promise<string> {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!name) throw new Error("Give the dataset a name");
  const taken = (await listDatasets(script)).some((d) => d.id !== except && d.name.toLowerCase() === name.toLowerCase());
  if (taken) throw new Error(`There is already a dataset called "${name}"`);
  return name;
}

/** Creates an empty dataset for a script and switches to it. */
export async function createDataset(script: Script, name: string): Promise<Result<{ id: string }>> {
  try {
    const s = await assertAdmin();
    if (script !== "si" && script !== "ta") throw new Error("Choose Sinhala or Tamil");
    const doc: Omit<Dataset, "id"> = { script, name: await cleanName(script, name), createdAt: Date.now(), createdBy: s.user.email };
    const id = newId();
    await col.datasets().doc(id).set(doc);
    await remember({ id, script });
    revalidatePath("/admin", "layout");
    return { ok: true, id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function renameDataset(id: string, name: string): Promise<Result> {
  try {
    await assertAdmin();
    const d = await getDataset(String(id));
    if (!d) throw new Error("Dataset not found");
    await col.datasets().doc(d.id).update({ name: await cleanName(d.script, name, d.id) });
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
