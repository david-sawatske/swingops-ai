import { useState } from "react";
import type {
  ExecuteEndToEndAgenticTradeInDemoResponse,
  GlobalReviewQueueItem,
  ResolveReviewQueueItemWithCorrectionsRequest,
  ReviewConditionGrade,
  ReviewCorrectionCategory,
  ReviewCorrectionShaftFlex,
  StructuredReviewCorrectedRecord,
  StructuredReviewLearningEventInput,
} from "../../../types/workflow";

type GuidedValidationReviewStepProps = {
  actionError: string | null;
  actionSuccess: string | null;
  activeReviewQueueItemId: string | null;
  currentRunReviewQueueItems: GlobalReviewQueueItem[];
  onContinue: () => void;
  onOpenReviewQueue: () => void;
  onReviewQueueNotesChange: (reviewQueueItemId: string, reviewerNotes: string) => void;
  onResolveReviewQueueItemWithCorrections: (input: {
    reviewQueueItemId: string;
    request: ResolveReviewQueueItemWithCorrectionsRequest;
    workflowRunId?: string | null;
    intakeBatchId?: string | null;
  }) => void;
  result: ExecuteEndToEndAgenticTradeInDemoResponse | null;
  reviewQueueNotesById: Record<string, string>;
};

type DemoResult = NonNullable<GuidedValidationReviewStepProps["result"]>;
type ParsedItem = DemoResult["parsedItems"][number];
type ValidationCheck = DemoResult["validationChecks"][number];
type RetryEvent = DemoResult["retryEvents"][number];
type ReviewOutcome = DemoResult["reviewOutcomes"][number];
type DemoReviewQueueItem = DemoResult["reviewQueueItemsCreated"][number];
type ReviewQueueItem = DemoReviewQueueItem | GlobalReviewQueueItem;

type ReviewCorrectionDraft = {
  brand: string;
  productLine: string;
  category: ReviewCorrectionCategory | "";
  shaftFlex: ReviewCorrectionShaftFlex | "";
  conditionGrade: ReviewConditionGrade | "";
  demoValue: string;
  demoValuationNote: string;
  reviewerNotes: string;
};

type RecordReviewCard = {
  id: string;
  index: number;
  label: string;
  status: "ready" | "needs-review" | "resolved";
  statusLabel: string;
  parsedRecord: Record<string, unknown>;
  reviewItem: ReviewQueueItem | null;
  reviewOutcome: ReviewOutcome | null;
  inventoryEvidence: Record<string, unknown> | null;
  valuationEvidence: Record<string, unknown> | null;
  sourceEvidence: string;
  missingFields: string[];
  reviewReasons: string[];
  validationChecks: ValidationCheck[];
  retryEvents: RetryEvent[];
  suggestedAction: string;
};

const CATEGORY_OPTIONS: Array<{
  label: string;
  value: ReviewCorrectionCategory;
}> = [
  { label: "Driver", value: "DRIVER" },
  { label: "Fairway Wood", value: "FAIRWAY_WOOD" },
  { label: "Hybrid", value: "HYBRID" },
  { label: "Iron Set", value: "IRON_SET" },
  { label: "Wedge", value: "WEDGE" },
  { label: "Putter", value: "PUTTER" },
];

const SHAFT_FLEX_OPTIONS: Array<{
  label: string;
  value: ReviewCorrectionShaftFlex;
}> = [
  { label: "Stiff", value: "STIFF" },
  { label: "Regular", value: "REGULAR" },
  { label: "Senior", value: "SENIOR" },
  { label: "X-Stiff", value: "X_STIFF" },
  { label: "Ladies", value: "LADIES" },
  { label: "Tour X-Stiff", value: "TOUR_X_STIFF" },
];

const CONDITION_GRADE_OPTIONS: ReviewConditionGrade[] = [
  "9.5 Mint",
  "9.0 Above Average",
  "8.0 Average",
  "7.0 Below Average",
  "6.0 Poor",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normalizeComparable(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function formatStatusLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

function formatFieldLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (first) => first.toUpperCase());
}

function formatEnumLabel(value: string) {
  const normalized = value.toUpperCase().replace(/[\s-]+/g, "_");

  const flexLabels: Record<string, string> = {
    LADIES: "Ladies",
    SENIOR: "Senior",
    REGULAR: "Regular",
    STIFF: "Stiff",
    X_STIFF: "X-Stiff",
    TOUR_X_STIFF: "Tour X-Stiff",
  };

  const categoryLabels: Record<string, string> = {
    DRIVER: "Driver",
    FAIRWAY_WOOD: "Fairway Wood",
    HYBRID: "Hybrid",
    IRON_SET: "Iron Set",
    WEDGE: "Wedge",
    PUTTER: "Putter",
  };

  return flexLabels[normalized] ?? categoryLabels[normalized] ?? value;
}

function normalizeCategoryValue(value: unknown): ReviewCorrectionCategory | "" {
  const normalized = normalizeComparable(value);

  const match = CATEGORY_OPTIONS.find((option) => {
    return normalizeComparable(option.value) === normalized || normalizeComparable(option.label) === normalized;
  });

  return match?.value ?? "";
}

function normalizeShaftFlexValue(value: unknown): ReviewCorrectionShaftFlex | "" {
  const normalized = normalizeComparable(value);

  const match = SHAFT_FLEX_OPTIONS.find((option) => {
    return normalizeComparable(option.value) === normalized || normalizeComparable(option.label) === normalized;
  });

  return match?.value ?? "";
}

function normalizeConditionGradeValue(value: unknown): ReviewConditionGrade | "" {
  const stringValue = asString(value);

  if (!stringValue) {
    return "";
  }

  const match = CONDITION_GRADE_OPTIONS.find((option) => option === stringValue);

  return match ?? "";
}

