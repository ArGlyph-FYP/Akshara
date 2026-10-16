import { describe, expect, it } from "vitest";
import { formatCode, normaliseCode } from "@/lib/codes";
import { parseScanFilename } from "@/lib/filenames";

describe("parseScanFilename", () => {
  it.each([
    ["SI-001.jpg", { code: "SI-001", script: "si", pageNo: 1, ext: "jpg" }],
    ["TA-014_p2.png", { code: "TA-014", script: "ta", pageNo: 2, ext: "png" }],
    ["si-7_P1.JPEG", { code: "SI-007", script: "si", pageNo: 1, ext: "jpg" }],
    ["scans/batch1/TA012.jpeg", { code: "TA-012", script: "ta", pageNo: 1, ext: "jpg" }],
    ["SI-1234.png", { code: "SI-1234", script: "si", pageNo: 1, ext: "png" }],
  ])("parses %s", (name, expected) => {
    expect(parseScanFilename(name)).toEqual(expected);
  });

  it.each(["IMG_2034.jpg", "SI-001.tif", "XX-001.jpg", "SI-001_p0.jpg", "SI-001 copy.jpg", "SI-.jpg"])("rejects %s", (name) => {
    expect(parseScanFilename(name)).toBeNull();
  });
});

describe("codes", () => {
  it("formats and normalises", () => {
    expect(formatCode("si", 7)).toBe("SI-007");
    expect(formatCode("ta", 120)).toBe("TA-120");
    expect(normaliseCode(" si 7 ")?.code).toBe("SI-007");
    expect(normaliseCode("TA-014")).toEqual({ code: "TA-014", script: "ta", number: 14 });
    expect(normaliseCode("AB-1")).toBeNull();
  });
});
