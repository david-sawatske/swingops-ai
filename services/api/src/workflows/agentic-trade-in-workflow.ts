import type { ModelCallLog, ToolCallLog } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { createMockModelCallLogForWorkflowRun } from "./workflow-model-logging.js";
import {
  executeWorkflowToolCallingPlan,
  type WorkflowToolCallingPlanExecution
} from "./workflow-tool-calling-plan.js";

export type AgenticTradeInRunEvalSummary = {
  extractionCompleteness: number;
  groundingConfidence: number;
  toolCallsAttempted: number;
  toolCallsSucceeded: number;
  modelProviderFallbackUsed: boolean;
  reviewRequired: boolean;
  pass: boolean;
};

export type AgenticTradeInRunResult = {
  workflowRunId: string;
  modelCallLog: ModelCallLog & {
    attemptLogs: {
      id: string;
      modelCallLogId: string;
      provider: string;
      model: string;
      attemptOrder: number;
      status: string;
      reason: string | null;
      errorMessage: string | null;
      latencyMs: number | null;
      estimatedCostUsd: number | null;
      startedAt: Date;
      completedAt: Date | null;
      createdAt: Date;
    }[];
  };
  toolCallingPlanExecution: WorkflowToolCallingPlanExecution;
  toolCallLogs: ToolCallLog[];
  evalSummary: AgenticTradeInRunEvalSummary;
  executionMetadata: {
    orchestrator: "deterministic.swingops.agentic-trade-in-run.v1";
    modelRoutingGoal: "HIGH_QUALITY";
    modelTaskType: "INTAKE_PARSING";
    providerFallbackExecutor: true;
    deterministicToolPlan: true;
    readOnlyMcpConnectorSurface: true;
    qualityEvalPersisted: false;
  };
};

export class AgenticTradeInWorkflowRunNotFoundError extends Error {
  constructor() {
    super("Workflow run not found");
    this.name = "AgenticTradeInWorkflowRunNotFoundError";
  }
}

function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}

function buildEvalSummary(input: {
  modelCallLog: AgenticTradeInRunResult["modelCallLog"];
  toolCallingPlanExecution: WorkflowToolCallingPlanExecution;
  openReviewQueueItemCount: number;
}): AgenticTradeInRunEvalSummary {
  const toolCallsAttempted = input.toolCallingPlanExecution.results.length;
  const toolCallsSucceeded = input.toolCallingPlanExecution.results.filter(
    (result) => result.status === "SUCCEEDED"
  ).length;
  const blockedToolCallCount = input.toolCallingPlanExecution.results.filter(
    (result) => result.status === "BLOCKED"
  ).length;
  const groundingSucceeded = input.toolCallingPlanExecution.results.some(
    (result) =>
      result.toolName === "swingops.clubReference.search" &&
      result.status === "SUCCEEDED"
  );
  const modelProviderFallbackUsed = input.modelCallLog.attemptLogs.length > 1;
  const reviewRequired = input.openReviewQueueItemCount > 0;

  return {
    extractionCompleteness: roundScore(toolCallsSucceeded / Math.max(toolCallsAttempted, 1)),
    groundingConfidence: groundingSucceeded ? 0.86 : 0.4,
    toolCallsAttempted,
    toolCallsSucceeded,
    modelProviderFallbackUsed,
    reviewRequired,
    pass:
      input.modelCallLog.status === "SUCCEEDED" &&
      toolCallsSucceeded >= 3 &&
      blockedToolCallCount >= 1
  };
}

export async function executeAgenticTradeInWorkflowRun(input: {
  workflowRunId: string;
}): Promise<AgenticTradeInRunResult> {
  const workflowRun = await prisma.workflowRun.findUnique({
    where: {
      id: input.workflowRunId
    },
    select: {
      id: true,
      reviewQueueItems: {
        where: {
          status: {
            in: ["OPEN", "IN_REVIEW"]
          }
        },
        select: {
          id: true
        }
      }
    }
  });

  if (!workflowRun) {
    throw new AgenticTradeInWorkflowRunNotFoundError();
  }

  const createdModelCallLog = await createMockModelCallLogForWorkflowRun({
    workflowRunId: workflowRun.id,
    taskType: "INTAKE_PARSING",
    goal: "HIGH_QUALITY"
  });

  const modelCallLog = await prisma.modelCallLog.findUniqueOrThrow({
    where: {
      id: createdModelCallLog.id
    },
    include: {
      attemptLogs: {
        orderBy: {
          attemptOrder: "asc"
        }
      }
    }
  });

  const toolCallingPlanExecution = await executeWorkflowToolCallingPlan({
    workflowRunId: workflowRun.id
  });

  const evalSummary = buildEvalSummary({
    modelCallLog,
    toolCallingPlanExecution,
    openReviewQueueItemCount: workflowRun.reviewQueueItems.length
  });

  return {
    workflowRunId: workflowRun.id,
    modelCallLog,
    toolCallingPlanExecution,
    toolCallLogs: toolCallingPlanExecution.toolCallLogs,
    evalSummary,
    executionMetadata: {
      orchestrator: "deterministic.swingops.agentic-trade-in-run.v1",
      modelRoutingGoal: "HIGH_QUALITY",
      modelTaskType: "INTAKE_PARSING",
      providerFallbackExecutor: true,
      deterministicToolPlan: true,
      readOnlyMcpConnectorSurface: true,
      qualityEvalPersisted: false
    }
  };
}
