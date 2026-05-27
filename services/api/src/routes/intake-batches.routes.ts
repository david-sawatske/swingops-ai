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

export async function intakeBatchRoutes(app: FastifyInstance): Promise<void> {
  app.get("/intake-batches", async () => {
    const intakeBatches = await prisma.intakeBatch.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    return {
      intakeBatches: intakeBatches.map((batch) => ({
        id: batch.id,
        name: batch.name,
        description: batch.description,
        sourceType: batch.sourceType,
        status: batch.status,
        itemCount: batch.itemCount,
        createdAt: batch.createdAt.toISOString(),
        updatedAt: batch.updatedAt.toISOString()
      }))
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
      intakeBatch: {
        id: intakeBatch.id,
        name: intakeBatch.name,
        description: intakeBatch.description,
        sourceType: intakeBatch.sourceType,
        status: intakeBatch.status,
        itemCount: intakeBatch.itemCount,
        createdAt: intakeBatch.createdAt.toISOString(),
        updatedAt: intakeBatch.updatedAt.toISOString()
      },
      items: intakeBatch.items.map((item) => ({
        id: item.id,
        intakeBatchId: item.intakeBatchId,
        rawText: item.rawText,
        sourceRowNumber: item.sourceRowNumber,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      }))
    });
  });

  app.get("/intake-batches/:id", async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().min(1)
    });

    const parsedParams = paramsSchema.safeParse(request.params);

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
      intakeBatch: {
        id: intakeBatch.id,
        name: intakeBatch.name,
        description: intakeBatch.description,
        sourceType: intakeBatch.sourceType,
        status: intakeBatch.status,
        itemCount: intakeBatch.itemCount,
        createdAt: intakeBatch.createdAt.toISOString(),
        updatedAt: intakeBatch.updatedAt.toISOString()
      },
      items: intakeBatch.items.map((item) => ({
        id: item.id,
        intakeBatchId: item.intakeBatchId,
        rawText: item.rawText,
        sourceRowNumber: item.sourceRowNumber,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      })),
      workflowRuns: intakeBatch.workflowRuns.map((run) => ({
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
      }))
    };
  });
}
