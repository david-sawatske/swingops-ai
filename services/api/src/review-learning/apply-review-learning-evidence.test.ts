import { describe, expect, it } from "vitest";

import {
  applyPriorReviewLearningEvidenceToParsedItem,
  type PriorReviewLearningEvidence,
} from "./review-learning-evidence.js";

describe("applyPriorReviewLearningEvidenceToParsedItem", () => {
  it("applies shaft flex evidence when a prior reviewer tied a correction to source text", () => {
    const item = {
      shaftFlex: null,
      missingFields: ["shaftFlex", "tradeInValue"],
      confidence: 0.62,
      uncertaintyNotes: [],
    };

    const evidence: PriorReviewLearningEvidence[] = [
      {
        fieldName: "shaftFlex",
        correctedValue: "Stiff",
        proposedValue: "—",
        rawTextMatch: "shaft stf",
        evidenceText: "Titleist TSR 3w shaft stf condition 8.0 Average",
        confidence: 0.94,
        strength: "STRONG",
        reasonCodes: ["RAW_TEXT_MATCH", "SHAFT_FLEX_RAW_TOKEN_MATCH"],
        summary:
          "Prior review evidence suggested shaftFlex = Stiff from similar raw text: shaft stf.",
        learningEventId: "learning-event-1",
        createdAt: "2026-07-03T00:00:00.000Z",
      },
    ];

    const result = applyPriorReviewLearningEvidenceToParsedItem(item, evidence);

    expect(result.shaftFlex).toBe("STIFF");
    expect(result.missingFields).toEqual(["tradeInValue"]);
    expect(result.confidence).toBe(0.7);
    expect(result.uncertaintyNotes).toContain(
      'Applied prior human review evidence for shaftFlex from source text "shaft stf".',
    );
  });

  it("does not overwrite an already parsed shaft flex", () => {
    const item = {
      shaftFlex: "REGULAR",
      missingFields: ["tradeInValue"],
      confidence: 0.72,
      uncertaintyNotes: [],
    };

    const evidence: PriorReviewLearningEvidence[] = [
      {
        fieldName: "shaftFlex",
        correctedValue: "Stiff",
        proposedValue: "—",
        rawTextMatch: "shaft stf",
        evidenceText: "Titleist TSR 3w shaft stf condition 8.0 Average",
        confidence: 0.94,
        strength: "STRONG",
        reasonCodes: ["RAW_TEXT_MATCH"],
        summary:
          "Prior review evidence suggested shaftFlex = Stiff from similar raw text: shaft stf.",
        learningEventId: "learning-event-1",
        createdAt: "2026-07-03T00:00:00.000Z",
      },
    ];

    const result = applyPriorReviewLearningEvidenceToParsedItem(item, evidence);

    expect(result.shaftFlex).toBe("REGULAR");
    expect(result.missingFields).toEqual(["tradeInValue"]);
  });
});
