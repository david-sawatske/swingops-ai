import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";

const aiReadyIntakeRecordParamsSchema = z.object({
  id: z.string().min(1)
});

const aiReadyIntakeRecordSourceTypeSchema = z.enum([
  "FREE_TEXT",
  "POORLY_FORMED_CSV",
  "EMAIL",
  "LOG"
]);

const aiReadyIntakeRecordStatusSchema = z.enum([
  "READY_FOR_REVIEW",
  "READY_FOR_RAG",
  "NEEDS_REVIEW"
]);

const listAiReadyIntakeRecordsQuerySchema = z.object({
  workflowRunId: z.string().min(1).optional(),
  intakeBatchId: z.string().min(1).optional(),
  sourceType: aiReadyIntakeRecordSourceTypeSchema.optional(),
  status: aiReadyIntakeRecordStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

function serializeAiReadyIntakeRecord(record: {
  id: string;
  intakeBatchId: string | null;
  intakeItemId: string | null;
  workflowRunId: string | null;
  sourceRecordId: string | null;
  sourceType: string;
  sourceName: string;
  rawText: string;
  cleanedText: string;
  normalizedJson: unknown;
  inferredSchemaJson: unknown;
  metadataJson: unknown;
  qualitySignalsJson: unknown;
  status: string;
  reviewNeeded: boolean;
  embeddingReady: boolean;
  ragReady: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    intakeBatchId: record.intakeBatchId,
    intakeItemId: record.intakeItemId,
    workflowRunId: record.workflowRunId,
    sourceRecordId: record.sourceRecordId,
    sourceType: record.sourceType,
    sourceName: record.sourceName,
    rawText: record.rawText,
    cleanedText: record.cleanedText,
    normalizedJson: record.normalizedJson,
    inferredSchemaJson: record.inferredSchemaJson,
    metadataJson: record.metadataJson,
    qualitySignalsJson: record.qualitySignalsJson,
    status: record.status,
    reviewNeeded: record.reviewNeeded,
    embeddingReady: record.embeddingReady,
    ragReady: record.ragReady,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export async function aiReadyIntakeRecordRoutes(app: FastifyInstance): Promise<void> {
  app.get("/ai-ready-intake-records", async (request, reply) => {
    const parsedQuery = listAiReadyIntakeRecordsQuerySchema.safeParse(request.query ?? {});

    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: "Invalid AI-ready intake record filters",
        details: parsedQuery.error.flatten()
      });
    }

    const where: Prisma.AiReadyIntakeRecordWhereInput = {};

    if (parsedQuery.data.workflowRunId) {
      where.workflowRunId = parsedQuery.data.workflowRunId;
    }

    if (parsedQuery.data.intakeBatchId) {
      where.intakeBatchId = parsedQuery.data.intakeBatchId;
    }

    if (parsedQuery.data.sourceType) {
      where.sourceType = parsedQuery.data.sourceType;
    }

    if (parsedQuery.data.status) {
      where.status = parsedQuery.data.status;
    }

    const records = await prisma.aiReadyIntakeRecord.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      },
      take: parsedQuery.data.limit
    });

    return {
      records: records.map(serializeAiReadyIntakeRecord),
      count: records.length
    };
  });

  app.get("/ai-ready-intake-records/:id", async (request, reply) => {
    const parsedParams = aiReadyIntakeRecordParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Invalid AI-ready intake record id",
        details: parsedParams.error.flatten()
      });
    }

    const record = await prisma.aiReadyIntakeRecord.findUnique({
      where: {
        id: parsedParams.data.id
      }
    });

    if (!record) {
      return reply.status(404).send({
        error: "AI-ready intake record not found"
      });
    }

    return {
      record: serializeAiReadyIntakeRecord(record)
    };
  });
}
