import { describe, expect, it } from "vitest";

import { buildCorrectionDraft } from "./RecordReviewCardView";
import type { RecordReviewCard } from "./validationReviewTypes";

function buildReviewCard(overrides: Partial<RecordReviewCard> = {}): RecordReviewCard {
  return {
    id: "card-1",
    index: 0,
    label: "PING G425 · Iron set",
    status: "needs-review",
    statusLabel: "needs review",
    parsedRecord: {
      brand: "PING",
      productLine: "G425",
      category: "IRON_SET",
    },
    reviewItem: {
      id: "review-1",
      workflowRunId: "workflow-1",
      intakeItemId: "intake-item-1",
      status: "OPEN",
      golfClubId: null,
      reason: "Shaft flex, condition, and trade-in value need reviewer confirmation.",
      resolvedAt: null,
      proposedGolfClubJson: {
        brand: "PING",
        productLine: "G425",
        category: "IRON_SET",
        shaftFlex: "STIFF",
        conditionGrade: "8.0 Average",
        tradeInValue: 100,
      },
      originalText: "PING G425 4-PW shaft unknown condition unclear value pending review",
      reviewerNotes: null,
      createdAt: "2026-07-04T00:00:00.000Z",
      updatedAt: "2026-07-04T00:00:00.000Z",
    },
    reviewOutcome: null,
    inventoryEvidence: null,
    valuationEvidence: null,
    sourceEvidence: "PING G425 4-PW shaft unknown condition unclear value pending review",
    priorReviewSuggestions: [],
    missingFields: ["shaftFlex", "conditionGrade", "demoValue"],
    reviewReasons: ["Shaft flex, condition, and trade-in value need reviewer confirmation."],
    validationChecks: [],
    retryEvents: [],
    suggestedAction: "Open the review correction form and confirm the missing fields.",
    ...overrides,
  };
}

describe("buildCorrectionDraft", () => {
  it("starts unresolved correction fields blank instead of using proposed fallback values", () => {
    const draft = buildCorrectionDraft(buildReviewCard());

    expect(draft.brand).toBe("PING");
    expect(draft.productLine).toBe("G425");
    expect(draft.category).toBe("IRON_SET");
    expect(draft.shaftFlex).toBe("");
    expect(draft.conditionGrade).toBe("");
    expect(draft.demoValue).toBe("");
  });

  it("keeps values that were already parsed or proposed when the field is not unresolved", () => {
    const draft = buildCorrectionDraft(
      buildReviewCard({
        parsedRecord: {
          brand: "Titleist",
          productLine: "TSR2",
          category: "FAIRWAY_WOOD",
          shaftFlex: "STIFF",
          conditionGrade: "8.0 Average",
          tradeInValue: 145,
        },
        sourceEvidence: "Titleist TSR2 3w shaft stiff condition 8.0 Average trade value $145",
        missingFields: [],
        reviewReasons: [],
      }),
    );

    expect(draft.brand).toBe("Titleist");
    expect(draft.productLine).toBe("TSR2");
    expect(draft.category).toBe("FAIRWAY_WOOD");
    expect(draft.shaftFlex).toBe("STIFF");
    expect(draft.conditionGrade).toBe("8.0 Average");
    expect(draft.demoValue).toBe("145");
  });

  it("does not infer condition from source text when condition is unresolved", () => {
    const draft = buildCorrectionDraft(
      buildReviewCard({
        parsedRecord: {
          brand: "Callaway",
          productLine: "Rogue ST Max",
          category: "DRIVER",
        },
        reviewItem: {
          id: "review-2",
          workflowRunId: "workflow-1",
          intakeItemId: "intake-item-2",
          status: "OPEN",
          golfClubId: null,
          reason: "Condition grade needs reviewer confirmation.",
          resolvedAt: null,
          proposedGolfClubJson: {
            brand: "Callaway",
            productLine: "Rogue ST Max",
            category: "DRIVER",
            conditionGrade: "8.0 Average",
          },
          originalText: "Callaway Rogue ST Max driver condition unclear",
          reviewerNotes: null,
          createdAt: "2026-07-04T00:00:00.000Z",
          updatedAt: "2026-07-04T00:00:00.000Z",
        },
        sourceEvidence: "Callaway Rogue ST Max driver condition unclear",
        missingFields: ["conditionGrade"],
      }),
    );

    expect(draft.conditionGrade).toBe("");
  });
});
