import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { executeWorkflowRunSimulation } from "../workflows/workflow-execution.js";
import {
  executeWorkflowToolCallingPlan,
  WorkflowToolCallingPlanWorkflowRunNotFoundError
} from "../workflows/workflow-tool-calling-plan.js";

const workflowRunParamsSchema = z.object({
  id: z.string().min(1)
});

const executeWorkflowRunBodySchema = z.object({
  scenario: z.enum(["HAPPY_PATH", "NEEDS_REVIEW"]).optional()
});

function serializeWorkflowRun(run: {
  id: string;
  intakeBatchId: string | null;
  intakeItemId: string | null;
  workflowName: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: run.id,
    intakeBatchId: run.intakeBatchId,
    intakeItemId: run.intakeItemId,
    workflowName: run.workflowName,
    status: run.status,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    errorMessage: run.errorMessage,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString()
  };
}

function serializeIntakeBatch(batch: {
  id: string;
  name: string;
  description: string | null;
  sourceType: string;
  status: string;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: batch.id,
    name: batch.name,
    description: batch.description,
    sourceType: batch.sourceType,
    status: batch.status,
    itemCount: batch.itemCount,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString()
  };
}

function serializeIntakeItem(item: {
  id: string;
  intakeBatchId: string;
  rawText: string;
  sourceRowNumber: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    intakeBatchId: item.intakeBatchId,
    rawText: item.rawText,
    sourceRowNumber: item.sourceRowNumber,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function serializeWorkflowStep(step: {
  id: string;
  workflowRunId: string;
  stepName: string;
  stepType: string;
  status: string;
  orderIndex: number;
  inputJson: unknown;
  outputJson: unknown;
  errorMessage: string | null;
  retryCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: step.id,
    workflowRunId: step.workflowRunId,
    stepName: step.stepName,
    stepType: step.stepType,
    status: step.status,
    orderIndex: step.orderIndex,
    inputJson: step.inputJson,
    outputJson: step.outputJson,
    errorMessage: step.errorMessage,
    retryCount: step.retryCount,
    startedAt: step.startedAt?.toISOString() ?? null,
    completedAt: step.completedAt?.toISOString() ?? null,
    createdAt: step.createdAt.toISOString(),
    updatedAt: step.updatedAt.toISOString()
  };
}

function serializeToolCallLog(log: {
  id: string;
  workflowRunId: string | null;
  workflowStepId: string | null;
  toolName: string;
  status: string;
  inputJson: unknown;
  outputJson: unknown;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: log.id,
    workflowRunId: log.workflowRunId,
    workflowStepId: log.workflowStepId,
    toolName: log.toolName,
    status: log.status,
    inputJson: log.inputJson,
    outputJson: log.outputJson,
    errorMessage: log.errorMessage,
    startedAt: log.startedAt.toISOString(),
    completedAt: log.completedAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString()
  };
}

function serializeModelCallLog(log: {
  id: string;
  workflowRunId: string | null;
  workflowStepId: string | null;
  provider: string;
  model: string;
  status: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  estimatedCostUsd: number | null;
  requestJson: unknown;
  responseJson: unknown;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: log.id,
    workflowRunId: log.workflowRunId,
    workflowStepId: log.workflowStepId,
    provider: log.provider,
    model: log.model,
    status: log.status,
    promptTokens: log.promptTokens,
    completionTokens: log.completionTokens,
    totalTokens: log.totalTokens,
    latencyMs: log.latencyMs,
    estimatedCostUsd: log.estimatedCostUsd,
    requestJson: log.requestJson,
    responseJson: log.responseJson,
    errorMessage: log.errorMessage,
    startedAt: log.startedAt.toISOString(),
    completedAt: log.completedAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString()
  };
}

function serializeReviewQueueItem(item: {
  id: string;
  intakeItemId: string | null;
  golfClubId: string | null;
  workflowRunId: string | null;
  reason: string;
  status: string;
  originalText: string | null;
  proposedGolfClubJson: unknown;
  reviewerNotes: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    intakeItemId: item.intakeItemId,
    golfClubId: item.golfClubId,
    workflowRunId: item.workflowRunId,
    reason: item.reason,
    status: item.status,
    originalText: item.originalText,
    proposedGolfClubJson: item.proposedGolfClubJson,
    reviewerNotes: item.reviewerNotes,
    resolvedAt: item.resolvedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function serializeWorkflowRunListItem(run: {
  id: string;
  intakeBatchId: string | null;
  intakeItemId: string | null;
  workflowName: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  intakeBatch: {
    id: string;
    name: string;
    description: string | null;
    sourceType: string;
    status: string;
    itemCount: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  intakeItem: {
    id: string;
    intakeBatchId: string;
    rawText: string;
    sourceRowNumber: number | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  modelCallLogs: {
    id: string;
    workflowRunId: string | null;
    workflowStepId: string | null;
    provider: string;
    model: string;
    status: string;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    latencyMs: number | null;
    estimatedCostUsd: number | null;
    requestJson: unknown;
    responseJson: unknown;
    errorMessage: string | null;
    startedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
  }[];
  toolCallLogs: {
    id: string;
    workflowRunId: string | null;
    workflowStepId: string | null;
    toolName: string;
    status: string;
    inputJson: unknown;
    outputJson: unknown;
    errorMessage: string | null;
    startedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
  }[];
  reviewQueueItems: {
    status: string;
  }[];
}) {
  const openReviewQueueItemCount = run.reviewQueueItems.filter(
    (item) => item.status === "OPEN" || item.status === "IN_REVIEW"
  ).length;
  const auditOnlyToolCallLogCount = run.toolCallLogs.filter(
    (log) =>
      typeof log.outputJson === "object" &&
      log.outputJson !== null &&
      !Array.isArray(log.outputJson) &&
      "previewOnly" in log.outputJson &&
      log.outputJson.previewOnly === true
  ).length;

  return {
    ...serializeWorkflowRun(run),
    intakeBatch: run.intakeBatch ? serializeIntakeBatch(run.intakeBatch) : null,
    intakeItem: run.intakeItem ? serializeIntakeItem(run.intakeItem) : null,
    latestModelCallLog: run.modelCallLogs[0]
      ? serializeModelCallLog(run.modelCallLogs[0])
      : null,
    latestToolCallLog: run.toolCallLogs[0]
      ? serializeToolCallLog(run.toolCallLogs[0])
      : null,
    totalToolCallLogCount: run.toolCallLogs.length,
    auditOnlyToolCallLogCount,
    totalReviewQueueItemCount: run.reviewQueueItems.length,
    openReviewQueueItemCount
  };
}

export async function workflowRunRoutes(app: FastifyInstance): Promise<void> {
  app.get("/workflow-runs", async () => {
    const workflowRuns = await prisma.workflowRun.findMany({
      orderBy: {
        createdAt: "desc"
      },
      include: {
        intakeBatch: true,
        intakeItem: true,
        modelCallLogs: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        },
        toolCallLogs: {
          orderBy: {
            createdAt: "desc"
          }
        },
        reviewQueueItems: {
          select: {
            status: true
          }
        }
      }
    });

    return {
      workflowRuns: workflowRuns.map(serializeWorkflowRunListItem)
    };
  });

  app.get("/workflow-runs/:id", async (request, reply) => {
    const parsedParams = workflowRunParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Invalid workflow run id",
        details: parsedParams.error.flatten()
      });
    }

    const workflowRun = await prisma.workflowRun.findUnique({
      where: {
        id: parsedParams.data.id
      },
      include: {
        steps: {
          orderBy: {
            orderIndex: "asc"
          }
        },
        toolCallLogs: {
          orderBy: {
            createdAt: "asc"
          }
        },
        modelCallLogs: {
          orderBy: {
            createdAt: "asc"
          }
        },
        reviewQueueItems: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    if (!workflowRun) {
      return reply.status(404).send({
        error: "Workflow run not found"
      });
    }

    return {
      workflowRun: serializeWorkflowRun(workflowRun),
      steps: workflowRun.steps.map(serializeWorkflowStep),
      toolCallLogs: workflowRun.toolCallLogs.map(serializeToolCallLog),
      modelCallLogs: workflowRun.modelCallLogs.map(serializeModelCallLog),
      reviewQueueItems: workflowRun.reviewQueueItems.map(
        serializeReviewQueueItem
      )
    };
  });


  app.post("/workflow-runs/:id/tool-calling-plan/execute", async (request, reply) => {
    const parsedParams = workflowRunParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Invalid workflow run id",
        details: parsedParams.error.flatten()
      });
    }

    try {
      const result = await executeWorkflowToolCallingPlan({
        workflowRunId: parsedParams.data.id
      });

      return {
        plan: result.plan,
        results: result.results,
        toolCallLogs: result.toolCallLogs.map(serializeToolCallLog),
        executionMetadata: result.executionMetadata
      };
    } catch (error) {
      if (error instanceof WorkflowToolCallingPlanWorkflowRunNotFoundError) {
        return reply.status(404).send({
          error: "Workflow run not found"
        });
      }

      throw error;
    }
  });
  app.post("/workflow-runs/:id/execute", async (request, reply) => {
    const parsedParams = workflowRunParamsSchema.safeParse(request.params);
    const parsedBody = executeWorkflowRunBodySchema.safeParse(request.body ?? {});

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Invalid workflow run id",
        details: parsedParams.error.flatten()
      });
    }

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid workflow execution request",
        details: parsedBody.error.flatten()
      });
    }

    try {
      const result = await executeWorkflowRunSimulation({
        workflowRunId: parsedParams.data.id,
        ...(parsedBody.data.scenario === undefined
          ? {}
          : { scenario: parsedBody.data.scenario })
      });

      return {
        workflowRun: serializeWorkflowRun(result.workflowRun),
        steps: result.steps.map(serializeWorkflowStep),
        toolCallLogs: result.toolCallLogs.map(serializeToolCallLog),
        reviewQueueItems: result.reviewQueueItems.map(serializeReviewQueueItem)
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Workflow run not found") {
        return reply.status(404).send({
          error: "Workflow run not found"
        });
      }

      throw error;
    }
  });
}
