import { describe, expect, it } from "vitest";

import type {
  PriorReviewLearningSuggestion
} from "../review-learning/review-learning-evidence.js";
import {
  filterPriorReviewLearningSuggestionsForSourceSafety
} from "./field-repair-advisory-candidates.js";

function makeConditionSuggestion(input: {
  sourceLearningEventId: string;
  rawTextMatch: string;
  suggestedValue: string;
}): PriorReviewLearningSuggestion {
  return {
    fieldName: "conditionGrade",
    rawTextMatch: input.rawTextMatch,
    suggestedValue:
      input.suggestedValue,
    previousCorrectedValue:
      input.suggestedValue,
    proposedValue: "Missing",
    evidenceText:
      `Prior reviewer approved ${input.rawTextMatch}.`,
    confidence: 0.94,
    strength: "STRONG",
    confidenceImpact:
      "Require reviewer confirmation.",
    reasonCodes: [
      "RAW_TEXT_MATCH"
    ],
    summary:
      "Prior review condition suggestion.",
    whySuggestionExists:
      "Matched prior approved correction.",
    sourceLearningEventId:
      input.sourceLearningEventId,
    status: "SUGGESTED",
    createdAt:
      "2026-07-18T00:00:00.000Z"
  };
}

describe(
  "filterPriorReviewLearningSuggestionsForSourceSafety",
  () => {
    const mintSuggestion =
      makeConditionSuggestion({
        sourceLearningEventId:
          "mint-learning-event",
        rawTextMatch:
          "cosmetics mint",
        suggestedValue:
          "9.5 Mint"
      });

    it("withholds a learned condition suggestion when current source phrases conflict", () => {
      expect(
        filterPriorReviewLearningSuggestionsForSourceSafety({
          sourceText:
            "PING G425 irons overall avg and cosmetics mint",
          suggestions: [
            mintSuggestion
          ]
        })
      ).toEqual([]);
    });

    it("withholds a learned condition suggestion when current source evidence is explicitly unclear", () => {
      expect(
        filterPriorReviewLearningSuggestionsForSourceSafety({
          sourceText:
            "PING G425 irons cosmetics mint but condition unclear",
          suggestions: [
            mintSuggestion
          ]
        })
      ).toEqual([]);
    });

    it("preserves a single supported learned suggestion", () => {
      expect(
        filterPriorReviewLearningSuggestionsForSourceSafety({
          sourceText:
            "Odyssey White Hot OG putter cosmetics mint",
          suggestions: [
            mintSuggestion
          ]
        })
      ).toEqual([
        mintSuggestion
      ]);
    });

    it("withholds multiple learned values for the same field", () => {
      const averageSuggestion =
        makeConditionSuggestion({
          sourceLearningEventId:
            "average-learning-event",
          rawTextMatch:
            "overall avg",
          suggestedValue:
            "8.0 Average"
        });

      expect(
        filterPriorReviewLearningSuggestionsForSourceSafety({
          sourceText:
            "PING G425 irons condition shorthand present",
          suggestions: [
            mintSuggestion,
            averageSuggestion
          ]
        })
      ).toEqual([]);
    });
    it("preserves a supported learned condition suggestion when another field is unresolved", () => {
      expect(
        filterPriorReviewLearningSuggestionsForSourceSafety({
          sourceText:
            "Odyssey White Hot OG putter cosmetics mint value pending",
          suggestions: [
            mintSuggestion
          ]
        })
      ).toEqual([
        mintSuggestion
      ]);

      expect(
        filterPriorReviewLearningSuggestionsForSourceSafety({
          sourceText:
            "Odyssey White Hot OG putter condition unclear value pending",
          suggestions: [
            mintSuggestion
          ]
        })
      ).toEqual([]);
    });

  }
);
