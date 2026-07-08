import type { FastifyInstance } from "fastify";

import { prisma } from "../lib/prisma.js";
import { getGolfTermNormalizationMatrix } from "../workflows/golf-term-normalization.js";

const SUCCESSFUL_MODEL_ATTEMPT_STATUSES = new Set(["SUCCESS", "SUCCEEDED"]);

const WORKFLOW_CONFIG_SNAPSHOT = {
  confidenceThresholds: [
    {
      name: "fieldRepairConfidence",
      value: "validated output required",
      description:
        "Model field repair is treated as a suggestion until deterministic parsing, reference data, validation rules, or review evidence supports it."
    },
    {
      name: "reviewRouting",
      value: "always active",
      description:
        "Missing fields, ambiguous evidence, low-confidence repair, negative evidence, and invalid enum output remain review-facing."
    },
    {
      name: "modelAuthority",
      value: "secondary",
      description:
        "Deterministic parsing, structured reference data, knowledge grounding, internal systems, and prior human review corrections remain higher authority than model output."
    }
  ],
  reviewRoutingRules: [
    {
      ruleId: "missing-required-field",
      label: "Missing required field",
      effect: "NEEDS_REVIEW",
      description:
        "Records with missing required values stay visible for human review rather than receiving invented defaults."
    },
    {
      ruleId: "negative-evidence",
      label: "Negative evidence blocks repair",
      effect: "BLOCK_REPAIR",
      description:
        "Terms such as unknown, unclear, pending, not listed, question marks, and tbd block model repair suggestions for the affected field."
    },
    {
      ruleId: "ambiguous-category",
      label: "Ambiguous category routes to review",
      effect: "NEEDS_REVIEW",
      description:
        "Ambiguous category evidence should not be forced into the nearest enum when deterministic rules cannot support it."
    }
  ],
  providerRoutingPolicy: [
    {
      taskType: "MAIN_RUN_FIELD_REPAIR",
      primaryProvider: "runtime configured provider",
      fallbackProvider: "MOCK",
      validationRequired: true
    }
  ],
  mutationPolicy: {
    readOnlyToolsOnly: true,
    blockedMutationsVisible: true,
    description:
      "Admin Ops is read-only in this slice and does not expose free-form configuration or unsafe tool mutation."
  }
} as const;

function safeNumber(value: number | null): number {
  return value ?? 0;
}

function calculateRate(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
}

function getMissingFieldsFromNormalizedJson(normalizedJson: unknown): string[] {
  if (
    normalizedJson !== null &&
    typeof normalizedJson === "object" &&
    !Array.isArray(normalizedJson) &&
    "missingFields" in normalizedJson
  ) {
    const missingFields = (normalizedJson as { missingFields?: unknown }).missingFields;

    if (Array.isArray(missingFields)) {
      return missingFields.filter((field): field is string => typeof field === "string");
    }
  }

  return [];
}

