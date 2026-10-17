"use client";

import { toast } from "sonner";
import type { ActionResult } from "./action";

type FormAction = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

/** Calls a (prev, FormData) server action from client code and shows the result as a toast. */
export async function act(
  action: FormAction,
  fields: Record<string, string | number | boolean | string[] | undefined>,
  success?: string,
): Promise<boolean> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.set(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  try {
    const r = await action(null, fd);
    if (r?.error) {
      toast.error(r.error);
      return false;
    }
    if (r?.message || success) toast.success(r?.message ?? success);
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
    return false;
  }
}
