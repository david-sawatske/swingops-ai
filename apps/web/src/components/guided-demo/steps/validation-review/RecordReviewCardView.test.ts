import { describe, expect, it } from "vitest";

import {
  buildCorrectionDraft,
  buildLearningEvents,
  canApplyModelReviewSuggestion,
  getAppliedCorrectionSummaries,
  getBlockingCorrectionFields,
  getInventoryProductLineCandidates,
  getRecordCardSummary,
} from "./RecordReviewCardView";
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
    modelReviewOutcome: null,
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

  it("keeps an entered trade-in value when only valuation evidence needs review", () => {
    const draft = buildCorrectionDraft(
      buildReviewCard({
        parsedRecord: {
          brand: "Titleist",
          productLine: "TSR",
          category: "FAIRWAY_WOOD",
          shaftFlex: "STIFF",
          conditionGrade: "8.0 Average",
          tradeInValue: 135,
        },
        reviewItem: {
          id: "review-valuation",
          workflowRunId: "workflow-1",
          intakeItemId: "intake-item-valuation",
          status: "OPEN",
          golfClubId: null,
          reason: "AMBIGUOUS_INPUT",
          resolvedAt: null,
          proposedGolfClubJson: {
            brand: "Titleist",
            productLine: "TSR",
            category: "FAIRWAY_WOOD",
            shaftFlex: "STIFF",
            conditionGrade: "8.0 Average",
            tradeInValue: 135,
            missingFields: [],
          },
          originalText:
            "Titleist TSR fairway wood, Stiff, 8.0 Average, trade value $135, generation unclear.",
          reviewerNotes: null,
          createdAt: "2026-07-14T00:00:00.000Z",
          updatedAt: "2026-07-14T00:00:00.000Z",
        },
        sourceEvidence:
          "Titleist TSR fairway wood, Stiff, 8.0 Average, trade value $135, generation unclear.",
        missingFields: [],
        reviewReasons: [
          "No internal product match was available for valuation.",
        ],
        validationChecks: [
          {
            id: "valuation-warning",
            label: "Demo valuation range generated",
            status: "WARNING",
            severity: "MEDIUM",
            message: "No demo valuation range was generated.",
            field: "demoValuationRange",
            recordId: "parsed-item-1",
            reviewRequired: true,
          },
        ],
      }),
    );

    expect(draft.demoValue).toBe("135");
  });


  it("returns only the strongest same-brand inventory candidates", () => {
    const card = buildReviewCard({
      parsedRecord: {
        brand: "Titleist",
        productLine: "TSR",
        category: "FAIRWAY_WOOD",
        shaftFlex: "STIFF",
        conditionGrade: "8.0 Average",
        tradeInValue: 135,
      },
      inventoryEvidence: {
        parsedItemId: "parsed-item-1",
        lookup: {
          similarProducts: [
            {
              productId: "tsr2",
              sku: "TITLEIST-TSR2-FWY-2023",
              brand: "Titleist",
              productLine: "TSR2",
              category: "FAIRWAY_WOOD",
              confidence: 0.58,
              reason: "Brand matched Titleist.",
            },
            {
              productId: "tsr3",
              sku: "TITLEIST-TSR3-FWY-2023",
              brand: "Titleist",
              productLine: "TSR3",
              category: "FAIRWAY_WOOD",
              confidence: 0.58,
              reason: "Brand matched Titleist.",
            },
            {
              productId: "ts2",
              sku: "TITLEIST-TS2-FWY-2019",
              brand: "Titleist",
              productLine: "TS2",
              category: "FAIRWAY_WOOD",
              confidence: 0.4,
              reason: "Brand matched Titleist.",
            },
            {
              productId: "other-brand",
              sku: "OTHER-FWY",
              brand: "Other",
              productLine: "Other Fairway",
              category: "FAIRWAY_WOOD",
              confidence: 0.58,
              reason: "Category matched.",
            },
          ],
        },
      },
    });

    expect(
      getInventoryProductLineCandidates(card).map(
        (candidate) => candidate.productLine,
      ),
    ).toEqual(["TSR2", "TSR3"]);
  });


  it("requires an ambiguous product line to be replaced before resolution", () => {
    const card = buildReviewCard({
      parsedRecord: {
        brand: "Titleist",
        productLine: "TSR",
        category: "FAIRWAY_WOOD",
        shaftFlex: "STIFF",
        conditionGrade: "8.0 Average",
        tradeInValue: 135,
      },
      reviewItem: {
        id: "review-tsr",
        workflowRunId: "workflow-1",
        intakeItemId: "intake-item-tsr",
        status: "OPEN",
        golfClubId: null,
        reason: "AMBIGUOUS_INPUT",
        resolvedAt: null,
        proposedGolfClubJson: {
          brand: "Titleist",
          productLine: "TSR",
          category: "FAIRWAY_WOOD",
          shaftFlex: "STIFF",
          conditionGrade: "8.0 Average",
          tradeInValue: 135,
          missingFields: [],
          uncertaintyNotes: ["model uncertain"],
        },
        originalText:
          "Titleist TSR fairway wood, Stiff, 8.0 Average, trade value $135, generation unclear.",
        reviewerNotes: null,
        createdAt: "2026-07-15T00:00:00.000Z",
        updatedAt: "2026-07-15T00:00:00.000Z",
      },
      sourceEvidence:
        "Titleist TSR fairway wood, Stiff, 8.0 Average, trade value $135, generation unclear.",
      missingFields: [],
      reviewReasons: ["uncertainty: model uncertain"],
    });

    const initialDraft = buildCorrectionDraft(card);

    expect(initialDraft.productLine).toBe("");
    expect(
      getBlockingCorrectionFields(card, initialDraft),
    ).toEqual(["productLine"]);

    expect(
      getBlockingCorrectionFields(card, {
        ...initialDraft,
        productLine: "TSR",
      }),
    ).toEqual(["productLine"]);

    expect(
      getBlockingCorrectionFields(card, {
        ...initialDraft,
        productLine: "TSR2",
      }),
    ).toEqual([]);
  });


  it("allows explicit confirmation of a provisional value when it is a supplied catalog candidate", () => {
    const card = buildReviewCard({
      parsedRecord: {
        brand: "Titleist",
        productLine: "TSR2",
        category: "FAIRWAY_WOOD",
        shaftFlex: "STIFF",
        conditionGrade: "9.0 Above Average",
        tradeInValue: 185,
      },
      reviewItem: {
        id: "review-tsr-confirmation",
        workflowRunId: "workflow-1",
        intakeItemId: "intake-item-tsr-confirmation",
        status: "OPEN",
        golfClubId: null,
        reason: "AMBIGUOUS_INPUT",
        resolvedAt: null,
        proposedGolfClubJson: {
          brand: "Titleist",
          productLine: "TSR2",
          category: "FAIRWAY_WOOD",
          shaftFlex: "STIFF",
          conditionGrade: "9.0 Above Average",
          tradeInValue: 185,
          missingFields: [],
          uncertaintyNotes: ["model uncertain"],
        },
        originalText:
          "Titleist TSR fairway wood, maybe TSR2 or TSR3, stiff shaft, condition 9.0 Above Average, trade value $185.",
        reviewerNotes: null,
        createdAt: "2026-07-17T00:00:00.000Z",
        updatedAt: "2026-07-17T00:00:00.000Z",
      },
      sourceEvidence:
        "Titleist TSR fairway wood, maybe TSR2 or TSR3, stiff shaft, condition 9.0 Above Average, trade value $185.",
      missingFields: [],
      reviewReasons: ["uncertainty: model uncertain"],
      inventoryEvidence: {
        parsedItemId: "parsed-item-tsr-confirmation",
        lookup: {
          similarProducts: [
            {
              productId: "tsr2",
              sku: "TITLEIST-TSR2-FWY-2023",
              brand: "Titleist",
              productLine: "TSR2",
              category: "FAIRWAY_WOOD",
              confidence: 0.58,
              reason: "Brand and category matched.",
            },
            {
              productId: "tsr3",
              sku: "TITLEIST-TSR3-FWY-2023",
              brand: "Titleist",
              productLine: "TSR3",
              category: "FAIRWAY_WOOD",
              confidence: 0.58,
              reason: "Brand and category matched.",
            },
          ],
        },
      },
    });

    const initialDraft = buildCorrectionDraft(card);

    expect(initialDraft.productLine).toBe("");
    expect(
      getBlockingCorrectionFields(card, initialDraft),
    ).toEqual(["productLine"]);

    expect(
      getBlockingCorrectionFields(card, {
        ...initialDraft,
        productLine: "TSR",
      }),
    ).toEqual(["productLine"]);

    expect(
      getBlockingCorrectionFields(card, {
        ...initialDraft,
        productLine: "TSR2",
      }),
    ).toEqual([]);

    expect(
      getBlockingCorrectionFields(card, {
        ...initialDraft,
        productLine: "TSR3",
      }),
    ).toEqual([]);
  });

  it("treats a source-supported unresolved product as catalog confirmation instead of a missing-field correction", () => {
    const card = buildReviewCard({
      label: "PING G430 · Driver",
      parsedRecord: {
        brand: "PING",
        productLine: "G430",
        category: "DRIVER",
        shaftFlex: "REGULAR",
        conditionGrade: "8.0 Average",
        tradeInValue: 180,
      },
      reviewItem: {
        id: "review-g430-unresolved",
        workflowRunId: "workflow-1",
        intakeItemId: "intake-item-g430",
        status: "OPEN",
        golfClubId: null,
        reason: "PRODUCT_UNRESOLVED",
        resolvedAt: null,
        proposedGolfClubJson: {
          brand: "PING",
          productLine: "G430",
          category: "DRIVER",
          shaftFlex: "REGULAR",
          conditionGrade: "8.0 Average",
          tradeInValue: 180,
          missingFields: [],
        },
        originalText:
          "PING G430 DRIVER — shaft flex REGULAR; condition 8.0 Average; trade value $180; store 207; source evidence: PING,G430,driver,R,8.0 Average,$180,207",
        reviewerNotes: null,
        createdAt: "2026-07-17T00:00:00.000Z",
        updatedAt: "2026-07-17T00:00:00.000Z",
      },
      modelReviewOutcome: {
        outcomeType: "NO_SAFE_REPAIR",
        recordId: "parsed_item_2",
        summary:
          "Product resolution is unresolved but the source-supported product text is G430.",
        evidenceIds: [
          "parsed_item_2:parser",
          "parsed_item_2:product-resolution",
        ],
        reviewerQuestion:
          "Can the catalog identity for the source-supported PING G430 be confirmed?",
        reasonCodes: [
          "PRODUCT_UNRESOLVED",
          "VALUATION_REVIEW_REQUIRED",
        ],
      },
      sourceEvidence:
        "PING G430 DRIVER — shaft flex REGULAR; condition 8.0 Average; trade value $180; store 207; source evidence: PING,G430,driver,R,8.0 Average,$180,207",
      missingFields: [],
      reviewReasons: [
        "Product resolution is unresolved.",
        "No internal product match was available for valuation.",
      ],
      inventoryEvidence: {
        parsedItemId: "parsed_item_2",
        lookup: {
          similarProducts: [
            {
              productId: "prod_ping_g430_max_driver",
              sku: "PING-G430-MAX-DRV",
              brand: "PING",
              productLine: "G430 Max",
              category: "DRIVER",
              confidence: 0.58,
              reason:
                "Brand and category matched, but the source did not specify Max.",
            },
          ],
        },
      },
    });

    const draft =
      buildCorrectionDraft(card);

    expect(
      getRecordCardSummary(card),
    ).toBe(
      "Catalog identity confirmation: G430",
    );

    expect(draft.productLine).toBe(
      "G430",
    );

    expect(
      getBlockingCorrectionFields(
        card,
        draft,
      ),
    ).toEqual([]);

    expect(
      buildLearningEvents(
        card,
        draft,
      ),
    ).toEqual([]);
  });



  it("summarizes the value applied from a prior review suggestion", () => {
    const draft = {
      ...buildCorrectionDraft(buildReviewCard()),
      productLine: "TSR2",
    };

    expect(
      getAppliedCorrectionSummaries(
        draft,
        new Set(["productLine"]),
      ),
    ).toEqual([
      {
        fieldName: "productLine",
        label: "Product line",
        value: "TSR2",
      },
    ]);
  });

});


