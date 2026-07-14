import { describe, expect, it } from "vitest";

import type {
  AiReadyIntakeRecord,
  ExecuteEndToEndAgenticTradeInDemoResponse,
  GlobalReviewQueueItem,
} from "../../../../types/workflow";
import type { RecordSummary } from "./finalRunReportTypes";
import {
  buildMergedRecord,
  getCorrectionSummaries,
  getRecordSummary,
  getSourceCandidateRecords,
} from "./finalRunReportUtils";

function makeCandidateRecord(overrides: Partial<RecordSummary> = {}): RecordSummary {
  return {
    id: "candidate-1",
    intakeItemId: "intake-item-1",
    sourceRecordId: "source-record-1",
    sourceName: "Free text",
    sourceType: "FREE_TEXT",
    supersededByAiReadyIntakeRecordId: null,
    supersededAt: null,
    supersededReason: null,
    label: "Titleist · TSR2 · Fairway Wood",
    brand: "Titleist",
    productLine: "TSR2",
    category: "FAIRWAY_WOOD",
    shaftFlex: "STIFF",
    conditionGrade: "8.0 Average",
    tradeInValue: 145,
    valueLabel: "$145",
    status: "READY_FOR_RAG",
    reviewNeeded: false,
    ragReady: true,
    missingFields: [],
    rawText: "Titleist TSR2 3w Stiff condition 8.0 Average value 145",
    cleanedText: "Titleist TSR2 3w Stiff condition 8.0 Average value 145",
    ...overrides,
  };
}

function makeResult(
  valuationEvidenceByItem: unknown = [],
  overrides: Partial<ExecuteEndToEndAgenticTradeInDemoResponse> = {},
): ExecuteEndToEndAgenticTradeInDemoResponse {
  return {
    parsedItems: [
      {
        id: "parsed-item-1",
        rawLine:
          "Titleist TSR2 3w Stiff condition 8.0 Average value 145",
        brand: "Titleist",
        productLine: "TSR2",
        model: "TSR2",
        category: "FAIRWAY_WOOD",
        loft: null,
        clubNumber: "3",
        shaftBrand: null,
        shaftModel: null,
        shaftFlex: "STIFF",
        conditionGrade: "8.0 Average",
        tradeInValue: 145,
        conditionNotes: [],
        accessoriesNotes: [],
        uncertaintyNotes: [],
        confidence: 0.94,
        missingFields: [],
      },
    ],
    knowledgeMatchesByItem: [],
    inventoryMatchesByItem: [],
    valuationEvidenceByItem,
    fieldRepairExecution: {
      modelCallLogId: "model-call-1",
      suggestions: [],
      jsonValid: true,
      validationPassed: true,
      validationErrors: [],
    },
    ...overrides,
  } as unknown as ExecuteEndToEndAgenticTradeInDemoResponse;
}

function makeReviewItem(
  overrides: Partial<GlobalReviewQueueItem> = {},
): GlobalReviewQueueItem {
  return {
    id: "review-item-1",
    intakeItemId: "intake-item-1",
    golfClubId: null,
    workflowRunId: "workflow-run-1",
    reason: "MISSING_FIELDS",
    status: "OPEN",
    originalText: "Titleist TSR2 3w Stiff condition 8.0 Average",
    proposedGolfClubJson: {
      brand: "Titleist",
      productLine: "TSR2",
      category: "FAIRWAY_WOOD",
      shaftFlex: "STIFF",
      conditionGrade: "8.0 Average",
    },
    reviewerNotes: null,
    resolvedAt: null,
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
    workflowRun: null,
    intakeItem: null,
    intakeBatch: null,
    reviewedTradeInRecord: null,
    humanReviewLearningEvents: [],
    ...overrides,
  };
}

