import { describe, expect, it } from "vitest";

import { findMatchingEvidenceFromEvents } from "./review-learning-evidence.js";

function makeLearningEvent(overrides: {
  id?: string;
  fieldName: string;
  rawTextMatch?: string | null;
  proposedValue?: string | null;
  correctedValue?: string | null;
  evidenceText?: string | null;
}) {
  return {
    id: overrides.id ?? `${overrides.fieldName}-learning-event`,
    workflowRunId: "previous-workflow-run",
    fieldName: overrides.fieldName,
    rawTextMatch: overrides.rawTextMatch ?? null,
    proposedValue: overrides.proposedValue ?? null,
    correctedValue: overrides.correctedValue ?? null,
    evidenceText: overrides.evidenceText ?? null,
    createdAt: new Date("2026-06-30T00:00:00.000Z")
  };
}

describe("findMatchingEvidenceFromEvents", () => {
  it("matches shaft flex from similar raw flex text instead of make/model", () => {
    const evidence = findMatchingEvidenceFromEvents({
      rawText: "Titleist TSR fairway shaft stf condition 8.0 Average",
      parsedFields: {
        brand: "Titleist",
        productLine: "TSR",
        category: "FAIRWAY_WOOD"
      },
      events: [
        makeLearningEvent({
          fieldName: "shaftFlex",
          rawTextMatch: "stf",
          proposedValue: "Missing",
          correctedValue: "STIFF",
          evidenceText: "Reviewer corrected shaft stf to STIFF."
        })
      ]
    });

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      fieldName: "shaftFlex",
      correctedValue: "STIFF",
      strength: "STRONG"
    });
    expect(evidence[0]?.reasonCodes).toContain("SHAFT_FLEX_RAW_TOKEN_MATCH");
  });

  it("does not infer shaft flex from product identity alone", () => {
    const evidence = findMatchingEvidenceFromEvents({
      rawText: "Callaway Rogue ST Max driver condition 8.0 Average",
      parsedFields: {
        brand: "Callaway",
        productLine: "Rogue ST Max",
        category: "DRIVER"
      },
      events: [
        makeLearningEvent({
          fieldName: "shaftFlex",
          rawTextMatch: "Callaway Rogue ST Max",
          correctedValue: "STIFF",
          evidenceText: "Previous reviewed record was Callaway Rogue ST Max."
        })
      ]
    });

    expect(evidence).toHaveLength(0);
  });

  it("matches category from similar set-composition text", () => {
    const evidence = findMatchingEvidenceFromEvents({
      rawText: "PING G425 4-PW reg condition 6.0 Poor",
      parsedFields: {
        brand: "PING",
        productLine: "G425"
      },
      events: [
        makeLearningEvent({
          fieldName: "category",
          rawTextMatch: "G425 5-PW",
          correctedValue: "IRON_SET",
          evidenceText: "Reviewer classified G425 5-PW as an iron set."
        })
      ]
    });

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      fieldName: "category",
      correctedValue: "IRON_SET",
      strength: "STRONG"
    });
    expect(evidence[0]?.reasonCodes).toContain("CATEGORY_SET_COMPOSITION_MATCH");
  });

  it("matches product-line alias learning with brand support", () => {
    const evidence = findMatchingEvidenceFromEvents({
      rawText: "Callaway Rogue ST mx driver HZRDUS x-stiff condition 7.0 Below Average",
      parsedFields: {
        brand: "Callaway",
        category: "DRIVER"
      },
      events: [
        makeLearningEvent({
          fieldName: "productLine",
          rawTextMatch: "Rogue ST mx",
          correctedValue: "Rogue ST Max",
          evidenceText: "Callaway model alias Rogue ST mx was corrected to Rogue ST Max."
        })
      ]
    });

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      fieldName: "productLine",
      correctedValue: "Rogue ST Max",
      strength: "STRONG"
    });
  });

  it("matches condition grade from condition shorthand", () => {
    const evidence = findMatchingEvidenceFromEvents({
      rawText: "TaylorMade Stealth 2 driver shaft stiff condition avg",
      parsedFields: {
        brand: "TaylorMade",
        productLine: "Stealth 2",
        category: "DRIVER"
      },
      events: [
        makeLearningEvent({
          fieldName: "conditionGrade",
          rawTextMatch: "cond avg",
          correctedValue: "8.0 Average",
          evidenceText: "Reviewer corrected cond avg to 8.0 Average."
        })
      ]
    });

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      fieldName: "conditionGrade",
      correctedValue: "8.0 Average"
    });
  });
});
