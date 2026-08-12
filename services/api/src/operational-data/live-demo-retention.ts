import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

const LIVE_DEMO_ORIGIN = "LIVE_DEMO" as const;
const LIVE_DEMO_RETENTION_LOCK_ID = 742_901_338;
const DAY_IN_MS = 24 * 60 * 60 * 1_000;

type TransactionClient = Parameters<
  Parameters<PrismaClient["$transaction"]>[0]
>[0];

export type LiveDemoRetentionCounts = {
  intakeBatches: number;
  intakeItems: number;
  golfClubs: number;
  workflowRuns: number;
  workflowSteps: number;
  aiReadyRecords: number;
  reviewQueueItems: number;
  reviewedTradeInRecords: number;
  humanReviewLearningEvents: number;
  modelCalls: number;
  modelCallAttempts: number;
  toolCalls: number;
};

export type PruneExpiredLiveDemoDataResult = {
  cutoff: string;
  dryRun: boolean;
  retentionDays: number;
  planned: LiveDemoRetentionCounts;
  deleted: LiveDemoRetentionCounts | null;
};

function assertDeletedCountsMatchPlan(
  planned: LiveDemoRetentionCounts,
  deleted: LiveDemoRetentionCounts,
): void {
  const differences = Object.entries(planned).filter(
    ([key, count]) => deleted[key as keyof LiveDemoRetentionCounts] !== count,
  );

  if (differences.length > 0) {
    throw new Error(
      `Live demo retention reconciliation failed for: ${differences
        .map(([key]) => key)
        .join(", ")}.`,
    );
  }
}

type PruneExpiredLiveDemoDataOptions = {
  dryRun?: boolean;
  now?: Date;
  retentionDays: number;
};

function validateRetentionOptions({
  now,
  retentionDays,
}: Required<Pick<PruneExpiredLiveDemoDataOptions, "now" | "retentionDays">>) {
  if (Number.isNaN(now.getTime())) {
    throw new Error("The retention reference time must be a valid date.");
  }

  if (
    !Number.isInteger(retentionDays) ||
    retentionDays < 1 ||
    retentionDays > 365
  ) {
    throw new Error(
      "Live demo retention must be an integer from 1 to 365 days.",
    );
  }
}

function getRetentionWhere(cutoff: Date) {
  const intakeBatch: Prisma.IntakeBatchWhereInput = {
    dataOrigin: LIVE_DEMO_ORIGIN,
    updatedAt: { lt: cutoff },
  };
  const workflowRun: Prisma.WorkflowRunWhereInput = {
    dataOrigin: LIVE_DEMO_ORIGIN,
    updatedAt: { lt: cutoff },
  };
  const reviewQueueItem: Prisma.ReviewQueueItemWhereInput = {
    dataOrigin: LIVE_DEMO_ORIGIN,
    updatedAt: { lt: cutoff },
  };
  const reviewedTradeInRecord: Prisma.ReviewedTradeInRecordWhereInput = {
    dataOrigin: LIVE_DEMO_ORIGIN,
    OR: [{ updatedAt: { lt: cutoff } }, { reviewQueueItem }],
  };
  const humanReviewLearningEvent: Prisma.HumanReviewLearningEventWhereInput = {
    dataOrigin: LIVE_DEMO_ORIGIN,
    OR: [
      { createdAt: { lt: cutoff } },
      { reviewQueueItem },
      { reviewedTradeInRecord },
    ],
  };
  const modelCall: Prisma.ModelCallLogWhereInput = {
    dataOrigin: LIVE_DEMO_ORIGIN,
    createdAt: { lt: cutoff },
  };

  return {
    intakeBatch,
    intakeItem: { intakeBatch },
    golfClub: { intakeItem: { intakeBatch } },
    workflowRun,
    workflowStep: { workflowRun },
    aiReadyRecord: {
      dataOrigin: LIVE_DEMO_ORIGIN,
      updatedAt: { lt: cutoff },
    } satisfies Prisma.AiReadyIntakeRecordWhereInput,
    reviewQueueItem,
    reviewedTradeInRecord,
    humanReviewLearningEvent,
    modelCall,
    modelCallAttempt: { modelCallLog: modelCall },
    toolCall: {
      dataOrigin: LIVE_DEMO_ORIGIN,
      createdAt: { lt: cutoff },
    } satisfies Prisma.ToolCallLogWhereInput,
  };
}

async function lockLiveDemoRetention(tx: TransactionClient): Promise<void> {
  await tx.$queryRaw<Array<{ acquired: boolean }>>`
    SELECT pg_advisory_xact_lock(${LIVE_DEMO_RETENTION_LOCK_ID}) IS NULL AS acquired
  `;
}

