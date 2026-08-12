import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import { pruneExpiredLiveDemoData } from "./live-demo-retention.js";

const OLD_DATE = new Date("2026-07-01T12:00:00.000Z");
const RECENT_DATE = new Date("2026-08-10T12:00:00.000Z");
const RETENTION_NOW = new Date("2026-08-12T12:00:00.000Z");
const TEST_PREFIX = "retention_test";

async function removeRetentionTestRows() {
  const idFilter = { startsWith: TEST_PREFIX };

  await prisma.$transaction([
    prisma.humanReviewLearningEvent.deleteMany({ where: { id: idFilter } }),
    prisma.reviewedTradeInRecord.deleteMany({ where: { id: idFilter } }),
    prisma.reviewQueueItem.deleteMany({ where: { id: idFilter } }),
    prisma.aiReadyIntakeRecord.deleteMany({ where: { id: idFilter } }),
    prisma.modelCallAttemptLog.deleteMany({ where: { id: idFilter } }),
    prisma.modelCallLog.deleteMany({ where: { id: idFilter } }),
    prisma.toolCallLog.deleteMany({ where: { id: idFilter } }),
    prisma.workflowStep.deleteMany({ where: { id: idFilter } }),
    prisma.workflowRun.deleteMany({ where: { id: idFilter } }),
    prisma.golfClub.deleteMany({ where: { id: idFilter } }),
    prisma.intakeItem.deleteMany({ where: { id: idFilter } }),
    prisma.intakeBatch.deleteMany({ where: { id: idFilter } }),
  ]);
}

