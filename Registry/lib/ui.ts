import type { SampleStatus } from "./types";

export const STATUS_STYLE: Record<SampleStatus, string> = {
  uploaded: "bg-stone-100 text-stone-700",
  qc_ok: "bg-emerald-50 text-emerald-800",
  rejected: "bg-amber-50 text-amber-800",
  excluded: "bg-red-50 text-red-700",
};

export const day = (t: number | null | undefined) => (t ? new Date(t).toISOString().slice(0, 10) : "");
