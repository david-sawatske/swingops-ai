import type { ModelCallLog, Prisma } from "@prisma/client";

import {
  executeModelWithProviderFallback,
  type ExecuteModelWithProviderFallbackResult
} from "../ai/model-provider-fallback-executor.js";
import type {
  ModelProviderFetch,
  ModelProviderRuntimeConfig
} from "../ai/model-provider-runtime-config.js";
import type {
  ModelRouteDecision,
  ModelRouteRequest,
  ModelRoutingGoal
} from "../ai/model-router.js";
import { prisma } from "../lib/prisma.js";

export type ModelExecutionOutputValidationResult = {
  jsonValid: boolean;
  validationPassed: boolean;
  validationErrors: string[];
};

export type CreateModelExecutionLogInput = {
  workflowRunId: string;
  taskType: ModelRouteRequest["taskType"];
  goal: ModelRoutingGoal;
  inputJson: Record<string, unknown>;
  policyKey?: string;
  agentName?: string;
  workflowName?: string;
  workflowStep?: string;
  requireJson?: boolean;
  allowDisabledProvidersForSimulation?: boolean;
  runtimeConfig?: ModelProviderRuntimeConfig;
  fetchFn?: ModelProviderFetch;
  validateOutput?: (
    outputJson: Record<string, unknown> | null
  ) => ModelExecutionOutputValidationResult;
};

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
    selectedProvider: decision.selectedProvider,
    selectedModel: decision.selectedModel,
    reason: decision.reason,
    selectedReason: decision.selectedReason,
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

export async function createModelExecutionLogForWorkflowRun(
  input: CreateModelExecutionLogInput
): Promise<ModelCallLog> {
  const requireJson = input.requireJson ?? true;
  const allowDisabledProvidersForSimulation =
    input.allowDisabledProvidersForSimulation ?? false;
  const executionInputJson = buildExecutionInputJson(input);

  const executionResult = await executeModelWithProviderFallback({
    goal: input.goal,
    taskType: input.taskType,
    requireJson,
    allowDisabledProvidersForSimulation,
    inputJson: executionInputJson,
    ...(input.validateOutput !== undefined
      ? { validateOutput: input.validateOutput }
      : {}),
    ...(input.runtimeConfig !== undefined
      ? { runtimeConfig: input.runtimeConfig }
      : {}),
    ...(input.fetchFn !== undefined ? { fetchFn: input.fetchFn } : {})
  });

  const validationResult = input.validateOutput
    ? input.validateOutput(executionResult.outputJson)
    : null;
  const validationFailed =
    validationResult !== null && !validationResult.validationPassed;
  const completedAt = new Date();

  return prisma.modelCallLog.create({
    data: {
      workflowRunId: input.workflowRunId,
      provider: executionResult.provider ?? executionResult.routingDecision.provider,
      model: executionResult.model ?? executionResult.routingDecision.model,
      status: validationFailed ? "FAILED" : executionResult.status,
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
      errorMessage: validationFailed
        ? buildValidationErrorMessage(validationResult)
        : executionResult.errorMessage,
      requestJson: {
        workflowRunId: input.workflowRunId,
        taskType: input.taskType,
        routingGoal: input.goal,
        requireJson,
        allowDisabledProvidersForSimulation,
        providerFallbackExecutor: true,
        ...(input.policyKey ? { policyKey: input.policyKey } : {}),
        ...(input.agentName ? { agentName: input.agentName } : {}),
        ...(input.workflowName ? { workflowName: input.workflowName } : {}),
        ...(input.workflowStep ? { workflowStep: input.workflowStep } : {}),
        inputJson: executionInputJson as Prisma.InputJsonObject,
        mock: executionResult.provider === "MOCK"
      },
      responseJson: {
        providerFallbackExecutor: true,
        mock: executionResult.provider === "MOCK",
        ...(input.policyKey ? { policyKey: input.policyKey } : {}),
        ...(input.agentName ? { agentName: input.agentName } : {}),
        ...(input.workflowName ? { workflowName: input.workflowName } : {}),
        ...(input.workflowStep ? { workflowStep: input.workflowStep } : {}),
        ...(validationResult
          ? {
              validation: {
                jsonValid: validationResult.jsonValid,
                validationPassed: validationResult.validationPassed,
                validationErrors: validationResult.validationErrors
              }
            }
          : {}),
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

export async function createMockModelCallLogForWorkflowRun(
  input: CreateMockModelCallLogInput
): Promise<ModelCallLog> {
  return createModelExecutionLogForWorkflowRun({
    workflowRunId: input.workflowRunId,
    taskType: input.taskType,
    goal: input.goal,
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
}

function buildExecutionInputJson(
  input: CreateModelExecutionLogInput
): Record<string, unknown> {
  return {
    ...(input.policyKey ? { policyKey: input.policyKey } : {}),
    ...(input.agentName ? { agentName: input.agentName } : {}),
    ...(input.workflowName ? { workflowName: input.workflowName } : {}),
    ...(input.workflowStep ? { workflowStep: input.workflowStep } : {}),
    ...input.inputJson
  };
}

function buildValidationErrorMessage(
  validationResult: ModelExecutionOutputValidationResult | null
): string {
  if (!validationResult) {
    return "Model output validation failed.";
  }

  return [
    "Model output validation failed.",
    ...validationResult.validationErrors
  ].join(" ");
}
