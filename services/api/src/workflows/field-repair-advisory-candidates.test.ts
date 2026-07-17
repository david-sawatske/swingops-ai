import { describe, expect, it } from "vitest";

import type {
  PriorReviewLearningSuggestion
} from "../review-learning/review-learning-evidence.js";

import {
  buildPriorReviewFieldRepairAdvisoryCandidates
} from "./field-repair-advisory-candidates.js";

function buildPriorSuggestion(
  overrides: Partial<PriorReviewLearningSuggestion> = {}
): PriorReviewLearningSuggestion {
  return {
    fieldName: "shaftFlex",
    rawTextMatch: "shaft firm",
    suggestedValue: "Stiff",
    previousCorrectedValue: "Stiff",
    proposedValue: "Missing",
    evidenceText:
      "Reviewer confirmed shaft firm means Stiff.",
    confidence: 0.94,
    strength: "STRONG",
    confidenceImpact:
      "Require reviewer action before changing the record.",
    reasonCodes: [
      "RAW_TEXT_MATCH",
      "SHAFT_FLEX_CONTEXT_MATCH"
    ],
    summary:
      "Prior review suggestion: shaftFlex = Stiff.",
    whySuggestionExists:
      "Matched prior approved correction using RAW_TEXT_MATCH.",
    sourceLearningEventId: "learning-event-1",
    status: "SUGGESTED",
    createdAt: "2026-07-17T00:00:00.000Z",
    ...overrides
  };
}

