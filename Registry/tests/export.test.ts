import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";
import { buildExport, buildManifest, type ExportData, type ExportOptions } from "@/lib/export";
import type { Participant, Rating, Sample } from "@/lib/types";

const participant = (code: string, status: Participant["status"] = "active"): Participant => ({
  code,
  script: code.startsWith("SI") ? "si" : "ta",
  phase: "main",
  consentReceivedAt: 1,
  consentVerifiedBy: "a@x",
  status,
  withdrawnAt: null,
  writerId: `w_${code.toLowerCase().replace("-", "")}x`,
  notes: "",
  createdAt: 1,
});

const sample = (id: string, code: string, extra: Partial<Sample> = {}): Sample => ({
  id,
  participantCode: code,
  writerId: participant(code).writerId,
  script: code.startsWith("SI") ? "si" : "ta",
  phase: "main",
  pageNo: 1,
  imagePath: `scans/x/${id}.jpg`,
  contentType: "image/jpeg",
  width: 1000,
  height: 2000,
  status: "qc_ok",
  isAnchor: false,
  anchorScores: null,
  uploadedAt: 1,
  uploadedBy: "a@x",
  ...extra,
});

const rating = (id: string, sampleId: string, extra: Partial<Rating> = {}): Rating => ({
  id,
  studyId: "st_rubric",
  studyType: "rubric",
  likedText: "",
  dislikedText: "",
  assignmentId: `a_${id}`,
  raterId: "uid1",
  sampleId,
  script: "si",
  kind: "normal",
  overall: 5,
  legibility: 4,
  criterionScores: { c1: 3 },
  regions: [{ criterionId: "c1", x: 0.1, y: 0.2, w: 0.5, h: 0.1, note: "uneven" }],
  comment: "",
  durationMs: 1000,
  rubricVersion: 1,
  submittedAt: 2,
  ...extra,
});

const data: ExportData = {
  participants: [participant("SI-001"), participant("SI-002", "withdrawn"), participant("TA-001")],
  samples: [
    sample("s1", "SI-001"),
    sample("s2", "SI-002", { status: "excluded" }),
    sample("s3", "TA-001"),
    sample("s4", "SI-001", { pageNo: 2, status: "uploaded" }),
    sample("p1", "SI-001", { phase: "pilot", status: "uploaded" }),
  ],
  ratings: [
    rating("r1", "s1"),
    rating("r2", "s2"),
    rating("r3", "s3", { script: "ta" }),
    rating("q1", "p1", {
      studyId: "st_pilot",
      studyType: "perception",
      legibility: null,
      criterionScores: {},
      regions: [
        { criterionId: "", tone: "good", x: 0.1, y: 0.1, w: 0.2, h: 0.1, note: "round letters" },
        { criterionId: "", tone: "weak", x: 0.5, y: 0.5, w: 0.1, h: 0.1, note: "" },
      ],
      likedText: 'neat, "even"',
      overall: 6,
    }),
  ],
  criteria: [
    { id: "c1", script: "si", rubricVersion: 1, key: "baseline", labelEn: "Baseline", labelLocal: "", description: "", level: "line", scaleMin: 1, scaleMax: 5, active: true, order: 1 },
  ],
  raterAliases: { uid1: "R01" },
  raterInfo: { uid1: { source: "public", firstLanguage: true, ageGroup: "25-34" } },
  studies: [
    { id: "st_rubric", script: "si", type: "rubric", title: "Main round", instructions: "", sampleIds: ["s1", "s3"], open: true, overallScale: { min: 1, max: 7 }, legibilityScale: { min: 1, max: 5 }, rubricVersion: 1, createdAt: 1 },
    { id: "st_pilot", script: "si", type: "perception", title: "Pilot perception", instructions: "", sampleIds: ["p1"], open: true, overallScale: { min: 1, max: 7 }, legibilityScale: null, rubricVersion: null, createdAt: 1 },
  ],
};

const opts: ExportOptions = { scripts: ["si", "ta"], phases: ["main"], qcOnly: true, mode: "public", includeSurveys: true };

