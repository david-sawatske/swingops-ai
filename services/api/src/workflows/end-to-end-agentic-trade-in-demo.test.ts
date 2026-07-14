import { LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE } from "../intake/legacy-intake-source-types.js";
import { describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import {
  executeEndToEndAgenticTradeInDemo,
  type EndToEndAgenticTradeInDemoResult
} from "./end-to-end-agentic-trade-in-demo.js";

async function cleanupResult(result: EndToEndAgenticTradeInDemoResult): Promise<void> {
  await prisma.reviewQueueItem.deleteMany({
    where: {
      workflowRunId: result.persisted.workflowRunId
    }
  });

  await prisma.toolCallLog.deleteMany({
    where: {
      workflowRunId: result.persisted.workflowRunId
    }
  });

  await prisma.modelCallLog.deleteMany({
    where: {
      workflowRunId: result.persisted.workflowRunId
    }
  });

  await prisma.workflowRun.deleteMany({
    where: {
      id: result.persisted.workflowRunId
    }
  });

  await prisma.intakeBatch.deleteMany({
    where: {
      id: result.persisted.intakeBatchId
    }
  });
}

describe("executeEndToEndAgenticTradeInDemo", () => {
  it("does not send present shaft, condition, or trade value fields to review", async () => {
    const result = await executeEndToEndAgenticTradeInDemo({
      rawInput:
        "TaylorMade Stealth 2 driver shaft stiff cond avg trade value $150"
    });

    try {
      expect(result.parsedItems).toHaveLength(1);

      const parsedItem = result.parsedItems[0];

      expect(parsedItem).toMatchObject({
        brand: "TaylorMade",
        productLine: "Stealth 2",
        category: "DRIVER",
        shaftFlex: "STIFF",
        conditionGrade: "8.0 Average",
        tradeInValue: 150,
        conditionNotes: ["8.0 Average"],
        missingFields: []
      });
      expect(parsedItem?.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.finalSummary.lowConfidenceItemCount).toBe(0);

      const warningFields = result.validationChecks
        .filter((check) => check.recordId === parsedItem?.id && check.status !== "PASS")
        .map((check) => check.field);

      expect(warningFields).not.toEqual(
        expect.arrayContaining(["shaftFlex", "conditionGrade", "tradeInValue"])
      );

      for (const reviewItem of result.reviewQueueItemsCreated) {
        const proposedRecord = reviewItem.proposedGolfClubJson as {
          shaftFlex?: string | null;
          conditionGrade?: string | null;
          tradeInValue?: number | null;
          missingFields?: string[];
        };

        expect(proposedRecord).toMatchObject({
          shaftFlex: "STIFF",
          conditionGrade: "8.0 Average",
          tradeInValue: 150
        });
        expect(proposedRecord.missingFields ?? []).not.toEqual(
          expect.arrayContaining(["shaftFlex", "conditionGrade", "tradeInValue", "conditionNotes"])
        );
      }
    } finally {
      await cleanupResult(result);
    }
  });
  it("resolves matching upstream intake review markers when the guarded workflow owns the review", async () => {
    const sourceText =
      "PING G425 4-PW shaft unknown condition unclear value pending review store 207";

    const upstreamBatch = await prisma.intakeBatch.create({
      data: {
        name: "Upstream intake review marker test",
        description: "Test batch with a Step 2 review marker.",
        sourceType: LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE,
        status: "NEEDS_REVIEW",
        itemCount: 1,
        items: {
          create: [
            {
              rawText: `1) ${sourceText}`,
              sourceRowNumber: 1,
              status: "NEEDS_REVIEW"
            }
          ]
        }
      },
      include: {
        items: true
      }
    });

    const upstreamWorkflowRun = await prisma.workflowRun.create({
      data: {
        intakeBatchId: upstreamBatch.id,
        workflowName: "multi-source-intake-demo",
        status: "NEEDS_REVIEW",
        startedAt: new Date()
      }
    });

    const upstreamReviewItem = await prisma.reviewQueueItem.create({
      data: {
        workflowRunId: upstreamWorkflowRun.id,
        intakeItemId: upstreamBatch.items[0]!.id,
        reason: "MISSING_REQUIRED_FIELDS",
        status: "OPEN",
        originalText: `1) ${sourceText}`,
        proposedGolfClubJson: {
          brand: "PING",
          productLine: "G425",
          category: "IRON_SET",
          shaftFlex: null,
          conditionGrade: null,
          tradeInValue: null,
          missingFields: ["shaftFlex", "conditionGrade", "tradeInValue"]
        }
      }
    });

    const result = await executeEndToEndAgenticTradeInDemo({
      rawInput: sourceText
    });

    expect(result.reviewQueueItemsCreated).toHaveLength(1);

    const supersededReviewItem = await prisma.reviewQueueItem.findUniqueOrThrow({
      where: {
        id: upstreamReviewItem.id
      }
    });

    expect(supersededReviewItem.status).toBe("SUPERSEDED");
    expect(supersededReviewItem.resolvedAt).toBeNull();
    expect(supersededReviewItem.supersededAt).not.toBeNull();
    expect(supersededReviewItem.supersededByReviewQueueItemId).toBe(
      result.reviewQueueItemsCreated[0]!.id,
    );
    expect(supersededReviewItem.supersededReason).toContain(
      result.reviewQueueItemsCreated[0]!.id,
    );

    const completedUpstreamWorkflowRun = await prisma.workflowRun.findUniqueOrThrow({
      where: {
        id: upstreamWorkflowRun.id
      }
    });

    expect(completedUpstreamWorkflowRun.status).toBe("COMPLETED");

    const listedSupersededReviewItem = await prisma.reviewQueueItem.findUniqueOrThrow({
      where: {
        id: upstreamReviewItem.id
      }
    });

    expect(listedSupersededReviewItem.supersededByReviewQueueItemId).toBe(
      result.reviewQueueItemsCreated[0]!.id,
    );
  });


});
