import "server-only";
import { cookies } from "next/headers";
import type { Script, UserDoc } from "./types";

export const SCRIPT_COOKIE = "akshara_script";

/** The Sinhala/Tamil branch chosen in the sidebar switch (defaults to the user's first script). */
export async function currentScript(user?: UserDoc): Promise<Script> {
  const v = (await cookies()).get(SCRIPT_COOKIE)?.value;
  if (v === "si" || v === "ta") return v;
  return user?.scripts[0] ?? "si";
}
