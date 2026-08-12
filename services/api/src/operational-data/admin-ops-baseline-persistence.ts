import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { buildAdminOpsBaselineFixtures } from "./admin-ops-baseline-fixtures.js";
import type { AdminOpsBaselineFixtures } from "./admin-ops-baseline-types.js";
import {
  validateAdminOpsBaselineFixtures,
  type AdminOpsBaselineReconciliation,
} from "./admin-ops-baseline-validation.js";

const BASELINE_ORIGIN = "SEEDED_BASELINE" as const;
const BASELINE_ADVISORY_LOCK_ID = 742_901_337;

type TransactionClient = Parameters<
  Parameters<PrismaClient["$transaction"]>[0]
>[0];

export type ReplaceAdminOpsBaselineResult = {
  anchor: string;
  replacedExistingBaseline: boolean;
  previous: {
    workflowRuns: number;
    aiReadyRecords: number;
    reviewQueueItems: number;
    modelCalls: number;
    toolCalls: number;
  };
  reconciliation: AdminOpsBaselineReconciliation;
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function lockBaselineReplacement(tx: TransactionClient): Promise<void> {
  await tx.$queryRaw<Array<{ acquired: boolean }>>`
    SELECT pg_advisory_xact_lock(${BASELINE_ADVISORY_LOCK_ID}) IS NULL AS acquired
  `;
}

async function getExistingBaselineCounts(tx: TransactionClient) {
  const [
    workflowRuns,
    aiReadyRecords,
    reviewQueueItems,
    modelCalls,
    toolCalls,
  ] = await Promise.all([
    tx.workflowRun.count({ where: { dataOrigin: BASELINE_ORIGIN } }),
    tx.aiReadyIntakeRecord.count({
      where: { dataOrigin: BASELINE_ORIGIN },
    }),
    tx.reviewQueueItem.count({ where: { dataOrigin: BASELINE_ORIGIN } }),
    tx.modelCallLog.count({ where: { dataOrigin: BASELINE_ORIGIN } }),
    tx.toolCallLog.count({ where: { dataOrigin: BASELINE_ORIGIN } }),
  ]);

  return {
    workflowRuns,
    aiReadyRecords,
    reviewQueueItems,
    modelCalls,
    toolCalls,
  };
}

async function deleteExistingBaseline(tx: TransactionClient): Promise<void> {
  await tx.humanReviewLearningEvent.deleteMany({
    where: { dataOrigin: BASELINE_ORIGIN },
  });
  await tx.reviewedTradeInRecord.deleteMany({
    where: { dataOrigin: BASELINE_ORIGIN },
  });
  await tx.reviewQueueItem.deleteMany({
    where: { dataOrigin: BASELINE_ORIGIN },
  });
  await tx.aiReadyIntakeRecord.deleteMany({
    where: { dataOrigin: BASELINE_ORIGIN },
  });
  await tx.modelCallLog.deleteMany({
    where: { dataOrigin: BASELINE_ORIGIN },
  });
  await tx.toolCallLog.deleteMany({
    where: { dataOrigin: BASELINE_ORIGIN },
  });
  await tx.workflowRun.deleteMany({
    where: { dataOrigin: BASELINE_ORIGIN },
  });
  await tx.intakeBatch.deleteMany({
    where: { dataOrigin: BASELINE_ORIGIN },
  });
}

async function createBaselineIntakeAndWorkflowRows(
  tx: TransactionClient,
  fixtures: AdminOpsBaselineFixtures,
): Promise<void> {
  await tx.intakeBatch.createMany({ data: fixtures.intakeBatches });
  await tx.intakeItem.createMany({ data: fixtures.intakeItems });
  await tx.workflowRun.createMany({
    data: fixtures.workflowRuns.map((run) => ({
      ...run,
      failureJson:
        run.failureJson === null ? Prisma.DbNull : toJson(run.failureJson),
    })),
  });
  await tx.workflowStep.createMany({
    data: fixtures.workflowSteps.map((step) => ({
      ...step,
      inputJson:
        step.inputJson === null ? Prisma.DbNull : toJson(step.inputJson),
      outputJson:
        step.outputJson === null ? Prisma.DbNull : toJson(step.outputJson),
    })),
  });
}

async function createBaselineAiReadyRecords(
  tx: TransactionClient,
  fixtures: AdminOpsBaselineFixtures,
): Promise<void> {
  const records = fixtures.aiReadyRecords.map((record) => ({
    ...record,
    normalizedJson: toJson(record.normalizedJson),
    inferredSchemaJson: Prisma.DbNull,
    metadataJson: toJson(record.metadataJson),
    qualitySignalsJson: toJson(record.qualitySignalsJson),
  }));

  await tx.aiReadyIntakeRecord.createMany({
    data: records.filter(
      (record) => record.supersededByAiReadyIntakeRecordId === null,
    ),
  });
  await tx.aiReadyIntakeRecord.createMany({
    data: records.filter(
      (record) => record.supersededByAiReadyIntakeRecordId !== null,
    ),
  });
}

async function createBaselineReviewRows(
  tx: TransactionClient,
  fixtures: AdminOpsBaselineFixtures,
): Promise<void> {
  const reviewQueueItems = fixtures.reviewQueueItems.map((item) => ({
    ...item,
    proposedGolfClubJson: toJson(item.proposedGolfClubJson),
  }));

  await tx.reviewQueueItem.createMany({
    data: reviewQueueItems.filter(
      (item) => item.supersededByReviewQueueItemId === null,
    ),
  });
  await tx.reviewQueueItem.createMany({
    data: reviewQueueItems.filter(
      (item) => item.supersededByReviewQueueItemId !== null,
    ),
  });
  await tx.reviewedTradeInRecord.createMany({
    data: fixtures.reviewedTradeInRecords,
  });
}

async function createBaselineAuditRows(
  tx: TransactionClient,
  fixtures: AdminOpsBaselineFixtures,
): Promise<void> {
  await tx.modelCallLog.createMany({
    data: fixtures.modelCalls.map((call) => ({
      ...call,
      requestJson: toJson(call.requestJson),
      responseJson: toJson(call.responseJson),
    })),
  });
  await tx.modelCallAttemptLog.createMany({
    data: fixtures.modelCallAttempts,
  });
  await tx.toolCallLog.createMany({
    data: fixtures.toolCalls.map((call) => ({
      ...call,
      inputJson: toJson(call.inputJson),
      outputJson: toJson(call.outputJson),
    })),
  });
}

export async function replaceAdminOpsBaseline(
  anchor: Date = new Date(),
): Promise<ReplaceAdminOpsBaselineResult> {
  const fixtures = buildAdminOpsBaselineFixtures(anchor);
  const reconciliation = validateAdminOpsBaselineFixtures(fixtures);

  return prisma.$transaction(
    async (tx) => {
      await lockBaselineReplacement(tx);
      const previous = await getExistingBaselineCounts(tx);

      await deleteExistingBaseline(tx);
      await createBaselineIntakeAndWorkflowRows(tx, fixtures);
      await createBaselineAiReadyRecords(tx, fixtures);
      await createBaselineReviewRows(tx, fixtures);
      await createBaselineAuditRows(tx, fixtures);

      return {
        anchor: fixtures.anchor.toISOString(),
        replacedExistingBaseline: Object.values(previous).some(
          (count) => count > 0,
        ),
        previous,
        reconciliation,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    },
  );
}
