import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";

const reviewQueueItemParamsSchema = z.object({
  id: z.string().min(1)
});

const reviewQueueActionBodySchema = z.object({
  reviewerNotes: z.string().min(1).optional()
});

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
