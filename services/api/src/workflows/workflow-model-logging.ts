import type { ModelCallLog, Prisma } from "@prisma/client";

import {
  routeModel,
  type ModelRouteDecision,
  type ModelRouteRequest,
  type ModelRoutingGoal
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
    fallbackReason: decision.fallbackReason
  };
}

export async function createMockModelCallLogForWorkflowRun(
  input: CreateMockModelCallLogInput
): Promise<ModelCallLog> {
  const decision = routeModel({
    preferredGoal: input.goal,
    taskType: input.taskType,
    requireJson: true,
    allowDisabledProvidersForSimulation: true
  });

  return prisma.modelCallLog.create({
    data: {
      workflowRunId: input.workflowRunId,
      provider: decision.provider,
      model: decision.model,
      status: "SUCCEEDED",
      latencyMs: 0,
      estimatedCostUsd: 0,
      completedAt: new Date(),
      requestJson: {
        workflowRunId: input.workflowRunId,
        taskType: input.taskType,
        routingGoal: input.goal,
        requireJson: true,
        allowDisabledProvidersForSimulation: true,
        mock: true
      },
      responseJson: {
        mock: true,
        routingDecision: toRoutingDecisionLogJson(decision)
      }
    }
  });
}