describe("finalRunReportUtils", () => {
  it("keeps reviewed final records out of the Step 2 candidate lineage", () => {
    const sourceCandidate = {
      id: "source-candidate-1",
    } as AiReadyIntakeRecord;
    const reviewedFinalRecord = {
      id: "reviewed-final-1",
    } as AiReadyIntakeRecord;

    expect(
      getSourceCandidateRecords(
        [sourceCandidate, reviewedFinalRecord],
        [reviewedFinalRecord],
      ),
    ).toEqual([sourceCandidate]);
  });

  it("keeps a clear candidate record ready when no review item exists", () => {
    const mergedRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord(),
      index: 0,
      result: makeResult(),
      reviewItems: [],
    });

    expect(mergedRecord.finalReviewLabel).toBe("Clear");
    expect(mergedRecord.finalReviewDetail).toBe("No review item open");
    expect(mergedRecord.status).toBe("READY_FOR_RAG");
    expect(mergedRecord.ragReady).toBe(true);
    expect(mergedRecord.reviewNeeded).toBe(false);
  });

  it("applies human review corrections to the finalized record", () => {
    const mergedRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord({
        shaftFlex: "REGULAR",
        conditionGrade: "7.0 Below Average",
        tradeInValue: null,
        valueLabel: "—",
        reviewNeeded: true,
        ragReady: false,
        status: "NEEDS_REVIEW",
      }),
      index: 0,
      result: makeResult(),
      reviewItems: [
        makeReviewItem({
          status: "RESOLVED",
          reviewedTradeInRecord: {
            id: "reviewed-record-1",
            reviewQueueItemId: "review-item-1",
            workflowRunId: "workflow-run-1",
            intakeItemId: "intake-item-1",
            originalText: "Titleist TSR2 3w Regular condition 7.0 Below Average",
            correctedBrand: "Titleist",
            correctedProductLine: "TSR2",
            correctedCategory: "FAIRWAY_WOOD",
            correctedShaftFlex: "STIFF",
            correctedConditionGrade: "8.0 Average",
            correctedDemoValue: 145,
            demoValuationNote: null,
            reviewerNotes: "Corrected flex, condition and value.",
            approvedAt: "2026-06-30T00:00:00.000Z",
            createdAt: "2026-06-30T00:00:00.000Z",
            updatedAt: "2026-06-30T00:00:00.000Z",
          },
          humanReviewLearningEvents: [
            {
              id: "learning-event-1",
              reviewedTradeInRecordId: "reviewed-record-1",
              reviewQueueItemId: "review-item-1",
              workflowRunId: "workflow-run-1",
              intakeItemId: "intake-item-1",
              fieldName: "shaftFlex",
              rawTextMatch: "Regular",
              proposedValue: "Regular",
              correctedValue: "Stiff",
              evidenceText: "Reviewer selected Stiff.",
              confidenceImpact: "HIGH",
              reviewerNotes: null,
              createdAt: "2026-06-30T00:00:00.000Z",
            },
          ],
        }),
      ],
    });

    expect(mergedRecord.finalReviewLabel).toBe("Resolved");
    expect(mergedRecord.finalReviewDetail).toBe("Human correction applied");
    expect(mergedRecord.status).toBe("READY_FOR_RAG");
    expect(mergedRecord.ragReady).toBe(true);
    expect(mergedRecord.reviewNeeded).toBe(false);
    expect(mergedRecord.shaftFlex).toBe("STIFF");
    expect(mergedRecord.conditionGrade).toBe("8.0 Average");
    expect(mergedRecord.tradeInValue).toBe(145);
    expect(mergedRecord.valueLabel).toBe("$145");
    expect(mergedRecord.transformationNotes).toContain("Step 4 resolved review item");
  });

  it("marks a corrected record resolved when source text matches but the candidate started incomplete", () => {
    const sourceText =
      "Callaway Apex UW 19 degree Ventus Blue R condition 8.0 Average value $165 store 104";

    const mergedRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord({
        id: "candidate-callaway-uw",
        intakeItemId: null,
        label: "Callaway",
        brand: "Callaway",
        productLine: null,
        category: null,
        shaftFlex: null,
        conditionGrade: "8.0 Average",
        tradeInValue: 165,
        valueLabel: "$165",
        status: "NEEDS_REVIEW",
        reviewNeeded: true,
        ragReady: false,
        missingFields: ["productLine", "category", "shaftFlex"],
        rawText: sourceText,
        cleanedText: sourceText,
      }),
      index: 0,
      result: makeResult(),
      reviewItems: [
        makeReviewItem({
          intakeItemId: "intake-item-10",
          status: "RESOLVED",
          originalText: sourceText,
          proposedGolfClubJson: {
            id: "parsed_item_10",
            brand: "Callaway",
            productLine: null,
            category: null,
            shaftFlex: null,
            conditionGrade: "8.0 Average",
            tradeInValue: 165,
            rawLine: sourceText,
          },
          reviewedTradeInRecord: {
            id: "reviewed-record-10",
            reviewQueueItemId: "review-item-1",
            workflowRunId: "workflow-run-1",
            intakeItemId: "intake-item-10",
            originalText: sourceText,
            correctedBrand: "Callaway",
            correctedProductLine: "Apex UW",
            correctedCategory: "FAIRWAY_WOOD",
            correctedShaftFlex: "REGULAR",
            correctedConditionGrade: "8.0 Average",
            correctedDemoValue: 111,
            demoValuationNote: null,
            reviewerNotes: "Corrected utility wood details.",
            approvedAt: "2026-06-30T00:00:00.000Z",
            createdAt: "2026-06-30T00:00:00.000Z",
            updatedAt: "2026-06-30T00:00:00.000Z",
          },
        }),
      ],
    });

    expect(mergedRecord.finalReviewLabel).toBe("Resolved");
    expect(mergedRecord.finalReviewDetail).toBe("Human correction applied");
    expect(mergedRecord.status).toBe("READY_FOR_RAG");
    expect(mergedRecord.reviewNeeded).toBe(false);
    expect(mergedRecord.ragReady).toBe(true);
    expect(mergedRecord.label).toBe("Callaway · Apex UW · Fairway Wood");
    expect(mergedRecord.productLine).toBe("Apex UW");
    expect(mergedRecord.category).toBe("FAIRWAY_WOOD");
    expect(mergedRecord.shaftFlex).toBe("REGULAR");
    expect(mergedRecord.tradeInValue).toBe(111);
  });

  it("still resolves a corrected record when persisted intake ids differ but source text matches", () => {
    const sourceText =
      "Callaway Apex UW 19 degree Ventus Blue R condition 8.0 Average value $165 store 104";

    const mergedRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord({
        id: "candidate-callaway-uw",
        intakeItemId: "step-2-intake-item-10",
        label: "Callaway",
        brand: "Callaway",
        productLine: null,
        category: null,
        shaftFlex: null,
        conditionGrade: "8.0 Average",
        tradeInValue: 165,
        valueLabel: "$165",
        status: "NEEDS_REVIEW",
        reviewNeeded: true,
        ragReady: false,
        missingFields: ["productLine", "category", "shaftFlex"],
        rawText: sourceText,
        cleanedText: sourceText,
      }),
      index: 0,
      result: makeResult(),
      reviewItems: [
        makeReviewItem({
          intakeItemId: "step-3-review-intake-item-10",
          status: "RESOLVED",
          originalText: sourceText,
          proposedGolfClubJson: {
            id: "parsed_item_10",
            brand: "Callaway",
            productLine: null,
            category: null,
            shaftFlex: null,
            conditionGrade: "8.0 Average",
            tradeInValue: 165,
            rawLine: sourceText,
          },
          reviewedTradeInRecord: {
            id: "reviewed-record-10",
            reviewQueueItemId: "review-item-1",
            workflowRunId: "workflow-run-1",
            intakeItemId: "step-3-review-intake-item-10",
            originalText: sourceText,
            correctedBrand: "Callaway",
            correctedProductLine: "Apex UW",
            correctedCategory: "FAIRWAY_WOOD",
            correctedShaftFlex: "REGULAR",
            correctedConditionGrade: "8.0 Average",
            correctedDemoValue: 111,
            demoValuationNote: null,
            reviewerNotes: "Corrected utility wood details.",
            approvedAt: "2026-06-30T00:00:00.000Z",
            createdAt: "2026-06-30T00:00:00.000Z",
            updatedAt: "2026-06-30T00:00:00.000Z",
          },
        }),
      ],
    });

    expect(mergedRecord.finalReviewLabel).toBe("Resolved");
    expect(mergedRecord.status).toBe("READY_FOR_RAG");
    expect(mergedRecord.reviewNeeded).toBe(false);
    expect(mergedRecord.label).toBe("Callaway · Apex UW · Fairway Wood");
  });

  it("matches corrected records when the candidate source text includes a leading row number", () => {
    const sourceText =
      "Callaway Apex UW 19 degree Ventus Blue R condition 8.0 Average value $165 store 104";

    const mergedRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord({
        id: "candidate-callaway-uw",
        intakeItemId: "step-2-intake-item-10",
        label: "Callaway",
        brand: "Callaway",
        productLine: null,
        category: null,
        shaftFlex: null,
        conditionGrade: "8.0 Average",
        tradeInValue: 165,
        valueLabel: "$165",
        status: "NEEDS_REVIEW",
        reviewNeeded: true,
        ragReady: false,
        missingFields: ["productLine", "category", "shaftFlex"],
        rawText: `10) ${sourceText}`,
        cleanedText: "Callaway | 8.0 Average | value 165 | store 104",
      }),
      index: 0,
      result: makeResult(),
      reviewItems: [
        makeReviewItem({
          intakeItemId: "step-3-review-intake-item-10",
          status: "RESOLVED",
          originalText: sourceText,
          proposedGolfClubJson: {
            id: "parsed_item_10",
            brand: "Callaway",
            productLine: null,
            category: null,
            shaftFlex: null,
            conditionGrade: "8.0 Average",
            tradeInValue: 165,
            rawLine: sourceText,
          },
          reviewedTradeInRecord: {
            id: "reviewed-record-10",
            reviewQueueItemId: "review-item-1",
            workflowRunId: "workflow-run-1",
            intakeItemId: "step-3-review-intake-item-10",
            originalText: sourceText,
            correctedBrand: "Callaway",
            correctedProductLine: "Apex UW",
            correctedCategory: "FAIRWAY_WOOD",
            correctedShaftFlex: "REGULAR",
            correctedConditionGrade: "8.0 Average",
            correctedDemoValue: 165,
            demoValuationNote: null,
            reviewerNotes: "Corrected utility wood details.",
            approvedAt: "2026-06-30T00:00:00.000Z",
            createdAt: "2026-06-30T00:00:00.000Z",
            updatedAt: "2026-06-30T00:00:00.000Z",
          },
        }),
      ],
    });

    expect(mergedRecord.finalReviewLabel).toBe("Resolved");
    expect(mergedRecord.status).toBe("READY_FOR_RAG");
    expect(mergedRecord.reviewNeeded).toBe(false);
    expect(mergedRecord.label).toBe("Callaway · Apex UW · Fairway Wood");
  });

  it("keeps an open review item marked as needing review", () => {
    const mergedRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord({
        reviewNeeded: true,
        ragReady: false,
        status: "NEEDS_REVIEW",
      }),
      index: 0,
      result: makeResult(),
      reviewItems: [makeReviewItem({ status: "OPEN" })],
    });

    expect(mergedRecord.finalReviewLabel).toBe("Needs review");
    expect(mergedRecord.finalReviewDetail).toBe("Review item still open");
    expect(mergedRecord.status).toBe("NEEDS_REVIEW");
    expect(mergedRecord.reviewNeeded).toBe(true);
    expect(mergedRecord.ragReady).toBe(false);
  });

  it("uses a valuation range when trade-in value is missing", () => {
    const mergedRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord({
        missingFields: ["tradeInValue"],
        tradeInValue: null,
        valueLabel: "—",
        reviewNeeded: true,
        ragReady: false,
        status: "NEEDS_REVIEW",
      }),
      index: 0,
      result: makeResult([
        {
          recordIndex: 0,
          estimate: {
            lowValue: 130,
            highValue: 160,
          },
        },
      ]),
      reviewItems: [],
    });

    expect(mergedRecord.valueLabel).toBe("$130–$160");
    expect(mergedRecord.status).toBe("READY_FOR_RAG");
    expect(mergedRecord.ragReady).toBe(true);
    expect(mergedRecord.reviewNeeded).toBe(false);
    expect(mergedRecord.finalReviewLabel).toBe("Clear");
    expect(mergedRecord.finalReviewDetail).toBe("Cleared with workflow evidence");
    expect(mergedRecord.transformationNotes).toContain("Step 3 added valuation range $130–$160");
  });

  it("does not clear review when non-value fields are still missing", () => {
    const mergedRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord({
        missingFields: ["shaftFlex"],
        shaftFlex: null,
        tradeInValue: null,
        valueLabel: "—",
        reviewNeeded: true,
        ragReady: false,
        status: "NEEDS_REVIEW",
      }),
      index: 0,
      result: makeResult([
        {
          recordIndex: 0,
          estimate: {
            lowValue: 130,
            highValue: 160,
          },
        },
      ]),
      reviewItems: [],
    });

    expect(mergedRecord.valueLabel).toBe("$130–$160");
    expect(mergedRecord.status).toBe("NEEDS_REVIEW");
    expect(mergedRecord.ragReady).toBe(false);
    expect(mergedRecord.reviewNeeded).toBe(true);
    expect(mergedRecord.finalReviewLabel).toBe("Needs review");
    expect(mergedRecord.finalReviewDetail).toBe("Record still flagged for review");
  });

  it("falls back cleanly when no valuation range exists", () => {
    const mergedRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord({
        tradeInValue: null,
        valueLabel: "—",
      }),
      index: 0,
      result: makeResult(),
      reviewItems: [],
    });

    expect(mergedRecord.valueLabel).toBe("—");
    expect(mergedRecord.finalReviewDetail).toBe("No review item open");
    expect(mergedRecord.transformationNotes).toEqual([
      "No field changes; workflow evidence checked",
    ]);
  });

  it("preserves missing fields that remain after review", () => {
    const mergedRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord({
        missingFields: ["tradeInValue"],
        tradeInValue: null,
        valueLabel: "—",
        reviewNeeded: true,
        ragReady: false,
        status: "NEEDS_REVIEW",
      }),
      index: 0,
      result: makeResult(),
      reviewItems: [makeReviewItem({ status: "OPEN" })],
    });

    expect(mergedRecord.missingFields).toEqual(["tradeInValue"]);
    expect(mergedRecord.status).toBe("NEEDS_REVIEW");
  });

  it("lists only source normalization and persistence when no other record evidence contributed", () => {
    const mergedRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord(),
      index: 0,
      result: makeResult(),
      reviewItems: [],
    });

    expect(mergedRecord.provenanceEntries.map((entry) => entry.key)).toEqual([
      "SOURCE_NORMALIZATION",
      "PERSISTED_RECORD",
    ]);
    expect(mergedRecord.persistenceLabel).toBe("Finalized without review");
  });

  it("does not attribute evidence by array position when record identity does not match", () => {
    const mergedRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord({
        id: "candidate-callaway",
        intakeItemId: "intake-callaway",
        sourceRecordId: "source-callaway",
        label: "Callaway · Rogue ST Max · Driver",
        brand: "Callaway",
        productLine: "Rogue ST Max",
        category: "DRIVER",
        rawText:
          "Callaway Rogue ST Max driver Stiff condition 8.0 Average",
        cleanedText:
          "Callaway Rogue ST Max driver Stiff condition 8.0 Average",
        tradeInValue: null,
        valueLabel: "—",
      }),
      index: 0,
      result: makeResult(
        [
          {
            parsedItemId: "parsed-item-1",
            estimate: {
              lowValue: 130,
              highValue: 160,
            },
          },
        ],
        {
          knowledgeMatchesByItem: [
            {
              parsedItemId: "parsed-item-1",
              query: "Titleist TSR2 fairway wood",
              search: {
                query: "Titleist TSR2 fairway wood",
                results: [
                  {
                    chunkId: "chunk-1",
                    documentTitle: "Titleist reference",
                    sourceName: "Seeded reference",
                    chunkText: "Titleist TSR2 evidence.",
                    chunkType: "PRODUCT",
                    brand: "Titleist",
                    productLine: "TSR2",
                    category: "FAIRWAY_WOOD",
                    score: 0.91,
                    matchedTerms: ["Titleist", "TSR2"],
                    scoringExplanation: [],
                  },
                ],
                summary: "One unrelated reference match.",
              },
            },
          ],
          inventoryMatchesByItem: [
            {
              parsedItemId: "parsed-item-1",
              lookup: {
                productId: "titleist-product",
                sku: "titleist-sku",
                displayName: "Titleist TSR2 Fairway Wood",
                brand: "Titleist",
                productLine: "TSR2",
                category: "FAIRWAY_WOOD",
                year: 2022,
                confidence: 0.94,
                matchReasons: ["Unrelated record."],
                similarProducts: [],
              },
            },
          ],
          fieldRepairExecution: {
            modelCallLogId: "model-call-1",
            suggestions: [
              {
                recordId: "parsed-item-1",
                fieldName: "shaftFlex",
                sourcePhrase: "Stiff",
                candidateValue: "STIFF",
                confidence: 0.9,
                reason: "Unrelated record suggestion.",
                reviewRequired: true,
              },
            ],
            jsonValid: true,
            validationPassed: true,
            validationErrors: [],
          },
        },
      ),
      reviewItems: [],
    });

    expect(mergedRecord.valueLabel).toBe("—");
    expect(mergedRecord.provenanceEntries.map((entry) => entry.key)).toEqual([
      "SOURCE_NORMALIZATION",
      "PERSISTED_RECORD",
    ]);
  });

  it("lists knowledge, inventory, and valuation only when each system returned applicable evidence", () => {
    const mergedRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord(),
      index: 0,
      result: makeResult(
        [
          {
            parsedItemId: "parsed-item-1",
            estimate: {
              productId: "product-1",
              sku: "sku-1",
              lowValue: 130,
              highValue: 160,
              currency: "USD",
              confidence: "HIGH",
              valueFactors: [],
              adjustments: [],
              reviewRequired: false,
              reviewReasons: [],
            },
          },
        ],
        {
          knowledgeMatchesByItem: [
            {
              parsedItemId: "parsed-item-1",
              query: "Titleist TSR2 fairway wood",
              search: {
                query: "Titleist TSR2 fairway wood",
                results: [
                  {
                    chunkId: "chunk-1",
                    documentTitle: "Titleist product family",
                    sourceName: "Seeded reference",
                    chunkText: "TSR2 fairway wood reference.",
                    chunkType: "PRODUCT",
                    brand: "Titleist",
                    productLine: "TSR2",
                    category: "FAIRWAY_WOOD",
                    score: 0.91,
                    matchedTerms: ["Titleist", "TSR2"],
                    scoringExplanation: [],
                  },
                ],
                summary: "One reference match.",
              },
            },
          ],
          inventoryMatchesByItem: [
            {
              parsedItemId: "parsed-item-1",
              lookup: {
                productId: "product-1",
                sku: "sku-1",
                displayName: "Titleist TSR2 Fairway Wood",
                brand: "Titleist",
                productLine: "TSR2",
                category: "FAIRWAY_WOOD",
                year: 2022,
                confidence: 0.94,
                matchReasons: ["Brand and product line matched."],
                similarProducts: [],
              },
            },
          ],
        },
      ),
      reviewItems: [],
    });

    expect(mergedRecord.provenanceEntries.map((entry) => entry.key)).toEqual([
      "SOURCE_NORMALIZATION",
      "KNOWLEDGE_EVIDENCE",
      "INVENTORY_MATCH",
      "VALUATION_EVIDENCE",
      "PERSISTED_RECORD",
    ]);
  });

  it("attributes a model suggestion only when its record id matches", () => {
    const unrelatedRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord(),
      index: 0,
      result: makeResult([], {
        fieldRepairExecution: {
          modelCallLogId: "model-call-1",
          suggestions: [
            {
              recordId: "another-record",
              fieldName: "shaftFlex",
              sourcePhrase: "Stiff",
              candidateValue: "STIFF",
              confidence: 0.9,
              reason: "Possible repair.",
              reviewRequired: true,
            },
          ],
          jsonValid: true,
          validationPassed: true,
          validationErrors: [],
        },
      }),
      reviewItems: [],
    });

    expect(
      unrelatedRecord.provenanceEntries.some(
        (entry) => entry.key === "MODEL_SUGGESTION",
      ),
    ).toBe(false);

    const matchingRecord = buildMergedRecord({
      candidateRecord: makeCandidateRecord(),
      index: 0,
      result: makeResult([], {
        fieldRepairExecution: {
          modelCallLogId: "model-call-1",
          suggestions: [
            {
              recordId: "parsed-item-1",
              fieldName: "shaftFlex",
              sourcePhrase: "Stiff",
              candidateValue: "STIFF",
              confidence: 0.9,
              reason: "Possible repair.",
              reviewRequired: true,
            },
          ],
          jsonValid: true,
          validationPassed: true,
          validationErrors: [],
        },
      }),
      reviewItems: [],
    });

    expect(
      matchingRecord.provenanceEntries.some(
        (entry) => entry.key === "MODEL_SUGGESTION",
      ),
    ).toBe(true);
  });

  it("shows a human-approved correction and active replacement record", () => {
    const candidateRecord = makeCandidateRecord({
      status: "SUPERSEDED",
      supersededByAiReadyIntakeRecordId: "final-record-1",
      supersededAt: "2026-07-14T00:00:00.000Z",
      supersededReason: "Human review created the active final record.",
    });
    const finalRecord = makeCandidateRecord({
      id: "final-record-1",
      status: "READY_FOR_RAG",
    });

    const mergedRecord = buildMergedRecord({
      candidateRecord,
      finalRecords: [finalRecord],
      index: 0,
      result: makeResult(),
      reviewItems: [
        makeReviewItem({
          status: "RESOLVED",
          reviewedTradeInRecord: {
            id: "reviewed-record-1",
            reviewQueueItemId: "review-item-1",
            workflowRunId: "workflow-run-1",
            intakeItemId: "intake-item-1",
            originalText:
              "Titleist TSR2 3w Stiff condition 8.0 Average value 145",
            correctedBrand: "Titleist",
            correctedProductLine: "TSR2",
            correctedCategory: "FAIRWAY_WOOD",
            correctedShaftFlex: "STIFF",
            correctedConditionGrade: "8.0 Average",
            correctedDemoValue: 145,
            demoValuationNote: null,
            reviewerNotes: "Approved record.",
            approvedAt: "2026-07-14T00:00:00.000Z",
            createdAt: "2026-07-14T00:00:00.000Z",
            updatedAt: "2026-07-14T00:00:00.000Z",
          },
          humanReviewLearningEvents: [
            {
              id: "learning-event-1",
              reviewedTradeInRecordId: "reviewed-record-1",
              reviewQueueItemId: "review-item-1",
              workflowRunId: "workflow-run-1",
              intakeItemId: "intake-item-1",
              fieldName: "shaftFlex",
              rawTextMatch: "Stiff",
              proposedValue: "Stiff",
              correctedValue: "Stiff",
              evidenceText: "Reviewer approved Stiff.",
              confidenceImpact: "HIGH",
              reviewerNotes: null,
              createdAt: "2026-07-14T00:00:00.000Z",
            },
          ],
        }),
      ],
    });

    expect(mergedRecord.provenanceEntries.map((entry) => entry.key)).toContain(
      "HUMAN_CORRECTION",
    );
    expect(mergedRecord.persistenceLabel).toBe("Finalized after human review");
    expect(mergedRecord.persistedRecordId).toBe("final-record-1");
    expect(mergedRecord.replacedRecordId).toBe("candidate-1");
  });

  it("builds record summaries from normalized AI-ready intake records", () => {
    const summary = getRecordSummary(
      {
        id: "ai-ready-record-1",
        intakeBatchId: "batch-1",
        intakeItemId: "intake-item-1",
        workflowRunId: "workflow-run-1",
        sourceRecordId: "source-record-1",
        sourceType: "FREE_TEXT",
        sourceName: "Free text",
        rawText: "PING G425 irons Regular condition 6.0 Poor",
        cleanedText: "PING G425 irons Regular condition 6.0 Poor",
        normalizedJson: {
          id: "source-record-1",
          sourceId: "source-1",
          sourceType: "FREE_TEXT",
          brand: "PING",
          productLine: "G425",
          category: "IRON_SET",
          shaftFlex: "Regular",
          conditionGrade: "6.0 Poor",
          tradeInValue: null,
          customerName: null,
          customerEmail: null,
          storeId: null,
          eventTimestamp: null,
          attachmentsMentioned: [],
          missingFields: ["tradeInValue"],
          confidence: 0.82,
          reviewNeeded: true,
          normalizedText: "PING G425 irons Regular condition 6.0 Poor",
        },
        inferredSchemaJson: null,
        metadataJson: null,
        qualitySignalsJson: null,
        status: "NEEDS_REVIEW",
        reviewNeeded: true,
        embeddingReady: true,
        ragReady: false,
        createdAt: "2026-06-30T00:00:00.000Z",
        updatedAt: "2026-06-30T00:00:00.000Z",
      },
      0,
    );

    expect(summary.label).toBe("PING · G425 · Iron Set");
    expect(summary.valueLabel).toBe("—");
    expect(summary.missingFields).toEqual(["tradeInValue"]);
    expect(summary.reviewNeeded).toBe(true);
  });

  it("summarizes grouped human review corrections", () => {
    const correctionSummaries = getCorrectionSummaries([
      makeReviewItem({
        status: "RESOLVED",
        humanReviewLearningEvents: [
          {
            id: "learning-event-1",
            reviewedTradeInRecordId: "reviewed-record-1",
            reviewQueueItemId: "review-item-1",
            workflowRunId: "workflow-run-1",
            intakeItemId: "intake-item-1",
            fieldName: "conditionGrade",
            rawTextMatch: "condition missing",
            proposedValue: null,
            correctedValue: "8.0 Average",
            evidenceText: "Reviewer selected condition grade.",
            confidenceImpact: "HIGH",
            reviewerNotes: null,
            createdAt: "2026-06-30T00:00:00.000Z",
          },
        ],
      }),
    ]);

    expect(correctionSummaries).toEqual([
      {
        fieldName: "conditionGrade",
        label: "Condition Grade",
        recordLabel: "Titleist · TSR2 · Fairway Wood",
        beforeValue: "Missing",
        afterValue: "8.0 Average",
      },
    ]);
  });
});
