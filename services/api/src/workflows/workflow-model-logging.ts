import type { ModelCallLog } from "@prisma/client";

import {
  routeModel,
  type ModelRouteRequest,
  type ModelRoutingGoal
} from "../ai/model-router.js";
import { prisma } from "../lib/prisma.js";

export type CreateMockModelCallLogInput = {
  workflowRunId: string;
  taskType: ModelRouteRequest["taskType"];
  goal: ModelRoutingGoal;
};

export async function createMockModelCallLogForWorkflowRun(
  input: CreateMockModelCallLogInput
): Promise<ModelCallLog> {
  const decision = routeModel({
    goal: input.goal,
    taskType: input.taskType
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
        mock: true
      },
      responseJson: {
        mock: true,
        routingDecision: {
          provider: decision.provider,
          model: decision.model,
          reason: decision.reason,
          estimatedCostTier: decision.estimatedCostTier,
          expectedLatencyTier: decision.expectedLatencyTier,
          qualityTier: decision.qualityTier
        }
      }
    }
  });
}