describe("model suggestion action availability", () => {
  const repairOutcome = {
    outcomeType: "REPAIR_SUGGESTED" as const,
    recordId: "parsed_item_1",
    summary:
      "A reviewer-controlled repair is available.",
    evidenceIds: [
      "parsed_item_1:parser"
    ],
    reviewerQuestion:
      "Should the suggested value be applied?",
    suggestions: [
      {
        recordId: "parsed_item_1",
        fieldName: "shaftFlex" as const,
        sourcePhrase: "shaft firm",
        candidateValue: "STIFF",
        confidence: 0.94,
        reason:
          "Prior approved evidence supports Stiff.",
        reviewRequired: true
      }
    ]
  };

  it("allows the model suggestion action for active review work", () => {
    expect(
      canApplyModelReviewSuggestion(
        buildReviewCard({
          modelReviewOutcome:
            repairOutcome
        })
      )
    ).toBe(true);
  });

  it("withholds the model suggestion action after resolution", () => {
    const openCard =
      buildReviewCard({
        modelReviewOutcome:
          repairOutcome
      });

    expect(
      canApplyModelReviewSuggestion({
        ...openCard,
        status: "resolved",
        statusLabel: "Resolved",
        reviewItem: openCard.reviewItem
          ? {
              ...openCard.reviewItem,
              status: "RESOLVED",
              resolvedAt:
                "2026-07-18T18:00:00.000Z"
            }
          : null
      })
    ).toBe(false);
  });

  it("withholds the model suggestion action after dismissal", () => {
    const openCard =
      buildReviewCard({
        modelReviewOutcome:
          repairOutcome
      });

    expect(
      canApplyModelReviewSuggestion({
        ...openCard,
        status: "resolved",
        statusLabel: "Dismissed",
        reviewItem: openCard.reviewItem
          ? {
              ...openCard.reviewItem,
              status: "DISMISSED",
              resolvedAt:
                "2026-07-18T18:00:00.000Z"
            }
          : null
      })
    ).toBe(false);
  });
});
