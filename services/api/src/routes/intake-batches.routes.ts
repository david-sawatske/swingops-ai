import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";

const createIntakeBatchBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sourceType: z.enum([
    "FREEFORM_NOTES",
    "BAD_CSV",
    "EMAIL",
    "PDF_TEXT",
    "MANUAL_ENTRY"
  ]),
  items: z
    .array(
      z.object({
        rawText: z.string().min(1),
        sourceRowNumber: z.number().int().positive().optional()
      })
    )
    .default([])
});

const paramsWithIdSchema = z.object({
  id: z.string().min(1)
});

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

export async function intakeBatchRoutes(app: FastifyInstance): Promise<void> {
  app.get("/intake-batches", async () => {
    const intakeBatches = await prisma.intakeBatch.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    return {
      intakeBatches: intakeBatches.map(serializeIntakeBatch)
    };
  });

  app.post("/intake-batches", async (request, reply) => {
    const parsedBody = createIntakeBatchBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid intake batch payload",
        details: parsedBody.error.flatten()
      });
    }

    const { items, ...batchInput } = parsedBody.data;

    const intakeItemCreates = items.map((item) => ({
      rawText: item.rawText,
      ...(item.sourceRowNumber !== undefined
        ? { sourceRowNumber: item.sourceRowNumber }
        : {})
    }));

    const data = {
      name: batchInput.name,
      ...(batchInput.description !== undefined
        ? { description: batchInput.description }
        : {}),
      sourceType: batchInput.sourceType,
      itemCount: items.length,
      items: {
        create: intakeItemCreates
      }
    };

    const intakeBatch = await prisma.intakeBatch.create({
      data,
      include: {
        items: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    return reply.status(201).send({
      intakeBatch: serializeIntakeBatch(intakeBatch),
      items: intakeBatch.items.map(serializeIntakeItem)
    });
  });

  app.get("/intake-batches/:id", async (request, reply) => {
    const parsedParams = paramsWithIdSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Invalid intake batch id",
        details: parsedParams.error.flatten()
      });
    }

    const intakeBatch = await prisma.intakeBatch.findUnique({
      where: {
        id: parsedParams.data.id
      },
      include: {
        items: {
          orderBy: {
            createdAt: "asc"
          }
        },
        workflowRuns: {
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    if (!intakeBatch) {
      return reply.status(404).send({
        error: "Intake batch not found"
      });
    }

    return {
      intakeBatch: serializeIntakeBatch(intakeBatch),
      items: intakeBatch.items.map(serializeIntakeItem),
      workflowRuns: intakeBatch.workflowRuns.map(serializeWorkflowRun)
    };
  });
}
