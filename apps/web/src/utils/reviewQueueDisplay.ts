import type { GlobalReviewQueueItem, ReviewQueueItem } from "../types/workflow";
import { isRecord } from "./objectFields";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function formatCurrencyRange(lowValue: unknown, highValue: unknown): string | null {
  const low = asNumber(lowValue);
  const high = asNumber(highValue);

  if (low === null || high === null) {
    return null;
  }

  return `${low.toLocaleString()}–${high.toLocaleString()}`;
}

function isIgnoredReviewField(value: string) {
  const normalized = value.toLowerCase().replace(/[_\s-]/g, "");

  return normalized.includes("serial");
}

function toIssueId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toFieldLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (first) => first.toUpperCase());
}

function getConfidenceIssue(proposed: Record<string, unknown>): ReviewQueueReviewIssue | null {
  const confidence =
    asNumber(proposed.confidenceScore) ??
    asNumber(proposed.confidence);

  if (confidence === null || confidence >= 0.72) {
    return null;
  }

  return {
    id: "low-parse-confidence",
    label: "Review low parse confidence",
    detail: `Parsed confidence is ${confidence.toFixed(2)}, so the normalized club fields need human confirmation.`,
    severity: "Review",
  };
}

function buildReviewIssues(input: {
  proposed: Record<string, unknown>;
  missingFields: string[];
  uncertaintyNotes: string[];
  valuationReviewReasons: string[];
}): ReviewQueueReviewIssue[] {
  const issues: ReviewQueueReviewIssue[] = [];

  const normalizedMissingFields = input.missingFields.map((field) =>
    field.toLowerCase().replace(/[_\\s-]/g, ""),
  );

  for (const field of input.missingFields) {
    if (isIgnoredReviewField(field)) {
      continue;
    }

    issues.push({
      id: `missing-${toIssueId(field)}`,
      label: `Confirm ${toFieldLabel(field)}`,
      detail: `${toFieldLabel(field)} is missing or unclear in the parsed trade-in record.`,
      severity: "Confirm",
    });
  }

  for (const reason of input.valuationReviewReasons) {
    const normalizedReason = reason.toLowerCase();

    if (
      normalizedReason.includes("condition") &&
      normalizedMissingFields.some((field) => field.includes("condition"))
    ) {
      continue;
    }

    issues.push({
      id: `valuation-${toIssueId(reason)}`,
      label: normalizedReason.includes("inventory match confidence")
        ? "Review inventory match confidence"
        : "Review valuation evidence",
      detail: reason,
      severity: "Review",
    });
  }

  for (const note of input.uncertaintyNotes) {
    if (issues.some((issue) => issue.detail === note) || isIgnoredReviewField(note)) {
      continue;
    }

    issues.push({
      id: `uncertainty-${toIssueId(note)}`,
      label: "Review parsing uncertainty",
      detail: note,
      severity: "Review",
    });
  }

  return issues;
}

export type ReviewQueueReviewIssue = {
  id: string;
  label: string;
  detail: string;
  severity: "Review" | "Confirm" | "Correct";
};

export type ReviewQueueEvidenceSummary = {
  parsedClubLabel: string;
  rawText: string;
  reviewReasonSummary: string | null;
  missingFields: string[];
  uncertaintyNotes: string[];
  groundingSummary: string | null;
  groundingMatches: string;
  inventoryMatchSummary: string | null;
  demoValuationRangeSummary: string | null;
  valuationReviewReasons: string[];
  adjustmentSummary: string;
  suggestedNextAction: string;
  reviewIssues: ReviewQueueReviewIssue[];
};

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

  return asString(grounding.summary);
}

export function getGroundingMatchNamesFromReviewItem(
  item: ReviewQueueItem | GlobalReviewQueueItem,
): string {
  if (!isRecord(item.proposedGolfClubJson)) {
    return "—";
  }

  const grounding = item.proposedGolfClubJson.grounding;
  const groundingMatches =
    isRecord(grounding) && Array.isArray(grounding.matches)
      ? grounding.matches
      : [];

  const knowledgeMatches = Array.isArray(item.proposedGolfClubJson.knowledgeMatches)
    ? item.proposedGolfClubJson.knowledgeMatches
    : [];

  const names = [...groundingMatches, ...knowledgeMatches]
    .filter(isRecord)
    .map((match) => {
      const brand = asString(match.brand);
      const model = asString(match.model) ?? asString(match.productLine) ?? asString(match.title);

      return brand && model ? `${brand} ${model}` : model;
    })
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? Array.from(new Set(names)).join(", ") : "—";
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
    ? "Human-approved resolution recorded."
    : "Dismissed during human review.";
}

export function getReviewQueueItemBatchId(
  item: GlobalReviewQueueItem,
): string | null {
  return item.intakeBatch?.id ?? item.workflowRun?.intakeBatchId ?? null;
}

