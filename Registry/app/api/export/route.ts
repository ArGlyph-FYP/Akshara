import { createHash } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getSession } from "@/lib/auth";
import { buildExport, buildManifest, type ExportOptions } from "@/lib/export";
import { loadExportData } from "@/lib/exportData";
import { adminBucket, adminDb } from "@/lib/firebase/admin";
import { SCRIPTS, type Phase, type Script } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel caps functions at 300 s (Hobby) to 800 s (Pro). For a full image export use `npm run export:prod`.
export const maxDuration = 300;

/** Accepts both `scripts=si,ta` and repeated `script=si&script=ta` (from the custom export form). */
function list<T extends string>(q: URLSearchParams, plural: string, single: string, allowed: readonly T[], fallback: T[]): T[] {
  const raw = [...(q.get(plural) ?? "").split(","), ...q.getAll(single)];
  const parts = [...new Set(raw.filter((x): x is T => (allowed as readonly string[]).includes(x)))];
  return parts.length ? parts : fallback;
}

/**
 * GET /api/export?scripts=si,ta&phases=main&qc=1&mode=public&surveys=1&images=1
 * Streams a ZIP. With only=survey it returns survey_responses.csv directly (optionally &survey=<id>).
 */
export async function GET(req: Request) {
  const s = await getSession();
  if (s?.kind !== "staff" || s.user.role !== "admin") return new Response("Admins only", { status: 403 });

  const q = new URL(req.url).searchParams;
  const opts: ExportOptions = {
    scripts: list<Script>(q, "scripts", "script", SCRIPTS, [...SCRIPTS]),
    phases: list<Phase>(q, "phases", "phase", ["pilot", "main"], ["main"]),
    qcOnly: q.get("qc") !== "0",
    mode: q.get("mode") === "internal" ? "internal" : "public",
    includeSurveys: q.get("surveys") === "1" || q.get("only") === "survey",
  };
  const withImages = q.get("images") !== "0";
  const { data, rubricVersions } = await loadExportData(adminDb(), { includeSurveys: opts.includeSurveys });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

  if (q.get("only") === "survey") {
    const surveyId = q.get("survey");
    if (surveyId) {
      data.surveys = data.surveys.filter((x) => x.id === surveyId);
    }
    const build = buildExport(data, { ...opts, phases: ["pilot", "main"], qcOnly: false });
    return new Response(build.files["survey_responses.csv"], {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="akshara-survey-${stamp}.csv"`,
      },
    });
  }

  const build = buildExport(data, opts);
  const zip = new ZipArchive({ zlib: { level: 6 } });
  const out = new PassThrough();
  zip.pipe(out);
  zip.on("error", (e) => out.destroy(e));

  void (async () => {
    try {
      for (const [name, content] of Object.entries(build.files)) zip.append(content, { name });
      const hashes: Record<string, string> = {};
      if (withImages) {
        const bucket = adminBucket();
        for (const img of build.images) {
          const [buf] = await bucket.file(img.imagePath).download();
          hashes[img.fileName] = createHash("sha256").update(buf).digest("hex");
          zip.append(buf, { name: img.fileName, store: true });
        }
      }
      zip.append(buildManifest(opts, build, hashes, rubricVersions, Date.now()), { name: "manifest.json" });
      await zip.finalize();
    } catch (e) {
      zip.abort();
      out.destroy(e as Error);
    }
  })();

  const name = `akshara-${opts.mode}-${opts.scripts.join("-")}-${stamp}.zip`;
  return new Response(Readable.toWeb(out) as ReadableStream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
