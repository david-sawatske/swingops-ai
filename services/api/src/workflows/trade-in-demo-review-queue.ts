import type { Prisma, ReviewQueueItem } from "@prisma/client";

import type { TradeInValuationResult } from "../internal-systems/trade-in-valuation-service.js";
import { prisma } from "../lib/prisma.js";
import {
  getTradeInDemoFieldRepairMissingFields,
  shouldRunTradeInDemoFieldRepair,
} from "./trade-in-demo-model-assistance.js";
import type { ParsedTradeInDemoItem } from "./trade-in-demo-parser.js";
import type { TradeInDemoEvidenceBundle } from "./trade-in-demo-evidence.js";
import { resolveSupersededIntakeReviewMarkers } from "./review-queue-supersession.js";

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function tradeInDemoItemNeedsReview(
  item: ParsedTradeInDemoItem,
): boolean {
  return item.confidence < 0.72 || item.missingFields.length > 0;
}

function valuationNeedsReview(estimate: TradeInValuationResult): boolean {
  return estimate.reviewRequired || estimate.confidence === "LOW";
}

function getReviewReason(
  item: ParsedTradeInDemoItem,
): "LOW_CONFIDENCE" | "MISSING_REQUIRED_FIELDS" | "AMBIGUOUS_INPUT" {
  if (getTradeInDemoFieldRepairMissingFields(item).length > 0) {
    return "MISSING_REQUIRED_FIELDS";
  }

  if (item.uncertaintyNotes.length > 0) {
    return "AMBIGUOUS_INPUT";
  }

  return "LOW_CONFIDENCE";
}

function summarizeReviewReason(input: {
  item: ParsedTradeInDemoItem;
  valuationEstimate?: TradeInValuationResult;
}): string {
  const missingFields = getTradeInDemoFieldRepairMissingFields(input.item);
  const reasons = [
    input.item.confidence < 0.72 ? `confidence ${input.item.confidence}` : null,
    missingFields.length > 0 ? `missing ${missingFields.join(", ")}` : null,
    input.item.uncertaintyNotes.length > 0
      ? `uncertainty: ${input.item.uncertaintyNotes.join(", ")}`
      : null,
    input.valuationEstimate?.reviewRequired
      ? `valuation review: ${input.valuationEstimate.reviewReasons.join(", ")}`
      : null,
  ].filter(Boolean);

  return reasons.join("; ");
}

export async function createTradeInDemoReviewQueueItems(input: {
  workflowRunId: string;
  parsedItems: ParsedTradeInDemoItem[];
  intakeItems: { id: string }[];
  evidence: TradeInDemoEvidenceBundle;
}): Promise<ReviewQueueItem[]> {
  const createdItems: ReviewQueueItem[] = [];

  for (const [index, item] of input.parsedItems.entries()) {
    const valuationEvidence = input.evidence.valuationEvidenceByItem.find(
      (candidate) => candidate.parsedItemId === item.id,
    );
    const inventoryEvidence = input.evidence.inventoryMatchesByItem.find(
      (candidate) => candidate.parsedItemId === item.id,
    );
    const fieldRepairMissingFields =
      getTradeInDemoFieldRepairMissingFields(item);

    if (
      !tradeInDemoItemNeedsReview(item) &&
      !shouldRunTradeInDemoFieldRepair(item) &&
      !valuationNeedsReview(valuationEvidence!.estimate)
    ) {
      continue;
    }

    const intakeItem = input.intakeItems[index];
    const reviewQueueItem = await prisma.reviewQueueItem.create({
      data: {
        workflowRunId: input.workflowRunId,
        intakeItemId: intakeItem?.id ?? null,
        reason: getReviewReason(item),
        status: "OPEN",
        originalText: item.rawLine,
        proposedGolfClubJson: toInputJson({
          ...item,
          missingFields: fieldRepairMissingFields,
          reviewReasonSummary: summarizeReviewReason({
            item,
            valuationEstimate: valuationEvidence!.estimate,
          }),
          knowledgeMatches:
            input.evidence.knowledgeMatchesByItem
              .find((match) => match.parsedItemId === item.id)
              ?.search.results.slice(0, 2) ?? [],
          inventoryMatch: inventoryEvidence?.lookup ?? null,
          demoValuationRange: valuationEvidence?.estimate ?? null,
        }),
      },
    });

    await resolveSupersededIntakeReviewMarkers({
      authoritativeReviewQueueItemId: reviewQueueItem.id,
      currentWorkflowRunId: input.workflowRunId,
      item,
      sourceRowNumber: index + 1,
    });

    createdItems.push(reviewQueueItem);
  }

  return createdItems;
}

export function buildTradeInDemoReviewQueueStepOutput(
  createdItems: ReviewQueueItem[],
) {
  return {
    reviewQueueItemCount: createdItems.length,
    reviewQueueItemIds: createdItems.map((item) => item.id),
    openReviewQueueItemCount: createdItems.filter(
      (item) => item.status === "OPEN" || item.status === "IN_REVIEW",
    ).length,
  };
}
