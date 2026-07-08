import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import {
  serializeHumanReviewLearningEvent,
  serializeReviewedTradeInRecord,
  serializeReviewQueueItem,
  serializeReviewQueueItemWithContext,
  serializeWorkflowRun
} from "./review-queue-items.serializers.js";

const REVIEW_CONDITION_GRADES = [
  "9.5 Mint",
  "9.0 Above Average",
  "8.0 Average",
  "7.0 Below Average",
  "6.0 Poor"
] as const;

const REVIEW_CATEGORY_VALUES = [
  "DRIVER",
  "FAIRWAY_WOOD",
  "HYBRID",
  "IRON_SET",
  "WEDGE",
  "PUTTER"
] as const;

const REVIEW_SHAFT_FLEX_VALUES = [
  "STIFF",
  "REGULAR",
  "SENIOR",
  "X_STIFF",
  "LADIES",
  "TOUR_X_STIFF"
] as const;

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
  status: reviewQueueItemStatusSchema.optional(),
  workflowRunId: z.string().min(1).optional()
});

const reviewQueueActionBodySchema = z.object({
  reviewerNotes: z.string().min(1).optional()
});

const correctedTradeInRecordSchema = z.object({
  brand: z.string().min(1).optional(),
  productLine: z.string().min(1).optional(),
  category: z.enum(REVIEW_CATEGORY_VALUES).optional(),
  shaftFlex: z.enum(REVIEW_SHAFT_FLEX_VALUES).optional(),
  conditionGrade: z.enum(REVIEW_CONDITION_GRADES).optional(),
  conditionEvidenceText: z.string().min(1).optional(),
  demoValue: z.number().int().nonnegative().optional(),
  demoValuationNote: z.string().min(1).optional()
});

const humanReviewLearningEventSchema = z.object({
  fieldName: z.string().min(1),
  rawTextMatch: z.string().min(1).optional(),
  proposedValue: z.string().min(1).optional(),
  correctedValue: z.string().min(1).optional(),
  evidenceText: z.string().min(1).optional(),
  confidenceImpact: z.string().min(1).optional()
});

const resolveWithCorrectionsBodySchema = z.object({
  reviewerNotes: z.string().min(1).optional(),
  correctedRecord: correctedTradeInRecordSchema,
  learningEvents: z.array(humanReviewLearningEventSchema).default([])
});

function toJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

const REQUIRED_REVIEW_READY_FIELDS = [
  "brand",
  "productLine",
  "category",
  "conditionGrade"
] as const;

class ReviewCorrectionValidationError extends Error {
  missingFields: string[];

  constructor(missingFields: string[]) {
    super(
      `Review correction is incomplete. Missing required field(s): ${missingFields.join(", ")}.`
    );
    this.name = "ReviewCorrectionValidationError";
    this.missingFields = missingFields;
  }
}

function getMissingReviewReadyFields(record: Record<string, unknown>) {
  return REQUIRED_REVIEW_READY_FIELDS.filter((fieldName) => {
    const value = record[fieldName];

    return !(typeof value === "string" && value.trim().length > 0);
  });
}

function hasRagReadyReviewShape(record: Record<string, unknown>) {
  return getMissingReviewReadyFields(record).length === 0;
}

