import Link from "next/link";
import { SCRIPTS, SCRIPT_LABEL, type Script } from "@/lib/types";

export function parseScript(v: string | string[] | undefined): Script | undefined {
  return v === "si" || v === "ta" ? v : undefined;
}

/** Sinhala / Tamil / All filter as links, preserving other query params. */
export function ScriptTabs({
  base,
  current,
  params = {},
  allowAll = true,
}: {
  base: string;
  current?: Script;
  params?: Record<string, string | undefined>;
  allowAll?: boolean;
}) {
  const href = (script?: Script) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (script) q.set("script", script);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  const opts: (Script | undefined)[] = allowAll ? [undefined, ...SCRIPTS] : [...SCRIPTS];
  return (
    <div className="inline-flex rounded-md border border-line bg-white p-0.5 text-sm">
      {opts.map((s) => (
        <Link
          key={s ?? "all"}
          href={href(s)}
          className={`rounded px-3 py-1 ${current === s ? "bg-accent text-white" : "text-muted hover:text-ink"}`}
        >
          {s ? SCRIPT_LABEL[s] : "All"}
        </Link>
      ))}
    </div>
  );
}
