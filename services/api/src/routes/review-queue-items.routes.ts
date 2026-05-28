import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";

const reviewQueueItemParamsSchema = z.object({
  id: z.string().min(1)
});

const reviewQueueItemStatusSchema = z.enum([
  "OPEN",
  "IN_REVIEW",
  "RESOLVED",
  "DISMISSED"
]);

const listReviewQueueItemsQuerySchema = z.object({
  status: reviewQueueItemStatusSchema.optional()
});

const reviewQueueActionBodySchema = z.object({
  reviewerNotes: z.string().min(1).optional()
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

function serializeReviewQueueItemWithContext(item: {
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
  workflowRun: {
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
  } | null;
  intakeItem: {
    id: string;
    intakeBatchId: string;
    rawText: string;
    sourceRowNumber: number | null;
    status: string;
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
    };
  } | null;
}) {
  return {
    ...serializeReviewQueueItem(item),
    workflowRun: item.workflowRun ? serializeWorkflowRun(item.workflowRun) : null,
    intakeItem: item.intakeItem ? serializeIntakeItem(item.intakeItem) : null,
    intakeBatch: item.intakeItem
      ? serializeIntakeBatch(item.intakeItem.intakeBatch)
      : null
  };
}

async function maybeCompleteWorkflowRunAfterReview(input: {
  workflowRunId: string | null;
}) {
  if (!input.workflowRunId) {
    return null;
  }

  const remainingOpenReviewCount = await prisma.reviewQueueItem.count({
    where: {
      workflowRunId: input.workflowRunId,
      status: {
        in: ["OPEN", "IN_REVIEW"]
      }
    }
  });

  if (remainingOpenReviewCount > 0) {
    return prisma.workflowRun.findUnique({
      where: {
        id: input.workflowRunId
      }
    });
  }

  return prisma.workflowRun.update({
    where: {
      id: input.workflowRunId
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date()
    }
  });
}

async function updateReviewQueueItemStatus(input: {
  reviewQueueItemId: string;
  status: "RESOLVED" | "DISMISSED";
  reviewerNotes?: string;
}) {
  const existingItem = await prisma.reviewQueueItem.findUnique({
    where: {
      id: input.reviewQueueItemId
    }
  });

  if (!existingItem) {
    return null;
  }

  const reviewQueueItem = await prisma.reviewQueueItem.update({
    where: {
      id: input.reviewQueueItemId
    },
    data: {
      status: input.status,
      ...(input.reviewerNotes === undefined
        ? {}
        : { reviewerNotes: input.reviewerNotes }),
      resolvedAt: new Date()
    }
  });

  const workflowRun = await maybeCompleteWorkflowRunAfterReview({
    workflowRunId: reviewQueueItem.workflowRunId
  });

  return {
    reviewQueueItem,
    workflowRun
  };
}

export async function reviewQueueItemRoutes(
  app: FastifyInstance
): Promise<void> {
  app.get("/review-queue-items", async (request, reply) => {
    const parsedQuery = listReviewQueueItemsQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: "Invalid review queue item list query",
        details: parsedQuery.error.flatten()
      });
    }

    const reviewQueueItems = await prisma.reviewQueueItem.findMany({
      where: parsedQuery.data.status
        ? {
            status: parsedQuery.data.status
          }
        : {},
      include: {
        workflowRun: true,
        intakeItem: {
          include: {
            intakeBatch: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return {
      reviewQueueItems: reviewQueueItems.map(serializeReviewQueueItemWithContext)
    };
  });

  app.post("/review-queue-items/:id/resolve", async (request, reply) => {
    const parsedParams = reviewQueueItemParamsSchema.safeParse(request.params);
    const parsedBody = reviewQueueActionBodySchema.safeParse(request.body ?? {});

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Invalid review queue item id",
        details: parsedParams.error.flatten()
      });
    }

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid review queue item resolution request",
        details: parsedBody.error.flatten()
      });
    }

    const result = await updateReviewQueueItemStatus({
      reviewQueueItemId: parsedParams.data.id,
      status: "RESOLVED",
      ...(parsedBody.data.reviewerNotes === undefined
        ? {}
        : { reviewerNotes: parsedBody.data.reviewerNotes })
    });

    if (!result) {
      return reply.status(404).send({
        error: "Review queue item not found"
      });
    }

    return {
      reviewQueueItem: serializeReviewQueueItem(result.reviewQueueItem),
      workflowRun: result.workflowRun
        ? serializeWorkflowRun(result.workflowRun)
        : null
    };
  });

  app.post("/review-queue-items/:id/dismiss", async (request, reply) => {
    const parsedParams = reviewQueueItemParamsSchema.safeParse(request.params);
    const parsedBody = reviewQueueActionBodySchema.safeParse(request.body ?? {});

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Invalid review queue item id",
        details: parsedParams.error.flatten()
      });
    }

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid review queue item dismissal request",
        details: parsedBody.error.flatten()
      });
    }

    const result = await updateReviewQueueItemStatus({
      reviewQueueItemId: parsedParams.data.id,
      status: "DISMISSED",
      ...(parsedBody.data.reviewerNotes === undefined
        ? {}
        : { reviewerNotes: parsedBody.data.reviewerNotes })
    });

    if (!result) {
      return reply.status(404).send({
        error: "Review queue item not found"
      });
    }

    return {
      reviewQueueItem: serializeReviewQueueItem(result.reviewQueueItem),
      workflowRun: result.workflowRun
        ? serializeWorkflowRun(result.workflowRun)
        : null
    };
  });
}
