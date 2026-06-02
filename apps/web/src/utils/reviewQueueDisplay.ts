import type { GlobalReviewQueueItem, ReviewQueueItem } from "../types/workflow";
import { isRecord } from "./objectFields";

export function getGroundingSummaryFromReviewItem(
  item: ReviewQueueItem | GlobalReviewQueueItem,
): string | null {
  if (!isRecord(item.proposedGolfClubJson)) {
    return null;
  }

  const grounding = item.proposedGolfClubJson.grounding;

  if (!isRecord(grounding)) {
    return null;
  }

  return typeof grounding.summary === "string" ? grounding.summary : null;
}

export function getGroundingMatchNamesFromReviewItem(
  item: ReviewQueueItem | GlobalReviewQueueItem,
): string {
  if (!isRecord(item.proposedGolfClubJson)) {
    return "—";
  }

  const grounding = item.proposedGolfClubJson.grounding;

  if (!isRecord(grounding) || !Array.isArray(grounding.matches)) {
    return "—";
  }

  const names = grounding.matches
    .filter(isRecord)
    .map((match) => {
      const brand = typeof match.brand === "string" ? match.brand : null;
      const model = typeof match.model === "string" ? match.model : null;

      return brand && model ? `${brand} ${model}` : null;
    })
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? names.join(", ") : "—";
}

export function getGlobalReviewQueueDisplayText(
  item: GlobalReviewQueueItem,
): string {
  return (
    item.originalText ??
    item.intakeItem?.rawText ??
    "No original text captured."
  );
}

export function getWorkflowReviewQueueDisplayText(
  item: ReviewQueueItem,
  rawItems: { rawText: string }[] | undefined,
): string {
  if (item.originalText) {
    return item.originalText;
  }

  if (rawItems?.length === 1) {
    return rawItems[0].rawText;
  }

  return "Review source context: see raw intake items above. This simulated review item does not store item-level original text yet.";
}

export function getReviewActionFallbackNote(action: "resolve" | "dismiss") {
  return action === "resolve"
    ? "Resolved during human review."
    : "Dismissed during human review.";
}

export function getReviewQueueItemBatchId(
  item: GlobalReviewQueueItem,
): string | null {
  return item.intakeBatch?.id ?? item.workflowRun?.intakeBatchId ?? null;
}