async function getRetentionCounts(
  tx: TransactionClient,
  cutoff: Date,
): Promise<LiveDemoRetentionCounts> {
  const where = getRetentionWhere(cutoff);
  const [
    intakeBatches,
    intakeItems,
    golfClubs,
    workflowRuns,
    workflowSteps,
    aiReadyRecords,
    reviewQueueItems,
    reviewedTradeInRecords,
    humanReviewLearningEvents,
    modelCalls,
    modelCallAttempts,
    toolCalls,
  ] = await Promise.all([
    tx.intakeBatch.count({ where: where.intakeBatch }),
    tx.intakeItem.count({ where: where.intakeItem }),
    tx.golfClub.count({ where: where.golfClub }),
    tx.workflowRun.count({ where: where.workflowRun }),
    tx.workflowStep.count({ where: where.workflowStep }),
    tx.aiReadyIntakeRecord.count({ where: where.aiReadyRecord }),
    tx.reviewQueueItem.count({ where: where.reviewQueueItem }),
    tx.reviewedTradeInRecord.count({
      where: where.reviewedTradeInRecord,
    }),
    tx.humanReviewLearningEvent.count({
      where: where.humanReviewLearningEvent,
    }),
    tx.modelCallLog.count({ where: where.modelCall }),
    tx.modelCallAttemptLog.count({ where: where.modelCallAttempt }),
    tx.toolCallLog.count({ where: where.toolCall }),
  ]);

  return {
    intakeBatches,
    intakeItems,
    golfClubs,
    workflowRuns,
    workflowSteps,
    aiReadyRecords,
    reviewQueueItems,
    reviewedTradeInRecords,
    humanReviewLearningEvents,
    modelCalls,
    modelCallAttempts,
    toolCalls,
  };
}

async function deleteExpiredLiveDemoRows(
  tx: TransactionClient,
  cutoff: Date,
): Promise<LiveDemoRetentionCounts> {
  const where = getRetentionWhere(cutoff);
  const humanReviewLearningEvents =
    await tx.humanReviewLearningEvent.deleteMany({
      where: where.humanReviewLearningEvent,
    });
  const reviewedTradeInRecords = await tx.reviewedTradeInRecord.deleteMany({
    where: where.reviewedTradeInRecord,
  });
  const reviewQueueItems = await tx.reviewQueueItem.deleteMany({
    where: where.reviewQueueItem,
  });
  const aiReadyRecords = await tx.aiReadyIntakeRecord.deleteMany({
    where: where.aiReadyRecord,
  });
  const modelCallAttempts = await tx.modelCallAttemptLog.deleteMany({
    where: where.modelCallAttempt,
  });
  const modelCalls = await tx.modelCallLog.deleteMany({
    where: where.modelCall,
  });
  const toolCalls = await tx.toolCallLog.deleteMany({
    where: where.toolCall,
  });
  const workflowSteps = await tx.workflowStep.deleteMany({
    where: where.workflowStep,
  });
  const workflowRuns = await tx.workflowRun.deleteMany({
    where: where.workflowRun,
  });
  const golfClubs = await tx.golfClub.deleteMany({
    where: where.golfClub,
  });
  const intakeItems = await tx.intakeItem.deleteMany({
    where: where.intakeItem,
  });
  const intakeBatches = await tx.intakeBatch.deleteMany({
    where: where.intakeBatch,
  });

  return {
    intakeBatches: intakeBatches.count,
    intakeItems: intakeItems.count,
    golfClubs: golfClubs.count,
    workflowRuns: workflowRuns.count,
    workflowSteps: workflowSteps.count,
    aiReadyRecords: aiReadyRecords.count,
    reviewQueueItems: reviewQueueItems.count,
    reviewedTradeInRecords: reviewedTradeInRecords.count,
    humanReviewLearningEvents: humanReviewLearningEvents.count,
    modelCalls: modelCalls.count,
    modelCallAttempts: modelCallAttempts.count,
    toolCalls: toolCalls.count,
  };
}

export async function pruneExpiredLiveDemoData({
  dryRun = false,
  now = new Date(),
  retentionDays,
}: PruneExpiredLiveDemoDataOptions): Promise<PruneExpiredLiveDemoDataResult> {
  validateRetentionOptions({ now, retentionDays });
  const cutoff = new Date(now.getTime() - retentionDays * DAY_IN_MS);

  return prisma.$transaction(
    async (tx) => {
      await lockLiveDemoRetention(tx);
      const planned = await getRetentionCounts(tx, cutoff);
      const deleted = dryRun
        ? null
        : await deleteExpiredLiveDemoRows(tx, cutoff);

      if (deleted) {
        assertDeletedCountsMatchPlan(planned, deleted);
      }

      return {
        cutoff: cutoff.toISOString(),
        dryRun,
        retentionDays,
        planned,
        deleted,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    },
  );
}