describe("buildExport", () => {
  it("public mode never contains participant codes or rater uids", () => {
    const b = buildExport(data, opts);
    const all = Object.values(b.files).join("\n");
    expect(all).not.toMatch(/\b(SI|TA)-\d{3}\b/);
    expect(all).not.toContain("uid1");
    expect(all).not.toContain("reader1");
    expect(all).toContain("R01");
  });

  it("internal mode includes codes", () => {
    const b = buildExport(data, { ...opts, mode: "internal" });
    expect(b.files["samples.csv"]).toContain("SI-001");
  });

  it("excludes withdrawn participants and non-approved samples", () => {
    const b = buildExport(data, opts);
    expect(b.images.map((i) => i.sampleId).sort()).toEqual(["s1", "s3"]);
    expect(b.counts.ratings).toBe(2);
    expect(b.files["ratings.csv"]).not.toContain("r2");
    const loose = buildExport(data, { ...opts, qcOnly: false });
    expect(loose.images.map((i) => i.sampleId).sort()).toEqual(["s1", "s3", "s4"]);
  });

  it("filters by script and phase", () => {
    expect(buildExport(data, { ...opts, scripts: ["ta"] }).images.map((i) => i.sampleId)).toEqual(["s3"]);
    expect(buildExport(data, { ...opts, phases: ["pilot"], qcOnly: false }).images.map((i) => i.sampleId)).toEqual(["p1"]);
  });

  it("converts regions to COCO pixel boxes", () => {
    const coco = JSON.parse(buildExport(data, opts).files["regions.json"]);
    const ann = coco.annotations.find((a: { rating_id: string }) => a.rating_id === "r1");
    expect(ann.bbox).toEqual([100, 400, 500, 200]);
    expect(coco.categories[0].name).toBe("baseline");
    expect(coco.images.find((i: { id: number }) => i.id === ann.image_id).sample_id).toBe("s1");
  });

  it("puts perception answers in their own file, with rater aliases and escaped text", () => {
    const b = buildExport(data, { ...opts, phases: ["pilot"], qcOnly: false });
    const csv = b.files["perception_responses.csv"];
    expect(csv).toContain('"neat, ""even"""');
    expect(csv).toContain("st_pilot");
    expect(csv).toContain("R01");
    expect(csv).toContain("public,true,25-34");
    expect(b.files["ratings.csv"]).not.toContain("q1");
    expect(b.counts.perception_responses).toBe(1);
  });

  it("exports perception marks separately from rubric regions", () => {
    const b = buildExport(data, { ...opts, phases: ["pilot"], qcOnly: false });
    expect(b.files["perception_responses.csv"]).toContain("1,1,");
    const coco = JSON.parse(b.files["perception_marks.json"]);
    expect(coco.annotations.map((a: { category_id: number }) => a.category_id)).toEqual([1, 2]);
    expect(coco.annotations[0].bbox).toEqual([100, 200, 200, 200]);
    expect(coco.annotations[0].note).toBe("round letters");
    expect(coco.annotations[0].rater).toBe("R01");
    expect(JSON.parse(b.files["regions.json"]).annotations).toHaveLength(0);
    expect(buildExport(data, { ...opts, includeSurveys: false }).files["perception_marks.json"]).toBeUndefined();
  });

  it("lists studies", () => {
    const studies = JSON.parse(buildExport(data, opts).files["studies.json"]);
    expect(studies.map((s: { type: string }) => s.type).sort()).toEqual(["perception", "rubric"]);
  });

  it("manifest records counts and hashes", () => {
    const b = buildExport(data, opts);
    const m = JSON.parse(buildManifest(opts, b, { "images/s1.jpg": "abc" }, { si: 1, ta: 1 }, 0));
    expect(m.counts.samples).toBe(2);
    expect(m.image_sha256["images/s1.jpg"]).toBe("abc");
  });
});

describe("toCsv", () => {
  it("escapes and adds a BOM", () => {
    const csv = toCsv(["a", "b"], [{ a: "x,y", b: "line\nbreak" }, { a: null, b: 3 }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"x,y","line\nbreak"');
    expect(csv).toContain(",3\r\n");
  });
});
