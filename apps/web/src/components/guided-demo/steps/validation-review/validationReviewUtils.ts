import { formatEnumLabel } from "../../../../utils/formatting";
import type {
  ReviewConditionGrade,
  ReviewCorrectionCategory,
  ReviewCorrectionShaftFlex,
} from "../../../../types/workflow";
import {
  CATEGORY_OPTIONS,
  CONDITION_GRADE_OPTIONS,
  SHAFT_FLEX_OPTIONS,
} from "./validationReviewOptions";
import type {
  DemoResult,
  ParsedItem,
  PriorReviewLearningSuggestion,
  RecordReviewCard,
  RetryEvent,
  ReviewOutcome,
  ReviewQueueItem,
  ValidationCheck,
} from "./validationReviewTypes";
export { formatEnumLabel };

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

export function normalizeComparable(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function formatStatusLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

export function formatFieldLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (first) => first.toUpperCase());
}

export function normalizeCategoryValue(value: unknown): ReviewCorrectionCategory | "" {
  const normalized = normalizeComparable(value);

  const match = CATEGORY_OPTIONS.find((option) => {
    return normalizeComparable(option.value) === normalized || normalizeComparable(option.label) === normalized;
  });

  return match?.value ?? "";
}

export function normalizeShaftFlexValue(value: unknown): ReviewCorrectionShaftFlex | "" {
  const normalized = normalizeComparable(value);

  const match = SHAFT_FLEX_OPTIONS.find((option) => {
    return normalizeComparable(option.value) === normalized || normalizeComparable(option.label) === normalized;
  });

  return match?.value ?? "";
}

export function normalizeConditionGradeValue(value: unknown): ReviewConditionGrade | "" {
  const stringValue = asString(value);

  if (!stringValue) {
    return "";
  }

  const match = CONDITION_GRADE_OPTIONS.find((option) => option === stringValue);

  return match ?? "";
}

export function inferConditionGradeFromText(value: string): ReviewConditionGrade | "" {
  const match = value.match(/\b(9\.5 Mint|9\.0 Above Average|8\.0 Average|7\.0 Below Average|6\.0 Poor)\b/i);

  if (!match) {
    return "";
  }

  const normalized = match[1]!.toLowerCase();

  return (
    CONDITION_GRADE_OPTIONS.find(
      (conditionGrade) => conditionGrade.toLowerCase() === normalized,
    ) ?? ""
  );
}

export function formatDisplayValue(value: unknown, options: { currency?: boolean } = {}) {
  const numberValue = asNumber(value);

  if (numberValue !== null) {
    return options.currency ? `$${numberValue.toLocaleString()}` : numberValue.toLocaleString();
  }

  const stringValue = asString(value);

  if (!stringValue) {
    return "—";
  }

  if (options.currency && /^\d+(\.\d+)?$/.test(stringValue)) {
    return `$${Number(stringValue).toLocaleString()}`;
  }

  return formatEnumLabel(stringValue);
}

export function getFirstValue(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (asString(value) || asNumber(value) !== null) {
      return value;
    }
  }

  return null;
}

export type ParserEvidenceDisplay = {
  value: string | number;
  sourceText: string;
};

export function getParserEvidenceForField(
  record: Record<string, unknown> | null,
  keys: string[],
): ParserEvidenceDisplay | null {
  const evidenceRoot = asRecord(record?.parserEvidence);

  if (!evidenceRoot) {
    return null;
  }

  for (const key of keys) {
    const evidence = asRecord(evidenceRoot[key]);
    const sourceText = asString(evidence?.sourceText);
    const value = getFirstValue(evidence, ["value"]);

    if (sourceText && (asString(value) || asNumber(value) !== null)) {
      return {
        value: value as string | number,
        sourceText,
      };
    }
  }

  return null;
}

export function getFirstString(record: Record<string, unknown> | null, keys: string[]) {
  const value = getFirstValue(record, keys);
  const stringValue = asString(value);

  return stringValue ?? (asNumber(value) !== null ? String(value) : null);
}

export function getProposedRecord(reviewItem: ReviewQueueItem | null) {
  return asRecord(asRecord(reviewItem)?.proposedGolfClubJson);
}

