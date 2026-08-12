import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { replaceAdminOpsBaseline } from "./admin-ops-baseline-persistence.js";

const BASELINE_ORIGIN = "SEEDED_BASELINE" as const;

async function removeBaselineRows() {
  await prisma.$transaction(async (tx) => {
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
  });
}

describe("Admin Ops operational baseline persistence", () => {
  beforeEach(removeBaselineRows);
  afterEach(removeBaselineRows);

  it("persists the reconciled fixture graph and exposes its scoped summary", async () => {
    const anchor = new Date();
    const result = await replaceAdminOpsBaseline(anchor);
    const app = buildApp();

    try {
      expect(result).toMatchObject({
        anchor: anchor.toISOString(),
        replacedExistingBaseline: false,
        previous: {
          workflowRuns: 0,
          aiReadyRecords: 0,
          reviewQueueItems: 0,
          modelCalls: 0,
          toolCalls: 0,
        },
        reconciliation: {
          aiReadyRecords: {
            total: 56,
            active: 48,
            superseded: 8,
          },
          workflowRuns: { total: 14 },
          reviewQueueItems: { total: 34 },
          modelTelemetry: {
            logicalCalls: 20,
            providerAttempts: 22,
          },
        },
      });

      await expect(
        Promise.all([
          prisma.intakeBatch.count({ where: { dataOrigin: BASELINE_ORIGIN } }),
          prisma.intakeItem.count({
            where: { intakeBatch: { dataOrigin: BASELINE_ORIGIN } },
          }),
          prisma.workflowRun.count({ where: { dataOrigin: BASELINE_ORIGIN } }),
          prisma.workflowStep.count({
            where: { workflowRun: { dataOrigin: BASELINE_ORIGIN } },
          }),
          prisma.aiReadyIntakeRecord.count({
            where: { dataOrigin: BASELINE_ORIGIN },
          }),
          prisma.reviewQueueItem.count({
            where: { dataOrigin: BASELINE_ORIGIN },
          }),
          prisma.reviewedTradeInRecord.count({
            where: { dataOrigin: BASELINE_ORIGIN },
          }),
          prisma.humanReviewLearningEvent.count({
            where: { dataOrigin: BASELINE_ORIGIN },
          }),
          prisma.modelCallLog.count({ where: { dataOrigin: BASELINE_ORIGIN } }),
          prisma.modelCallAttemptLog.count({
            where: { modelCallLog: { dataOrigin: BASELINE_ORIGIN } },
          }),
          prisma.toolCallLog.count({ where: { dataOrigin: BASELINE_ORIGIN } }),
        ]),
      ).resolves.toEqual([14, 48, 14, 53, 56, 34, 9, 0, 20, 22, 126]);

      const summaryResponse = await app.inject({
        method: "GET",
        url: "/admin/ops/summary?dataOrigin=SEEDED_BASELINE",
      });

      expect(summaryResponse.statusCode).toBe(200);
      expect(summaryResponse.json()).toMatchObject({
        scope: { dataOrigin: BASELINE_ORIGIN },
        aiReadyRecords: {
          total: 56,
          active: 48,
          superseded: 8,
          reviewNeeded: 17,
          ragReady: 31,
          freshness: {
            last24Hours: 9,
            last7Days: 56,
            last30Days: 56,
          },
        },
        workflowRuns: {
          total: 14,
          byStatus: {
            COMPLETED: 8,
            NEEDS_REVIEW: 5,
            FAILED: 1,
          },
        },
        reviewQueue: {
          total: 34,
          active: 17,
          handled: 17,
          handledRate: 50,
          byStatus: {
            OPEN: 10,
            IN_REVIEW: 7,
            RESOLVED: 9,
            SUPERSEDED: 8,
          },
        },
        toolActivity: {
          total: 126,
          succeeded: 124,
          failed: 2,
          successRate: 98.4,
          blockedMutations: 2,
        },
        modelExecutions: {
          totalCalls: 20,
          succeededCalls: 20,
          failedCalls: 0,
          fallbackCount: 2,
          fallbackRate: 10,
          executionSuccessRate: 100,
          validationTrackedCalls: 20,
          validationPassedCalls: 20,
          validationFailedCalls: 0,
          validationPassRate: 100,
          assistance: {
            totalCalls: 20,
            selectedRecords: 58,
            recordOutcomes: 58,
            repairSuggested: 32,
            candidateComparison: 14,
            noSafeRepair: 12,
          },
          attempts: {
            totalAttempts: 22,
            successfulAttempts: 20,
            nonSuccessfulAttempts: 2,
            attemptSuccessRate: 90.9,
          },
          averageLatencyMs: 7_886,
          estimatedCostTotal: 0.0614,
          totalTokens: 28_600,
        },
      });
    } finally {
      await app.close();
    }
  });

  it("replaces only baseline rows while preserving stable identifiers", async () => {
    const firstAnchor = new Date("2026-08-12T12:00:00.000Z");
    const secondAnchor = new Date("2026-08-13T12:00:00.000Z");
    const liveRun = await prisma.workflowRun.create({
      data: {
        workflowName: "live-run-preserved-during-baseline-refresh",
        status: "COMPLETED",
        dataOrigin: "LIVE_DEMO",
      },
    });

    try {
      await replaceAdminOpsBaseline(firstAnchor);
      const firstRecords = await prisma.aiReadyIntakeRecord.findMany({
        where: { dataOrigin: BASELINE_ORIGIN },
        select: { id: true, createdAt: true },
        orderBy: { id: "asc" },
      });
      const secondResult = await replaceAdminOpsBaseline(secondAnchor);
      const secondRecords = await prisma.aiReadyIntakeRecord.findMany({
        where: { dataOrigin: BASELINE_ORIGIN },
        select: { id: true, createdAt: true },
        orderBy: { id: "asc" },
      });

      expect(secondResult).toMatchObject({
        replacedExistingBaseline: true,
        previous: {
          workflowRuns: 14,
          aiReadyRecords: 56,
          reviewQueueItems: 34,
          modelCalls: 20,
          toolCalls: 126,
        },
      });
      expect(secondRecords.map((record) => record.id)).toEqual(
        firstRecords.map((record) => record.id),
      );
      expect(
        secondRecords[0]!.createdAt.getTime() -
          firstRecords[0]!.createdAt.getTime(),
      ).toBe(24 * 60 * 60 * 1_000);
      await expect(
        prisma.workflowRun.findUnique({ where: { id: liveRun.id } }),
      ).resolves.toMatchObject({
        id: liveRun.id,
        dataOrigin: "LIVE_DEMO",
      });
    } finally {
      await prisma.workflowRun.delete({ where: { id: liveRun.id } });
    }
  });
});
