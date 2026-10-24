import { createHash } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
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
 * Streams a ZIP. With only=study&study=<id> it returns that study's responses as a CSV.
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
    includeSurveys: q.get("surveys") === "1",
  };
  const withImages = q.get("images") !== "0";
  const { data, rubricVersions } = await loadExportData(adminDb());
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

  // One study's responses as a CSV for the team (internal: includes participant codes).
  if (q.get("only") === "study") {
    const study = data.studies.find((x) => x.id === q.get("study"));
    if (!study) return new Response("Study not found", { status: 404 });
    const samples = new Map(data.samples.map((x) => [x.id, x]));
    const main = study.type === "rubric";
    // Main study: one column per criterion, named by its key (a1…a8).
    const crit = data.criteria
      .filter((c) => c.script === study.script && c.rubricVersion === study.rubricVersion)
      .sort((a, b) => a.order - b.order);
    const rows = data.ratings
      .filter((r) => r.studyId === study.id)
      .sort((a, b) => a.submittedAt - b.submittedAt)
      .map((r) => {
        const smp = samples.get(r.sampleId);
        return {
          participant_code: smp?.participantCode ?? "",
          page_no: smp?.pageNo ?? "",
          part: smp?.part ?? "",
          sample_id: r.sampleId,
          writer_id: smp?.writerId ?? "",
          rater: data.raterAliases[r.raterId] ?? "R?",
          kind: r.kind,
          batch: r.batch ?? "",
          block: main && r.kind !== "anchor" ? (smp?.part === 2 ? 2 : 1) : "",
          position: r.position ?? "",
          score: r.overall,
          legibility: r.legibility ?? "",
          decoration: r.decoration ?? "",
          alterations: r.alterations ?? "",
          ...Object.fromEntries(crit.map((c) => [c.key, r.criterionScores[c.id] ?? ""])),
          comment: r.comment,
          liked_text: r.likedText,
          disliked_text: r.dislikedText,
          n_regions: r.regions.length,
          // Perception marks as normalised (0–1) boxes: tone, x, y, w, h, note.
          marks_json: r.studyType === "perception" && r.regions.length ? JSON.stringify(r.regions.map(({ tone, x, y, w, h, note }) => ({ tone, x, y, w, h, note }))) : "",
          // Main-study boxes, normalised (0–1): criterion key or flag, issue tag, part, severity, x, y, w, h, note.
          regions_json:
            main && r.regions.length
              ? JSON.stringify(
                  r.regions.map((g) => ({
                    criterion: crit.find((c) => c.id === g.criterionId)?.key ?? null,
                    flag: g.flag ?? null,
                    issue_tag: g.issueTag ?? null,
                    part: g.part ?? null,
                    severity: g.severity ?? null,
                    x: g.x,
                    y: g.y,
                    w: g.w,
                    h: g.h,
                    note: g.note,
                  })),
                )
              : "",
          duration_ms: r.durationMs,
          submitted_at: new Date(r.submittedAt).toISOString(),
        };
      });
    const cols = main
      ? ["participant_code", "page_no", "part", "sample_id", "writer_id", "rater", "kind", "batch", "block", "position", "score", "decoration", "alterations", ...crit.map((c) => c.key), "legibility", "comment", "n_regions", "regions_json", "duration_ms", "submitted_at"]
      : ["participant_code", "page_no", "part", "sample_id", "writer_id", "rater", "kind", "score", "legibility", "liked_text", "disliked_text", "n_regions", "marks_json", "duration_ms", "submitted_at"];
    const slug = study.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "study";
    return new Response(toCsv(cols, rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="akshara-${slug}-${stamp}.csv"`,
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
