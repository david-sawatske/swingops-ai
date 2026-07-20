import { prisma } from "../lib/prisma.js";

export const GOLDEN_DEMONSTRATION_HISTORY_IDS = {
  workflowRunId: "golden_demo_history_workflow",
  reviewQueueItemId: "golden_demo_history_review",
  reviewedTradeInRecordId: "golden_demo_history_record",
  learningEventId: "golden_demo_history_learning_shaft_firm",
} as const;

const HISTORICAL_REVIEW_DATE = new Date("2026-06-30T15:00:00.000Z");

const HISTORICAL_SOURCE_TEXT =
  "Prior reviewed PING G425 iron set with shaft firm";

const HISTORICAL_REVIEWER_NOTE =
  "Reviewer confirmed that the source phrase shaft firm means STIFF.";

export type GoldenDemonstrationHistoryResult = {
  created: boolean;
  workflowRunId: string;
  reviewQueueItemId: string;
  reviewedTradeInRecordId: string;
  learningEventId: string;
  fieldName: "shaftFlex";
  rawTextMatch: "shaft firm";
  correctedValue: "STIFF";
};

export async function ensureGoldenDemonstrationHistory(): Promise<GoldenDemonstrationHistoryResult> {
  return prisma.$transaction(async (tx) => {
    const existingLearningEvent =
      await tx.humanReviewLearningEvent.findUnique({
        where: {
          id: GOLDEN_DEMONSTRATION_HISTORY_IDS.learningEventId,
        },
        select: {
          id: true,
        },
      });

    await tx.workflowRun.upsert({
      where: {
        id: GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId,
      },
      create: {
        id: GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId,
        workflowName: "golden-demonstration-historical-review-evidence",
        status: "COMPLETED",
        startedAt: HISTORICAL_REVIEW_DATE,
        completedAt: HISTORICAL_REVIEW_DATE,
        createdAt: HISTORICAL_REVIEW_DATE,
      },
      update: {
        workflowName: "golden-demonstration-historical-review-evidence",
        status: "COMPLETED",
        startedAt: HISTORICAL_REVIEW_DATE,
        completedAt: HISTORICAL_REVIEW_DATE,
      },
    });

    await tx.reviewQueueItem.upsert({
      where: {
        id: GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
      },
      create: {
        id: GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
        workflowRunId: GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId,
        reason: "MISSING_REQUIRED_FIELDS",
        status: "RESOLVED",
        originalText: HISTORICAL_SOURCE_TEXT,
        proposedGolfClubJson: {
          brand: "PING",
          productLine: "G425",
          category: "IRON_SET",
          shaftFlex: null,
          conditionGrade: "8.0 Average",
          tradeInValue: 210,
          missingFields: ["shaftFlex"],
        },
        reviewerNotes: HISTORICAL_REVIEWER_NOTE,
        resolvedAt: HISTORICAL_REVIEW_DATE,
        createdAt: HISTORICAL_REVIEW_DATE,
      },
      update: {
        workflowRunId: GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId,
        reason: "MISSING_REQUIRED_FIELDS",
        status: "RESOLVED",
        originalText: HISTORICAL_SOURCE_TEXT,
        proposedGolfClubJson: {
          brand: "PING",
          productLine: "G425",
          category: "IRON_SET",
          shaftFlex: null,
          conditionGrade: "8.0 Average",
          tradeInValue: 210,
          missingFields: ["shaftFlex"],
        },
        reviewerNotes: HISTORICAL_REVIEWER_NOTE,
        resolvedAt: HISTORICAL_REVIEW_DATE,
      },
    });

    const reviewedTradeInRecord =
      await tx.reviewedTradeInRecord.upsert({
        where: {
          reviewQueueItemId:
            GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
        },
        create: {
          id: GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewedTradeInRecordId,
          reviewQueueItemId:
            GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
          workflowRunId: GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId,
          originalText: HISTORICAL_SOURCE_TEXT,
          correctedBrand: "PING",
          correctedProductLine: "G425",
          correctedCategory: "IRON_SET",
          correctedShaftFlex: "STIFF",
          correctedConditionGrade: "8.0 Average",
          correctedDemoValue: 210,
          reviewerNotes: HISTORICAL_REVIEWER_NOTE,
          approvedAt: HISTORICAL_REVIEW_DATE,
          createdAt: HISTORICAL_REVIEW_DATE,
        },
        update: {
          workflowRunId: GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId,
          originalText: HISTORICAL_SOURCE_TEXT,
          correctedBrand: "PING",
          correctedProductLine: "G425",
          correctedCategory: "IRON_SET",
          correctedShaftFlex: "STIFF",
          correctedConditionGrade: "8.0 Average",
          correctedDemoValue: 210,
          reviewerNotes: HISTORICAL_REVIEWER_NOTE,
          approvedAt: HISTORICAL_REVIEW_DATE,
        },
      });

    await tx.humanReviewLearningEvent.upsert({
      where: {
        id: GOLDEN_DEMONSTRATION_HISTORY_IDS.learningEventId,
      },
      create: {
        id: GOLDEN_DEMONSTRATION_HISTORY_IDS.learningEventId,
        reviewedTradeInRecordId: reviewedTradeInRecord.id,
        reviewQueueItemId:
          GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
        workflowRunId: GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId,
        fieldName: "shaftFlex",
        rawTextMatch: "shaft firm",
        proposedValue: "Missing",
        correctedValue: "STIFF",
        evidenceText: "Reviewer corrected shaft firm to STIFF.",
        confidenceImpact:
          "Require reviewer confirmation before applying.",
        reviewerNotes: HISTORICAL_REVIEWER_NOTE,
        createdAt: HISTORICAL_REVIEW_DATE,
      },
      update: {
        reviewedTradeInRecordId: reviewedTradeInRecord.id,
        reviewQueueItemId:
          GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
        workflowRunId: GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId,
        fieldName: "shaftFlex",
        rawTextMatch: "shaft firm",
        proposedValue: "Missing",
        correctedValue: "STIFF",
        evidenceText: "Reviewer corrected shaft firm to STIFF.",
        confidenceImpact:
          "Require reviewer confirmation before applying.",
        reviewerNotes: HISTORICAL_REVIEWER_NOTE,
      },
    });

    return {
      created: existingLearningEvent === null,
      workflowRunId: GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId,
      reviewQueueItemId:
        GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
      reviewedTradeInRecordId: reviewedTradeInRecord.id,
      learningEventId: GOLDEN_DEMONSTRATION_HISTORY_IDS.learningEventId,
      fieldName: "shaftFlex",
      rawTextMatch: "shaft firm",
      correctedValue: "STIFF",
    };
  });
}