export function getReviewQueueEvidenceSummary(
  item: ReviewQueueItem | GlobalReviewQueueItem,
): ReviewQueueEvidenceSummary {
  const proposed = isRecord(item.proposedGolfClubJson)
    ? item.proposedGolfClubJson
    : {};

  const brand = asString(proposed.brand);
  const model =
    asString(proposed.model) ??
    asString(proposed.productLine) ??
    asString(proposed.productName);
  const category = asString(proposed.category);
  const shaftFlex = asString(proposed.shaftFlex) ?? asString(proposed.flex);
  const condition = asString(proposed.condition);

  const parsedClubParts = [
    brand,
    model,
    category ? `(${category})` : null,
    shaftFlex ? `${shaftFlex} flex` : null,
    condition ? `${condition} condition` : null,
  ].filter((part): part is string => Boolean(part));

  const inventoryMatch = isRecord(proposed.inventoryMatch)
    ? proposed.inventoryMatch
    : null;

  const inventoryMatchSummary = inventoryMatch
    ? [
        asString(inventoryMatch.sku),
        asString(inventoryMatch.productName) ??
          [asString(inventoryMatch.brand), asString(inventoryMatch.productLine)]
            .filter(Boolean)
            .join(" "),
        asNumber(inventoryMatch.confidence) !== null
          ? `confidence ${asNumber(inventoryMatch.confidence)}`
          : null,
      ]
        .filter((part): part is string => Boolean(part))
        .join(" · ")
    : null;

  const demoValuationRange = isRecord(proposed.demoValuationRange)
    ? proposed.demoValuationRange
    : null;

  const demoRangeText = demoValuationRange
    ? formatCurrencyRange(demoValuationRange.lowValue, demoValuationRange.highValue)
    : null;

  const demoValuationRangeSummary = demoValuationRange
    ? [
        demoRangeText,
        asString(demoValuationRange.confidence)
          ? `confidence ${asString(demoValuationRange.confidence)}`
          : null,
        demoValuationRange.reviewRequired === true ? "review required" : "review not required",
      ]
        .filter((part): part is string => Boolean(part))
        .join(" · ")
    : null;

  const adjustmentSummary =
    demoValuationRange && Array.isArray(demoValuationRange.adjustments)
      ? demoValuationRange.adjustments
          .filter(isRecord)
          .map((adjustment) => {
            const label =
              asString(adjustment.label) ??
              asString(adjustment.reason) ??
              asString(adjustment.type);
            const amount = asNumber(adjustment.amount);

            return amount === null || !label
              ? label
              : `${label} (${amount > 0 ? "+" : ""}${amount})`;
          })
          .filter((summary): summary is string => Boolean(summary))
          .join(", ")
      : "";

  const missingFields = [
    ...asStringArray(proposed.missingFields),
    ...asStringArray(proposed.validationWarnings),
  ].filter((field) => !isIgnoredReviewField(field));

  const uncertaintyNotes = [
    ...asStringArray(proposed.uncertaintyNotes),
    ...asStringArray(proposed.reviewReasons),
  ];

  const valuationReviewReasons =
    demoValuationRange && Array.isArray(demoValuationRange.reviewReasons)
      ? asStringArray(demoValuationRange.reviewReasons)
      : [];

  const reviewIssues = buildReviewIssues({
    proposed,
    missingFields,
    uncertaintyNotes,
    valuationReviewReasons,
  });

  const suggestedNextAction =
    item.status === "RESOLVED"
      ? "Resolution recorded. The workflow lifecycle can show this item as human-approved."
      : item.status === "DISMISSED"
        ? "Dismissal recorded. The workflow lifecycle can show this item as reviewed but not accepted."
        : reviewIssues.length > 0
          ? "Work through each actionable record issue, add corrections or confirmations, then resolve as a controlled human action."
          : "Inspect the evidence, confirm or correct the normalized trade-in record, then resolve as a controlled human action.";

  return {
    parsedClubLabel:
      parsedClubParts.length > 0 ? parsedClubParts.join(" ") : "Unresolved club details",
    rawText:
      item.originalText ??
      ("intakeItem" in item ? item.intakeItem?.rawText : null) ??
      "No original text captured.",
    reviewReasonSummary: asString(proposed.reviewReasonSummary),
    missingFields,
    uncertaintyNotes,
    groundingSummary: getGroundingSummaryFromReviewItem(item),
    groundingMatches: getGroundingMatchNamesFromReviewItem(item),
    inventoryMatchSummary,
    demoValuationRangeSummary,
    valuationReviewReasons,
    adjustmentSummary: adjustmentSummary || "—",
    suggestedNextAction,
    reviewIssues,
  };
}
