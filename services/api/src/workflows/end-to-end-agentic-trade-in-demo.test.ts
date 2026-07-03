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
});
