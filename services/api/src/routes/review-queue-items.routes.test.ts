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

async function createWorkflowRunWithIntakeReviewItem() {
  const intakeBatch = await prisma.intakeBatch.create({
    data: {
      name: "Review Queue Dashboard Batch",
      description: "Batch with review context",
      sourceType: "FREEFORM_NOTES",
      status: "PROCESSING",
      itemCount: 1,
      items: {
        create: {
          rawText: "Callaway Rogue ST Max driver, stiff shaft, condition unclear",
          sourceRowNumber: 1
        }
      }
    },
    include: {
      items: true
    }
  });

  const intakeItem = intakeBatch.items[0]!;

  const workflowRun = await prisma.workflowRun.create({
    data: {
      intakeBatchId: intakeBatch.id,
      intakeItemId: intakeItem.id,
      workflowName: "test-global-review-dashboard-workflow",
      status: "NEEDS_REVIEW",
      startedAt: new Date(),
      reviewQueueItems: {
        create: {
          intakeItemId: intakeItem.id,
          reason: "MISSING_REQUIRED_FIELDS",
          status: "OPEN",
          originalText:
            "Callaway Rogue ST Max driver, stiff shaft, condition unclear",
          proposedGolfClubJson: {
            brand: "Callaway",
            model: "Rogue ST Max",
            category: "DRIVER",
            missingFields: ["condition"]
          }
        }
      }
    },
    include: {
      reviewQueueItems: true
    }
  });

  const resolvedReviewQueueItem = await prisma.reviewQueueItem.create({
    data: {
      intakeItemId: intakeItem.id,
      reason: "LOW_CONFIDENCE",
      status: "RESOLVED",
      originalText: "Resolved historical review item for filter coverage",
      proposedGolfClubJson: {
        brand: "Ping",
        model: "G425"
      },
      reviewerNotes: "Already reviewed.",
      resolvedAt: new Date()
    }
  });

  return {
    ...intakeBatch,
    items: [
      {
        ...intakeItem,
        workflowRuns: [workflowRun],
        reviewQueueItems: [resolvedReviewQueueItem]
      }
    ]
  };
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

async function deleteIntakeBatch(intakeBatchId: string) {
  await prisma.intakeBatch.delete({
    where: {
      id: intakeBatchId
    }
  });
}

describe("review queue item routes", () => {
  describe("GET /review-queue-items", () => {
    it("returns review queue items with workflow and intake context", async () => {
      const app = buildApp();
      const intakeBatch = await createWorkflowRunWithIntakeReviewItem();

      const response = await app.inject({
        method: "GET",
        url: "/review-queue-items"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      const openReviewItem =
        intakeBatch.items[0]!.workflowRuns[0]!.reviewQueueItems[0]!;

      expect(body.reviewQueueItems.length).toBeGreaterThanOrEqual(2);

      const listedItem = body.reviewQueueItems.find(
        (item: { id: string }) => item.id === openReviewItem.id
      );

      expect(listedItem).toMatchObject({
        id: openReviewItem.id,
        intakeItemId: intakeBatch.items[0]!.id,
        workflowRunId: intakeBatch.items[0]!.workflowRuns[0]!.id,
        reason: "MISSING_REQUIRED_FIELDS",
        status: "OPEN",
        originalText:
          "Callaway Rogue ST Max driver, stiff shaft, condition unclear",
        workflowRun: {
          id: intakeBatch.items[0]!.workflowRuns[0]!.id,
          workflowName: "test-global-review-dashboard-workflow",
          status: "NEEDS_REVIEW"
        },
        intakeItem: {
          id: intakeBatch.items[0]!.id,
          rawText: "Callaway Rogue ST Max driver, stiff shaft, condition unclear"
        },
        intakeBatch: {
          id: intakeBatch.id,
          name: "Review Queue Dashboard Batch"
        }
      });

      await deleteIntakeBatch(intakeBatch.id);
      await app.close();
    });

    it("filters review queue items by status", async () => {
      const app = buildApp();
      const intakeBatch = await createWorkflowRunWithIntakeReviewItem();

      const response = await app.inject({
        method: "GET",
        url: "/review-queue-items?status=OPEN"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.reviewQueueItems.length).toBeGreaterThanOrEqual(1);
      expect(
        body.reviewQueueItems.every(
          (item: { status: string }) => item.status === "OPEN"
        )
      ).toBe(true);

      await deleteIntakeBatch(intakeBatch.id);
      await app.close();
    });

    it("returns a list response when filtering review queue items by status", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/review-queue-items?status=IN_REVIEW"
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(Array.isArray(body.reviewQueueItems)).toBe(true);

      await app.close();
    });

    it("filters review queue items by workflow run id", async () => {
      const app = buildApp();
      const intakeBatch = await createWorkflowRunWithIntakeReviewItem();
      const workflowRunId = intakeBatch.items[0]!.workflowRuns[0]!.id;

      const response = await app.inject({
        method: "GET",
        url: `/review-queue-items?workflowRunId=${workflowRunId}`
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.reviewQueueItems.length).toBeGreaterThanOrEqual(1);
      expect(
        body.reviewQueueItems.every(
          (item: { workflowRunId: string | null }) =>
            item.workflowRunId === workflowRunId
        )
      ).toBe(true);

      await deleteIntakeBatch(intakeBatch.id);
      await app.close();
    });

    it("returns 400 for an invalid status query", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/review-queue-items?status=NOT_A_STATUS"
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("Invalid review queue item list query");

      await app.close();
    });
  });

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

  describe("POST /review-queue-items/:id/resolve-with-corrections", () => {
    it("creates a reviewed trade-in record and learning events", async () => {
      const app = buildApp();
      const reviewQueueItem = await createReviewQueueItem();

      const response = await app.inject({
        method: "POST",
        url: `/review-queue-items/${reviewQueueItem.id}/resolve-with-corrections`,
        payload: {
          reviewerNotes: "Human approved final trade-in record.",
          correctedRecord: {
            brand: "TaylorMade",
            productLine: "Stealth 2",
            category: "DRIVER",
            shaftFlex: "STIFF",
            conditionGrade: "8.0 Average",
            conditionEvidenceText: "worn grips",
            demoValue: 185,
            demoValuationNote: "Demo valuation range reviewed by human."
          },
          learningEvents: [
            {
              fieldName: "category",
              rawTextMatch: "TM driver",
              proposedValue: "UNKNOWN",
              correctedValue: "DRIVER",
              evidenceText: "Original raw text used driver wording.",
              confidenceImpact: "Boost future category normalization."
            },
            {
              fieldName: "conditionGrade",
              rawTextMatch: "worn grips",
              proposedValue: "condition unclear",
              correctedValue: "8.0 Average",
              evidenceText: "worn grips"
            }
          ]
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.reviewQueueItem).toMatchObject({
        id: reviewQueueItem.id,
        status: "RESOLVED",
        reviewerNotes: "Human approved final trade-in record."
      });
      expect(body.workflowRun).toMatchObject({
        id: reviewQueueItem.workflowRunId,
        status: "COMPLETED"
      });
      expect(body.reviewedTradeInRecord).toMatchObject({
        reviewQueueItemId: reviewQueueItem.id,
        workflowRunId: reviewQueueItem.workflowRunId,
        originalText: "TM driver maybe 10.5, shaft unknown 1",
        correctedBrand: "TaylorMade",
        correctedProductLine: "Stealth 2",
        correctedCategory: "DRIVER",
        correctedShaftFlex: "STIFF",
        correctedConditionGrade: "8.0 Average",
        conditionEvidenceText: "worn grips",
        correctedDemoValue: 185,
        demoValuationNote: "Demo valuation range reviewed by human.",
        reviewerNotes: "Human approved final trade-in record."
      });
      expect(body.reviewedTradeInRecord.approvedAt).not.toBeNull();

      expect(body.learningEvents).toHaveLength(2);
      expect(body.learningEvents[0]).toMatchObject({
        reviewedTradeInRecordId: body.reviewedTradeInRecord.id,
        reviewQueueItemId: reviewQueueItem.id,
        workflowRunId: reviewQueueItem.workflowRunId,
        fieldName: "category",
        rawTextMatch: "TM driver",
        proposedValue: "UNKNOWN",
        correctedValue: "DRIVER",
        evidenceText: "Original raw text used driver wording.",
        confidenceImpact: "Boost future category normalization.",
        reviewerNotes: "Human approved final trade-in record."
      });
      expect(body.learningEvents[1]).toMatchObject({
        fieldName: "conditionGrade",
        rawTextMatch: "worn grips",
        proposedValue: "condition unclear",
        correctedValue: "8.0 Average",
        evidenceText: "worn grips"
      });

      const persistedRecord = await prisma.reviewedTradeInRecord.findUniqueOrThrow({
        where: {
          reviewQueueItemId: reviewQueueItem.id
        }
      });

      expect(persistedRecord.correctedConditionGrade).toBe("8.0 Average");
      expect(persistedRecord.conditionEvidenceText).toBe("worn grips");

      const persistedLearningEvents = await prisma.humanReviewLearningEvent.findMany({
        where: {
          reviewedTradeInRecordId: persistedRecord.id
        },
        orderBy: {
          createdAt: "asc"
        }
      });

      expect(persistedLearningEvents).toHaveLength(2);
      expect(persistedLearningEvents[0]).toMatchObject({
        fieldName: "category",
        rawTextMatch: "TM driver",
        correctedValue: "DRIVER"
      });
      expect(persistedLearningEvents[1]).toMatchObject({
        fieldName: "conditionGrade",
        rawTextMatch: "worn grips",
        correctedValue: "8.0 Average",
        evidenceText: "worn grips"
      });

      await deleteWorkflowRun(reviewQueueItem.workflowRunId!);

      await app.close();
    });

    it("updates a persisted AI-ready intake record after human review", async () => {
      const app = buildApp();
      const reviewQueueItem = await createReviewQueueItem();

      const aiReadyRecord = await prisma.aiReadyIntakeRecord.create({
        data: {
          intakeItemId: reviewQueueItem.intakeItemId,
          workflowRunId: reviewQueueItem.workflowRunId,
          sourceType: "FREE_TEXT",
          sourceName: "Human review lifecycle test",
          rawText: reviewQueueItem.originalText ?? "Raw review text",
          cleanedText: reviewQueueItem.originalText ?? "Cleaned review text",
          normalizedJson: {
            id: "review-lifecycle-record",
            sourceId: "review-source",
            sourceType: "FREE_TEXT",
            normalizedText: reviewQueueItem.originalText,
            brand: "TM",
            productLine: null,
            category: null,
            shaftFlex: null,
            conditionGrade: null,
            tradeInValue: null,
            customerName: null,
            customerEmail: null,
            storeId: null,
            reviewNeeded: true,
            missingFields: ["productLine", "category", "conditionGrade"]
          },
          status: "NEEDS_REVIEW",
          reviewNeeded: true,
          embeddingReady: false,
          ragReady: false
        }
      });

      const response = await app.inject({
        method: "POST",
        url: `/review-queue-items/${reviewQueueItem.id}/resolve-with-corrections`,
        payload: {
          reviewerNotes: "Human approved AI-ready record.",
          correctedRecord: {
            brand: "TaylorMade",
            productLine: "Stealth 2",
            category: "DRIVER",
            shaftFlex: "STIFF",
            conditionGrade: "8.0 Average",
            demoValue: 185
          },
          learningEvents: [
            {
              fieldName: "conditionGrade",
              rawTextMatch: "8.0 Average",
              correctedValue: "8.0 Average",
              evidenceText: "Condition grade supplied by review."
            }
          ]
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.aiReadyIntakeRecord).toMatchObject({
        id: aiReadyRecord.id,
        status: "READY_FOR_RAG",
        reviewNeeded: false,
        embeddingReady: true,
        ragReady: true,
        normalizedJson: expect.objectContaining({
          brand: "TaylorMade",
          productLine: "Stealth 2",
          category: "DRIVER",
          shaftFlex: "STIFF",
          conditionGrade: "8.0 Average",
          tradeInValue: 185,
          reviewNeeded: false,
          missingFields: []
        })
      });

      const persistedAiReadyRecord =
        await prisma.aiReadyIntakeRecord.findUniqueOrThrow({
          where: {
            id: aiReadyRecord.id
          }
        });

      expect(persistedAiReadyRecord.status).toBe("READY_FOR_RAG");
      expect(persistedAiReadyRecord.reviewNeeded).toBe(false);
      expect(persistedAiReadyRecord.ragReady).toBe(true);
      expect(persistedAiReadyRecord.normalizedJson).toEqual(
        expect.objectContaining({
          brand: "TaylorMade",
          productLine: "Stealth 2",
          category: "DRIVER",
          conditionGrade: "8.0 Average",
          tradeInValue: 185
        })
      );

      await deleteWorkflowRun(reviewQueueItem.workflowRunId!);

      await app.close();
    });

    it("creates an AI-ready intake record when human review has no existing record", async () => {
      const app = buildApp();
      const reviewQueueItem = await createReviewQueueItem();

      const response = await app.inject({
        method: "POST",
        url: `/review-queue-items/${reviewQueueItem.id}/resolve-with-corrections`,
        payload: {
          reviewerNotes: "Human approved newly durable AI-ready record.",
          correctedRecord: {
            brand: "TaylorMade",
            productLine: "Stealth 2",
            category: "DRIVER",
            shaftFlex: "STIFF",
            conditionGrade: "8.0 Average",
            demoValue: 185
          },
          learningEvents: []
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.aiReadyIntakeRecord).toMatchObject({
        workflowRunId: reviewQueueItem.workflowRunId,
        sourceRecordId: reviewQueueItem.id,
        sourceType: "FREE_TEXT",
        sourceName: "Human-reviewed workflow record",
        status: "READY_FOR_RAG",
        reviewNeeded: false,
        embeddingReady: true,
        ragReady: true,
        normalizedJson: expect.objectContaining({
          brand: "TaylorMade",
          productLine: "Stealth 2",
          category: "DRIVER",
          shaftFlex: "STIFF",
          conditionGrade: "8.0 Average",
          tradeInValue: 185,
          reviewNeeded: false,
          missingFields: []
        })
      });

      const persistedAiReadyRecord =
        await prisma.aiReadyIntakeRecord.findUniqueOrThrow({
          where: {
            id: body.aiReadyIntakeRecord.id
          }
        });

      expect(persistedAiReadyRecord.ragReady).toBe(true);

      await deleteWorkflowRun(reviewQueueItem.workflowRunId!);

      await app.close();
    });

    it("rejects condition values outside the fixed review grade list", async () => {
      const app = buildApp();
      const reviewQueueItem = await createReviewQueueItem();

      const response = await app.inject({
        method: "POST",
        url: `/review-queue-items/${reviewQueueItem.id}/resolve-with-corrections`,
        payload: {
          reviewerNotes: "Invalid condition test.",
          correctedRecord: {
            brand: "TaylorMade",
            conditionGrade: "worn grips",
            conditionEvidenceText: "worn grips"
          },
          learningEvents: []
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe(
        "Invalid structured review queue item resolution request"
      );

      const persistedRecord = await prisma.reviewedTradeInRecord.findUnique({
        where: {
          reviewQueueItemId: reviewQueueItem.id
        }
      });

      expect(persistedRecord).toBeNull();

      await deleteWorkflowRun(reviewQueueItem.workflowRunId!);

      await app.close();
    });

    it("returns reviewed records and learning events in the review queue list", async () => {
      const app = buildApp();
      const reviewQueueItem = await createReviewQueueItem();

      await app.inject({
        method: "POST",
        url: `/review-queue-items/${reviewQueueItem.id}/resolve-with-corrections`,
        payload: {
          reviewerNotes: "Approved category mapping.",
          correctedRecord: {
            category: "IRON_SET",
            conditionGrade: "9.0 Above Average"
          },
          learningEvents: [
            {
              fieldName: "category",
              rawTextMatch: "IRON_SET",
              proposedValue: "UNKNOWN",
              correctedValue: "IRON_SET",
              evidenceText: "Raw source included IRON_SET."
            }
          ]
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/review-queue-items?status=RESOLVED"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      const listedItem = body.reviewQueueItems.find(
        (item: { id: string }) => item.id === reviewQueueItem.id
      );

      expect(listedItem).toMatchObject({
        id: reviewQueueItem.id,
        status: "RESOLVED",
        reviewedTradeInRecord: {
          correctedCategory: "IRON_SET",
          correctedConditionGrade: "9.0 Above Average"
        },
        humanReviewLearningEvents: [
          {
            fieldName: "category",
            rawTextMatch: "IRON_SET",
            correctedValue: "IRON_SET",
            evidenceText: "Raw source included IRON_SET."
          }
        ]
      });

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
