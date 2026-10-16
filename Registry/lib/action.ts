export type ActionResult = { ok?: boolean; error?: string; message?: string } | null;

/** Wraps a server action body so thrown errors come back as a message instead of an error page. */
export async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const message = await fn();
    return { ok: true, message: message || undefined };
  } catch (e) {
    // Let Next.js redirects/notFound propagate.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export function num(fd: FormData, key: string, fallback?: number): number {
  const v = Number(fd.get(key));
  if (Number.isFinite(v) && String(fd.get(key) ?? "").trim() !== "") return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`${key} must be a number`);
}