export async function adminOpsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/ops/summary", async () => {
    const [aiReadyRecords, workflowRuns, modelCallLogs] = await Promise.all([
      prisma.aiReadyIntakeRecord.findMany({
        select: {
          sourceType: true,
          status: true,
          reviewNeeded: true,
          ragReady: true,
          normalizedJson: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 500
      }),
      prisma.workflowRun.findMany({
        select: {
          status: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 500
      }),
      prisma.modelCallLog.findMany({
        select: {
          provider: true,
          model: true,
          status: true,
          latencyMs: true,
          estimatedCostUsd: true,
          totalTokens: true,
          errorMessage: true,
          attemptLogs: {
            select: {
              status: true
            },
            orderBy: {
              attemptOrder: "asc"
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 500
      })
    ]);

    const aiReadyByStatus = aiReadyRecords.reduce<Record<string, number>>(
      (counts, record) => ({
        ...counts,
        [record.status]: (counts[record.status] ?? 0) + 1
      }),
      {}
    );
    const aiReadyBySourceType = aiReadyRecords.reduce<Record<string, number>>(
      (counts, record) => ({
        ...counts,
        [record.sourceType]: (counts[record.sourceType] ?? 0) + 1
      }),
      {}
    );
    const missingFieldCounts = aiReadyRecords.reduce<Record<string, number>>(
      (counts, record) => {
        for (const field of getMissingFieldsFromNormalizedJson(record.normalizedJson)) {
          counts[field] = (counts[field] ?? 0) + 1;
        }

        return counts;
      },
      {}
    );

    const workflowRunsByStatus = workflowRuns.reduce<Record<string, number>>(
      (counts, run) => ({
        ...counts,
        [run.status]: (counts[run.status] ?? 0) + 1
      }),
      {}
    );

    const callsWithLatency = modelCallLogs.filter((call) => call.latencyMs !== null);
    const failedModelCalls = modelCallLogs.filter((call) => call.status === "FAILED").length;
    const succeededModelCalls = modelCallLogs.filter((call) => call.status === "SUCCEEDED").length;
    const fallbackCount = modelCallLogs.filter((call) =>
      call.attemptLogs.length > 1 ||
      call.attemptLogs.some((attempt) => !SUCCESSFUL_MODEL_ATTEMPT_STATUSES.has(attempt.status))
    ).length;
    const estimatedCostTotal = modelCallLogs.reduce(
      (total, call) => total + safeNumber(call.estimatedCostUsd),
      0
    );
    const totalTokens = modelCallLogs.reduce(
      (total, call) => total + safeNumber(call.totalTokens),
      0
    );
    const averageLatencyMs =
      callsWithLatency.length > 0
        ? Math.round(
            callsWithLatency.reduce((total, call) => total + safeNumber(call.latencyMs), 0) /
              callsWithLatency.length
          )
        : null;

    const byProviderModelMap = new Map<
      string,
      {
        provider: string;
        model: string;
        callCount: number;
        failedCallCount: number;
        fallbackCount: number;
        totalLatencyMs: number;
        latencyCallCount: number;
        estimatedCostTotal: number;
        totalTokens: number;
      }
    >();

    for (const call of modelCallLogs) {
      const key = `${call.provider}:${call.model}`;
      const existing = byProviderModelMap.get(key) ?? {
        provider: call.provider,
        model: call.model,
        callCount: 0,
        failedCallCount: 0,
        fallbackCount: 0,
        totalLatencyMs: 0,
        latencyCallCount: 0,
        estimatedCostTotal: 0,
        totalTokens: 0
      };
      const hasFallbackSignal =
        call.attemptLogs.length > 1 ||
        call.attemptLogs.some((attempt) => !SUCCESSFUL_MODEL_ATTEMPT_STATUSES.has(attempt.status));

      existing.callCount += 1;
      existing.failedCallCount += call.status === "FAILED" ? 1 : 0;
      existing.fallbackCount += hasFallbackSignal ? 1 : 0;
      existing.estimatedCostTotal += safeNumber(call.estimatedCostUsd);
      existing.totalTokens += safeNumber(call.totalTokens);

      if (call.latencyMs !== null) {
        existing.totalLatencyMs += call.latencyMs;
        existing.latencyCallCount += 1;
      }

      byProviderModelMap.set(key, existing);
    }

    const byProviderModel = Array.from(byProviderModelMap.values()).map((entry) => ({
      provider: entry.provider,
      model: entry.model,
      callCount: entry.callCount,
      failedCallCount: entry.failedCallCount,
      fallbackCount: entry.fallbackCount,
      averageLatencyMs:
        entry.latencyCallCount > 0
          ? Math.round(entry.totalLatencyMs / entry.latencyCallCount)
          : null,
      estimatedCostTotal: Math.round(entry.estimatedCostTotal * 1_000_000) / 1_000_000,
      totalTokens: entry.totalTokens
    }));

    return {
      aiReadyRecords: {
        total: aiReadyRecords.length,
        byStatus: aiReadyByStatus,
        bySourceType: aiReadyBySourceType,
        reviewNeeded: aiReadyRecords.filter((record) => record.reviewNeeded).length,
        ragReady: aiReadyRecords.filter((record) => record.ragReady).length,
        missingFieldCounts
      },
      workflowRuns: {
        total: workflowRuns.length,
        byStatus: workflowRunsByStatus
      },
      modelExecutions: {
        totalCalls: modelCallLogs.length,
        succeededCalls: succeededModelCalls,
        failedCalls: failedModelCalls,
        fallbackCount,
        fallbackRate: calculateRate(fallbackCount, modelCallLogs.length),
        validationPassRate: calculateRate(succeededModelCalls, modelCallLogs.length),
        averageLatencyMs,
        estimatedCostTotal: Math.round(estimatedCostTotal * 1_000_000) / 1_000_000,
        totalTokens,
        byProviderModel
      }
    };
  });

  app.get("/admin/ops/workflow-config", async () => WORKFLOW_CONFIG_SNAPSHOT);

  app.get("/admin/ops/normalization-matrix", async () => ({
    entries: getGolfTermNormalizationMatrix()
  }));
}
