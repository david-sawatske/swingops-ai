import { buildAdminOpsBaselineFixtures } from "./admin-ops-baseline-fixtures.js";
import {
  replaceAdminOpsBaseline,
  type ReplaceAdminOpsBaselineResult,
} from "./admin-ops-baseline-persistence.js";
import {
  pruneExpiredLiveDemoData,
  type PruneExpiredLiveDemoDataResult,
} from "./live-demo-retention.js";

export type RunAdminOpsMaintenanceOptions = {
  anchor?: Date;
  dryRun?: boolean;
  retentionDays: number;
};

export type RunAdminOpsMaintenanceResult = {
  dryRun: boolean;
  baseline:
    | ReplaceAdminOpsBaselineResult
    | {
        anchor: string;
        planned: {
          aiReadyRecords: number;
          workflowRuns: number;
          reviewQueueItems: number;
          modelCalls: number;
          toolCalls: number;
        };
      };
  retention: PruneExpiredLiveDemoDataResult;
};

export async function runAdminOpsMaintenance({
  anchor = new Date(),
  dryRun = false,
  retentionDays,
}: RunAdminOpsMaintenanceOptions): Promise<RunAdminOpsMaintenanceResult> {
  if (dryRun) {
    const fixtures = buildAdminOpsBaselineFixtures(anchor);
    const retention = await pruneExpiredLiveDemoData({
      dryRun: true,
      now: anchor,
      retentionDays,
    });

    return {
      dryRun: true,
      baseline: {
        anchor: fixtures.anchor.toISOString(),
        planned: {
          aiReadyRecords: fixtures.aiReadyRecords.length,
          workflowRuns: fixtures.workflowRuns.length,
          reviewQueueItems: fixtures.reviewQueueItems.length,
          modelCalls: fixtures.modelCalls.length,
          toolCalls: fixtures.toolCalls.length,
        },
      },
      retention,
    };
  }

  const baseline = await replaceAdminOpsBaseline(anchor);
  const retention = await pruneExpiredLiveDemoData({
    now: anchor,
    retentionDays,
  });

  return {
    dryRun: false,
    baseline,
    retention,
  };
}
