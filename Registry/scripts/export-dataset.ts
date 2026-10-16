// Writes the dataset to a folder (same layout as the ZIP download) for the training pipeline.
//   npm run export -- --out ../data/akshara --scripts si,ta --phases main --mode public [--all-statuses] [--surveys] [--no-images]
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { buildExport, buildManifest, type ExportOptions } from "../lib/export";
import { loadExportData } from "../lib/exportData";
import type { Phase, Script } from "../lib/types";
import { arg, bucket, db, target } from "./admin-app";

async function main() {
  const out = resolve(arg("out", "./data/export")!);
  const opts: ExportOptions = {
    scripts: (arg("scripts", "si,ta")!.split(",").filter((s) => s === "si" || s === "ta") as Script[]),
    phases: (arg("phases", "main")!.split(",").filter((s) => s === "pilot" || s === "main") as Phase[]),
    qcOnly: arg("all-statuses") === undefined,
    mode: arg("mode", "public") === "internal" ? "internal" : "public",
    includeSurveys: arg("surveys") !== undefined,
  };
  const withImages = arg("no-images") === undefined;
  console.log(`Exporting from ${target()} to ${out}`, opts);

  const { data, rubricVersions } = await loadExportData(db, { includeSurveys: opts.includeSurveys });
  const build = buildExport(data, opts);
  await mkdir(out, { recursive: true });
  for (const [name, content] of Object.entries(build.files)) await writeFile(join(out, name), content);

  const hashes: Record<string, string> = {};
  if (withImages) {
    let i = 0;
    for (const img of build.images) {
      const [buf] = await bucket.file(img.imagePath).download();
      const p = join(out, img.fileName);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, buf);
      hashes[img.fileName] = createHash("sha256").update(buf).digest("hex");
      process.stdout.write(`\r  images ${++i}/${build.images.length}`);
    }
    process.stdout.write("\n");
  }
  await writeFile(join(out, "manifest.json"), buildManifest(opts, build, hashes, rubricVersions, Date.now()));
  console.log("✓ Done", build.counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
