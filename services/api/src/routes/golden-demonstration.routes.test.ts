import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from "vitest";

import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import {
  GOLDEN_DEMONSTRATION_HISTORY_IDS
} from "../workflows/golden-demonstration-history.js";

async function removeGoldenDemonstrationHistory() {
  await prisma.humanReviewLearningEvent.deleteMany({
    where: {
      id:
        GOLDEN_DEMONSTRATION_HISTORY_IDS.learningEventId
    }
  });

  await prisma.reviewedTradeInRecord.deleteMany({
    where: {
      reviewQueueItemId:
        GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId
    }
  });

  await prisma.reviewQueueItem.deleteMany({
    where: {
      id:
        GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId
    }
  });

  await prisma.workflowRun.deleteMany({
    where: {
      id:
        GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId
    }
  });
}

describe(
  "POST /workflow-runs/golden-demonstration/prepare",
  () => {
    beforeEach(async () => {
      await removeGoldenDemonstrationHistory();
    });

    afterEach(async () => {
      await removeGoldenDemonstrationHistory();
    });

    it(
      "creates one historical review chain and reuses it idempotently",
      async () => {
        const app = buildApp();

        try {
          const firstResponse = await app.inject({
            method: "POST",
            url:
              "/workflow-runs/golden-demonstration/prepare",
            payload: {}
          });

          expect(firstResponse.statusCode).toBe(200);
          expect(firstResponse.json()).toMatchObject({
            historicalEvidence: {
              created: true,
              workflowRunId:
                GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId,
              reviewQueueItemId:
                GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
              reviewedTradeInRecordId:
                GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewedTradeInRecordId,
              learningEventId:
                GOLDEN_DEMONSTRATION_HISTORY_IDS.learningEventId,
              fieldName: "shaftFlex",
              rawTextMatch: "shaft firm",
              correctedValue: "STIFF"
            }
          });

          const secondResponse = await app.inject({
            method: "POST",
            url:
              "/workflow-runs/golden-demonstration/prepare",
            payload: {}
          });

          expect(secondResponse.statusCode).toBe(200);
          expect(secondResponse.json()).toMatchObject({
            historicalEvidence: {
              created: false,
              workflowRunId:
                GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId,
              reviewQueueItemId:
                GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId,
              reviewedTradeInRecordId:
                GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewedTradeInRecordId,
              learningEventId:
                GOLDEN_DEMONSTRATION_HISTORY_IDS.learningEventId
            }
          });

          await expect(
            prisma.workflowRun.count({
              where: {
                id:
                  GOLDEN_DEMONSTRATION_HISTORY_IDS.workflowRunId
              }
            })
          ).resolves.toBe(1);

          await expect(
            prisma.reviewQueueItem.count({
              where: {
                id:
                  GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId
              }
            })
          ).resolves.toBe(1);

          await expect(
            prisma.reviewedTradeInRecord.count({
              where: {
                reviewQueueItemId:
                  GOLDEN_DEMONSTRATION_HISTORY_IDS.reviewQueueItemId
              }
            })
          ).resolves.toBe(1);

          await expect(
            prisma.humanReviewLearningEvent.count({
              where: {
                id:
                  GOLDEN_DEMONSTRATION_HISTORY_IDS.learningEventId
              }
            })
          ).resolves.toBe(1);
        } finally {
          await app.close();
        }
      }
    );

    it(
      "rejects user-supplied fixture content",
      async () => {
        const app = buildApp();

        try {
          const response = await app.inject({
            method: "POST",
            url:
              "/workflow-runs/golden-demonstration/prepare",
            payload: {
              rawTextMatch: "custom phrase",
              correctedValue: "REGULAR"
            }
          });

          expect(response.statusCode).toBe(400);
          expect(response.json()).toMatchObject({
            error:
              "Invalid golden demonstration preparation request"
          });

          await expect(
            prisma.humanReviewLearningEvent.count({
              where: {
                id:
                  GOLDEN_DEMONSTRATION_HISTORY_IDS.learningEventId
              }
            })
          ).resolves.toBe(0);
        } finally {
          await app.close();
        }
      }
    );
  }
);
