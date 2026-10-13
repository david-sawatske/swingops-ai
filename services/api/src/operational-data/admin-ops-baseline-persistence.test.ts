import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { executeMultiSourceIntakeDemo } from "../workflows/multi-source-intake-demo.js";
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
        persisted: {
          intakeBatches: 14,
          intakeItems: 48,
          workflowRuns: 14,
          workflowSteps: 53,
          aiReadyRecords: 56,
          reviewQueueItems: 34,
          reviewedTradeInRecords: 9,
          humanReviewLearningEvents: 0,
          modelCalls: 20,
          modelCallAttempts: 22,
          toolCalls: 126,
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
      const summary = summaryResponse.json();

      expect(summary).toMatchObject({
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
          failed: 0,
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
      expect(summary.aiReadyRecords.byStatus).toEqual({
        NEEDS_REVIEW: 17,
        READY_FOR_RAG: 31,
        SUPERSEDED: 8,
      });
      expect(summary.aiReadyRecords.bySourceType).toEqual({
        EMAIL: 11,
        FREE_TEXT: 21,
        LOG: 10,
        POORLY_FORMED_CSV: 14,
      });
      expect(summary.aiReadyRecords.missingFieldCounts).toEqual({
        brand: 1,
        category: 2,
        conditionGrade: 10,
        productLine: 4,
        shaftFlex: 8,
        tradeInValue: 7,
      });
      expect(summary.aiReadyRecords.categoryMix).toEqual([
        { label: "DRIVER", count: 14 },
        { label: "PUTTER", count: 8 },
        { label: "WEDGE", count: 8 },
        { label: "FAIRWAY_WOOD", count: 7 },
        { label: "IRON_SET", count: 6 },
        { label: "HYBRID", count: 4 },
        { label: "Blank", count: 1 },
      ]);
      expect(summary.aiReadyRecords.storeMix).toEqual([
        { label: "104", count: 21 },
        { label: "207", count: 16 },
        { label: "312", count: 11 },
      ]);
      expect(summary.aiReadyRecords.sourceQuality).toEqual([
        {
          sourceType: "FREE_TEXT",
          total: 21,
          active: 18,
          reviewNeeded: 6,
          groundingReady: 12,
          superseded: 3,
        },
        {
          sourceType: "POORLY_FORMED_CSV",
          total: 14,
          active: 12,
          reviewNeeded: 3,
          groundingReady: 9,
          superseded: 2,
        },
        {
          sourceType: "EMAIL",
          total: 11,
          active: 10,
          reviewNeeded: 2,
          groundingReady: 8,
          superseded: 1,
        },
        {
          sourceType: "LOG",
          total: 10,
          active: 8,
          reviewNeeded: 6,
          groundingReady: 2,
          superseded: 2,
        },
      ]);
      expect(summary.reviewQueue.byStatus).toEqual({
        IN_REVIEW: 7,
        OPEN: 10,
        RESOLVED: 9,
        SUPERSEDED: 8,
      });
      expect(summary.toolActivity.byTool).toEqual([
        { label: "swingops.knowledgeBase.search", count: 44 },
        { label: "swingops.inventory.lookupProduct", count: 42 },
        { label: "swingops.tradeInValuation.estimate", count: 38 },
        { label: "swingops.inventory.createSku", count: 2 },
      ]);
      expect(
        Object.values(summary.aiReadyRecords.byStatus).reduce(
          (total: number, count) => total + Number(count),
          0,
        ),
      ).toBe(summary.aiReadyRecords.total);
      expect(
        Object.values(summary.workflowRuns.byStatus).reduce(
          (total: number, count) => total + Number(count),
          0,
        ),
      ).toBe(summary.workflowRuns.total);
      expect(
        Object.values(summary.reviewQueue.byStatus).reduce(
          (total: number, count) => total + Number(count),
          0,
        ),
      ).toBe(summary.reviewQueue.total);
      expect(summary.modelExecutions.assistance.recordOutcomes).toBe(
        summary.modelExecutions.assistance.repairSuggested +
          summary.modelExecutions.assistance.candidateComparison +
          summary.modelExecutions.assistance.noSafeRepair,
      );
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

  it("does not change deterministic live intake behavior", async () => {
    const source = {
      sourceType: "FREE_TEXT" as const,
      sourceName: "Baseline isolation check",
      rawContent:
        "Store 207: Callaway Rogue ST Max driver, HZRDUS X-Stiff, condition 7.0 Below Average, value $190.",
    };
    const liveResults = [];

    try {
      const beforeRefresh = await executeMultiSourceIntakeDemo({
        sources: [source],
      });
      liveResults.push(beforeRefresh);
      await replaceAdminOpsBaseline(new Date("2026-08-12T12:00:00.000Z"));
      const afterRefresh = await executeMultiSourceIntakeDemo({
        sources: [source],
      });
      liveResults.push(afterRefresh);

      const getDeterministicResult = (
        result: Awaited<ReturnType<typeof executeMultiSourceIntakeDemo>>,
      ) => ({
        sourcesProcessed: result.sourcesProcessed,
        recordsExtracted: result.recordsExtracted,
        reviewNeeded: result.reviewNeeded,
        sourceResults: result.sourceResults,
        cleanedDatasetPreview: result.cleanedDatasetPreview,
        metadataSummary: result.metadataSummary,
        ragReadinessSummary: result.ragReadinessSummary,
        finalSummary: result.finalSummary,
      });

      expect(getDeterministicResult(afterRefresh)).toEqual(
        getDeterministicResult(beforeRefresh),
      );
      await expect(
        prisma.workflowRun.findMany({
          where: {
            id: {
              in: liveResults.map(
                (result) => result.persistedIds.workflowRunId,
              ),
            },
          },
          select: { dataOrigin: true },
        }),
      ).resolves.toEqual([
        { dataOrigin: "LIVE_DEMO" },
        { dataOrigin: "LIVE_DEMO" },
      ]);
    } finally {
      for (const result of liveResults) {
        await prisma.intakeBatch.delete({
          where: { id: result.persistedIds.intakeBatchId },
        });
        await prisma.workflowRun.delete({
          where: { id: result.persistedIds.workflowRunId },
        });
      }
    }
  });
});