function getProposedClubField(
  proposedGolfClubJson: unknown,
  fieldName: string,
): string | null {
  const proposed = toJsonObject(proposedGolfClubJson);
  const value = proposed[fieldName];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getJsonStringField(
  record: Record<string, unknown>,
  fieldName: string,
): string | null {
  const value = record[fieldName];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeLearningEventComparable(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
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

async function resolveReviewQueueItemWithCorrections(input: {
  reviewQueueItemId: string;
  reviewerNotes?: string;
  correctedRecord: z.infer<typeof correctedTradeInRecordSchema>;
  learningEvents: z.infer<typeof humanReviewLearningEventSchema>[];
}) {
  const existingItem = await prisma.reviewQueueItem.findUnique({
    where: {
      id: input.reviewQueueItemId
    }
  });

  if (!existingItem) {
    return null;
  }

  const correctedBrand = input.correctedRecord.brand ?? null;
  const correctedProductLine = input.correctedRecord.productLine ?? null;
  const correctedCategory = input.correctedRecord.category ?? null;
  const correctedShaftFlex = input.correctedRecord.shaftFlex ?? null;
  const correctedConditionGrade = input.correctedRecord.conditionGrade ?? null;
  const conditionEvidenceText =
    input.correctedRecord.conditionEvidenceText ?? null;
  const correctedDemoValue = input.correctedRecord.demoValue ?? null;
  const demoValuationNote = input.correctedRecord.demoValuationNote ?? null;
  const reviewerNotes = input.reviewerNotes ?? null;

  const correctionResult = await prisma.$transaction(async (tx) => {
    const reviewQueueItem = await tx.reviewQueueItem.update({
      where: {
        id: input.reviewQueueItemId
      },
      data: {
        status: "RESOLVED",
        reviewerNotes,
        resolvedAt: new Date()
      }
    });

    const reviewedTradeInRecord = await tx.reviewedTradeInRecord.upsert({
      where: {
        reviewQueueItemId: reviewQueueItem.id
      },
      create: {
        reviewQueueItemId: reviewQueueItem.id,
        workflowRunId: reviewQueueItem.workflowRunId,
        intakeItemId: reviewQueueItem.intakeItemId,
        originalText: reviewQueueItem.originalText,
        correctedBrand,
        correctedProductLine,
        correctedCategory,
        correctedShaftFlex,
        correctedConditionGrade,
        conditionEvidenceText,
        correctedDemoValue,
        demoValuationNote,
        reviewerNotes
      },
      update: {
        workflowRunId: reviewQueueItem.workflowRunId,
        intakeItemId: reviewQueueItem.intakeItemId,
        originalText: reviewQueueItem.originalText,
        correctedBrand,
        correctedProductLine,
        correctedCategory,
        correctedShaftFlex,
        correctedConditionGrade,
        conditionEvidenceText,
        correctedDemoValue,
        demoValuationNote,
        reviewerNotes,
        approvedAt: new Date()
      }
    });

    const existingAiReadyRecord = reviewQueueItem.workflowRunId
      ? await tx.aiReadyIntakeRecord.findFirst({
          where: {
            workflowRunId: reviewQueueItem.workflowRunId,
            ...(reviewQueueItem.intakeItemId
              ? { intakeItemId: reviewQueueItem.intakeItemId }
              : {})
          },
          orderBy: {
            createdAt: "desc"
          }
        })
      : reviewQueueItem.intakeItemId
        ? await tx.aiReadyIntakeRecord.findFirst({
            where: {
              intakeItemId: reviewQueueItem.intakeItemId
            },
            orderBy: {
              createdAt: "desc"
            }
          })
        : null;

    const existingAiReadyJson = toJsonObject(existingAiReadyRecord?.normalizedJson);
    const proposedBrand =
      getProposedClubField(reviewQueueItem.proposedGolfClubJson, "brand") ??
      getProposedClubField(reviewQueueItem.proposedGolfClubJson, "correctedBrand");
    const proposedProductLine =
      getProposedClubField(reviewQueueItem.proposedGolfClubJson, "productLine") ??
      getProposedClubField(reviewQueueItem.proposedGolfClubJson, "model");
    const proposedCategory =
      getProposedClubField(reviewQueueItem.proposedGolfClubJson, "category");
    const proposedShaftFlex =
      getProposedClubField(reviewQueueItem.proposedGolfClubJson, "shaftFlex");
    const proposedConditionGrade =
      getProposedClubField(reviewQueueItem.proposedGolfClubJson, "conditionGrade");

    const currentLearningEventValues: Record<string, string | null> = {
      brand: getJsonStringField(existingAiReadyJson, "brand") ?? proposedBrand,
      productLine:
        getJsonStringField(existingAiReadyJson, "productLine") ?? proposedProductLine,
      category: getJsonStringField(existingAiReadyJson, "category") ?? proposedCategory,
      shaftFlex:
        getJsonStringField(existingAiReadyJson, "shaftFlex") ?? proposedShaftFlex,
      conditionGrade:
        getJsonStringField(existingAiReadyJson, "conditionGrade") ??
        proposedConditionGrade,
      demoValue:
        getJsonStringField(existingAiReadyJson, "tradeInValue") ??
        getJsonStringField(existingAiReadyJson, "demoValue")
    };

    const filteredLearningEvents = input.learningEvents.filter((event) => {
      const correctedValue = event.correctedValue ?? null;

      if (!correctedValue) {
        return true;
      }

      const currentValue =
        currentLearningEventValues[event.fieldName] ?? event.proposedValue ?? null;

      return (
        normalizeLearningEventComparable(currentValue) !==
        normalizeLearningEventComparable(correctedValue)
      );
    });

    await tx.humanReviewLearningEvent.deleteMany({
      where: {
        reviewedTradeInRecordId: reviewedTradeInRecord.id
      }
    });

    if (filteredLearningEvents.length > 0) {
      await tx.humanReviewLearningEvent.createMany({
        data: filteredLearningEvents.map((event) => ({
          reviewedTradeInRecordId: reviewedTradeInRecord.id,
          reviewQueueItemId: reviewQueueItem.id,
          workflowRunId: reviewQueueItem.workflowRunId,
          intakeItemId: reviewQueueItem.intakeItemId,
          fieldName: event.fieldName,
          rawTextMatch: event.rawTextMatch ?? null,
          proposedValue: event.proposedValue ?? null,
          correctedValue: event.correctedValue ?? null,
          evidenceText: event.evidenceText ?? null,
          confidenceImpact: event.confidenceImpact ?? null,
          reviewerNotes
        }))
      });
    }

    const reviewedAiReadyJson = {
      ...existingAiReadyJson,
      id: existingAiReadyRecord?.sourceRecordId ?? reviewQueueItem.id,
      sourceId: reviewQueueItem.workflowRunId ?? reviewQueueItem.id,
      sourceType: existingAiReadyRecord?.sourceType ?? "FREE_TEXT",
      normalizedText:
        existingAiReadyRecord?.cleanedText ??
        reviewQueueItem.originalText ??
        "",
      brand:
        correctedBrand ??
        (typeof existingAiReadyJson.brand === "string"
          ? existingAiReadyJson.brand
          : proposedBrand),
      productLine:
        correctedProductLine ??
        (typeof existingAiReadyJson.productLine === "string"
          ? existingAiReadyJson.productLine
          : proposedProductLine),
      category:
        correctedCategory ??
        (typeof existingAiReadyJson.category === "string"
          ? existingAiReadyJson.category
          : proposedCategory),
      shaftFlex:
        correctedShaftFlex ??
        (typeof existingAiReadyJson.shaftFlex === "string"
          ? existingAiReadyJson.shaftFlex
          : proposedShaftFlex),
      conditionGrade:
        correctedConditionGrade ??
        (typeof existingAiReadyJson.conditionGrade === "string"
          ? existingAiReadyJson.conditionGrade
          : proposedConditionGrade),
      ...(correctedDemoValue === null ? {} : { tradeInValue: correctedDemoValue }),
      reviewNeeded: false,
      missingFields: []
    };

    const reviewedAiReadyMissingFields =
      getMissingReviewReadyFields(reviewedAiReadyJson);
    const reviewedAiReadyShapeIsRagReady =
      reviewedAiReadyMissingFields.length === 0;

    if (!reviewedAiReadyShapeIsRagReady) {
      throw new ReviewCorrectionValidationError(reviewedAiReadyMissingFields);
    }

    const updatedAiReadyIntakeRecord = existingAiReadyRecord
      ? await tx.aiReadyIntakeRecord.update({
          where: {
            id: existingAiReadyRecord.id
          },
          data: {
            normalizedJson: reviewedAiReadyJson,
            status: reviewedAiReadyShapeIsRagReady
              ? "READY_FOR_RAG"
              : "READY_FOR_REVIEW",
            reviewNeeded: false,
            embeddingReady: true,
            ragReady: reviewedAiReadyShapeIsRagReady
          }
        })
      : await tx.aiReadyIntakeRecord.create({
          data: {
            intakeItemId: reviewQueueItem.intakeItemId,
            workflowRunId: reviewQueueItem.workflowRunId,
            sourceRecordId: reviewQueueItem.id,
            sourceType: "FREE_TEXT",
            sourceName: "Human-reviewed workflow record",
            rawText: reviewQueueItem.originalText ?? "",
            cleanedText: reviewQueueItem.originalText ?? "",
            normalizedJson: reviewedAiReadyJson,
            metadataJson: {
              createdFrom: "HUMAN_REVIEW_RESOLUTION",
              reviewQueueItemId: reviewQueueItem.id,
              reviewedTradeInRecordId: reviewedTradeInRecord.id
            },
            qualitySignalsJson: filteredLearningEvents,
            status: reviewedAiReadyShapeIsRagReady
              ? "READY_FOR_RAG"
              : "READY_FOR_REVIEW",
            reviewNeeded: false,
            embeddingReady: true,
            ragReady: reviewedAiReadyShapeIsRagReady
          }
        });

    const learningEvents = await tx.humanReviewLearningEvent.findMany({
      where: {
        reviewedTradeInRecordId: reviewedTradeInRecord.id
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return {
      reviewQueueItem,
      reviewedTradeInRecord,
      updatedAiReadyIntakeRecord,
      learningEvents
    };
  });

  const workflowRun = await maybeCompleteWorkflowRunAfterReview({
    workflowRunId: correctionResult.reviewQueueItem.workflowRunId
  });

  return {
    ...correctionResult,
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
      where: {
        ...(parsedQuery.data.status
          ? {
              status: parsedQuery.data.status
            }
          : {}),
        ...(parsedQuery.data.workflowRunId
          ? {
              workflowRunId: parsedQuery.data.workflowRunId
            }
          : {})
      },
      include: {
        workflowRun: true,
        intakeItem: {
          include: {
            intakeBatch: true
          }
        },
        reviewedTradeInRecord: true,
        humanReviewLearningEvents: {
          orderBy: {
            createdAt: "asc"
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

  app.post(
    "/review-queue-items/:id/resolve-with-corrections",
    async (request, reply) => {
      const parsedParams = reviewQueueItemParamsSchema.safeParse(request.params);
      const parsedBody = resolveWithCorrectionsBodySchema.safeParse(
        request.body ?? {}
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "Invalid review queue item id",
          details: parsedParams.error.flatten()
        });
      }

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "Invalid structured review queue item resolution request",
          details: parsedBody.error.flatten()
        });
      }

      let result;

      try {
        result = await resolveReviewQueueItemWithCorrections({
          reviewQueueItemId: parsedParams.data.id,
          ...(parsedBody.data.reviewerNotes === undefined
            ? {}
            : { reviewerNotes: parsedBody.data.reviewerNotes }),
          correctedRecord: parsedBody.data.correctedRecord,
          learningEvents: parsedBody.data.learningEvents
        });
      } catch (error) {
        if (error instanceof ReviewCorrectionValidationError) {
          return reply.status(400).send({
            error: error.message,
            missingFields: error.missingFields
          });
        }

        throw error;
      }

      if (!result) {
        return reply.status(404).send({
          error: "Review queue item not found"
        });
      }

      return {
        reviewQueueItem: serializeReviewQueueItem(result.reviewQueueItem),
        workflowRun: result.workflowRun
          ? serializeWorkflowRun(result.workflowRun)
          : null,
        reviewedTradeInRecord: serializeReviewedTradeInRecord(
          result.reviewedTradeInRecord
        ),
        aiReadyIntakeRecord: result.updatedAiReadyIntakeRecord,
        learningEvents: result.learningEvents.map(
          serializeHumanReviewLearningEvent
        )
      };
    }
  );

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
