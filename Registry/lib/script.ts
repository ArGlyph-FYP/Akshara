import "server-only";
import { cookies } from "next/headers";
import { listDatasets } from "./data";
import { initialDatasetId, type Dataset, type Script, type UserDoc } from "./types";

export const SCRIPT_COOKIE = "akshara_script";
/** The dataset chosen in the sidebar, remembered separately for Sinhala and Tamil. */
export const datasetCookie = (script: Script) => `akshara_dataset_${script}`;

/** The Sinhala/Tamil branch chosen in the sidebar switch (defaults to the user's first script). */
export async function currentScript(user?: UserDoc): Promise<Script> {
  const v = (await cookies()).get(SCRIPT_COOKIE)?.value;
  if (v === "si" || v === "ta") return v;
  return user?.scripts[0] ?? "si";
}

/** The dataset chosen in the sidebar for this script (defaults to the initial dataset), plus all of the script's datasets. */
export async function currentDataset(script: Script): Promise<{ dataset: Dataset; datasets: Dataset[] }> {
  const datasets = await listDatasets(script);
  const v = (await cookies()).get(datasetCookie(script))?.value;
  const dataset = datasets.find((d) => d.id === v) ?? datasets.find((d) => d.id === initialDatasetId(script)) ?? datasets[0];
  return { dataset, datasets };
}
