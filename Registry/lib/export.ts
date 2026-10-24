import { compareSamples } from "./codes";
import { toCsv } from "./csv";
import type { Criterion, Participant, Phase, Rating, Sample, Script, Study } from "./types";

export interface ExportData {
  participants: Participant[];
  samples: Sample[];
  ratings: Rating[];
  criteria: Criterion[];
  raterAliases: Record<string, string>;
  /** Self-reported reader details (public-link sign-up). Never names or contact details. */
  raterInfo?: Record<
    string,
    { source: "account" | "public"; firstLanguage: boolean | null; ageGroup: string | null; age?: number | null; occupation?: string | null }
  >;
  studies: Study[];
}

export interface ExportOptions {
  scripts: Script[];
  phases: Phase[];
  /** Only QC-approved samples (otherwise uploaded + approved). */
  qcOnly: boolean;
  /** "public" drops participant codes; only writer IDs remain. */
  mode: "internal" | "public";
  /** Include perception-study answers (open-text reasons). */
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
    .sort((a, b) => a.script.localeCompare(b.script) || compareSamples(a, b));
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
    "part",
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
      part: s.part ?? "",
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

  const studyById = new Map(data.studies.map((s) => [s.id, s]));
  const all = data.ratings.filter((r) => sampleById.has(r.sampleId)).sort((a, b) => a.submittedAt - b.submittedAt);
  const ratings = all.filter((r) => r.studyType !== "perception");
  const perception = all.filter((r) => r.studyType === "perception");

  const ratingsCsv = toCsv(
    [
      "rating_id",
      "study_id",
      "sample_id",
      "writer_id",
      "script",
      "rater",
      "kind",
      "batch",
      "block",
      "position",
      "overall",
      "legibility",
      "decoration",
      "alterations",
      "rubric_version",
      "n_regions",
      "duration_ms",
      "seconds",
      "comment",
      "submitted_at",
    ],
    ratings.map((r) => ({
      rating_id: r.id,
      study_id: r.studyId,
      sample_id: r.sampleId,
      writer_id: sampleById.get(r.sampleId)!.writerId,
      script: r.script,
      rater: alias(r.raterId),
      kind: r.kind,
      batch: r.batch ?? "",
      block: r.studyType === "rubric" && r.kind !== "anchor" ? (sampleById.get(r.sampleId)!.part === 2 ? 2 : 1) : "",
      position: r.position ?? "",
      overall: r.overall,
      legibility: r.legibility,
      decoration: r.decoration ?? "",
      alterations: r.alterations ?? "",
      rubric_version: r.rubricVersion,
      n_regions: r.regions.length,
      duration_ms: r.durationMs,
      seconds: Math.round(r.durationMs / 100) / 10,
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
        issue_tag: g.issueTag ?? null,
        part: g.part ?? null,
        severity: g.severity ?? null,
        flag: g.flag ?? null,
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

  // Main-study raters: self-reported details. Exact age and occupation go in internal exports only.
  const raterIds = [...new Set(ratings.map((r) => r.raterId))].sort((a, b) => alias(a).localeCompare(alias(b)));
  files["raters.csv"] = toCsv(
    ["rater", "source", "first_language", "age_group", ...(internal ? ["age", "occupation"] : [])],
    raterIds.map((uid) => {
      const info = data.raterInfo?.[uid];
      return {
        rater: alias(uid),
        source: info?.source ?? "",
        first_language: info?.firstLanguage ?? "",
        age_group: info?.ageGroup ?? "",
        age: info?.age ?? "",
        occupation: info?.occupation ?? "",
      };
    }),
  );

  files["studies.json"] = JSON.stringify(
    data.studies
      .filter((st) => scripts.has(st.script))
      .map((st) => ({
        id: st.id,
        script: st.script,
        type: st.type,
        title: st.title,
        overall_scale: [st.overallScale.min, st.overallScale.max],
        legibility_scale: st.legibilityScale ? [st.legibilityScale.min, st.legibilityScale.max] : null,
        rubric_version: st.rubricVersion,
        form_size: st.type === "rubric" ? (st.perReader ?? null) : null,
        target_per_sample: st.targetPerSample ?? null,
        max_per_sample: st.maxPerSample ?? null,
        n_samples: st.sampleIds.filter((id) => sampleById.has(id)).length,
        created_at: iso(st.createdAt),
      })),
    null,
    2,
  );

  if (opts.includeSurveys) {
    files["perception_responses.csv"] = toCsv(
      ["rating_id", "study_id", "study_title", "sample_id", "writer_id", "script", "rater", "rater_source", "rater_first_language", "rater_age_group", "kind", "score", "liked_text", "disliked_text", "n_good_marks", "n_weak_marks", "duration_ms", "submitted_at"],
      perception.map((r) => ({
        rater_source: data.raterInfo?.[r.raterId]?.source ?? "",
        rater_first_language: data.raterInfo?.[r.raterId]?.firstLanguage ?? "",
        rater_age_group: data.raterInfo?.[r.raterId]?.ageGroup ?? "",
        rating_id: r.id,
        study_id: r.studyId,
        study_title: studyById.get(r.studyId)?.title ?? "",
        sample_id: r.sampleId,
        writer_id: sampleById.get(r.sampleId)!.writerId,
        script: r.script,
        rater: alias(r.raterId),
        kind: r.kind,
        score: r.overall,
        liked_text: r.likedText,
        disliked_text: r.dislikedText,
        n_good_marks: r.regions.filter((g) => g.tone === "good").length,
        n_weak_marks: r.regions.filter((g) => g.tone === "weak").length,
        duration_ms: r.durationMs,
        submitted_at: iso(r.submittedAt),
      })),
    );

    // Boxes readers drew in perception studies, COCO-style in pixels (category 1 = looks good, 2 = could be better).
    const marked = perception.filter((r) => r.regions.length);
    const markImages = [...new Set(marked.map((r) => r.sampleId))].map((id, i) => ({ id, imageId: i + 1, s: sampleById.get(id)! }));
    const markImageId = new Map(markImages.map((m) => [m.id, m.imageId]));
    let markId = 1;
    files["perception_marks.json"] = JSON.stringify(
      {
        info: { description: "Akshara perception-survey marks", bbox_format: "xywh pixels" },
        images: markImages.map(({ imageId, s }) => ({ id: imageId, sample_id: s.id, file_name: `images/${s.id}.${ext(s)}`, width: s.width, height: s.height })),
        categories: [
          { id: 1, name: "good" },
          { id: 2, name: "weak" },
        ],
        annotations: marked.flatMap((r) => {
          const s = sampleById.get(r.sampleId)!;
          return r.regions.map((g) => {
            const box = [g.x * s.width, g.y * s.height, g.w * s.width, g.h * s.height].map((v) => Math.round(v * 10) / 10);
            return {
              id: markId++,
              image_id: markImageId.get(s.id),
              category_id: g.tone === "good" ? 1 : 2,
              bbox: box,
              area: Math.round(box[2] * box[3]),
              iscrowd: 0,
              rating_id: r.id,
              study_id: r.studyId,
              rater: alias(r.raterId),
              note: g.note,
            };
          });
        }),
      },
      null,
      2,
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
      perception_responses: opts.includeSurveys ? perception.length : 0,
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
      filters: { scripts: opts.scripts, phases: opts.phases, qc_only: opts.qcOnly, include_perception: opts.includeSurveys },
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