function inferConditionGradeFromText(value: string): ReviewConditionGrade | "" {
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

function formatDisplayValue(value: unknown, options: { currency?: boolean } = {}) {
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

function getFirstValue(record: Record<string, unknown> | null, keys: string[]) {
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

function getFirstString(record: Record<string, unknown> | null, keys: string[]) {
  const value = getFirstValue(record, keys);
  const stringValue = asString(value);

  return stringValue ?? (asNumber(value) !== null ? String(value) : null);
}

function getProposedRecord(reviewItem: ReviewQueueItem | null) {
  return asRecord(asRecord(reviewItem)?.proposedGolfClubJson);
}

function getRecordIdentity(record: Record<string, unknown>) {
  return (
    getFirstString(record, ["id", "itemId", "parsedItemId", "sourceRecordId", "recordId"]) ??
    null
  );
}

function getRecordLabel(input: {
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

function getSourceEvidence(input: {
  parsedRecord: Record<string, unknown>;
  reviewItem: ReviewQueueItem | null;
}) {
  const reviewRecord = asRecord(input.reviewItem);

  return (
    getFirstString(reviewRecord, ["originalText"]) ??
    getFirstString(input.parsedRecord, [
      "rawText",
      "sourceText",
      "normalizedText",
      "originalText",
      "text",
    ]) ??
    "No source evidence captured for this record."
  );
}

function getMissingFields(input: {
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

function getReviewReasons(input: {
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

function getReviewOutcomeForItem(
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

function findRecordIndexFromText(values: unknown[], recordCount: number) {
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

function fieldMatches(field: string | null | undefined, fields: string[]) {
  if (!field) {
    return false;
  }

  const normalizedField = normalizeComparable(field);

  return fields.some((candidate) => normalizeComparable(candidate) === normalizedField);
}

function getEvidenceForRecord<T>(
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

function findMatchingReviewItem(input: {
  parsedRecord: Record<string, unknown>;
  reviewItems: ReviewQueueItem[];
  usedReviewItemIds: Set<string>;
}) {
  const recordIdentity = getRecordIdentity(input.parsedRecord);
  const brand = normalizeComparable(getFirstString(input.parsedRecord, ["brand"]));
  const productLine = normalizeComparable(
    getFirstString(input.parsedRecord, ["productLine", "model", "title"]),
  );

  const directMatch = input.reviewItems.find((reviewItem) => {
    if (input.usedReviewItemIds.has(reviewItem.id)) {
      return false;
    }

    const proposedRecord = getProposedRecord(reviewItem);
    const proposedIdentity = getRecordIdentity(proposedRecord ?? {});
    const proposedBrand = normalizeComparable(getFirstString(proposedRecord, ["brand"]));
    const proposedProductLine = normalizeComparable(
      getFirstString(proposedRecord, ["productLine", "model", "title"]),
    );
    const originalText = normalizeComparable(asRecord(reviewItem)?.originalText);

    if (recordIdentity && proposedIdentity && recordIdentity === proposedIdentity) {
      return true;
    }

    if (brand && productLine && proposedBrand === brand && proposedProductLine === productLine) {
      return true;
    }

    return Boolean(
      originalText &&
        ((brand && originalText.includes(brand)) ||
          (productLine && originalText.includes(productLine))),
    );
  });

  if (directMatch) {
    return directMatch;
  }

  const missingFields = getMissingFields({
    parsedRecord: input.parsedRecord,
    reviewItem: null,
  });
  const confidence =
    asNumber(input.parsedRecord.confidence) ?? asNumber(input.parsedRecord.confidenceScore);
  const reviewNeeded = input.parsedRecord.reviewNeeded === true;
  const likelyNeedsReview =
    reviewNeeded || missingFields.length > 0 || (confidence !== null && confidence < 0.72);

  if (!likelyNeedsReview) {
    return null;
  }

  return (
    input.reviewItems.find((reviewItem) => !input.usedReviewItemIds.has(reviewItem.id)) ?? null
  );
}

function getInventorySummary(evidence: Record<string, unknown> | null) {
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

function getValuationSummary(evidence: Record<string, unknown> | null) {
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

function getSuggestedAction(input: {
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

function validationCheckMatchesCardIdentity(
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

function shouldValidationCheckBelongToCard(input: {
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

function shouldRetryEventBelongToCard(input: {
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

function buildRecordReviewCards(
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

function isActionableRunLevelValidationCheck(check: ValidationCheck) {
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

function getStatusClassName(status: string) {
  return `guided-validation-status guided-validation-status--${status.toLowerCase()}`;
}

function getRecordStatusClassName(status: RecordReviewCard["status"]) {
  return `guided-record-review-card__status guided-record-review-card__status--${status}`;
}

function RecordFieldGrid({ card }: { card: RecordReviewCard }) {
  const proposedRecord = getProposedRecord(card.reviewItem);

  const fields = [
    {
      label: "Brand",
      value: getFirstValue(card.parsedRecord, ["brand"]) ?? getFirstValue(proposedRecord, ["brand"]),
    },
    {
      label: "Product line",
      value:
        getFirstValue(card.parsedRecord, ["productLine", "model", "title"]) ??
        getFirstValue(proposedRecord, ["productLine", "model", "title"]),
    },
    {
      label: "Category",
      value:
        getFirstValue(card.parsedRecord, ["category"]) ??
        getFirstValue(proposedRecord, ["category"]),
    },
    {
      label: "Shaft flex",
      value:
        getFirstValue(card.parsedRecord, ["shaftFlex", "flex"]) ??
        getFirstValue(proposedRecord, ["shaftFlex", "flex"]),
    },
    {
      label: "Condition",
      value:
        getFirstValue(card.parsedRecord, ["conditionGrade"]) ??
        getFirstValue(proposedRecord, ["conditionGrade"]),
    },
    {
      label: "Trade-in value",
      value:
        getFirstValue(card.parsedRecord, ["tradeInValue", "demoValue", "value"]) ??
        getFirstValue(proposedRecord, ["tradeInValue", "demoValue", "value"]),
      currency: true,
    },
    {
      label: "Store",
      value:
        getFirstValue(card.parsedRecord, ["storeId", "store"]) ??
        getFirstValue(proposedRecord, ["storeId", "store"]),
    },
  ];

  return (
    <dl className="guided-record-field-grid">
      {fields.map((field) => (
        <div key={field.label}>
          <dt>{field.label}</dt>
          <dd>{formatDisplayValue(field.value, { currency: field.currency })}</dd>
        </div>
      ))}
    </dl>
  );
}

function RecordAttentionList({ card }: { card: RecordReviewCard }) {
  const warningChecks = card.validationChecks.filter(
    (check) => check.status === "WARNING" || check.status === "FAIL",
  );
  const unresolvedRetries = card.retryEvents.filter((event) => event.status === "UNRESOLVED");

  const attentionItems = [
    ...card.missingFields.map((field) => ({
      id: `missing-${field}`,
      label: `Confirm ${formatFieldLabel(field)}`,
      detail: "This value is missing or unclear in the normalized record.",
    })),
    ...card.reviewReasons.map((reason) => ({
      id: `reason-${reason}`,
      label: "Review reason",
      detail: reason,
    })),
    ...warningChecks.map((check) => ({
      id: `check-${check.id}`,
      label: check.label,
      detail: check.message,
    })),
    ...unresolvedRetries.map((event) => ({
      id: `retry-${event.id}`,
      label: event.reason,
      detail: event.message,
    })),
  ];

  const dedupedItems = attentionItems.filter(
    (item, index, items) =>
      items.findIndex((candidate) => candidate.label === item.label && candidate.detail === item.detail) ===
      index,
  );

  if (dedupedItems.length === 0) {
    return (
      <p className="guided-validation-empty-note">
        No record-level issues were found for this item.
      </p>
    );
  }

  return (
    <ul className="guided-record-attention-list">
      {dedupedItems.map((item) => (
        <li key={item.id}>
          <strong>{item.label}</strong>
          <span>{item.detail}</span>
        </li>
      ))}
    </ul>
  );
}

function getReviewItemStatusLabel(reviewItem: ReviewQueueItem | null) {
  if (!reviewItem) {
    return "No review item";
  }

  return formatStatusLabel(reviewItem.status);
}

function canResolveReviewItem(reviewItem: ReviewQueueItem | null) {
  return reviewItem?.status === "OPEN" || reviewItem?.status === "IN_REVIEW";
}

function buildCorrectionDraft(card: RecordReviewCard): ReviewCorrectionDraft {
  const proposedRecord = getProposedRecord(card.reviewItem);
  const brand =
    getFirstString(card.parsedRecord, ["brand"]) ??
    getFirstString(proposedRecord, ["brand"]) ??
    "";
  const productLine =
    getFirstString(card.parsedRecord, ["productLine", "model", "title"]) ??
    getFirstString(proposedRecord, ["productLine", "model", "title"]) ??
    "";
  const category =
    getFirstValue(card.parsedRecord, ["category"]) ??
    getFirstValue(proposedRecord, ["category"]);
  const shaftFlex =
    getFirstValue(card.parsedRecord, ["shaftFlex", "flex"]) ??
    getFirstValue(proposedRecord, ["shaftFlex", "flex"]);
  const conditionGrade =
    getFirstValue(card.parsedRecord, ["conditionGrade"]) ??
    getFirstValue(proposedRecord, ["conditionGrade"]);
  const demoValue =
    getFirstValue(card.parsedRecord, ["tradeInValue", "demoValue", "value"]) ??
    getFirstValue(proposedRecord, ["tradeInValue", "demoValue", "value"]);

  return {
    brand,
    productLine,
    category: normalizeCategoryValue(category),
    shaftFlex: normalizeShaftFlexValue(shaftFlex),
    conditionGrade:
      normalizeConditionGradeValue(conditionGrade) ||
      inferConditionGradeFromText(card.sourceEvidence) ||
      "8.0 Average",
    demoValue: demoValue === null || demoValue === undefined ? "" : String(demoValue),
    demoValuationNote: "",
    reviewerNotes: "Confirmed current run review item from the guided validation checkpoint.",
  };
}

function getCurrentValueForField(card: RecordReviewCard, fieldName: string) {
  const proposedRecord = getProposedRecord(card.reviewItem);

  if (fieldName === "brand") {
    return getFirstString(card.parsedRecord, ["brand"]) ?? getFirstString(proposedRecord, ["brand"]) ?? "";
  }

  if (fieldName === "productLine") {
    return (
      getFirstString(card.parsedRecord, ["productLine", "model", "title"]) ??
      getFirstString(proposedRecord, ["productLine", "model", "title"]) ??
      ""
    );
  }

  if (fieldName === "category") {
    return formatDisplayValue(
      getFirstValue(card.parsedRecord, ["category"]) ?? getFirstValue(proposedRecord, ["category"]),
    );
  }

  if (fieldName === "shaftFlex") {
    return formatDisplayValue(
      getFirstValue(card.parsedRecord, ["shaftFlex", "flex"]) ??
        getFirstValue(proposedRecord, ["shaftFlex", "flex"]),
    );
  }

  if (fieldName === "conditionGrade") {
    return formatDisplayValue(
      getFirstValue(card.parsedRecord, ["conditionGrade"]) ??
        getFirstValue(proposedRecord, ["conditionGrade"]),
    );
  }

  if (fieldName === "demoValue") {
    return formatDisplayValue(
      getFirstValue(card.parsedRecord, ["tradeInValue", "demoValue", "value"]) ??
        getFirstValue(proposedRecord, ["tradeInValue", "demoValue", "value"]),
    );
  }

  return "";
}

function getCorrectedValueForField(draft: ReviewCorrectionDraft, fieldName: string) {
  if (fieldName === "category") {
    return draft.category ? formatEnumLabel(draft.category) : "";
  }

  if (fieldName === "shaftFlex") {
    return draft.shaftFlex ? formatEnumLabel(draft.shaftFlex) : "";
  }

  if (fieldName === "conditionGrade") {
    return draft.conditionGrade;
  }

  if (fieldName === "demoValue") {
    return draft.demoValue;
  }

  return draft[fieldName as "brand" | "productLine"] ?? "";
}

function buildCorrectedRecord(draft: ReviewCorrectionDraft): StructuredReviewCorrectedRecord {
  const demoValue = draft.demoValue.trim().length > 0 ? Number(draft.demoValue) : null;

  return {
    ...(draft.brand.trim() ? { brand: draft.brand.trim() } : {}),
    ...(draft.productLine.trim() ? { productLine: draft.productLine.trim() } : {}),
    ...(draft.category ? { category: draft.category } : {}),
    ...(draft.shaftFlex ? { shaftFlex: draft.shaftFlex } : {}),
    ...(draft.conditionGrade ? { conditionGrade: draft.conditionGrade } : {}),
    ...(demoValue !== null && Number.isFinite(demoValue)
      ? { demoValue: Math.round(demoValue) }
      : {}),
    ...(draft.demoValuationNote.trim()
      ? { demoValuationNote: draft.demoValuationNote.trim() }
      : {}),
  };
}

function buildLearningEvents(
  card: RecordReviewCard,
  draft: ReviewCorrectionDraft,
): StructuredReviewLearningEventInput[] {
  const fieldNames = [
    "brand",
    "productLine",
    "category",
    "shaftFlex",
    "conditionGrade",
    "demoValue",
  ];
  const focusFieldNames = getCorrectionFocusFields(card).filter(isCorrectionFormFieldName);
  const events: StructuredReviewLearningEventInput[] = [];

  for (const fieldName of fieldNames) {
    const correctedValue = getCorrectedValueForField(draft, fieldName).trim();

    if (!correctedValue) {
      continue;
    }

    const proposedValue = getCurrentValueForField(card, fieldName);
    const changed =
      normalizeComparable(proposedValue) !== normalizeComparable(correctedValue);
    const wasMissing = card.missingFields.some(
      (field) => normalizeComparable(field) === normalizeComparable(fieldName),
    );
    const isFocusedReviewField =
      focusFieldNames.length === 0 ||
      focusFieldNames.includes(fieldName as CorrectionFormFieldName);
    const hasKnownCurrentValue =
      proposedValue.trim().length > 0 && proposedValue !== "—";

    if (!isFocusedReviewField && (!changed || !hasKnownCurrentValue)) {
      continue;
    }

    if (!changed && !(isFocusedReviewField && wasMissing)) {
      continue;
    }

    events.push({
      fieldName,
      rawTextMatch: card.sourceEvidence.slice(0, 240),
      proposedValue: proposedValue || undefined,
      correctedValue,
      evidenceText: card.sourceEvidence.slice(0, 240),
      confidenceImpact: wasMissing
        ? "Human review supplied a missing field."
        : "Human review corrected the normalized field.",
    });
  }

  return events;
}

function getCorrectionFieldFromSignal(value: string) {
  const normalized = normalizeComparable(value);

  if (normalized.includes("serial")) {
    return null;
  }

  if (normalized.includes("brand")) {
    return "brand";
  }

  if (
    normalized.includes("product") ||
    normalized.includes("model") ||
    normalized.includes("line")
  ) {
    return "productLine";
  }

  if (
    normalized.includes("category") ||
    normalized.includes("equipment") ||
    normalized.includes("clubtype")
  ) {
    return "category";
  }

  if (normalized.includes("shaft") || normalized.includes("flex")) {
    return "shaftFlex";
  }

  if (normalized.includes("condition")) {
    return "conditionGrade";
  }

  if (
    normalized.includes("tradein") ||
    normalized.includes("tradevalue") ||
    normalized.includes("value") ||
    normalized.includes("valuation")
  ) {
    return "demoValue";
  }

  if (normalized.includes("store")) {
    return "storeId";
  }

  return null;
}

function getCorrectionFieldLabel(fieldName: string) {
  const labels: Record<string, string> = {
    brand: "Brand",
    productLine: "Product line",
    category: "Category",
    shaftFlex: "Shaft flex",
    conditionGrade: "Condition grade",
    demoValue: "Trade-in value",
    storeId: "Store",
  };

  return labels[fieldName] ?? formatFieldLabel(fieldName);
}

function addSourceMissingFieldSignals(card: RecordReviewCard, fields: Set<string>) {
  const sourceText = card.sourceEvidence.toLowerCase();

  if (/missing\s+(?:trade\s*-?\s*in\s*)?value|missing\s+tradeinvalue|value\s+pending|trade\s*-?\s*in\s+value\s+(?:missing|unclear|pending)/i.test(sourceText)) {
    fields.add("demoValue");
  }

  if (/missing\s+condition|condition\s+(?:missing|unclear|pending)|conditionnotes/i.test(sourceText)) {
    fields.add("conditionGrade");
  }

  if (/missing\s+category|category\s+(?:missing|unclear|pending|could not be classified)/i.test(sourceText)) {
    fields.add("category");
  }

  if (/missing\s+(?:shaft\s*)?flex|shaft\s*flex\s+(?:missing|unclear|pending)/i.test(sourceText)) {
    fields.add("shaftFlex");
  }

  if (/missing\s+product|product\s+(?:line\s+)?(?:missing|unclear|pending)/i.test(sourceText)) {
    fields.add("productLine");
  }

  if (/missing\s+brand|brand\s+(?:missing|unclear|pending)/i.test(sourceText)) {
    fields.add("brand");
  }
}

function addBlankCorrectableFieldSignals(card: RecordReviewCard, fields: Set<string>) {
  const proposedRecord = getProposedRecord(card.reviewItem);

  const demoValue =
    getFirstValue(card.parsedRecord, ["tradeInValue", "demoValue", "value"]) ??
    getFirstValue(proposedRecord, ["tradeInValue", "demoValue", "value"]);
  const conditionGrade =
    getFirstValue(card.parsedRecord, ["conditionGrade"]) ??
    getFirstValue(proposedRecord, ["conditionGrade"]);
  const category =
    getFirstValue(card.parsedRecord, ["category"]) ??
    getFirstValue(proposedRecord, ["category"]);

  if ((demoValue === null || demoValue === undefined || demoValue === "") && fields.has("demoValue")) {
    fields.add("demoValue");
  }

  if ((conditionGrade === null || conditionGrade === undefined || conditionGrade === "") && fields.has("conditionGrade")) {
    fields.add("conditionGrade");
  }

  if ((category === null || category === undefined || category === "") && fields.has("category")) {
    fields.add("category");
  }
}

function getCorrectionFocusFields(card: RecordReviewCard) {
  const fields = new Set<string>();

  addSourceMissingFieldSignals(card, fields);

  for (const field of card.missingFields) {
    const correctionField = getCorrectionFieldFromSignal(field);

    if (correctionField) {
      fields.add(correctionField);
    }
  }

  for (const check of card.validationChecks) {
    if (check.status === "PASS") {
      continue;
    }

    const correctionField =
      getCorrectionFieldFromSignal(check.field ?? "") ??
      getCorrectionFieldFromSignal(check.label) ??
      getCorrectionFieldFromSignal(check.message);

    if (correctionField) {
      fields.add(correctionField);
    }
  }

  for (const event of card.retryEvents) {
    if (event.status === "RESOLVED") {
      continue;
    }

    const correctionField =
      getCorrectionFieldFromSignal(event.targetField ?? "") ??
      getCorrectionFieldFromSignal(event.reason) ??
      getCorrectionFieldFromSignal(event.message);

    if (correctionField) {
      fields.add(correctionField);
    }
  }

  for (const reason of card.reviewReasons) {
    const correctionField = getCorrectionFieldFromSignal(reason);

    if (correctionField) {
      fields.add(correctionField);
    }
  }

  addBlankCorrectableFieldSignals(card, fields);

  return Array.from(fields);
}

function getRecordCardSummary(card: RecordReviewCard) {
  const focusFields = getCorrectionFocusFields(card);

  if (focusFields.length > 0) {
    return `Needs attention: ${focusFields.map(getCorrectionFieldLabel).join(", ")}`;
  }

  if (card.reviewReasons.length > 0) {
    return card.reviewReasons[0]!;
  }

  if (card.validationChecks.length > 0) {
    const warningCount = card.validationChecks.filter(
      (check) => check.status === "WARNING" || check.status === "FAIL",
    ).length;

    return warningCount > 0
      ? `${warningCount} validation warning(s)`
      : "Validation checks available";
  }

  return card.suggestedAction;
}

function CorrectionFocusCallout({ card }: { card: RecordReviewCard }) {
  const focusFields = getCorrectionFocusFields(card);

  if (focusFields.length === 0) {
    return (
      <div className="guided-correction-focus">
        <strong>Fields needing attention</strong>
        <p>Review the source evidence and confirm the corrected record values.</p>
      </div>
    );
  }

  return (
    <div className="guided-correction-focus">
      <strong>Fields needing attention</strong>
      <ul>
        {focusFields.map((field) => (
          <li key={field}>{getCorrectionFieldLabel(field)}</li>
        ))}
      </ul>
    </div>
  );
}

const CORRECTION_FORM_FIELD_NAMES = [
  "brand",
  "productLine",
  "category",
  "shaftFlex",
  "conditionGrade",
  "demoValue",
] as const;

type CorrectionFormFieldName = (typeof CORRECTION_FORM_FIELD_NAMES)[number];

function isCorrectionFormFieldName(value: string): value is CorrectionFormFieldName {
  return CORRECTION_FORM_FIELD_NAMES.includes(value as CorrectionFormFieldName);
}

function getVisibleCorrectionFields(card: RecordReviewCard): CorrectionFormFieldName[] {
  const focusFields = getCorrectionFocusFields(card).filter(isCorrectionFormFieldName);

  if (focusFields.length > 0) {
    return focusFields;
  }

  return ["brand", "productLine", "category", "shaftFlex", "conditionGrade", "demoValue"];
}

function getSecondaryCorrectionFields(
  visibleFields: CorrectionFormFieldName[],
): CorrectionFormFieldName[] {
  return CORRECTION_FORM_FIELD_NAMES.filter(
    (field) => !visibleFields.includes(field),
  );
}

function RecordEvidenceDetails({ card }: { card: RecordReviewCard }) {
  return (
    <details className="guided-record-supporting-details">
      <summary>Source and system evidence</summary>

      <div className="guided-record-evidence-grid">
        <article className="guided-record-evidence-grid__source">
          <strong>Source evidence</strong>
          <p>{card.sourceEvidence}</p>
        </article>
        <article>
          <strong>Inventory evidence</strong>
          <p>{getInventorySummary(card.inventoryEvidence)}</p>
        </article>
        <article>
          <strong>Valuation evidence</strong>
          <p>{getValuationSummary(card.valuationEvidence)}</p>
        </article>
      </div>
    </details>
  );
}

function RecordReviewSignalDetails({ card }: { card: RecordReviewCard }) {
  return (
    <details className="guided-record-supporting-details">
      <summary>Review signals and suggested action</summary>

      <div className="guided-record-review-card__body-grid">
        <section>
          <h5>What needs attention</h5>
          <RecordAttentionList card={card} />
        </section>

        <section>
          <h5>Suggested next action</h5>
          <p>{card.suggestedAction}</p>
        </section>
      </div>
    </details>
  );
}

function RecordValidationDetails({ card }: { card: RecordReviewCard }) {
  return (
    <details className="guided-record-review-details">
      <summary>Detailed validation and retry evidence</summary>

      {card.validationChecks.length > 0 ? (
        <ol className="guided-validation-evidence-list">
          {card.validationChecks.map((check) => (
            <li key={check.id}>
              <span className={getStatusClassName(check.status)}>{check.status}</span>
              <div>
                <strong>{check.label}</strong>
                <p>{check.message}</p>
                <small>
                  Severity {check.severity.toLowerCase()}
                  {check.field ? ` · field ${check.field}` : ""}
                  {check.reviewRequired ? " · review required" : ""}
                </small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="guided-validation-empty-note">
          No detailed validation checks were matched directly to this record.
        </p>
      )}

      {card.retryEvents.length > 0 ? (
        <ol className="guided-validation-evidence-list">
          {card.retryEvents.map((event) => (
            <li key={event.id}>
              <span className={getStatusClassName(event.status)}>{event.status}</span>
              <div>
                <strong>{event.reason}</strong>
                <p>{event.message}</p>
                <small>
                  {event.targetField ? `Target field ${event.targetField}` : "Workflow-level retry"}
                  {" · "}
                  {event.policy}
                </small>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </details>
  );
}

function RecordCorrectionPanel({
  activeReviewQueueItemId,
  card,
  draft,
  isEditing,
  onDraftChange,
  onStartEditing,
  onCancelEditing,
  onSubmit,
}: {
  activeReviewQueueItemId: string | null;
  card: RecordReviewCard;
  draft: ReviewCorrectionDraft;
  isEditing: boolean;
  onDraftChange: (draft: ReviewCorrectionDraft) => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSubmit: () => void;
}) {
  if (!card.reviewItem) {
    return (
      <div className="guided-record-correction-panel guided-record-correction-panel--muted">
        <strong>No review queue item</strong>
        <p>This record has no persisted review item to resolve from this checkpoint.</p>
      </div>
    );
  }

  if (!canResolveReviewItem(card.reviewItem)) {
    return (
      <div className="guided-record-correction-panel guided-record-correction-panel--resolved">
        <strong>Review status: {getReviewItemStatusLabel(card.reviewItem)}</strong>
        <p>This review item has already been handled.</p>
      </div>
    );
  }

  const visibleFields = getVisibleCorrectionFields(card);
  const secondaryFields = getSecondaryCorrectionFields(visibleFields);

  if (!isEditing) {
    return (
      <div className="guided-record-correction-panel">
        <div>
          <strong>Ready for human correction</strong>
          <p>Focus on {visibleFields.map(getCorrectionFieldLabel).join(", ")}.</p>
        </div>
        <CorrectionFocusCallout card={card} />
        <button className="guided-step-primary-action" onClick={onStartEditing} type="button">
          Review and correct
        </button>
      </div>
    );
  }

  const isSaving = activeReviewQueueItemId === card.reviewItem.id;

  return (
    <div className="guided-record-correction-form">
      <div className="guided-record-correction-form__header">
        <div>
          <strong>Resolve current run review item</strong>
          <p>
            These controlled fields are saved through the review queue correction flow.
          </p>
        </div>
        <button disabled={isSaving} onClick={onCancelEditing} type="button">
          Cancel
        </button>
      </div>

      <CorrectionFocusCallout card={card} />

      <div className="guided-record-correction-grid guided-record-correction-grid--focused">
        {visibleFields.includes("brand") ? (
          <label>
            Brand
            <input
              onChange={(event) => onDraftChange({ ...draft, brand: event.target.value })}
              value={draft.brand}
            />
          </label>
        ) : null}

        {visibleFields.includes("productLine") ? (
          <label>
            Product line
            <input
              onChange={(event) =>
                onDraftChange({ ...draft, productLine: event.target.value })
              }
              value={draft.productLine}
            />
          </label>
        ) : null}

        {visibleFields.includes("category") ? (
          <label>
            Category
            <select
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  category: event.target.value as ReviewCorrectionCategory | "",
                })
              }
              value={draft.category}
            >
              <option value="">Select category</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {visibleFields.includes("shaftFlex") ? (
          <label>
            Shaft flex
            <select
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  shaftFlex: event.target.value as ReviewCorrectionShaftFlex | "",
                })
              }
              value={draft.shaftFlex}
            >
              <option value="">Select shaft flex</option>
              {SHAFT_FLEX_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {visibleFields.includes("conditionGrade") ? (
          <label>
            Condition grade
            <select
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  conditionGrade: event.target.value as ReviewConditionGrade | "",
                })
              }
              value={draft.conditionGrade}
            >
              <option value="">Select condition</option>
              {CONDITION_GRADE_OPTIONS.map((conditionGrade) => (
                <option key={conditionGrade} value={conditionGrade}>
                  {conditionGrade}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {visibleFields.includes("demoValue") ? (
          <label>
            Trade-in value
            <input
              min="0"
              onChange={(event) => onDraftChange({ ...draft, demoValue: event.target.value })}
              type="number"
              value={draft.demoValue}
            />
          </label>
        ) : null}
      </div>

      {secondaryFields.length > 0 ? (
        <details className="guided-record-secondary-fields">
          <summary>Other normalized fields</summary>
          <dl>
            {secondaryFields.map((field) => (
              <div key={field}>
                <dt>{getCorrectionFieldLabel(field)}</dt>
                <dd>{getCorrectedValueForField(draft, field) || "—"}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}

      <label>
        Valuation note
        <input
          onChange={(event) =>
            onDraftChange({ ...draft, demoValuationNote: event.target.value })
          }
          placeholder="Optional note about the corrected value."
          value={draft.demoValuationNote}
        />
      </label>

      <label>
        Reviewer notes
        <textarea
          onChange={(event) =>
            onDraftChange({ ...draft, reviewerNotes: event.target.value })
          }
          rows={3}
          value={draft.reviewerNotes}
        />
      </label>

      <div className="guided-record-correction-form__actions">
        <button
          className="guided-step-primary-action"
          disabled={isSaving}
          onClick={onSubmit}
          type="button"
        >
          {isSaving ? "Saving correction…" : "Save correction and resolve"}
        </button>
      </div>
    </div>
  );
}

function hasUsableSourceEvidence(value: string) {
  const trimmedValue = value.trim();

  return (
    trimmedValue.length > 0 &&
    trimmedValue !== "No source evidence captured for this record."
  );
}

function PassedRecordReviewSummary({ card }: { card: RecordReviewCard }) {
  const inventorySummary = getInventorySummary(card.inventoryEvidence);
  const valuationSummary = getValuationSummary(card.valuationEvidence);
  const hasSourceEvidence = hasUsableSourceEvidence(card.sourceEvidence);

  return (
    <div className="guided-passed-record-summary">
      <div className="guided-passed-record-summary__status">
        <strong>Record passed review gates.</strong>
        <p>
          This record has no active review item. The available system evidence is
          summarized below.
        </p>
      </div>

      <div className="guided-passed-record-evidence-grid">
        {hasSourceEvidence ? (
          <article className="guided-passed-record-evidence-grid__source">
            <strong>Source evidence</strong>
            <p>{card.sourceEvidence}</p>
          </article>
        ) : null}

        <article>
          <strong>Inventory evidence</strong>
          <p>{inventorySummary}</p>
        </article>

        <article>
          <strong>Valuation evidence</strong>
          <p>{valuationSummary}</p>
        </article>
      </div>
    </div>
  );
}

function RecordReviewCardView({
  activeReviewQueueItemId,
  card,
  correctionDraft,
  isEditing,
  onCancelEditing,
  onDraftChange,
  onStartEditing,
  onSubmitCorrection,
}: {
  activeReviewQueueItemId: string | null;
  card: RecordReviewCard;
  correctionDraft: ReviewCorrectionDraft;
  isEditing: boolean;
  onCancelEditing: () => void;
  onDraftChange: (draft: ReviewCorrectionDraft) => void;
  onStartEditing: () => void;
  onSubmitCorrection: () => void;
}) {
  return (
    <details className="guided-record-review-card" open={isEditing}>
      <summary className="guided-record-review-card__header">
        <div>
          <span className="model-route-card__eyebrow">Record {card.index + 1}</span>
          <h4>{card.label}</h4>
          <p className="guided-record-review-card__summary-line">
            {getRecordCardSummary(card)}
          </p>
        </div>
        <span className={getRecordStatusClassName(card.status)}>{card.statusLabel}</span>
      </summary>

      <div className="guided-record-review-card__content">
        {card.status === "ready" ? (
          <PassedRecordReviewSummary card={card} />
        ) : (
          <>
            <RecordCorrectionPanel
              activeReviewQueueItemId={activeReviewQueueItemId}
              card={card}
              draft={correctionDraft}
              isEditing={isEditing}
              onCancelEditing={onCancelEditing}
              onDraftChange={onDraftChange}
              onStartEditing={onStartEditing}
              onSubmit={onSubmitCorrection}
            />

            <RecordEvidenceDetails card={card} />
            <RecordReviewSignalDetails card={card} />
            <RecordValidationDetails card={card} />
          </>
        )}
      </div>
    </details>
  );
}

export function GuidedValidationReviewStep({
  actionError,
  actionSuccess,
  activeReviewQueueItemId,
  currentRunReviewQueueItems,
  onContinue,
  onOpenReviewQueue,
  onReviewQueueNotesChange,
  onResolveReviewQueueItemWithCorrections,
  result,
  reviewQueueNotesById,
}: GuidedValidationReviewStepProps) {
  const [editingReviewQueueItemId, setEditingReviewQueueItemId] = useState<string | null>(null);
  const [correctionDraftsByReviewQueueItemId, setCorrectionDraftsByReviewQueueItemId] =
    useState<Record<string, ReviewCorrectionDraft>>({});
  const validationChecks = result?.validationChecks ?? [];
  const retryEvents = result?.retryEvents ?? [];
  const qualitySummary = result?.workflowQualitySummary ?? null;

  const warningChecks = validationChecks.filter((check) => check.status === "WARNING");
  const failedChecks = validationChecks.filter((check) => check.status === "FAIL");
  const reviewRequiredChecks = validationChecks.filter((check) => check.reviewRequired);
  const unresolvedRetries = retryEvents.filter((event) => event.status === "UNRESOLVED");
  const recordReviewData = result
    ? buildRecordReviewCards(result, currentRunReviewQueueItems)
    : null;
  const recordCards = recordReviewData?.cards ?? [];
  const recordsStillNeedingAttention = recordCards.filter(
    (card) => card.status === "needs-review",
  );
  const recordsResolvedByReview = recordCards.filter(
    (card) => card.status === "resolved",
  );
  const recordsAutoPassed = recordCards.filter((card) => card.status === "ready");
  const activeRecordCards = recordsStillNeedingAttention;
  const reviewedRecordCards = recordsResolvedByReview;
  const passedGateRecordCards = recordsAutoPassed;
  const visibleReviewRecordCards = [...activeRecordCards, ...reviewedRecordCards];
  const shouldOpenPassedGateRecords = activeRecordCards.length === 0;
  const unmappedActionableValidationChecks =
    recordReviewData?.unassignedValidationChecks.filter(
      isActionableRunLevelValidationCheck,
    ) ?? [];
  const unmappedActionableRetryEvents =
    recordReviewData?.unassignedRetryEvents.filter((event) => event.status === "UNRESOLVED") ?? [];
  const unassignedRunLevelSignalCount =
    unmappedActionableValidationChecks.length + unmappedActionableRetryEvents.length;
  const reviewItemsCreatedCount = result?.reviewQueueItemsCreated.length ?? 0;

  function getDraftForCard(card: RecordReviewCard) {
    if (!card.reviewItem) {
      return buildCorrectionDraft(card);
    }

    return (
      correctionDraftsByReviewQueueItemId[card.reviewItem.id] ??
      buildCorrectionDraft(card)
    );
  }

  function setDraftForCard(card: RecordReviewCard, draft: ReviewCorrectionDraft) {
    if (!card.reviewItem) {
      return;
    }

    setCorrectionDraftsByReviewQueueItemId((current) => ({
      ...current,
      [card.reviewItem!.id]: draft,
    }));

    onReviewQueueNotesChange(card.reviewItem.id, draft.reviewerNotes);
  }

  function startEditingCard(card: RecordReviewCard) {
    if (!card.reviewItem) {
      return;
    }

    setCorrectionDraftsByReviewQueueItemId((current) => ({
      ...current,
      [card.reviewItem!.id]:
        current[card.reviewItem!.id] ?? {
          ...buildCorrectionDraft(card),
          reviewerNotes:
            reviewQueueNotesById[card.reviewItem!.id] ??
            buildCorrectionDraft(card).reviewerNotes,
        },
    }));
    setEditingReviewQueueItemId(card.reviewItem.id);
  }

  function submitCorrectionForCard(card: RecordReviewCard) {
    const reviewItem = card.reviewItem;

    if (!result || !reviewItem) {
      return;
    }

    const draft = getDraftForCard(card);
    const correctedRecord = buildCorrectedRecord(draft);
    const learningEvents = buildLearningEvents(card, draft);

    onResolveReviewQueueItemWithCorrections({
      reviewQueueItemId: reviewItem.id,
      request: {
        reviewerNotes: draft.reviewerNotes.trim() || undefined,
        correctedRecord,
        learningEvents,
      },
      workflowRunId: reviewItem.workflowRunId ?? result.persisted.workflowRunId,
      intakeBatchId: result.persisted.intakeBatchId,
    });

    setEditingReviewQueueItemId(null);
  }

  function renderRecordReviewCard(card: RecordReviewCard) {
    return (
      <RecordReviewCardView
        activeReviewQueueItemId={activeReviewQueueItemId}
        card={card}
        correctionDraft={getDraftForCard(card)}
        isEditing={
          card.reviewItem
            ? editingReviewQueueItemId === card.reviewItem.id
            : false
        }
        key={card.id}
        onCancelEditing={() => setEditingReviewQueueItemId(null)}
        onDraftChange={(draft) => setDraftForCard(card, draft)}
        onStartEditing={() => startEditingCard(card)}
        onSubmitCorrection={() => submitCorrectionForCard(card)}
      />
    );
  }

  return (
    <article className="guided-workflow-card guided-workflow-card--validation-review">
      <section className="guided-step-orientation">
        <span className="model-route-card__eyebrow">
          Step 4 · Validation and Human Review
        </span>
        <h3>Which records need attention before the final report?</h3>
        <p>
          After guarded execution, the workflow should show exactly what passed,
          what still needs review, and which records need a human decision before
          downstream use.
        </p>

        <div className="guided-step-mini-list" aria-label="Validation and review explanation">
          <article>
            <strong>Input</strong>
            <p>Parsed records, source evidence, tool results, validation checks, retry events, and review items.</p>
          </article>

          <article>
            <strong>Action</strong>
            <p>Group the evidence by record so the reviewer can see the work item, not just the trace.</p>
          </article>

          <article>
            <strong>Output</strong>
            <p>A run-scoped review checkpoint that explains what can move forward and what needs attention.</p>
          </article>
        </div>
      </section>

      <section className="guided-step-workspace">
        <div className="guided-step-workspace__header">
          <div>
            <span className="model-route-card__eyebrow">Do the work</span>
            <h4>Review the current run by record</h4>
            <p>
              This checkpoint separates records that passed from records that need
              confirmation, correction, or review before the final run report.
            </p>
          </div>
        </div>

        {result && qualitySummary && recordReviewData ? (
          <>
            <div className="guided-validation-summary-grid">
              <article>
                <strong>{formatStatusLabel(qualitySummary.status)}</strong>
                <span>quality status</span>
              </article>
              <article>
                <strong>{recordsStillNeedingAttention.length}</strong>
                <span>still needs attention</span>
              </article>
              <article>
                <strong>{recordsResolvedByReview.length}</strong>
                <span>resolved by review</span>
              </article>
              <article>
                <strong>{reviewItemsCreatedCount}</strong>
                <span>review items created</span>
              </article>
            </div>

            {actionSuccess ? (
              <p className="form-message form-message--success">{actionSuccess}</p>
            ) : null}

            {actionError ? (
              <p className="form-message form-message--error">{actionError}</p>
            ) : null}

            <section className="guided-review-checkpoint">
              <div>
                <span className="model-route-card__eyebrow">Review checkpoint</span>
                <h4>
                  {recordsStillNeedingAttention.length === 0
                    ? "All current review work has been handled"
                    : `${recordsStillNeedingAttention.length} record(s) still need review before final reporting`}
                </h4>
                <p>
                  {recordsStillNeedingAttention.length === 0
                    ? "Human review has resolved the current run's review items. The original validation trace remains available for audit context."
                    : `Workflow completed with ${reviewItemsCreatedCount} review item(s). ${recordsResolvedByReview.length} have been resolved and ${recordsStillNeedingAttention.length} still need attention.`}
                </p>
              </div>

              <dl className="guided-review-checkpoint__facts">
                <div>
                  <dt>Still needs attention</dt>
                  <dd>{recordsStillNeedingAttention.length}</dd>
                </div>
                <div>
                  <dt>Resolved by review</dt>
                  <dd>{recordsResolvedByReview.length}</dd>
                </div>
                <div>
                  <dt>Auto-passed records</dt>
                  <dd>{recordsAutoPassed.length}</dd>
                </div>
                <div>
                  <dt>Review items created</dt>
                  <dd>{reviewItemsCreatedCount}</dd>
                </div>
              </dl>

              <div className="guided-original-validation-trace">
                <span className="model-route-card__eyebrow">Original validation trace</span>
                <dl className="guided-review-checkpoint__facts">
                  <div>
                    <dt>Passed checks</dt>
                    <dd>{qualitySummary.validationPassed}</dd>
                  </div>
                  <div>
                    <dt>Warnings</dt>
                    <dd>{qualitySummary.validationWarnings}</dd>
                  </div>
                  <div>
                    <dt>Review-required checks</dt>
                    <dd>{reviewRequiredChecks.length}</dd>
                  </div>
                  <div>
                    <dt>Unresolved retries</dt>
                    <dd>{unresolvedRetries.length}</dd>
                  </div>
                </dl>

                <small>Evidence coverage: {qualitySummary.evidenceCoverage}</small>
              </div>
            </section>

            <section className="guided-validation-section">
              <div className="guided-validation-section__header">
                <div>
                  <h4>Current run review records</h4>
                  <p>
                    Each card shows the normalized record, current review state, source
                    evidence, warning signals, retry outcome, and suggested next action.
                  </p>
                </div>
                <span>{recordsStillNeedingAttention.length} active</span>
              </div>

              <div className="guided-record-review-list">
                {activeRecordCards.length > 0 ? (
                  <div className="guided-record-review-group-label">
                    <span>Needs review</span>
                    <strong>{activeRecordCards.length} active</strong>
                  </div>
                ) : null}

                {visibleReviewRecordCards.map(renderRecordReviewCard)}
                {passedGateRecordCards.length > 0 ? (
                  <section className="guided-passed-gates-section">
                    <div className="guided-passed-gates-section__header">
                      <span>Passed gates</span>
                    </div>

                    <details
                      className="guided-passed-gates-records"
                      open={shouldOpenPassedGateRecords}
                    >
                      <summary>
                        <div>
                          <strong>
                            {passedGateRecordCards.length} record
                            {passedGateRecordCards.length === 1 ? "" : "s"} passed review gates
                          </strong>
                        </div>

                      </summary>

                      <div className="guided-record-review-list guided-record-review-list--passed-gates">
                        {passedGateRecordCards.map(renderRecordReviewCard)}
                      </div>
                    </details>
                  </section>
                ) : null}
              </div>
            </section>

            <section className="guided-run-audit-section">
              <div className="guided-run-audit-section__header">
                <span>Run-level audit</span>
              </div>

              <details className="guided-run-audit-dropdown">
                <summary>
                  <div>
                    <strong>
                      {unassignedRunLevelSignalCount === 0
                        ? "All actionable signals grouped into review cards"
                        : `${unassignedRunLevelSignalCount} unmapped actionable signal${unassignedRunLevelSignalCount === 1 ? "" : "s"}`}
                    </strong>
                    <p>
                      Checks and retries are shown on record cards when they can be tied
                      to one club. This audit row only reports actionable workflow-level
                      signals that could not be mapped to a single record.
                    </p>
                  </div>
                </summary>

                <div className="guided-run-validation-detail__body guided-run-validation-detail__body--audit">
                  <div className="guided-run-audit-summary">
                    <article>
                      <strong>{unmappedActionableValidationChecks.length}</strong>
                      <span>unmapped warnings or failures</span>
                    </article>
                    <article>
                      <strong>{unmappedActionableRetryEvents.length}</strong>
                      <span>unmapped unresolved retries</span>
                    </article>
                  </div>

                  <p className="guided-validation-empty-note">
                    {unassignedRunLevelSignalCount === 0
                      ? "All actionable validation and retry signals were grouped into the record cards above."
                      : "Review the unmapped warnings or failures below. Passing checks and review-item summaries are already represented by the record cards above."}
                  </p>

                  {unmappedActionableValidationChecks.length > 0 ? (
                    <div className="guided-run-audit-signal-list">
                      <h5>Unmapped warnings or failures</h5>
                      <ol className="guided-validation-evidence-list guided-run-audit-signal-list__items">
                        {unmappedActionableValidationChecks.map((check) => (
                          <li key={check.id}>
                            <span className={getStatusClassName(check.status)}>{check.status}</span>
                            <div>
                              <strong>{check.label}</strong>
                              <p>{check.message}</p>
                              <small>
                                Severity {check.severity.toLowerCase()}
                                {check.field ? ` · field ${formatFieldLabel(check.field)}` : ""}
                                {check.reviewRequired ? " · review required" : ""}
                              </small>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {unmappedActionableRetryEvents.length > 0 ? (
                    <div className="guided-run-audit-signal-list">
                      <h5>Unmapped unresolved retries</h5>
                      <ol className="guided-validation-evidence-list guided-run-audit-signal-list__items">
                        {unmappedActionableRetryEvents.map((event) => (
                          <li key={event.id}>
                            <span className={getStatusClassName(event.status)}>{event.status}</span>
                            <div>
                              <strong>{event.reason}</strong>
                              <p>{event.message}</p>
                              <small>
                                {event.targetField
                                  ? `Target field ${formatFieldLabel(event.targetField)}`
                                  : "Workflow-level retry"}
                                {" · "}
                                {event.policy}
                              </small>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              </details>
            </section>

            <section className="guided-validation-section">
              <div className="guided-validation-section__header">
                <div>
                  <h4>Current review handoff</h4>
                  <p>
                    The record cards make the review work visible before final reporting. Records that require human approval can be opened in the review queue and resolved through the controlled correction flow.
                  </p>
                </div>
                <span>
                  {recordsStillNeedingAttention.length} open ·{" "}
                  {recordsResolvedByReview.length} resolved
                </span>
              </div>

              <div className="guided-review-action-row">
                <button
                  className="guided-step-primary-action"
                  onClick={onContinue}
                  type="button"
                >
                  Continue to Final Run Report
                </button>

                <button
                  className="guided-review-secondary-action"
                  onClick={onOpenReviewQueue}
                  type="button"
                >
                  Open Review Queue
                </button>
              </div>
            </section>
          </>
        ) : (
          <p>Run Step 3 first so this step has workflow evidence to explain.</p>
        )}
      </section>
    </article>
  );
}
