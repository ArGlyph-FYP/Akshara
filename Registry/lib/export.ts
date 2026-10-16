import { toCsv } from "./csv";
import { hashString } from "./random";
import type {
  Criterion,
  Participant,
  Phase,
  Rating,
  Sample,
  Script,
  Survey,
  SurveyReader,
  SurveyResponse,
} from "./types";

export interface ExportData {
  participants: Participant[];
  samples: Sample[];
  ratings: Rating[];
  criteria: Criterion[];
  raterAliases: Record<string, string>;
  surveys: Survey[];
  surveyReaders: (SurveyReader & { surveyId: string })[];
  surveyResponses: (SurveyResponse & { surveyId: string })[];
}

export interface ExportOptions {
  scripts: Script[];
  phases: Phase[];
  /** Only QC-approved samples (otherwise uploaded + approved). */
  qcOnly: boolean;
  /** "public" drops participant codes; only writer IDs remain. */
  mode: "internal" | "public";
  includeSurveys: boolean;
}

export interface ExportImage {
  sampleId: string;
  imagePath: string;
  fileName: string;
}

export interface ExportBuild {
  files: Record<string, string>;
  images: ExportImage[];
  counts: Record<string, number>;
}

const iso = (t: number | null | undefined) => (t ? new Date(t).toISOString() : "");
export const readerAlias = (uid: string) => `rd_${hashString(uid).toString(16).padStart(8, "0")}`;

/**
 * Builds the dataset files (CSV/JSON) for the chosen filters.
 * Withdrawn participants, and everything linked to their samples, are always left out.
 */
