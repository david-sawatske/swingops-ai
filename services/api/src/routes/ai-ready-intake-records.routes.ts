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
  "NEEDS_REVIEW",
  "SUPERSEDED"
]);

const booleanQuerySchema = z.preprocess((value) => {
  if (value === true || value === false) {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "true") {
      return true;
    }

    if (normalizedValue === "false") {
      return false;
    }
  }

  return value;
}, z.boolean());

const listAiReadyIntakeRecordsSortSchema = z.enum([
  "createdAt_desc",
  "createdAt_asc",
  "status_asc",
  "sourceType_asc"
]);

const listAiReadyIntakeRecordsQuerySchema = z.object({
  workflowRunId: z.string().min(1).optional(),
  intakeBatchId: z.string().min(1).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  sourceType: aiReadyIntakeRecordSourceTypeSchema.optional(),
  status: aiReadyIntakeRecordStatusSchema.optional(),
  activeOnly: booleanQuerySchema.optional(),
  reviewNeeded: booleanQuerySchema.optional(),
  ragReady: booleanQuerySchema.optional(),
  missingFields: booleanQuerySchema.optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  sort: listAiReadyIntakeRecordsSortSchema.default("createdAt_desc")
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
  supersededByAiReadyIntakeRecordId: string | null;
  supersededAt: Date | null;
  supersededReason: string | null;
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
    supersededByAiReadyIntakeRecordId: record.supersededByAiReadyIntakeRecordId,
    supersededAt: record.supersededAt ? record.supersededAt.toISOString() : null,
    supersededReason: record.supersededReason,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}


function buildAiReadyRecordSearchWhere(
  searchTerm: string,
): Prisma.AiReadyIntakeRecordWhereInput {
  const normalizedSearchTerm = searchTerm.trim();
  const normalizedSearchText = normalizedSearchTerm.toLowerCase();

  const searchConditions: Prisma.AiReadyIntakeRecordWhereInput[] = [
    {
      rawText: {
        contains: normalizedSearchTerm,
        mode: "insensitive"
      }
    },
    {
      cleanedText: {
        contains: normalizedSearchTerm,
        mode: "insensitive"
      }
    },
    {
      sourceName: {
        contains: normalizedSearchTerm,
        mode: "insensitive"
      }
    },
    {
      sourceRecordId: {
        contains: normalizedSearchTerm,
        mode: "insensitive"
      }
    },
    {
      normalizedJson: {
        path: ["brand"],
        string_contains: normalizedSearchTerm
      }
    },
    {
      normalizedJson: {
        path: ["productLine"],
        string_contains: normalizedSearchTerm
      }
    },
    {
      normalizedJson: {
        path: ["category"],
        string_contains: normalizedSearchTerm
      }
    },
    {
      normalizedJson: {
        path: ["shaftFlex"],
        string_contains: normalizedSearchTerm
      }
    },
    {
      normalizedJson: {
        path: ["conditionGrade"],
        string_contains: normalizedSearchTerm
      }
    },
    {
      normalizedJson: {
        path: ["missingFields"],
        array_contains: [normalizedSearchTerm]
      }
    }
  ];

  const matchingSourceTypes = aiReadyIntakeRecordSourceTypeSchema.options.filter((sourceType) =>
    sourceType.toLowerCase().includes(normalizedSearchText)
  );

  if (matchingSourceTypes.length > 0) {
    searchConditions.push({
      sourceType: {
        in: matchingSourceTypes
      }
    });
  }

  const matchingStatuses = aiReadyIntakeRecordStatusSchema.options.filter((status) =>
    status.toLowerCase().includes(normalizedSearchText)
  );

  if (matchingStatuses.length > 0) {
    searchConditions.push({
      status: {
        in: matchingStatuses
      }
    });
  }

  return {
    OR: searchConditions
  };
}

function buildAiReadyMissingFieldsWhere(
  hasMissingFields: boolean,
): Prisma.AiReadyIntakeRecordWhereInput {
  const noMissingFieldsWhere: Prisma.AiReadyIntakeRecordWhereInput = {
    normalizedJson: {
      path: ["missingFields"],
      equals: []
    }
  };

  return hasMissingFields
    ? {
        NOT: noMissingFieldsWhere
      }
    : noMissingFieldsWhere;
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
    const andConditions: Prisma.AiReadyIntakeRecordWhereInput[] = [];

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
    } else if (parsedQuery.data.activeOnly === true) {
      where.status = {
        not: "SUPERSEDED"
      };
    }

    if (parsedQuery.data.reviewNeeded !== undefined) {
      where.reviewNeeded = parsedQuery.data.reviewNeeded;
    }

    if (parsedQuery.data.ragReady !== undefined) {
      where.ragReady = parsedQuery.data.ragReady;
    }

    if (parsedQuery.data.createdFrom || parsedQuery.data.createdTo) {
      where.createdAt = {
        ...(parsedQuery.data.createdFrom ? { gte: parsedQuery.data.createdFrom } : {}),
        ...(parsedQuery.data.createdTo ? { lte: parsedQuery.data.createdTo } : {})
      };
    }

    if (parsedQuery.data.missingFields !== undefined) {
      andConditions.push(buildAiReadyMissingFieldsWhere(parsedQuery.data.missingFields));
    }

    if (parsedQuery.data.search) {
      andConditions.push(buildAiReadyRecordSearchWhere(parsedQuery.data.search));
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const orderBy: Prisma.AiReadyIntakeRecordOrderByWithRelationInput =
      parsedQuery.data.sort === "createdAt_asc"
        ? { createdAt: "asc" }
        : parsedQuery.data.sort === "status_asc"
          ? { status: "asc" }
          : parsedQuery.data.sort === "sourceType_asc"
            ? { sourceType: "asc" }
            : { createdAt: "desc" };

    const [records, totalCount] = await Promise.all([
      prisma.aiReadyIntakeRecord.findMany({
        where,
        orderBy,
        skip: parsedQuery.data.offset,
        take: parsedQuery.data.limit
      }),
      prisma.aiReadyIntakeRecord.count({
        where
      })
    ]);

    return {
      records: records.map(serializeAiReadyIntakeRecord),
      count: records.length,
      totalCount,
      limit: parsedQuery.data.limit,
      offset: parsedQuery.data.offset,
      hasMore: parsedQuery.data.offset + records.length < totalCount
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
