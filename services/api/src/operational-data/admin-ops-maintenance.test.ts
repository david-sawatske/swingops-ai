import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import { runAdminOpsMaintenance } from "./admin-ops-maintenance.js";

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

describe("Admin Ops maintenance", () => {
  beforeEach(removeBaselineRows);
  afterEach(removeBaselineRows);

  it("previews baseline refresh and retention without persisting fixtures", async () => {
    const result = await runAdminOpsMaintenance({
      anchor: new Date("2026-08-12T17:00:00.000Z"),
      dryRun: true,
      retentionDays: 14,
    });

    expect(result).toMatchObject({
      dryRun: true,
      baseline: {
        anchor: "2026-08-12T17:00:00.000Z",
        planned: {
          aiReadyRecords: 56,
          workflowRuns: 14,
          reviewQueueItems: 34,
          modelCalls: 20,
          toolCalls: 126,
        },
      },
      retention: {
        cutoff: "2026-07-29T17:00:00.000Z",
        dryRun: true,
        retentionDays: 14,
        deleted: null,
      },
    });
    await expect(
      prisma.workflowRun.count({ where: { dataOrigin: BASELINE_ORIGIN } }),
    ).resolves.toBe(0);
  });
});