async function createRunGraph({
  id,
  dataOrigin,
  timestamp,
}: {
  id: string;
  dataOrigin: "LIVE_DEMO" | "GOLDEN_DEMONSTRATION" | "SEEDED_BASELINE";
  timestamp: Date;
}) {
  const batchId = `${id}_batch`;
  const itemId = `${id}_item`;
  const runId = `${id}_run`;

  await prisma.intakeBatch.create({
    data: {
      id: batchId,
      name: id,
      sourceType: "MANUAL_ENTRY",
      status: "COMPLETED",
      itemCount: 1,
      dataOrigin,
      createdAt: timestamp,
      updatedAt: timestamp,
      items: {
        create: {
          id: itemId,
          rawText: `${id} source`,
          status: "STRUCTURED",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    },
  });
  await prisma.workflowRun.create({
    data: {
      id: runId,
      intakeBatchId: batchId,
      intakeItemId: itemId,
      workflowName: id,
      status: "COMPLETED",
      dataOrigin,
      createdAt: timestamp,
      updatedAt: timestamp,
      steps: {
        create: {
          id: `${id}_step`,
          stepName: "Completed step",
          stepType: "FINALIZE_WORKFLOW",
          status: "COMPLETED",
          orderIndex: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
      modelCallLogs: {
        create: {
          id: `${id}_model`,
          provider: "MOCK",
          model: "retention-test-model",
          status: "SUCCEEDED",
          dataOrigin,
          startedAt: timestamp,
          completedAt: timestamp,
          createdAt: timestamp,
          attemptLogs: {
            create: {
              id: `${id}_attempt`,
              provider: "MOCK",
              model: "retention-test-model",
              attemptOrder: 1,
              status: "SUCCESS",
              startedAt: timestamp,
              completedAt: timestamp,
              createdAt: timestamp,
            },
          },
        },
      },
      toolCallLogs: {
        create: {
          id: `${id}_tool`,
          toolName: "swingops.retention.test",
          status: "SUCCEEDED",
          dataOrigin,
          startedAt: timestamp,
          completedAt: timestamp,
          createdAt: timestamp,
        },
      },
      reviewQueueItems: {
        create: {
          id: `${id}_review`,
          intakeItemId: itemId,
          reason: "MANUAL_REVIEW_REQUESTED",
          status: "RESOLVED",
          dataOrigin,
          resolvedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
      aiReadyIntakeRecords: {
        create: {
          id: `${id}_record`,
          intakeBatchId: batchId,
          intakeItemId: itemId,
          sourceType: "FREE_TEXT",
          sourceName: id,
          rawText: `${id} source`,
          cleanedText: `${id} source`,
          normalizedJson: {},
          status: "READY_FOR_RAG",
          reviewNeeded: false,
          dataOrigin,
          embeddingReady: true,
          ragReady: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    },
  });

  return { batchId, runId };
}

describe("live demo retention", () => {
  beforeEach(removeRetentionTestRows);
  afterEach(removeRetentionTestRows);

  it("previews expired live rows without changing the database", async () => {
    const before = await pruneExpiredLiveDemoData({
      dryRun: true,
      now: RETENTION_NOW,
      retentionDays: 14,
    });
    const oldLive = await createRunGraph({
      id: `${TEST_PREFIX}_preview`,
      dataOrigin: "LIVE_DEMO",
      timestamp: OLD_DATE,
    });

    const result = await pruneExpiredLiveDemoData({
      dryRun: true,
      now: RETENTION_NOW,
      retentionDays: 14,
    });

    expect(result).toMatchObject({
      cutoff: "2026-07-29T12:00:00.000Z",
      dryRun: true,
      retentionDays: 14,
      planned: {
        intakeBatches: before.planned.intakeBatches + 1,
        workflowRuns: before.planned.workflowRuns + 1,
        workflowSteps: before.planned.workflowSteps + 1,
        aiReadyRecords: before.planned.aiReadyRecords + 1,
        reviewQueueItems: before.planned.reviewQueueItems + 1,
        modelCalls: before.planned.modelCalls + 1,
        modelCallAttempts: before.planned.modelCallAttempts + 1,
        toolCalls: before.planned.toolCalls + 1,
      },
      deleted: null,
    });
    await expect(
      prisma.workflowRun.findUnique({ where: { id: oldLive.runId } }),
    ).resolves.not.toBeNull();
  });

  it("deletes only expired live demo graphs", async () => {
    const before = await pruneExpiredLiveDemoData({
      dryRun: true,
      now: RETENTION_NOW,
      retentionDays: 14,
    });
    const oldLive = await createRunGraph({
      id: `${TEST_PREFIX}_old_live`,
      dataOrigin: "LIVE_DEMO",
      timestamp: OLD_DATE,
    });
    const recentLive = await createRunGraph({
      id: `${TEST_PREFIX}_recent_live`,
      dataOrigin: "LIVE_DEMO",
      timestamp: RECENT_DATE,
    });
    const protectedGolden = await createRunGraph({
      id: `${TEST_PREFIX}_golden`,
      dataOrigin: "GOLDEN_DEMONSTRATION",
      timestamp: OLD_DATE,
    });
    const protectedBaseline = await createRunGraph({
      id: `${TEST_PREFIX}_baseline`,
      dataOrigin: "SEEDED_BASELINE",
      timestamp: OLD_DATE,
    });

    const result = await pruneExpiredLiveDemoData({
      now: RETENTION_NOW,
      retentionDays: 14,
    });

    expect(result.deleted).toMatchObject({
      intakeBatches: before.planned.intakeBatches + 1,
      intakeItems: before.planned.intakeItems + 1,
      workflowRuns: before.planned.workflowRuns + 1,
      workflowSteps: before.planned.workflowSteps + 1,
      aiReadyRecords: before.planned.aiReadyRecords + 1,
      reviewQueueItems: before.planned.reviewQueueItems + 1,
      modelCalls: before.planned.modelCalls + 1,
      modelCallAttempts: before.planned.modelCallAttempts + 1,
      toolCalls: before.planned.toolCalls + 1,
    });
    await expect(
      prisma.workflowRun.findUnique({ where: { id: oldLive.runId } }),
    ).resolves.toBeNull();
    await expect(
      prisma.workflowRun.findUnique({ where: { id: recentLive.runId } }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.workflowRun.findUnique({ where: { id: protectedGolden.runId } }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.workflowRun.findUnique({ where: { id: protectedBaseline.runId } }),
    ).resolves.not.toBeNull();
  });

  it("rejects unsafe retention windows before opening a transaction", async () => {
    await expect(
      pruneExpiredLiveDemoData({
        now: RETENTION_NOW,
        retentionDays: 0,
      }),
    ).rejects.toThrow("integer from 1 to 365 days");
  });
});