export function buildExport(data: ExportData, opts: ExportOptions): ExportBuild {
  const scripts = new Set(opts.scripts);
  const phases = new Set(opts.phases);
  const withdrawn = new Set(data.participants.filter((p) => p.status === "withdrawn").map((p) => p.code));
  const okStatus = opts.qcOnly ? new Set(["qc_ok"]) : new Set(["qc_ok", "uploaded"]);
  const alias = (uid: string) => data.raterAliases[uid] ?? "R?";
  const ext = (s: Sample) => (s.contentType === "image/png" ? "png" : "jpg");

  const samples = data.samples
    .filter(
      (s) =>
        scripts.has(s.script) &&
        phases.has(s.phase) &&
        okStatus.has(s.status) &&
        s.imagePath &&
        !withdrawn.has(s.participantCode),
    )
    .sort((a, b) => a.script.localeCompare(b.script) || a.participantCode.localeCompare(b.participantCode) || a.pageNo - b.pageNo);
  const sampleById = new Map(samples.map((s) => [s.id, s]));

  const images: ExportImage[] = samples.map((s) => ({
    sampleId: s.id,
    imagePath: s.imagePath!,
    fileName: `images/${s.id}.${ext(s)}`,
  }));

  const internal = opts.mode === "internal";
  const sampleCols = [
    "sample_id",
    "writer_id",
    ...(internal ? ["participant_code"] : []),
    "script",
    "phase",
    "page_no",
    "file",
    "width",
    "height",
    "status",
    "is_anchor",
  ];
  const samplesCsv = toCsv(
    sampleCols,
    samples.map((s) => ({
      sample_id: s.id,
      writer_id: s.writerId,
      participant_code: s.participantCode,
      script: s.script,
      phase: s.phase,
      page_no: s.pageNo,
      file: `images/${s.id}.${ext(s)}`,
      width: s.width,
      height: s.height,
      status: s.status,
      is_anchor: s.isAnchor,
    })),
  );

  const criteria = data.criteria
    .filter((c) => scripts.has(c.script))
    .sort((a, b) => a.script.localeCompare(b.script) || a.rubricVersion - b.rubricVersion || a.order - b.order);
  const criterionById = new Map(criteria.map((c) => [c.id, c]));

  const ratings = data.ratings
    .filter((r) => sampleById.has(r.sampleId))
    .sort((a, b) => a.submittedAt - b.submittedAt);

  const ratingsCsv = toCsv(
    ["rating_id", "sample_id", "writer_id", "script", "rater", "kind", "overall", "legibility", "rubric_version", "n_regions", "duration_ms", "comment", "submitted_at"],
    ratings.map((r) => ({
      rating_id: r.id,
      sample_id: r.sampleId,
      writer_id: sampleById.get(r.sampleId)!.writerId,
      script: r.script,
      rater: alias(r.raterId),
      kind: r.kind,
      overall: r.overall,
      legibility: r.legibility,
      rubric_version: r.rubricVersion,
      n_regions: r.regions.length,
      duration_ms: r.durationMs,
      comment: r.comment,
      submitted_at: iso(r.submittedAt),
    })),
  );

  const criterionRows: Record<string, string | number>[] = [];
  for (const r of ratings) {
    for (const [cid, score] of Object.entries(r.criterionScores)) {
      const c = criterionById.get(cid);
      criterionRows.push({
        rating_id: r.id,
        sample_id: r.sampleId,
        rater: alias(r.raterId),
        kind: r.kind,
        criterion_id: cid,
        criterion_key: c?.key ?? "",
        level: c?.level ?? "",
        score,
      });
    }
  }
  const criterionScoresCsv = toCsv(
    ["rating_id", "sample_id", "rater", "kind", "criterion_id", "criterion_key", "level", "score"],
    criterionRows,
  );

  // COCO-style region annotations, boxes in pixels.
  const imageIndex = new Map(samples.map((s, i) => [s.id, i + 1]));
  const catIndex = new Map(criteria.map((c, i) => [c.id, i + 1]));
  const annotations = [];
  let annId = 1;
  for (const r of ratings) {
    const s = sampleById.get(r.sampleId)!;
    for (const g of r.regions) {
      const box = [g.x * s.width, g.y * s.height, g.w * s.width, g.h * s.height].map((v) => Math.round(v * 10) / 10);
      annotations.push({
        id: annId++,
        image_id: imageIndex.get(s.id),
        category_id: catIndex.get(g.criterionId) ?? null,
        bbox: box,
        area: Math.round(box[2] * box[3]),
        iscrowd: 0,
        rating_id: r.id,
        rater: alias(r.raterId),
        kind: r.kind,
        note: g.note,
      });
    }
  }
  const regionsJson = JSON.stringify(
    {
      info: { description: "Akshara weak-region annotations", bbox_format: "xywh pixels" },
      images: samples.map((s) => ({
        id: imageIndex.get(s.id),
        sample_id: s.id,
        file_name: `images/${s.id}.${ext(s)}`,
        width: s.width,
        height: s.height,
      })),
      categories: criteria.map((c) => ({
        id: catIndex.get(c.id),
        criterion_id: c.id,
        name: c.key,
        script: c.script,
        level: c.level,
        rubric_version: c.rubricVersion,
      })),
      annotations,
    },
    null,
    2,
  );

  const criteriaJson = JSON.stringify(
    criteria.map((c) => ({
      id: c.id,
      script: c.script,
      rubric_version: c.rubricVersion,
      key: c.key,
      label_en: c.labelEn,
      label_local: c.labelLocal,
      description: c.description,
      level: c.level,
      scale: [c.scaleMin, c.scaleMax],
      active: c.active,
    })),
    null,
    2,
  );

  const files: Record<string, string> = {
    "samples.csv": samplesCsv,
    "ratings.csv": ratingsCsv,
    "criterion_scores.csv": criterionScoresCsv,
    "regions.json": regionsJson,
    "criteria.json": criteriaJson,
  };

  let surveyResponseCount = 0;
  if (opts.includeSurveys) {
    const surveys = new Map(data.surveys.filter((s) => scripts.has(s.script)).map((s) => [s.id, s]));
    const allSamples = new Map(data.samples.map((s) => [s.id, s]));
    const readers = new Map(data.surveyReaders.map((r) => [`${r.surveyId}:${r.uid}`, r]));
    const rows = data.surveyResponses
      .filter((r) => {
        const s = allSamples.get(r.sampleId);
        return surveys.has(r.surveyId) && s && !withdrawn.has(s.participantCode);
      })
      .sort((a, b) => a.submittedAt - b.submittedAt)
      .map((r) => {
        const s = allSamples.get(r.sampleId)!;
        return {
          survey_id: r.surveyId,
          script: surveys.get(r.surveyId)!.script,
          sample_id: r.sampleId,
          writer_id: s.writerId,
          reader: readerAlias(r.respondentUid),
          native_reader: readers.get(`${r.surveyId}:${r.respondentUid}`)?.nativeReader ?? "",
          overall: r.overall,
          liked_text: r.likedText,
          disliked_text: r.dislikedText,
          duration_ms: r.durationMs,
          submitted_at: iso(r.submittedAt),
        };
      });
    surveyResponseCount = rows.length;
    files["survey_responses.csv"] = toCsv(
      ["survey_id", "script", "sample_id", "writer_id", "reader", "native_reader", "overall", "liked_text", "disliked_text", "duration_ms", "submitted_at"],
      rows,
    );
  }

  return {
    files,
    images,
    counts: {
      samples: samples.length,
      writers: new Set(samples.map((s) => s.writerId)).size,
      ratings: ratings.length,
      criterion_scores: criterionRows.length,
      regions: annotations.length,
      survey_responses: surveyResponseCount,
    },
  };
}

export function buildManifest(
  opts: ExportOptions,
  build: ExportBuild,
  imageHashes: Record<string, string>,
  rubricVersions: Record<Script, number>,
  exportedAt: number,
): string {
  return JSON.stringify(
    {
      dataset: "Akshara handwriting aesthetics",
      exported_at: iso(exportedAt),
      mode: opts.mode,
      filters: { scripts: opts.scripts, phases: opts.phases, qc_only: opts.qcOnly, include_surveys: opts.includeSurveys },
      rubric_versions: rubricVersions,
      counts: build.counts,
      notes: [
        "Withdrawn participants are excluded.",
        "Group cross-validation folds by writer_id.",
        "kind=repeat rows are blinded repeats for intra-rater reliability; kind=anchor rows are calibration items.",
      ],
      files: Object.keys(build.files).concat(Object.keys(imageHashes).length ? ["images/"] : []),
      image_sha256: imageHashes,
    },
    null,
    2,
  );
}
