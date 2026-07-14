import { describe, expect, it } from "vitest";

import {
  findMatchingReviewItem,
  getParserEvidenceForField,
} from "./validationReviewUtils";

describe("getParserEvidenceForField", () => {
  it("returns exact parser evidence for a normalized field", () => {
    expect(
      getParserEvidenceForField(
        {
          parserEvidence: {
            shaftFlex: {
              value: "STIFF",
              sourceText: "shaft stiff",
            },
          },
        },
        ["shaftFlex"],
      ),
    ).toEqual({
      value: "STIFF",
      sourceText: "shaft stiff",
    });
  });

  it("does not return parser evidence without a known source phrase", () => {
    expect(
      getParserEvidenceForField(
        {
          parserEvidence: {
            shaftFlex: {
              value: "STIFF",
              sourceText: "",
            },
          },
        },
        ["shaftFlex"],
      ),
    ).toBeNull();
  });
});


function createReviewItem(input: {
  id: string;
  parsedItemId: string;
  brand: string;
  productLine: string | null;
  originalText: string;
}) {
  return {
    id: input.id,
    intakeItemId: null,
    golfClubId: null,
    workflowRunId: "workflow-run-1",
    reason: "Needs review",
    status: "OPEN",
    originalText: input.originalText,
    proposedGolfClubJson: {
      id: input.parsedItemId,
      brand: input.brand,
      productLine: input.productLine,
    },
    reviewerNotes: null,
    resolvedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as const;
}

describe("findMatchingReviewItem", () => {
  it("matches review items by parsed item identity", () => {
    const reviewItem = createReviewItem({
      id: "review-item-9",
      parsedItemId: "parsed_item_9",
      brand: "PING",
      productLine: "G425",
      originalText:
        "PING G425 4-PW shaft unknown condition unclear value pending review store 207",
    });

    expect(
      findMatchingReviewItem({
        parsedRecord: {
          id: "parsed_item_9",
          brand: "PING",
          productLine: "G425",
        },
        reviewItems: [reviewItem],
        usedReviewItemIds: new Set(),
      }),
    ).toBe(reviewItem);
  });

  it("does not attach review evidence to a similar product record", () => {
    const reviewItem = createReviewItem({
      id: "review-item-9",
      parsedItemId: "parsed_item_9",
      brand: "PING",
      productLine: "G425",
      originalText:
        "PING G425 4-PW shaft unknown condition unclear value pending review store 207",
    });

    expect(
      findMatchingReviewItem({
        parsedRecord: {
          id: "parsed_item_3",
          brand: "PING",
          productLine: "G425",
        },
        reviewItems: [reviewItem],
        usedReviewItemIds: new Set(),
      }),
    ).toBeNull();
  });

  it("does not fall back to the first unused review item for unrelated low-confidence records", () => {
    const reviewItem = createReviewItem({
      id: "review-item-10",
      parsedItemId: "parsed_item_10",
      brand: "Callaway",
      productLine: null,
      originalText:
        "Callaway Apex UW 19 degree Ventus Blue R condition 8.0 Average value $165 store 104",
    });

    expect(
      findMatchingReviewItem({
        parsedRecord: {
          id: "parsed_item_7",
          brand: "Callaway",
          productLine: "Rogue ST Max",
          confidence: 0.45,
          missingFields: ["shaftFlex"],
          reviewNeeded: true,
        },
        reviewItems: [reviewItem],
        usedReviewItemIds: new Set(),
      }),
    ).toBeNull();
  });
});