export function getRecordIdentity(record: Record<string, unknown>) {
  return (
    getFirstString(record, ["id", "itemId", "parsedItemId", "sourceRecordId", "recordId"]) ??
    null
  );
}

export function getRecordLabel(input: {
  parsedRecord: Record<string, unknown>;
  reviewItem: ReviewQueueItem | null;
  fallbackIndex: number;
}) {
  const proposedRecord = getProposedRecord(input.reviewItem);
  const brand =
    getFirstString(input.parsedRecord, ["brand"]) ??
    getFirstString(proposedRecord, ["brand"]);
  const productLine =
    getFirstString(input.parsedRecord, ["productLine", "model", "title"]) ??
    getFirstString(proposedRecord, ["productLine", "model", "title"]);
  const category =
    getFirstString(input.parsedRecord, ["category"]) ??
    getFirstString(proposedRecord, ["category"]);

  const labelParts = [brand, productLine, category ? formatEnumLabel(category) : null].filter(
    Boolean,
  );

  return labelParts.length > 0
    ? labelParts.join(" · ")
    : `Record ${input.fallbackIndex + 1}`;
}

export function getSourceEvidence(input: {
  parsedRecord: Record<string, unknown>;
  reviewItem: ReviewQueueItem | null;
}) {
  const reviewRecord = asRecord(input.reviewItem);

  return (
    getFirstString(reviewRecord, ["originalText"]) ??
    getFirstString(input.parsedRecord, [
      "rawText",
      "rawLine",
      "sourceText",
      "normalizedText",
      "originalText",
      "text",
    ]) ??
    "No source evidence captured for this record."
  );
}

export function getMissingFields(input: {
  parsedRecord: Record<string, unknown>;
  reviewItem: ReviewQueueItem | null;
}) {
  const proposedRecord = getProposedRecord(input.reviewItem);
  const fields = [
    ...asStringArray(input.parsedRecord.missingFields),
    ...asStringArray(proposedRecord?.missingFields),
  ];

  return Array.from(new Set(fields)).filter((field) => {
    return !normalizeComparable(field).includes("serial");
  });
}

export function getReviewReasons(input: {
  parsedRecord: Record<string, unknown>;
  reviewItem: ReviewQueueItem | null;
  valuationEvidence: Record<string, unknown> | null;
}) {
  const reviewRecord = asRecord(input.reviewItem);
  const proposedRecord = getProposedRecord(input.reviewItem);
  const valuationEstimate = asRecord(input.valuationEvidence?.estimate);

  const reasons = [
    ...asStringArray(reviewRecord?.reasonCodes),
    ...asStringArray(input.parsedRecord.reasonCodes),
    ...asStringArray(input.parsedRecord.valuationReviewReasons),
    ...asStringArray(proposedRecord?.reasonCodes),
    ...asStringArray(proposedRecord?.valuationReviewReasons),
    ...asStringArray(valuationEstimate?.reviewReasons),
  ];

  const reviewReasonSummary =
    getFirstString(proposedRecord, ["reviewReasonSummary"]) ??
    getFirstString(reviewRecord, ["reviewReasonSummary"]);

  if (reviewReasonSummary) {
    reasons.unshift(reviewReasonSummary);
  }

  return Array.from(new Set(reasons)).filter((reason) => {
    return !normalizeComparable(reason).includes("serial");
  });
}

export function getReviewOutcomeForItem(
  reviewItem: ReviewQueueItem | null,
  reviewOutcomes: ReviewOutcome[],
) {
  if (!reviewItem) {
    return null;
  }

  return (
    reviewOutcomes.find((outcome) => outcome.reviewQueueItemId === reviewItem.id) ?? null
  );
}

export function getPriorReviewSuggestionsForRecord(input: {
  result: DemoResult;
  index: number;
  recordIdentity: string | null;
}): PriorReviewLearningSuggestion[] {
  const directMatch = input.result.priorReviewLearningSuggestionsByItem.find(
    (item) => item.parsedItemId === input.recordIdentity,
  );

  if (directMatch) {
    return directMatch.suggestions;
  }

  return input.result.priorReviewLearningSuggestionsByItem[input.index]?.suggestions ?? [];
}