describe(
  "buildPriorReviewFieldRepairAdvisoryCandidates",
  () => {
    it("builds typed review-required candidates across every supported repair field", () => {
      const sourceText =
        "Cally Rogue ST mx 5-PW shaft firm cond avg value $145";

      const candidates =
        buildPriorReviewFieldRepairAdvisoryCandidates({
          recordId: "record-1",
          sourceText,
          missingFields: [
            "brand",
            "productLine",
            "category",
            "shaftFlex",
            "conditionGrade",
            "tradeInValue"
          ],
          fieldApplicability: {
            shaftFlex: "REQUIRED"
          },
          productResolutionStatus: "UNRESOLVED",
          sourceEvidenceId: "record-1:prior-review",
          priorReviewSuggestions: [
            buildPriorSuggestion({
              fieldName: "brand",
              rawTextMatch: "Cally",
              suggestedValue: "Callaway",
              previousCorrectedValue: "Callaway",
              sourceLearningEventId: "brand-event"
            }),
            buildPriorSuggestion({
              fieldName: "productLine",
              rawTextMatch: "Rogue ST mx",
              suggestedValue: "Rogue ST Max",
              previousCorrectedValue:
                "Rogue ST Max",
              sourceLearningEventId:
                "product-line-event"
            }),
            buildPriorSuggestion({
              fieldName: "category",
              rawTextMatch: "5-PW",
              suggestedValue: "IRON_SET",
              previousCorrectedValue: "IRON_SET",
              sourceLearningEventId: "category-event"
            }),
            buildPriorSuggestion({
              fieldName: "shaftFlex",
              rawTextMatch: "shaft firm",
              suggestedValue: "Stiff",
              previousCorrectedValue: "Stiff",
              sourceLearningEventId:
                "shaft-flex-event"
            }),
            buildPriorSuggestion({
              fieldName: "conditionGrade",
              rawTextMatch: "cond avg",
              suggestedValue: "8.0 Average",
              previousCorrectedValue:
                "8.0 Average",
              sourceLearningEventId:
                "condition-event"
            }),
            buildPriorSuggestion({
              fieldName: "tradeInValue",
              rawTextMatch: "value $145",
              suggestedValue: "$145",
              previousCorrectedValue: "$145",
              sourceLearningEventId:
                "trade-value-event"
            })
          ]
        });

      expect(
        candidates.map((candidate) => ({
          fieldName: candidate.suggestion.fieldName,
          candidateValue:
            candidate.suggestion.candidateValue,
          sourcePhrase:
            candidate.suggestion.sourcePhrase,
          reviewRequired:
            candidate.suggestion.reviewRequired,
          sourceType: candidate.sourceType,
          sourceEvidenceId:
            candidate.sourceEvidenceId
        }))
      ).toEqual([
        {
          fieldName: "brand",
          candidateValue: "Callaway",
          sourcePhrase: "Cally",
          reviewRequired: true,
          sourceType: "PRIOR_REVIEW",
          sourceEvidenceId:
            "record-1:prior-review"
        },
        {
          fieldName: "productLine",
          candidateValue: "Rogue ST Max",
          sourcePhrase: "Rogue ST mx",
          reviewRequired: true,
          sourceType: "PRIOR_REVIEW",
          sourceEvidenceId:
            "record-1:prior-review"
        },
        {
          fieldName: "category",
          candidateValue: "IRON_SET",
          sourcePhrase: "5-PW",
          reviewRequired: true,
          sourceType: "PRIOR_REVIEW",
          sourceEvidenceId:
            "record-1:prior-review"
        },
        {
          fieldName: "shaftFlex",
          candidateValue: "STIFF",
          sourcePhrase: "shaft firm",
          reviewRequired: true,
          sourceType: "PRIOR_REVIEW",
          sourceEvidenceId:
            "record-1:prior-review"
        },
        {
          fieldName: "conditionGrade",
          candidateValue: "8.0 Average",
          sourcePhrase: "cond avg",
          reviewRequired: true,
          sourceType: "PRIOR_REVIEW",
          sourceEvidenceId:
            "record-1:prior-review"
        },
        {
          fieldName: "tradeInValue",
          candidateValue: 145,
          sourcePhrase: "value $145",
          reviewRequired: true,
          sourceType: "PRIOR_REVIEW",
          sourceEvidenceId:
            "record-1:prior-review"
        }
      ]);
    });

    it("withholds candidates that are not strong, missing, exact, applicable, or authoritative", () => {
      const baseInput = {
        recordId: "record-1",
        sourceText:
          "PING G425 putter shaft firm condition avg",
        missingFields: [
          "shaftFlex",
          "conditionGrade"
        ],
        fieldApplicability: {
          shaftFlex:
            "NOT_APPLICABLE" as const
        },
        productResolutionStatus:
          "MATCHED" as const,
        sourceEvidenceId: "record-1:prior-review"
      };

      const candidates =
        buildPriorReviewFieldRepairAdvisoryCandidates({
          ...baseInput,
          priorReviewSuggestions: [
            buildPriorSuggestion(),
            buildPriorSuggestion({
              fieldName: "conditionGrade",
              rawTextMatch: "condition avg",
              suggestedValue: "8.0 Average",
              strength: "MEDIUM",
              confidence: 0.78,
              sourceLearningEventId:
                "medium-event"
            }),
            buildPriorSuggestion({
              fieldName: "brand",
              rawTextMatch: "PING",
              suggestedValue: "PING",
              sourceLearningEventId:
                "matched-brand-event"
            }),
            buildPriorSuggestion({
              fieldName: "conditionGrade",
              rawTextMatch: "not in source",
              suggestedValue: "8.0 Average",
              sourceLearningEventId:
                "missing-phrase-event"
            }),
            buildPriorSuggestion({
              fieldName: "storeId",
              rawTextMatch: "PING",
              suggestedValue: "207",
              previousCorrectedValue: "207",
              sourceLearningEventId:
                "unsupported-field-event"
            })
          ]
        });

      expect(candidates).toEqual([]);
    });

    it("withholds all candidates for a field when strong prior corrections conflict", () => {
      const candidates =
        buildPriorReviewFieldRepairAdvisoryCandidates({
          recordId: "record-1",
          sourceText:
            "PING G425 shaft firm or flex smooth",
          missingFields: ["shaftFlex"],
          fieldApplicability: {
            shaftFlex: "REQUIRED"
          },
          productResolutionStatus: "MATCHED",
          sourceEvidenceId: "record-1:prior-review",
          priorReviewSuggestions: [
            buildPriorSuggestion({
              rawTextMatch: "shaft firm",
              suggestedValue: "STIFF",
              previousCorrectedValue: "STIFF",
              sourceLearningEventId:
                "stiff-event"
            }),
            buildPriorSuggestion({
              rawTextMatch: "flex smooth",
              suggestedValue: "REGULAR",
              previousCorrectedValue: "REGULAR",
              sourceLearningEventId:
                "regular-event"
            })
          ]
        });

      expect(candidates).toEqual([]);
    });

    it("keeps only the strongest duplicate candidate for the same field and value", () => {
      const candidates =
        buildPriorReviewFieldRepairAdvisoryCandidates({
          recordId: "record-1",
          sourceText:
            "PING G425 shaft firm flex firm",
          missingFields: ["shaftFlex"],
          fieldApplicability: {
            shaftFlex: "REQUIRED"
          },
          productResolutionStatus: "MATCHED",
          sourceEvidenceId: "record-1:prior-review",
          priorReviewSuggestions: [
            buildPriorSuggestion({
              rawTextMatch: "shaft firm",
              confidence: 0.94,
              sourceLearningEventId:
                "stronger-event"
            }),
            buildPriorSuggestion({
              rawTextMatch: "flex firm",
              confidence: 0.9,
              sourceLearningEventId:
                "weaker-event"
            })
          ]
        });

      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toMatchObject({
        candidateId:
          "prior-review:stronger-event:shaftFlex",
        suggestion: {
          fieldName: "shaftFlex",
          candidateValue: "STIFF",
          sourcePhrase: "shaft firm",
          confidence: 0.94,
          reviewRequired: true
        }
      });
    });

    it("preserves product candidate comparison precedence for ambiguous records", () => {
      expect(
        buildPriorReviewFieldRepairAdvisoryCandidates({
          recordId: "record-1",
          sourceText:
            "Titleist TSR shaft firm generation unclear",
          missingFields: ["shaftFlex"],
          fieldApplicability: {
            shaftFlex: "REQUIRED"
          },
          productResolutionStatus: "AMBIGUOUS",
          sourceEvidenceId: "record-1:prior-review",
          priorReviewSuggestions: [
            buildPriorSuggestion()
          ]
        })
      ).toEqual([]);
    });
  }
);
