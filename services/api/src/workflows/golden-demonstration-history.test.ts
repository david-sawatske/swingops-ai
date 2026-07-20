import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import {
  findPriorReviewLearningEvidence,
} from "../review-learning/review-learning-evidence.js";
import {
  ensureGoldenDemonstrationHistory,
  GOLDEN_DEMONSTRATION_HISTORY_IDS,
} from "./golden-demonstration-history.js";

async function removeGoldenDemonstrationHistory() {
  await prisma.humanReviewLearningEvent.deleteMany({
    where: {
      id: GOLDEN_DEMONSTRATION_HISTORY_IDS.learningEventId,
    },
  });

  await prisma.reviewedTradeInRecord.deleteMany({
    where: {
      reviewQueueItemId:
        GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
    },
  });

  await prisma.reviewQueueItem.deleteMany({
    where: {
      id: GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
    },
  });

  await prisma.workflowRun.deleteMany({
    where: {
      id: GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId,
    },
  });
}

describe("ensureGoldenDemonstrationHistory", () => {
  beforeEach(async () => {
    await removeGoldenDemonstrationHistory();
  });

  afterEach(async () => {
    await removeGoldenDemonstrationHistory();
  });

  it("creates one reusable historical correction and reuses it idempotently", async () => {
    const firstPreparation =
      await ensureGoldenDemonstrationHistory();
    const secondPreparation =
      await ensureGoldenDemonstrationHistory();

    expect(firstPreparation).toMatchObject({
      created: true,
      fieldName: "shaftFlex",
      rawTextMatch: "shaft firm",
      correctedValue: "STIFF",
    });
    expect(secondPreparation).toMatchObject({
      created: false,
      workflowRunId: firstPreparation.workflowRunId,
      reviewQueueItemId: firstPreparation.reviewQueueItemId,
      reviewedTradeInRecordId:
        firstPreparation.reviewedTradeInRecordId,
      learningEventId: firstPreparation.learningEventId,
    });

    const workflowRun = await prisma.workflowRun.findUniqueOrThrow({
      where: {
        id: GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId,
      },
    });
    const reviewQueueItem =
      await prisma.reviewQueueItem.findUniqueOrThrow({
        where: {
          id: GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
        },
      });
    const reviewedTradeInRecord =
      await prisma.reviewedTradeInRecord.findUniqueOrThrow({
        where: {
          reviewQueueItemId:
            GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
        },
      });
    const learningEvent =
      await prisma.humanReviewLearningEvent.findUniqueOrThrow({
        where: {
          id: GOLDEN_DEMONSTRATION_HISTORY_IDS.learningEventId,
        },
      });

    expect(workflowRun).toMatchObject({
      workflowName:
        "golden-demonstration-historical-review-evidence",
      status: "COMPLETED",
    });
    expect(reviewQueueItem).toMatchObject({
      workflowRunId: workflowRun.id,
      status: "RESOLVED",
      reason: "MISSING_REQUIRED_FIELDS",
    });
    expect(reviewedTradeInRecord).toMatchObject({
      reviewQueueItemId: reviewQueueItem.id,
      workflowRunId: workflowRun.id,
      correctedShaftFlex: "STIFF",
    });
    expect(learningEvent).toMatchObject({
      reviewedTradeInRecordId: reviewedTradeInRecord.id,
      reviewQueueItemId: reviewQueueItem.id,
      workflowRunId: workflowRun.id,
      fieldName: "shaftFlex",
      rawTextMatch: "shaft firm",
      correctedValue: "STIFF",
    });

    const evidence = await findPriorReviewLearningEvidence({
      rawText:
        "TaylorMade Stealth 2 driver shaft firm condition 9.0 Above Average trade value $155 store 104",
      parsedFields: {
        brand: "TaylorMade",
        productLine: "Stealth 2",
        category: "DRIVER",
        shaftFlex: null,
        conditionGrade: "9.0 Above Average",
        storeId: "104",
      },
      sourceType: "FREE_TEXT",
    });

    const reusableShaftFlexEvidence =
      evidence.find(
        (item) =>
          item.fieldName === "shaftFlex" &&
          item.rawTextMatch === "shaft firm" &&
          item.correctedValue?.toUpperCase() === "STIFF" &&
          item.strength === "STRONG",
      );

    expect(reusableShaftFlexEvidence).toBeDefined();

    await expect(
      prisma.workflowRun.count({
        where: {
          id: GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.reviewQueueItem.count({
        where: {
          id: GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.reviewedTradeInRecord.count({
        where: {
          reviewQueueItemId:
            GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.humanReviewLearningEvent.count({
        where: {
          id: GOLDEN_DEMONSTRATION_HISTORY_IDS.learningEventId,
        },
      }),
    ).resolves.toBe(1);
  });
});
