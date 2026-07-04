import { describe, expect, it } from "vitest";

import {
  buildPriorReviewLearningSuggestionsFromEvidence,
  type PriorReviewLearningEvidence,
} from "./review-learning-evidence.js";

describe("buildPriorReviewLearningSuggestionsFromEvidence", () => {
  it("converts prior evidence into explicit suggestions without mutating parsed fields", () => {
    const parsedItem = {
      shaftFlex: null,
      missingFields: ["shaftFlex", "tradeInValue"],
      confidence: 0.62,
      uncertaintyNotes: [] as string[],
    };
    const originalParsedItem = {
      ...parsedItem,
      missingFields: [...parsedItem.missingFields],
      uncertaintyNotes: [...parsedItem.uncertaintyNotes],
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

    const suggestions = buildPriorReviewLearningSuggestionsFromEvidence(evidence);

    expect(parsedItem).toEqual(originalParsedItem);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      fieldName: "shaftFlex",
      rawTextMatch: "shaft stf",
      suggestedValue: "Stiff",
      previousCorrectedValue: "Stiff",
      proposedValue: "—",
      confidence: 0.94,
      strength: "STRONG",
      sourceLearningEventId: "learning-event-1",
      status: "SUGGESTED",
    });
    expect(suggestions[0]?.confidenceImpact).toContain("require reviewer action");
    expect(suggestions[0]?.whySuggestionExists).toContain("RAW_TEXT_MATCH");
  });

  it("keeps suggestions separate from final review decisions", () => {
    const evidence: PriorReviewLearningEvidence[] = [
      {
        fieldName: "conditionGrade",
        correctedValue: "8.0 Average",
        proposedValue: "Missing",
        rawTextMatch: "cond avg",
        evidenceText: "Reviewer corrected cond avg to 8.0 Average.",
        confidence: 0.72,
        strength: "MEDIUM",
        reasonCodes: ["RAW_TEXT_MATCH", "CONDITION_CONTEXT_MATCH"],
        summary:
          "Prior review evidence suggested conditionGrade = 8.0 Average from similar raw text: cond avg.",
        learningEventId: "learning-event-2",
        createdAt: "2026-07-03T00:00:00.000Z",
      },
    ];

    expect(buildPriorReviewLearningSuggestionsFromEvidence(evidence)).toEqual([
      expect.objectContaining({
        fieldName: "conditionGrade",
        suggestedValue: "8.0 Average",
        status: "SUGGESTED",
      }),
    ]);
  });
  it("dedupes repeated prior corrections for the same field, source phrase, and value", () => {
    const suggestions = buildPriorReviewLearningSuggestionsFromEvidence([
      {
        learningEventId: "older-event",
        fieldName: "shaftFlex",
        rawTextMatch: "shaft firm",
        proposedValue: "Missing",
        correctedValue: "Stiff",
        evidenceText: "PING G425 shaft firm condition unclear value pending review",
        confidence: 0.91,
        strength: "STRONG",
        reasonCodes: ["RAW_TEXT_MATCH"],
        summary:
          "Prior review evidence suggested shaftFlex = Stiff from similar raw text: shaft firm.",
        createdAt: "2026-07-04T19:00:00.000Z",
      },
      {
        learningEventId: "newer-event",
        fieldName: "shaftFlex",
        rawTextMatch: "shaft firm",
        proposedValue: "Missing",
        correctedValue: "Stiff",
        evidenceText: "PING G425 shaft firm condition unclear value pending review",
        confidence: 0.94,
        strength: "STRONG",
        reasonCodes: ["RAW_TEXT_MATCH", "SHAFT_FLEX_CONTEXT_MATCH"],
        summary:
          "Prior review evidence suggested shaftFlex = Stiff from similar raw text: shaft firm.",
        createdAt: "2026-07-04T20:00:00.000Z",
      },
    ]);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      sourceLearningEventId: "newer-event",
      fieldName: "shaftFlex",
      rawTextMatch: "shaft firm",
      suggestedValue: "Stiff",
      status: "SUGGESTED",
    });
  });

});
