"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { SCRIPT_COOKIE } from "@/lib/script";

export async function setScript(script: string) {
  await assertAdmin();
  if (script !== "si" && script !== "ta") return;
  (await cookies()).set(SCRIPT_COOKIE, script, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/admin", "layout");
}
