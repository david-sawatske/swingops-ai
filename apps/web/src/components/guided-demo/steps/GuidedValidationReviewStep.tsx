import type { ExecuteEndToEndAgenticTradeInDemoResponse } from "../../../types/workflow";

type GuidedValidationReviewStepProps = {
  onContinue: () => void;
  onOpenReviewQueue: () => void;
  result: ExecuteEndToEndAgenticTradeInDemoResponse | null;
};

type DemoResult = NonNullable<GuidedValidationReviewStepProps["result"]>;
type ParsedItem = DemoResult["parsedItems"][number];
type ValidationCheck = DemoResult["validationChecks"][number];
type RetryEvent = DemoResult["retryEvents"][number];
type ReviewOutcome = DemoResult["reviewOutcomes"][number];
type ReviewQueueItem = DemoResult["reviewQueueItemsCreated"][number];

type RecordReviewCard = {
  id: string;
  index: number;
  label: string;
  status: "ready" | "needs-review";
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

function shouldValidationCheckBelongToCard(input: {
  check: ValidationCheck;
  card: Pick<RecordReviewCard, "index" | "missingFields" | "reviewItem">;
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

function buildRecordReviewCards(result: DemoResult) {
  const reviewItems = result.reviewQueueItemsCreated;
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
      status: reviewItem || missingFields.length > 0 || reviewReasons.length > 0
        ? "needs-review"
        : "ready",
      statusLabel: reviewItem || missingFields.length > 0 || reviewReasons.length > 0
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
      status: "needs-review",
      statusLabel: "Needs review",
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

    card.suggestedAction = getSuggestedAction({
      missingFields: card.missingFields,
      reviewReasons: card.reviewReasons,
      retryEvents: card.retryEvents,
      reviewOutcome: card.reviewOutcome,
      reviewItem: card.reviewItem,
    });
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
    (check) => check.status === "WARNING" || check.status === "FAIL" || check.reviewRequired,
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

function RecordReviewCardView({ card }: { card: RecordReviewCard }) {
  return (
    <article className="guided-record-review-card">
      <div className="guided-record-review-card__header">
        <div>
          <span className="model-route-card__eyebrow">Record {card.index + 1}</span>
          <h4>{card.label}</h4>
        </div>
        <span className={getRecordStatusClassName(card.status)}>{card.statusLabel}</span>
      </div>

      <RecordFieldGrid card={card} />

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

      <div className="guided-record-evidence-grid">
        <article>
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

      <RecordValidationDetails card={card} />
    </article>
  );
}

export function GuidedValidationReviewStep({
  onContinue,
  onOpenReviewQueue,
  result,
}: GuidedValidationReviewStepProps) {
  const validationChecks = result?.validationChecks ?? [];
  const retryEvents = result?.retryEvents ?? [];
  const qualitySummary = result?.workflowQualitySummary ?? null;

  const warningChecks = validationChecks.filter((check) => check.status === "WARNING");
  const failedChecks = validationChecks.filter((check) => check.status === "FAIL");
  const reviewRequiredChecks = validationChecks.filter((check) => check.reviewRequired);
  const unresolvedRetries = retryEvents.filter((event) => event.status === "UNRESOLVED");
  const recordReviewData = result ? buildRecordReviewCards(result) : null;
  const recordCards = recordReviewData?.cards ?? [];
  const recordsNeedingAttention = recordCards.filter((card) => card.status === "needs-review");
  const recordsPassed = recordCards.length - recordsNeedingAttention.length;
  const fixableHereCount = result?.reviewQueueItemsCreated.length ?? 0;

  return (
    <article className="guided-workflow-card guided-workflow-card--validation-review">
      <section className="guided-step-orientation">
        <span className="model-route-card__eyebrow">
          Step 5 · Validation and Review
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

        <details className="guided-workflow-details guided-workflow-details--compact">
          <summary>Why organize review by record?</summary>
          <p className="guided-workflow-details__intro">
            Validation checks, retries, and tool evidence are useful only when the reviewer
            can connect them to the specific club record that needs confirmation.
          </p>
        </details>
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
                <strong>{recordsPassed}</strong>
                <span>records passed</span>
              </article>
              <article>
                <strong>{recordsNeedingAttention.length}</strong>
                <span>need attention</span>
              </article>
              <article>
                <strong>{fixableHereCount}</strong>
                <span>review items</span>
              </article>
            </div>

            <section className="guided-review-checkpoint">
              <div>
                <span className="model-route-card__eyebrow">Review checkpoint</span>
                <h4>
                  {recordsNeedingAttention.length === 0
                    ? "All records passed the current gates"
                    : `${recordsNeedingAttention.length} record(s) need review before final reporting`}
                </h4>
                <p>{qualitySummary.summary}</p>
              </div>

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
            </section>

            <section className="guided-validation-section">
              <div className="guided-validation-section__header">
                <div>
                  <h4>Records needing attention</h4>
                  <p>
                    Each card shows the normalized record, source evidence, warning signals,
                    retry outcome, and suggested next action.
                  </p>
                </div>
                <span>{recordsNeedingAttention.length} active</span>
              </div>

              <div className="guided-record-review-list">
                {(recordsNeedingAttention.length > 0 ? recordsNeedingAttention : recordCards).map(
                  (card) => (
                    <RecordReviewCardView card={card} key={card.id} />
                  ),
                )}
              </div>
            </section>

            <details className="guided-validation-section guided-run-validation-detail">
              <summary>
                <div>
                  <h4>Run-level validation detail</h4>
                  <p>
                    Open this for workflow-level checks that did not map cleanly to one
                    record card.
                  </p>
                </div>
                <span>{warningChecks.length + failedChecks.length} warnings or failures</span>
              </summary>

              <div className="guided-run-validation-detail__body">
                {recordReviewData.unassignedValidationChecks.length > 0 ||
                recordReviewData.unassignedRetryEvents.length > 0 ? (
                  <>
                    {recordReviewData.unassignedValidationChecks.length > 0 ? (
                      <ol className="guided-validation-evidence-list">
                        {recordReviewData.unassignedValidationChecks.map((check) => (
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
                    ) : null}

                    {recordReviewData.unassignedRetryEvents.length > 0 ? (
                      <ol className="guided-validation-evidence-list">
                        {recordReviewData.unassignedRetryEvents.map((event) => (
                          <li key={event.id}>
                            <span className={getStatusClassName(event.status)}>
                              {event.status}
                            </span>
                            <div>
                              <strong>{event.reason}</strong>
                              <p>{event.message}</p>
                              <small>
                                {event.targetField
                                  ? `Target field ${event.targetField}`
                                  : "Workflow-level retry"}
                                {" · "}
                                {event.policy}
                              </small>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </>
                ) : (
                  <p className="guided-validation-empty-note">
                    All validation and retry signals were grouped into record cards.
                  </p>
                )}
              </div>
            </details>

            <section className="guided-validation-section">
              <div className="guided-validation-section__header">
                <div>
                  <h4>Current review handoff</h4>
                  <p>
                    The record cards make the review work visible before final reporting. Records that require human approval can be opened in the review queue and resolved through the controlled correction flow.
                  </p>
                </div>
                <span>{result.reviewQueueItemsCreated.length} created</span>
              </div>

              <div className="guided-review-action-row">
                <button onClick={onOpenReviewQueue} type="button">
                  Open Review Queue
                </button>

                <button
                  className="guided-step-primary-action"
                  onClick={onContinue}
                  type="button"
                >
                  Continue to Step 6
                </button>
              </div>
            </section>
          </>
        ) : (
          <p>Run Step 4 first so this step has workflow evidence to explain.</p>
        )}
      </section>
    </article>
  );
}
