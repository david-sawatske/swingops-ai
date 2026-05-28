import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

async function createReviewQueueItem() {
  return prisma.reviewQueueItem.create({
    data: {
      reason: "LOW_CONFIDENCE",
      status: "OPEN",
      originalText: "TM driver maybe 10.5, shaft unknown",
      proposedGolfClubJson: {
        brand: "TaylorMade",
        model: "Unknown Driver",
        confidenceScore: 0.58
      }
    }
  });
}

describe("review queue item routes", () => {
  describe("POST /review-queue-items/:id/resolve", () => {
    it("resolves an open review queue item", async () => {
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
        reason: "LOW_CONFIDENCE",
        status: "RESOLVED",
        originalText: "TM driver maybe 10.5, shaft unknown",
        reviewerNotes: "Confirmed TaylorMade driver details."
      });
      expect(body.reviewQueueItem.resolvedAt).not.toBeNull();

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

      await prisma.reviewQueueItem.delete({
        where: {
          id: reviewQueueItem.id
        }
      });

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

      await prisma.reviewQueueItem.delete({
        where: {
          id: reviewQueueItem.id
        }
      });

      await app.close();
    });
  });

  describe("POST /review-queue-items/:id/dismiss", () => {
    it("dismisses an open review queue item", async () => {
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
        reason: "LOW_CONFIDENCE",
        status: "DISMISSED",
        originalText: "TM driver maybe 10.5, shaft unknown",
        reviewerNotes: "Duplicate or unusable intake item."
      });
      expect(body.reviewQueueItem.resolvedAt).not.toBeNull();

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

      await prisma.reviewQueueItem.delete({
        where: {
          id: reviewQueueItem.id
        }
      });

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

      await prisma.reviewQueueItem.delete({
        where: {
          id: reviewQueueItem.id
        }
      });

      await app.close();
    });
  });
});
