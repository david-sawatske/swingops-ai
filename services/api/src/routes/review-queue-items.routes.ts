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

  return prisma.reviewQueueItem.update({
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

    const reviewQueueItem = await updateReviewQueueItemStatus({
      reviewQueueItemId: parsedParams.data.id,
      status: "RESOLVED",
      ...(parsedBody.data.reviewerNotes === undefined
        ? {}
        : { reviewerNotes: parsedBody.data.reviewerNotes })
    });

    if (!reviewQueueItem) {
      return reply.status(404).send({
        error: "Review queue item not found"
      });
    }

    return {
      reviewQueueItem: serializeReviewQueueItem(reviewQueueItem)
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

    const reviewQueueItem = await updateReviewQueueItemStatus({
      reviewQueueItemId: parsedParams.data.id,
      status: "DISMISSED",
      ...(parsedBody.data.reviewerNotes === undefined
        ? {}
        : { reviewerNotes: parsedBody.data.reviewerNotes })
    });

    if (!reviewQueueItem) {
      return reply.status(404).send({
        error: "Review queue item not found"
      });
    }

    return {
      reviewQueueItem: serializeReviewQueueItem(reviewQueueItem)
    };
  });
}
