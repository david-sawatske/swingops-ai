import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";

export async function workflowRunRoutes(app: FastifyInstance): Promise<void> {
  app.get("/workflow-runs/:id", async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().min(1)
    });

    const parsedParams = paramsSchema.safeParse(request.params);

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
      workflowRun: {
        id: workflowRun.id,
        intakeBatchId: workflowRun.intakeBatchId,
        intakeItemId: workflowRun.intakeItemId,
        workflowName: workflowRun.workflowName,
        status: workflowRun.status,
        startedAt: workflowRun.startedAt?.toISOString() ?? null,
        completedAt: workflowRun.completedAt?.toISOString() ?? null,
        errorMessage: workflowRun.errorMessage,
        createdAt: workflowRun.createdAt.toISOString(),
        updatedAt: workflowRun.updatedAt.toISOString()
      },
      steps: workflowRun.steps.map((step) => ({
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
      })),
      toolCallLogs: workflowRun.toolCallLogs.map((log) => ({
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
      })),
      modelCallLogs: workflowRun.modelCallLogs.map((log) => ({
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
      })),
      reviewQueueItems: workflowRun.reviewQueueItems.map((item) => ({
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
      }))
    };
  });
}
