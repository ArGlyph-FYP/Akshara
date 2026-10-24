"use server";

import { revalidatePath } from "next/cache";
import { num, run, str, type ActionResult } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { newId } from "@/lib/codes";
import { col, db, getSettings, listCriteria } from "@/lib/data";
import { CRITERIA as SI_CRITERIA } from "@/lib/rubric/si";
import { LEVELS, type Criterion, type Level, type Script } from "@/lib/types";

function script(fd: FormData): Script {
  const s = str(fd, "script");
  if (s !== "si" && s !== "ta") throw new Error("Bad script");
  return s;
}

function fields(fd: FormData) {
  const key = str(fd, "key").toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  if (!key) throw new Error("Key is required (e.g. baseline_alignment)");
  const level = str(fd, "level") as Level;
  if (!LEVELS.includes(level)) throw new Error("Pick a level");
  const scaleMin = num(fd, "scaleMin", 1);
  const scaleMax = num(fd, "scaleMax", 5);
  if (scaleMax <= scaleMin) throw new Error("Scale max must be above min");
  return {
    key,
    labelEn: str(fd, "labelEn") || key,
    labelLocal: str(fd, "labelLocal"),
    description: str(fd, "description"),
    level,
    scaleMin,
    scaleMax,
    order: num(fd, "order", 0),
  };
}

export async function addCriterion(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const sc = script(fd);
    const version = (await getSettings()).rubricVersion[sc];
    const f = fields(fd);
    const dup = (await listCriteria(sc)).some((c) => c.rubricVersion === version && c.key === f.key);
    if (dup) throw new Error(`"${f.key}" already exists in v${version}`);
    const c: Omit<Criterion, "id"> = { script: sc, rubricVersion: version, active: true, ...f };
    await col.criteria().doc(newId()).set(c);
    revalidatePath("/admin/main");
    return `Added ${f.key}`;
  });
}

export async function updateCriterion(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const id = str(fd, "id");
    const used = await col.ratings().where(`criterionScores.${id}`, ">=", -1e9).limit(1).get();
    const f = fields(fd);
    const prev = (await col.criteria().doc(id).get()).data() as Criterion;
    if (!used.empty && (f.key !== prev.key || f.scaleMin !== prev.scaleMin || f.scaleMax !== prev.scaleMax)) {
      throw new Error("Already used in ratings: only labels, description, order and active can change. Start a new rubric version instead.");
    }
    await col.criteria().doc(id).update({ ...f, active: str(fd, "active") === "1" });
    revalidatePath("/admin/main");
    return "Saved";
  });
}

/** Starts rubric version N+1 for a script, copying the active criteria of the current version. */
export async function newRubricVersion(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const sc = script(fd);
    const settings = await getSettings();
    const current = settings.rubricVersion[sc];
    const next = current + 1;
    const toCopy = (await listCriteria(sc, true)).filter((c) => c.rubricVersion === current);
    const batch = db().batch();
    for (const c of toCopy) {
      const { id: _id, ...rest } = c;
      void _id;
      batch.set(col.criteria().doc(newId()), { ...rest, rubricVersion: next });
    }
    batch.set(col.settings(), { rubricVersion: { ...settings.rubricVersion, [sc]: next } }, { merge: true });
    await batch.commit();
    revalidatePath("/admin/main");
    return `Now on v${next} (${toCopy.length} criteria copied). Raters see v${next} from their next item.`;
  });
}

/**
 * Starts rubric version N+1 with exactly the eight Rubric v1 criteria (A1–A8, 1–10 each).
 * The Sinhala form text (what to look for, band descriptions) is matched to them by key (a1…a8).
 */
export async function applyAksharaRubric(_: ActionResult, fd: FormData) {
  return run(async () => {
    await assertAdmin();
    const sc = script(fd);
    const settings = await getSettings();
    const next = settings.rubricVersion[sc] + 1;
    const batch = db().batch();
    SI_CRITERIA.forEach((c, i) => {
      const doc: Omit<Criterion, "id"> = {
        script: sc,
        rubricVersion: next,
        key: c.key,
        labelEn: `${c.code} ${c.labelEn}`,
        labelLocal: sc === "si" ? c.label : "",
        description: sc === "si" ? c.lookFor : "",
        level: "paragraph",
        scaleMin: 1,
        scaleMax: 10,
        active: true,
        order: i + 1,
      };
      batch.set(col.criteria().doc(newId()), doc);
    });
    batch.set(col.settings(), { rubricVersion: { ...settings.rubricVersion, [sc]: next } }, { merge: true });
    await batch.commit();
    revalidatePath("/admin/main");
    return `Now on v${next} with A1–A8 (1–10). New surveys use it; existing surveys keep their version.`;
  });
}
