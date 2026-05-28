import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

async function createWorkflowRunWithReviewItems(
  reviewItemStatuses: Array<"OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED"> = [
    "OPEN"
  ]
) {
  return prisma.workflowRun.create({
    data: {
      workflowName: "test-review-completion-workflow",
      status: "NEEDS_REVIEW",
      startedAt: new Date(),
      reviewQueueItems: {
        create: reviewItemStatuses.map((status, index) => ({
          reason: "LOW_CONFIDENCE",
          status,
          originalText: `TM driver maybe 10.5, shaft unknown ${index + 1}`,
          proposedGolfClubJson: {
            brand: "TaylorMade",
            model: "Unknown Driver",
            confidenceScore: 0.58
          }
        }))
      }
    },
    include: {
      reviewQueueItems: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });
}

async function createReviewQueueItem() {
  const workflowRun = await createWorkflowRunWithReviewItems();

  return workflowRun.reviewQueueItems[0]!;
}

async function deleteWorkflowRun(workflowRunId: string) {
  await prisma.workflowRun.delete({
    where: {
      id: workflowRunId
    }
  });
}

describe("review queue item routes", () => {
  describe("POST /review-queue-items/:id/resolve", () => {
    it("resolves an open review queue item and completes its workflow run", async () => {
      const app = buildApp();
      const reviewQueueItem = await createReviewQueueItem();

      const response = await app.inject({
        method: "POST",
        url: `/review-queue-items/${reviewQueueItem.id}/resolve`,
        payload: {
          reviewerNotes: "Confirmed TaylorMade driver details."
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.reviewQueueItem).toMatchObject({
        id: reviewQueueItem.id,
        workflowRunId: reviewQueueItem.workflowRunId,
        reason: "LOW_CONFIDENCE",
        status: "RESOLVED",
        originalText: "TM driver maybe 10.5, shaft unknown 1",
        reviewerNotes: "Confirmed TaylorMade driver details."
      });
      expect(body.reviewQueueItem.resolvedAt).not.toBeNull();
      expect(body.workflowRun).toMatchObject({
        id: reviewQueueItem.workflowRunId,
        status: "COMPLETED"
      });
      expect(body.workflowRun.completedAt).not.toBeNull();

      const persistedItem = await prisma.reviewQueueItem.findUniqueOrThrow({
        where: {
          id: reviewQueueItem.id
        }
      });

      expect(persistedItem.status).toBe("RESOLVED");
      expect(persistedItem.reviewerNotes).toBe(
        "Confirmed TaylorMade driver details."
      );
      expect(persistedItem.resolvedAt).not.toBeNull();

      const persistedWorkflowRun = await prisma.workflowRun.findUniqueOrThrow({
        where: {
          id: reviewQueueItem.workflowRunId!
        }
      });

      expect(persistedWorkflowRun.status).toBe("COMPLETED");
      expect(persistedWorkflowRun.completedAt).not.toBeNull();

      await deleteWorkflowRun(reviewQueueItem.workflowRunId!);

      await app.close();
    });

    it("keeps the workflow run in review when other review items remain open", async () => {
      const app = buildApp();
      const workflowRun = await createWorkflowRunWithReviewItems([
        "OPEN",
        "OPEN"
      ]);
      const reviewQueueItem = workflowRun.reviewQueueItems[0]!;

      const response = await app.inject({
        method: "POST",
        url: `/review-queue-items/${reviewQueueItem.id}/resolve`,
        payload: {
          reviewerNotes: "Resolved one item, another remains."
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.reviewQueueItem.status).toBe("RESOLVED");
      expect(body.workflowRun).toMatchObject({
        id: workflowRun.id,
        status: "NEEDS_REVIEW"
      });
      expect(body.workflowRun.completedAt).toBeNull();

      const persistedWorkflowRun = await prisma.workflowRun.findUniqueOrThrow({
        where: {
          id: workflowRun.id
        }
      });

      expect(persistedWorkflowRun.status).toBe("NEEDS_REVIEW");
      expect(persistedWorkflowRun.completedAt).toBeNull();

      await deleteWorkflowRun(workflowRun.id);

      await app.close();
    });

    it("returns 404 when resolving a missing review queue item", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/review-queue-items/not-real/resolve",
        payload: {
          reviewerNotes: "Missing item."
        }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe("Review queue item not found");

      await app.close();
    });

    it("returns 400 for an invalid resolve request", async () => {
      const app = buildApp();
      const reviewQueueItem = await createReviewQueueItem();

      const response = await app.inject({
        method: "POST",
        url: `/review-queue-items/${reviewQueueItem.id}/resolve`,
        payload: {
          reviewerNotes: ""
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe(
        "Invalid review queue item resolution request"
      );

      await deleteWorkflowRun(reviewQueueItem.workflowRunId!);

      await app.close();
    });
  });

  describe("POST /review-queue-items/:id/dismiss", () => {
    it("dismisses an open review queue item and completes its workflow run", async () => {
      const app = buildApp();
      const reviewQueueItem = await createReviewQueueItem();

      const response = await app.inject({
        method: "POST",
        url: `/review-queue-items/${reviewQueueItem.id}/dismiss`,
        payload: {
          reviewerNotes: "Duplicate or unusable intake item."
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.reviewQueueItem).toMatchObject({
        id: reviewQueueItem.id,
        workflowRunId: reviewQueueItem.workflowRunId,
        reason: "LOW_CONFIDENCE",
        status: "DISMISSED",
        originalText: "TM driver maybe 10.5, shaft unknown 1",
        reviewerNotes: "Duplicate or unusable intake item."
      });
      expect(body.reviewQueueItem.resolvedAt).not.toBeNull();
      expect(body.workflowRun).toMatchObject({
        id: reviewQueueItem.workflowRunId,
        status: "COMPLETED"
      });
      expect(body.workflowRun.completedAt).not.toBeNull();

      const persistedItem = await prisma.reviewQueueItem.findUniqueOrThrow({
        where: {
          id: reviewQueueItem.id
        }
      });

      expect(persistedItem.status).toBe("DISMISSED");
      expect(persistedItem.reviewerNotes).toBe(
        "Duplicate or unusable intake item."
      );
      expect(persistedItem.resolvedAt).not.toBeNull();

      const persistedWorkflowRun = await prisma.workflowRun.findUniqueOrThrow({
        where: {
          id: reviewQueueItem.workflowRunId!
        }
      });

      expect(persistedWorkflowRun.status).toBe("COMPLETED");
      expect(persistedWorkflowRun.completedAt).not.toBeNull();

      await deleteWorkflowRun(reviewQueueItem.workflowRunId!);

      await app.close();
    });

    it("returns 404 when dismissing a missing review queue item", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/review-queue-items/not-real/dismiss",
        payload: {
          reviewerNotes: "Missing item."
        }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe("Review queue item not found");

      await app.close();
    });

    it("returns 400 for an invalid dismiss request", async () => {
      const app = buildApp();
      const reviewQueueItem = await createReviewQueueItem();

      const response = await app.inject({
        method: "POST",
        url: `/review-queue-items/${reviewQueueItem.id}/dismiss`,
        payload: {
          reviewerNotes: ""
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe(
        "Invalid review queue item dismissal request"
      );

      await deleteWorkflowRun(reviewQueueItem.workflowRunId!);

      await app.close();
    });
  });
});
