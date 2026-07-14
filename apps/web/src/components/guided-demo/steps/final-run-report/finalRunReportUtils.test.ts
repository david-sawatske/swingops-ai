import { describe, expect, it } from "vitest";

import type {
  ExecuteEndToEndAgenticTradeInDemoResponse,
  GlobalReviewQueueItem,
} from "../../../../types/workflow";
import type { RecordSummary } from "./finalRunReportTypes";
import {
  buildMergedRecord,
  getCorrectionSummaries,
  getRecordSummary,
} from "./finalRunReportUtils";

function makeCandidateRecord(overrides: Partial<RecordSummary> = {}): RecordSummary {
  return {
    id: "candidate-1",
    intakeItemId: "intake-item-1",
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
): ExecuteEndToEndAgenticTradeInDemoResponse {
  return {
    valuationEvidenceByItem,
  } as ExecuteEndToEndAgenticTradeInDemoResponse;
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