export function findRecordIndexFromText(values: unknown[], recordCount: number) {
  for (const value of values) {
    const text = asString(value);

    if (!text) {
      continue;
    }

    const match = text.match(/\b(?:record|item|club|row)\s*#?\s*(\d+)\b/i);
    const index = match ? Number(match[1]) - 1 : Number.NaN;

    if (Number.isInteger(index) && index >= 0 && index < recordCount) {
      return index;
    }
  }

  return null;
}

export function fieldMatches(field: string | null | undefined, fields: string[]) {
  if (!field) {
    return false;
  }

  const normalizedField = normalizeComparable(field);

  return fields.some((candidate) => normalizeComparable(candidate) === normalizedField);
}

export function getEvidenceForRecord<T>(
  evidenceList: T[],
  input: {
    index: number;
    recordIdentity: string | null;
  },
) {
  const matchingEvidence = evidenceList.find((evidence) => {
    const record = asRecord(evidence);

    if (!record || !input.recordIdentity) {
      return false;
    }

    const evidenceIdentity =
      getFirstString(record, ["itemId", "recordId", "parsedItemId", "sourceRecordId"]) ??
      getFirstString(asRecord(record.lookup), ["itemId", "recordId"]);

    return evidenceIdentity === input.recordIdentity;
  });

  return asRecord(matchingEvidence ?? evidenceList[input.index]) ?? null;
}

export function findMatchingReviewItem(input: {
  parsedRecord: Record<string, unknown>;
  reviewItems: ReviewQueueItem[];
  usedReviewItemIds: Set<string>;
}) {
  const recordIdentity = getRecordIdentity(input.parsedRecord);
  const intakeItemId = getFirstString(input.parsedRecord, ["intakeItemId"]);
  const sourceRowNumber = asNumber(input.parsedRecord.sourceRowNumber);

  return (
    input.reviewItems.find((reviewItem) => {
      if (input.usedReviewItemIds.has(reviewItem.id)) {
        return false;
      }

      const proposedRecord = getProposedRecord(reviewItem);
      const proposedIdentity = getRecordIdentity(proposedRecord ?? {});
      const reviewItemRecord = asRecord(reviewItem);
      const reviewIntakeItem = asRecord(reviewItemRecord?.intakeItem);
      const reviewSourceRowNumber = asNumber(reviewIntakeItem?.sourceRowNumber);

      if (recordIdentity && proposedIdentity && recordIdentity === proposedIdentity) {
        return true;
      }

      if (intakeItemId && reviewItem.intakeItemId && intakeItemId === reviewItem.intakeItemId) {
        return true;
      }

      if (
        sourceRowNumber !== null &&
        reviewSourceRowNumber !== null &&
        sourceRowNumber === reviewSourceRowNumber
      ) {
        return true;
      }

      return false;
    }) ?? null
  );
}

export function getInventorySummary(evidence: Record<string, unknown> | null) {
  if (!evidence) {
    return "No inventory match evidence captured.";
  }

  const lookup = asRecord(evidence.lookup);
  const productId = getFirstString(lookup, ["productId", "sku", "id"]);
  const confidence = asNumber(lookup?.confidence) ?? asNumber(evidence.confidence);
  const matched = evidence.matched === true || evidence.hasMatch === true || Boolean(productId);

  if (!matched) {
    return "No internal inventory match found.";
  }

  return [
    productId ? `Matched ${productId}` : "Inventory match found",
    confidence !== null ? `confidence ${confidence.toFixed(2)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function getValuationSummary(evidence: Record<string, unknown> | null) {
  const estimate = asRecord(evidence?.estimate);

  if (!estimate) {
    return "No valuation range captured.";
  }

  const lowValue = asNumber(estimate.lowValue);
  const highValue = asNumber(estimate.highValue);
  const confidence = getFirstString(estimate, ["confidence"]);
  const reviewRequired = estimate.reviewRequired === true;

  return [
    lowValue !== null && highValue !== null
      ? `$${lowValue.toLocaleString()}–$${highValue.toLocaleString()}`
      : "Valuation range available",
    confidence ? `${confidence.toLowerCase()} confidence` : null,
    reviewRequired ? "review required" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function getSuggestedAction(input: {
  missingFields: string[];
  reviewReasons: string[];
  retryEvents: RetryEvent[];
  reviewOutcome: ReviewOutcome | null;
  reviewItem: ReviewQueueItem | null;
}) {
  if (input.reviewOutcome?.suggestedNextAction) {
    return input.reviewOutcome.suggestedNextAction;
  }

  if (input.missingFields.length > 0) {
    return `Confirm ${input.missingFields.map(formatFieldLabel).join(", ")} before this record moves downstream.`;
  }

  if (input.retryEvents.some((event) => event.status === "UNRESOLVED")) {
    return "Inspect the unresolved retry result and confirm the field before final reporting.";
  }

  if (input.reviewReasons.length > 0 || input.reviewItem) {
    return "Review the source evidence and confirm whether the normalized record should be approved.";
  }

  return "No action required. This record passed the current review gates.";
}

export function validationCheckMatchesCardIdentity(
  check: ValidationCheck,
  card: Pick<
    RecordReviewCard,
    "id" | "inventoryEvidence" | "reviewItem" | "valuationEvidence"
  >,
) {
  const checkRecordId = asString(check.recordId);

  if (!checkRecordId) {
    return false;
  }

  const proposedRecord = getProposedRecord(card.reviewItem);
  const reviewRecord = asRecord(card.reviewItem);
  const inventoryLookup = asRecord(card.inventoryEvidence?.lookup);
  const valuationEstimate = asRecord(card.valuationEvidence?.estimate);

  const candidateIds = [
    card.id,
    getRecordIdentity(proposedRecord ?? {}),
    getFirstString(reviewRecord, [
      "recordId",
      "parsedItemId",
      "sourceRecordId",
      "intakeItemId",
    ]),
    getFirstString(card.inventoryEvidence, [
      "recordId",
      "parsedItemId",
      "sourceRecordId",
      "itemId",
    ]),
    getFirstString(inventoryLookup, [
      "recordId",
      "parsedItemId",
      "sourceRecordId",
      "itemId",
    ]),
    getFirstString(card.valuationEvidence, [
      "recordId",
      "parsedItemId",
      "sourceRecordId",
      "itemId",
    ]),
    getFirstString(valuationEstimate, [
      "recordId",
      "parsedItemId",
      "sourceRecordId",
      "itemId",
    ]),
  ].filter((value): value is string => Boolean(value));

  return candidateIds.some((candidateId) => candidateId === checkRecordId);
}

export function shouldValidationCheckBelongToCard(input: {
  check: ValidationCheck;
  card: Pick<
    RecordReviewCard,
    | "id"
    | "index"
    | "inventoryEvidence"
    | "missingFields"
    | "reviewItem"
    | "valuationEvidence"
  >;
  recordCount: number;
}) {
  const checkRecordIndex = findRecordIndexFromText(
    [
      input.check.id,
      input.check.label,
      input.check.message,
      input.check.field,
    ],
    input.recordCount,
  );

  if (checkRecordIndex !== null) {
    return checkRecordIndex === input.card.index;
  }

  if (validationCheckMatchesCardIdentity(input.check, input.card)) {
    return true;
  }

  if (input.recordCount === 1) {
    return true;
  }

  if (input.check.reviewRequired && fieldMatches(input.check.field, input.card.missingFields)) {
    return true;
  }

  return false;
}

export function shouldRetryEventBelongToCard(input: {
  event: RetryEvent;
  card: Pick<RecordReviewCard, "index" | "missingFields" | "reviewItem">;
  recordCount: number;
}) {
  const eventRecordIndex = findRecordIndexFromText(
    [
      input.event.id,
      input.event.reason,
      input.event.message,
      input.event.targetField,
    ],
    input.recordCount,
  );

  if (eventRecordIndex !== null) {
    return eventRecordIndex === input.card.index;
  }

  if (input.recordCount === 1) {
    return true;
  }

  return fieldMatches(input.event.targetField, input.card.missingFields);
}

export function buildRecordReviewCards(
  result: DemoResult,
  currentRunReviewQueueItems: ReviewQueueItem[] = result.reviewQueueItemsCreated,
) {
  const reviewItems =
    currentRunReviewQueueItems.length > 0
      ? currentRunReviewQueueItems
      : result.reviewQueueItemsCreated;
  const usedReviewItemIds = new Set<string>();

  const cards: RecordReviewCard[] = result.parsedItems.map((parsedItem: ParsedItem, index) => {
    const parsedRecord = asRecord(parsedItem) ?? {};
    const recordIdentity = getRecordIdentity(parsedRecord);
    const reviewItem = findMatchingReviewItem({
      parsedRecord,
      reviewItems,
      usedReviewItemIds,
    });

    if (reviewItem) {
      usedReviewItemIds.add(reviewItem.id);
    }

    const inventoryEvidence = getEvidenceForRecord(result.inventoryMatchesByItem, {
      index,
      recordIdentity,
    });
    const valuationEvidence = getEvidenceForRecord(result.valuationEvidenceByItem, {
      index,
      recordIdentity,
    });
    const reviewOutcome = getReviewOutcomeForItem(reviewItem, result.reviewOutcomes);
    const missingFields = getMissingFields({ parsedRecord, reviewItem });
    const reviewReasons = getReviewReasons({ parsedRecord, reviewItem, valuationEvidence });

    return {
      id: recordIdentity ?? reviewItem?.id ?? `record-${index + 1}`,
      index,
      label: getRecordLabel({ parsedRecord, reviewItem, fallbackIndex: index }),
      status:
        reviewItem?.status === "RESOLVED" || reviewItem?.status === "DISMISSED"
          ? "resolved"
          : reviewItem || missingFields.length > 0 || reviewReasons.length > 0
            ? "needs-review"
            : "ready",
      statusLabel:
        reviewItem?.status === "RESOLVED"
          ? "Resolved"
          : reviewItem?.status === "DISMISSED"
            ? "Dismissed"
            : reviewItem || missingFields.length > 0 || reviewReasons.length > 0
              ? "Needs review"
              : "Passed gates",
      parsedRecord,
      reviewItem,
      reviewOutcome,
      inventoryEvidence,
      valuationEvidence,
      sourceEvidence: getSourceEvidence({ parsedRecord, reviewItem }),
      priorReviewSuggestions: getPriorReviewSuggestionsForRecord({
        result,
        index,
        recordIdentity,
      }),
      missingFields,
      reviewReasons,
      validationChecks: [],
      retryEvents: [],
      suggestedAction: "",
    };
  });

  for (const reviewItem of reviewItems) {
    if (usedReviewItemIds.has(reviewItem.id)) {
      continue;
    }

    const parsedRecord = getProposedRecord(reviewItem) ?? {};
    const index = cards.length;
    const reviewOutcome = getReviewOutcomeForItem(reviewItem, result.reviewOutcomes);
    const missingFields = getMissingFields({ parsedRecord, reviewItem });
    const valuationEvidence = null;
    const reviewReasons = getReviewReasons({ parsedRecord, reviewItem, valuationEvidence });

    cards.push({
      id: reviewItem.id,
      index,
      label: getRecordLabel({ parsedRecord, reviewItem, fallbackIndex: index }),
      status:
        reviewItem.status === "RESOLVED" || reviewItem.status === "DISMISSED"
          ? "resolved"
          : "needs-review",
      statusLabel:
        reviewItem.status === "RESOLVED"
          ? "Resolved"
          : reviewItem.status === "DISMISSED"
            ? "Dismissed"
            : "Needs review",
      parsedRecord,
      reviewItem,
      reviewOutcome,
      inventoryEvidence: null,
      valuationEvidence,
      sourceEvidence: getSourceEvidence({ parsedRecord, reviewItem }),
      priorReviewSuggestions: [],
      missingFields,
      reviewReasons,
      validationChecks: [],
      retryEvents: [],
      suggestedAction: "",
    });
  }

  for (const card of cards) {
    card.validationChecks = result.validationChecks.filter((check) =>
      shouldValidationCheckBelongToCard({
        check,
        card,
        recordCount: cards.length,
      }),
    );

    card.retryEvents = result.retryEvents.filter((event) =>
      shouldRetryEventBelongToCard({
        event,
        card,
        recordCount: cards.length,
      }),
    );

    const hasBlockingValidation = card.validationChecks.some(
      (check) => check.reviewRequired || check.status === "FAIL" || check.status === "WARNING",
    );
    const hasUnresolvedRetry = card.retryEvents.some((event) => event.status === "UNRESOLVED");

    if (
      card.status === "ready" &&
      (hasBlockingValidation || hasUnresolvedRetry)
    ) {
      card.status = "needs-review";
      card.statusLabel = "Needs review";
    }

    if (
      card.reviewItem?.status === "RESOLVED" ||
      card.reviewItem?.status === "DISMISSED"
    ) {
      card.status = "resolved";
      card.statusLabel =
        card.reviewItem.status === "RESOLVED" ? "Resolved" : "Dismissed";
    }

    if (
      card.reviewItem?.status === "RESOLVED" ||
      card.reviewItem?.status === "DISMISSED"
    ) {
      card.status = "resolved";
      card.statusLabel =
        card.reviewItem.status === "RESOLVED" ? "Resolved" : "Dismissed";
    }

    card.suggestedAction = getSuggestedAction({
      missingFields: card.missingFields,
      reviewReasons: card.reviewReasons,
      retryEvents: card.retryEvents,
      reviewOutcome: card.reviewOutcome,
      reviewItem: card.reviewItem,
    });
  }

  const initiallyAssignedValidationCheckIds = new Set(
    cards.flatMap((card) => card.validationChecks.map((check) => check.id)),
  );
  const initiallyAssignedRetryEventIds = new Set(
    cards.flatMap((card) => card.retryEvents.map((event) => event.id)),
  );
  const activeReviewCards = cards.filter((card) => card.status === "needs-review");
  const singleActiveReviewCard =
    activeReviewCards.length === 1 ? activeReviewCards[0] : null;

  if (singleActiveReviewCard) {
    const orphanedActionableValidationChecks = result.validationChecks.filter(
      (check) =>
        !initiallyAssignedValidationCheckIds.has(check.id) &&
        isActionableRunLevelValidationCheck(check),
    );
    const orphanedUnresolvedRetryEvents = result.retryEvents.filter(
      (event) =>
        !initiallyAssignedRetryEventIds.has(event.id) &&
        event.status === "UNRESOLVED",
    );

    if (orphanedActionableValidationChecks.length > 0) {
      singleActiveReviewCard.validationChecks = [
        ...singleActiveReviewCard.validationChecks,
        ...orphanedActionableValidationChecks,
      ];
    }

    if (orphanedUnresolvedRetryEvents.length > 0) {
      singleActiveReviewCard.retryEvents = [
        ...singleActiveReviewCard.retryEvents,
        ...orphanedUnresolvedRetryEvents,
      ];
    }
  }

  const assignedValidationCheckIds = new Set(
    cards.flatMap((card) => card.validationChecks.map((check) => check.id)),
  );
  const assignedRetryEventIds = new Set(
    cards.flatMap((card) => card.retryEvents.map((event) => event.id)),
  );

  return {
    cards,
    unassignedValidationChecks: result.validationChecks.filter(
      (check) => !assignedValidationCheckIds.has(check.id),
    ),
    unassignedRetryEvents: result.retryEvents.filter(
      (event) => !assignedRetryEventIds.has(event.id),
    ),
  };
}

export function isActionableRunLevelValidationCheck(check: ValidationCheck) {
  const normalizedLabel = normalizeComparable(check.label);
  const normalizedMessage = normalizeComparable(check.message);
  const isReviewItemSummary =
    normalizedLabel.includes("reviewrequirementdetermined") ||
    normalizedMessage.includes("humanreviewitemwascreated");

  if (isReviewItemSummary) {
    return false;
  }

  return check.status === "WARNING" || check.status === "FAIL";
}

export function getStatusClassName(status: string) {
  return `guided-validation-status guided-validation-status--${status.toLowerCase()}`;
}

export function getRecordStatusClassName(status: RecordReviewCard["status"]) {
  return `guided-record-review-card__status guided-record-review-card__status--${status}`;
}
