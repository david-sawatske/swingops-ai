import type {
  ReviewConditionGrade,
  ReviewCorrectionCategory,
  ReviewCorrectionShaftFlex,
  StructuredReviewCorrectedRecord,
  StructuredReviewLearningEventInput,
} from "../../../../types/workflow";
import {
  CATEGORY_OPTIONS,
  CONDITION_GRADE_OPTIONS,
  SHAFT_FLEX_OPTIONS,
} from "./validationReviewOptions";
import type {
  RecordReviewCard,
  ReviewCorrectionDraft,
  ReviewQueueItem,
} from "./validationReviewTypes";
import {
  formatDisplayValue,
  formatEnumLabel,
  formatFieldLabel,
  formatStatusLabel,
  getFirstString,
  getFirstValue,
  getParserEvidenceForField,
  getInventorySummary,
  getProposedRecord,
  getRecordStatusClassName,
  getStatusClassName,
  getValuationSummary,
  normalizeCategoryValue,
  normalizeComparable,
  normalizeConditionGradeValue,
  normalizeShaftFlexValue,
} from "./validationReviewUtils";

function RecordFieldGrid({ card }: { card: RecordReviewCard }) {
  const proposedRecord = getProposedRecord(card.reviewItem);

  const fields = [
    {
      label: "Brand",
      value: getFirstValue(card.parsedRecord, ["brand"]) ?? getFirstValue(proposedRecord, ["brand"]),
      evidenceKeys: ["brand"],
    },
    {
      label: "Product line",
      value:
        getFirstValue(card.parsedRecord, ["productLine", "model", "title"]) ??
        getFirstValue(proposedRecord, ["productLine", "model", "title"]),
      evidenceKeys: ["productLine"],
    },
    {
      label: "Category",
      value:
        getFirstValue(card.parsedRecord, ["category"]) ??
        getFirstValue(proposedRecord, ["category"]),
      evidenceKeys: ["category"],
    },
    {
      label: "Shaft flex",
      value:
        getFirstValue(card.parsedRecord, ["shaftFlex", "flex"]) ??
        getFirstValue(proposedRecord, ["shaftFlex", "flex"]),
      evidenceKeys: ["shaftFlex"],
    },
    {
      label: "Condition",
      value:
        getFirstValue(card.parsedRecord, ["conditionGrade"]) ??
        getFirstValue(proposedRecord, ["conditionGrade"]),
      evidenceKeys: ["conditionGrade"],
    },
    {
      label: "Trade-in value",
      value:
        getFirstValue(card.parsedRecord, ["tradeInValue", "demoValue", "value"]) ??
        getFirstValue(proposedRecord, ["tradeInValue", "demoValue", "value"]),
      currency: true,
      evidenceKeys: ["tradeInValue", "demoValue", "value"],
    },
    {
      label: "Store",
      value:
        getFirstValue(card.parsedRecord, ["storeId", "store"]) ??
        getFirstValue(proposedRecord, ["storeId", "store"]),
      evidenceKeys: [],
    },
  ];

  return (
    <dl className="guided-record-field-grid">
      {fields.map((field) => {
        const parserEvidence =
          field.evidenceKeys.length > 0
            ? getParserEvidenceForField(card.parsedRecord, field.evidenceKeys)
            : null;

        return (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>
              <span>{formatDisplayValue(field.value, { currency: field.currency })}</span>
              {parserEvidence ? (
                <small className="guided-parser-field-evidence">
                  Parsed from “{parserEvidence.sourceText}”
                </small>
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function RecordAttentionList({ card }: { card: RecordReviewCard }) {
  const warningChecks = card.validationChecks.filter(
    (check) => check.status === "WARNING" || check.status === "FAIL",
  );
  const unresolvedRetries = card.retryEvents.filter((event) => event.status === "UNRESOLVED");

  const attentionItems = [
    ...getUnresolvedMissingFields(card).map((field) => ({
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

const REVIEW_LEARNING_SOURCE_MATCH_FIELDS = [
  "brand",
  "productLine",
  "category",
  "shaftFlex",
  "conditionGrade",
  "demoValue",
] as const;

type ReviewLearningSourceMatchField =
  (typeof REVIEW_LEARNING_SOURCE_MATCH_FIELDS)[number];

function compactWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function findFirstSourceMatch(sourceEvidence: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = sourceEvidence.match(pattern);

    if (match?.[0]) {
      return compactWhitespace(match[0]);
    }
  }

  return "";
}

function getSourceTextMatchSuggestion(
  card: RecordReviewCard,
  fieldName: ReviewLearningSourceMatchField,
) {
  const sourceEvidence = card.sourceEvidence;

  if (!sourceEvidence || sourceEvidence === "No source evidence captured for this record.") {
    return "";
  }

  if (fieldName === "shaftFlex") {
    return findFirstSourceMatch(sourceEvidence, [
      /\bshaft\s+(?:stf|stiff|regular|reg|senior|lite|ladies|women|x\s*-?\s*stiff|tour\s+x)\b/i,
      /\b(?:stf|s\s*-?\s*flex|stiff|regular|reg\s*flex|r\s*-?\s*flex|senior|sr|lite|ladies|l\s*-?\s*flex|x\s*-?\s*stiff|x\s*-?\s*flex|tour\s+x)\b/i,
    ]);
  }

  if (fieldName === "conditionGrade") {
    return findFirstSourceMatch(sourceEvidence, [
      /\bcondition\s+(?:9\.5\s+Mint|9\.0\s+Above\s+Average|8\.0\s+Average|7\.0\s+Below\s+Average|6\.0\s+Poor|avg|average|poor|mint)\b/i,
      /\b(?:9\.5\s+Mint|9\.0\s+Above\s+Average|8\.0\s+Average|7\.0\s+Below\s+Average|6\.0\s+Poor)\b/i,
      /\bcond\s+(?:avg|average|poor|mint)\b/i,
    ]);
  }

  if (fieldName === "category") {
    return findFirstSourceMatch(sourceEvidence, [
      /\b(?:[3-9]\s*-\s*(?:pw|gw|sw)|irons?|iron\s+set)\b/i,
      /\b(?:driver|drv|1\s*w|[357]\s*w|fairway|fw|hybrid|hy|rescue|wedge|putter|pt)\b/i,
    ]);
  }

  if (fieldName === "demoValue") {
    return findFirstSourceMatch(sourceEvidence, [
      /\b(?:value|trade|trade-in|estimate|estimated)\s*[:=]?\s*\$?\d+\b/i,
      /\$\d+\b/i,
    ]);
  }

  const proposedRecord = getProposedRecord(card.reviewItem);
  const rawValue =
    fieldName === "brand"
      ? getFirstString(card.parsedRecord, ["brand"]) ??
        getFirstString(proposedRecord, ["brand"])
      : fieldName === "productLine"
        ? getFirstString(card.parsedRecord, ["productLine", "model", "title"]) ??
          getFirstString(proposedRecord, ["productLine", "model", "title"])
        : null;

  if (!rawValue) {
    return "";
  }

  const compactValue = normalizeComparable(rawValue);
  const matchingToken = sourceEvidence.split(/\s+/).find((token) =>
    normalizeComparable(token).includes(compactValue),
  );

  return matchingToken ?? "";
}

function buildSourceTextMatches(card: RecordReviewCard) {
  return REVIEW_LEARNING_SOURCE_MATCH_FIELDS.reduce<Record<string, string>>(
    (matches, fieldName) => ({
      ...matches,
      [fieldName]: getSourceTextMatchSuggestion(card, fieldName),
    }),
    {},
  );
}

function getSourceTextMatchValue(
  draft: ReviewCorrectionDraft,
  fieldName: string,
) {
  return draft.sourceTextMatches[fieldName]?.trim() ?? "";
}

function shouldStartCorrectionFieldBlank(card: RecordReviewCard, fieldName: CorrectionFormFieldName) {
  return getCorrectionFocusFields(card).some(
    (focusField) => normalizeComparable(focusField) === normalizeComparable(fieldName),
  );
}

export function buildCorrectionDraft(card: RecordReviewCard): ReviewCorrectionDraft {
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
    category: shouldStartCorrectionFieldBlank(card, "category")
      ? ""
      : normalizeCategoryValue(category),
    shaftFlex: shouldStartCorrectionFieldBlank(card, "shaftFlex")
      ? ""
      : normalizeShaftFlexValue(shaftFlex),
    conditionGrade: shouldStartCorrectionFieldBlank(card, "conditionGrade")
      ? ""
      : normalizeConditionGradeValue(conditionGrade),
    demoValue:
      shouldStartCorrectionFieldBlank(card, "demoValue") ||
      demoValue === null ||
      demoValue === undefined
        ? ""
        : String(demoValue),
    sourceTextMatches: buildSourceTextMatches(card),
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

export function buildCorrectedRecord(draft: ReviewCorrectionDraft): StructuredReviewCorrectedRecord {
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

export function buildLearningEvents(
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
    const wasMissing = getUnresolvedMissingFields(card).some(
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

    const rawTextMatch = getSourceTextMatchValue(draft, fieldName);

    events.push({
      fieldName,
      ...(rawTextMatch ? { rawTextMatch } : {}),
      proposedValue: proposedValue || undefined,
      correctedValue,
      evidenceText: card.sourceEvidence.slice(0, 240),
      confidenceImpact: rawTextMatch
        ? wasMissing
          ? "Human review supplied a missing field and tied it to source text."
          : "Human review corrected the normalized field and tied it to source text."
        : wasMissing
          ? "Human review supplied a missing field without an exact source text match."
          : "Human review corrected the normalized field without an exact source text match.",
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

  if (/missing\s+(?:trade\s*-?\s*in\s*)?value|missing\s+tradeinvalue|value\s+(?:missing|unknown|unclear|pending)|trade\s*-?\s*in\s+value\s+(?:missing|unknown|unclear|pending)/i.test(sourceText)) {
    fields.add("demoValue");
  }

  if (/missing\s+condition|condition\s+(?:missing|unknown|unclear|pending)|conditionnotes/i.test(sourceText)) {
    fields.add("conditionGrade");
  }

  if (/missing\s+category|category\s+(?:missing|unknown|unclear|pending|could not be classified)/i.test(sourceText)) {
    fields.add("category");
  }

  if (/missing\s+(?:shaft\s*)?flex|shaft(?:\s*flex)?\s+(?:missing|unknown|unclear|pending)|flex\s+(?:missing|unknown|unclear|pending)/i.test(sourceText)) {
    fields.add("shaftFlex");
  }

  if (/missing\s+product|product\s+(?:line\s+)?(?:missing|unknown|unclear|pending)/i.test(sourceText)) {
    fields.add("productLine");
  }

  if (/missing\s+brand|brand\s+(?:missing|unknown|unclear|pending)/i.test(sourceText)) {
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

function cardHasActiveCorrectionWork(card: RecordReviewCard) {
  return card.status === "needs-review" && canResolveReviewItem(card.reviewItem);
}

function getUnresolvedMissingFields(card: RecordReviewCard) {
  return card.missingFields.filter((fieldName) => {
    const currentValue = getCurrentValueForField(card, fieldName);

    return !currentValue || currentValue === "—";
  });
}

function getCorrectionFocusFields(card: RecordReviewCard) {
  if (!cardHasActiveCorrectionWork(card)) {
    return [];
  }

  const fields = new Set<string>();

  addSourceMissingFieldSignals(card, fields);

  for (const field of getUnresolvedMissingFields(card)) {
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
  if (!cardHasActiveCorrectionWork(card)) {
    if (card.status === "resolved") {
      return "Review item resolved.";
    }

    if (card.status === "ready") {
      return "No action required. This record passed the current review gates.";
    }
  }

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
            {secondaryFields.map((field) => {
              const parserEvidence = getParserEvidenceForField(
                card.parsedRecord,
                field === "demoValue" ? ["tradeInValue", "demoValue", "value"] : [field],
              );

              return (
                <div key={field}>
                  <dt>{getCorrectionFieldLabel(field)}</dt>
                  <dd>
                    <span>{getCorrectedValueForField(draft, field) || "—"}</span>
                    {parserEvidence ? (
                      <small className="guided-parser-field-evidence">
                        Parsed from “{parserEvidence.sourceText}”
                      </small>
                    ) : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        </details>
      ) : null}
        <SourceTextMatchEditor
          card={card}
          draft={draft}
          onDraftChange={onDraftChange}
        />


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

      <div className="guided-passed-record-normalized-fields">
        <strong>Normalized fields and parser evidence</strong>
        <RecordFieldGrid card={card} />
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

function getSourceMatchFieldsForForm(card: RecordReviewCard) {
  return getCorrectionFocusFields(card).filter((fieldName) =>
    isCorrectionFormFieldName(fieldName) &&
    REVIEW_LEARNING_SOURCE_MATCH_FIELDS.includes(
      fieldName as ReviewLearningSourceMatchField,
    ),
  );
}

function SourceTextMatchEditor({
  card,
  draft,
  onDraftChange,
}: {
  card: RecordReviewCard;
  draft: ReviewCorrectionDraft;
  onDraftChange: (draft: ReviewCorrectionDraft) => void;
}) {
  const fieldNames = getSourceMatchFieldsForForm(card);

  if (fieldNames.length === 0) {
    return null;
  }

  return (
    <section className="guided-review-source-match-editor">
      <div>
        <strong>Matching source text</strong>
        <p>
          Tie each correction to the exact phrase in the original record. This is
          what future runs can safely use as prior review evidence.
        </p>
      </div>

      <div className="guided-review-source-match-original">
        <span>Original record</span>
        <p>{card.sourceEvidence}</p>
      </div>

      <div className="guided-review-source-match-grid">
        {fieldNames.map((fieldName) => {
          const suggestion = getSourceTextMatchSuggestion(
            card,
            fieldName as ReviewLearningSourceMatchField,
          );

          return (
            <label key={fieldName}>
              {formatFieldLabel(fieldName)}
              <input
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    sourceTextMatches: {
                      ...draft.sourceTextMatches,
                      [fieldName]: event.target.value,
                    },
                  })
                }
                placeholder={
                  suggestion
                    ? `Suggested: ${suggestion}`
                    : "Exact source phrase, or leave blank if reviewer judgment only"
                }
                type="text"
                value={draft.sourceTextMatches[fieldName] ?? ""}
              />
              <small>
                {suggestion
                  ? `Suggested source match: ${suggestion}`
                  : "Leave blank only when no exact source phrase exists."}
              </small>
            </label>
          );
        })}
      </div>
    </section>
  );
}

export function RecordReviewCardView({
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
