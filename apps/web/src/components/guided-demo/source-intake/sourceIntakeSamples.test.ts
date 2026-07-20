import { describe, expect, it } from "vitest";

import { SAMPLE_SOURCE_BY_TYPE } from "./sourceIntakeSamples";

const SUPPORTED_SOURCE_TYPES = [
  "FREE_TEXT",
  "POORLY_FORMED_CSV",
  "EMAIL",
  "LOG",
] as const;

function countSampleRecords(
  sourceType: (typeof SUPPORTED_SOURCE_TYPES)[number],
  rawContent: string,
) {
  const lines = rawContent.split("\n").filter((line) => line.trim().length > 0);

  if (sourceType === "FREE_TEXT") {
    return lines.filter((line) => /^\d+\)/.test(line)).length;
  }

  if (sourceType === "POORLY_FORMED_CSV") {
    return lines.length - 1;
  }

  if (sourceType === "EMAIL") {
    return lines.filter((line) => /^\d+\./.test(line)).length;
  }

  return lines.length;
}

describe("source-type golden samples", () => {
  it("provides five golden behavior roles for every supported source type", () => {
    expect(Object.keys(SAMPLE_SOURCE_BY_TYPE)).toEqual(SUPPORTED_SOURCE_TYPES);

    for (const sourceType of SUPPORTED_SOURCE_TYPES) {
      const sample = SAMPLE_SOURCE_BY_TYPE[sourceType];

      expect(sample.sourceType).toBe(sourceType);
      expect(sample.sourceName?.trim()).not.toBe("");
      expect(countSampleRecords(sourceType, sample.rawContent)).toBe(5);
      expect(sample.rawContent).toContain("shaft firm");
      expect(sample.rawContent).toContain("cosmetics poor");
      expect(sample.rawContent.toLowerCase()).toContain("generation");
      expect(sample.rawContent.toLowerCase()).toContain("unclear");
      expect(sample.rawContent.toLowerCase()).toContain("pending");
    }
  });

  it("uses distinct records rather than repeating one corpus in four formats", () => {
    const samples = Object.values(SAMPLE_SOURCE_BY_TYPE);

    expect(new Set(samples.map((sample) => sample.rawContent)).size).toBe(4);
    expect(SAMPLE_SOURCE_BY_TYPE.FREE_TEXT.rawContent).toContain(
      "Cleveland RTX 6 ZipCore",
    );
    expect(SAMPLE_SOURCE_BY_TYPE.POORLY_FORMED_CSV.rawContent).toContain(
      "PING| G430 Max",
    );
    expect(SAMPLE_SOURCE_BY_TYPE.EMAIL.rawContent).toContain(
      "Mizuno JPX 923 Hot Metal",
    );
    expect(SAMPLE_SOURCE_BY_TYPE.LOG.rawContent).toContain(
      "model='Rogue ST Max'",
    );
  });

  it("leaves putter shaft flex absent in every sample format", () => {
    for (const sample of Object.values(SAMPLE_SOURCE_BY_TYPE)) {
      const putterLine = sample.rawContent
        .split("\n")
        .find((line) => line.includes("Odyssey") && line.includes("putter"));

      expect(putterLine).toBeDefined();
      expect(putterLine?.toLowerCase()).not.toContain("shaft");
      expect(putterLine?.toLowerCase()).not.toContain("flex");
    }
  });
});
