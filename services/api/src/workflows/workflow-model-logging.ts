import type { ModelCallLog, Prisma } from "@prisma/client";

import {
  executeModelWithProviderFallback,
  type ExecuteModelWithProviderFallbackResult
} from "../ai/model-provider-fallback-executor.js";
import type {
  ModelRouteDecision,
  ModelRouteRequest,
  ModelRoutingGoal
} from "../ai/model-router.js";
import { prisma } from "../lib/prisma.js";

export type CreateMockModelCallLogInput = {
  workflowRunId: string;
  taskType: ModelRouteRequest["taskType"];
  goal: ModelRoutingGoal;
};

function toRoutingDecisionLogJson(
  decision: ModelRouteDecision
): Prisma.InputJsonObject {
  return {
    provider: decision.provider,
    model: decision.model,
    reason: decision.reason,
    estimatedCostTier: decision.estimatedCostTier,
    expectedLatencyTier: decision.expectedLatencyTier,
    qualityTier: decision.qualityTier,
    selectedModelMetadata: decision.selectedModelMetadata,
    candidatesConsidered: decision.candidatesConsidered,
    rejectedCandidates: decision.rejectedCandidates,
    fallbackProvider: decision.fallbackProvider,
    fallbackModel: decision.fallbackModel,
    fallbackReason: decision.fallbackReason
  };
}

function toProviderExecutionLogJson(
  result: ExecuteModelWithProviderFallbackResult
): Prisma.InputJsonObject {
  return {
    outputJson: result.outputJson as Prisma.InputJsonObject | null,
    usage: result.usage,
    routingDecision: toRoutingDecisionLogJson(result.routingDecision),
    attempts: result.attempts.map((attempt) => ({
      provider: attempt.provider,
      model: attempt.model,
      attemptOrder: attempt.attemptOrder,
      status: attempt.status,
      reason: attempt.reason,
      errorMessage: attempt.errorMessage,
      latencyMs: attempt.latencyMs,
      estimatedCostUsd: attempt.estimatedCostUsd
    }))
  };
}

export async function createMockModelCallLogForWorkflowRun(
  input: CreateMockModelCallLogInput
): Promise<ModelCallLog> {
  const executionResult = await executeModelWithProviderFallback({
    goal: input.goal,
    taskType: input.taskType,
    requireJson: true,
    allowDisabledProvidersForSimulation: true,
    inputJson: {
      workflowRunId: input.workflowRunId,
      taskType: input.taskType,
      routingGoal: input.goal
    },
    runtimeConfig: {
      enableRealModelCalls: false
    }
  });

  const completedAt = new Date();

  return prisma.modelCallLog.create({
    data: {
      workflowRunId: input.workflowRunId,
      provider: executionResult.provider ?? executionResult.routingDecision.provider,
      model: executionResult.model ?? executionResult.routingDecision.model,
      status: executionResult.status,
      promptTokens: executionResult.usage?.promptTokens ?? null,
      completionTokens: executionResult.usage?.completionTokens ?? null,
      totalTokens: executionResult.usage?.totalTokens ?? null,
      latencyMs:
        executionResult.attempts.reduce(
          (totalLatencyMs, attempt) => totalLatencyMs + attempt.latencyMs,
          0
        ) || 0,
      estimatedCostUsd:
        executionResult.attempts.reduce(
          (totalCostUsd, attempt) => totalCostUsd + attempt.estimatedCostUsd,
          0
        ) || 0,
      completedAt,
      errorMessage: executionResult.errorMessage,
      requestJson: {
        workflowRunId: input.workflowRunId,
        taskType: input.taskType,
        routingGoal: input.goal,
        requireJson: true,
        allowDisabledProvidersForSimulation: true,
        providerFallbackExecutor: true,
        mock: executionResult.provider === "MOCK"
      },
      responseJson: {
        providerFallbackExecutor: true,
        mock: executionResult.provider === "MOCK",
        providerExecution: toProviderExecutionLogJson(executionResult),
        routingDecision: toRoutingDecisionLogJson(executionResult.routingDecision)
      },
      attemptLogs: {
        create: executionResult.attempts.map((attempt) => ({
          provider: attempt.provider,
          model: attempt.model,
          attemptOrder: attempt.attemptOrder,
          status: attempt.status,
          reason: attempt.reason,
          errorMessage: attempt.errorMessage,
          latencyMs: attempt.latencyMs,
          estimatedCostUsd: attempt.estimatedCostUsd,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt
        }))
      }
    }
  });
}
