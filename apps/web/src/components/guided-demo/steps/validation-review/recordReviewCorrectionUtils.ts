import type {
  StructuredReviewCorrectedRecord,
  StructuredReviewLearningEventInput,
} from "../../../../types/workflow";
import type {
  ModelReviewOutcome,
  PriorReviewLearningSuggestion,
  RecordReviewCard,
  ReviewCorrectionDraft,
  ReviewQueueItem,
} from "./validationReviewTypes";
import {
  formatDisplayValue,
  formatEnumLabel,
  formatFieldLabel,
  getFirstString,
  getFirstValue,
  getProposedRecord,
  normalizeCategoryValue,
  normalizeComparable,
  normalizeConditionGradeValue,
  normalizeShaftFlexValue,
} from "./validationReviewUtils";

export type ModelReviewSuggestion = Extract<
  ModelReviewOutcome,
  { outcomeType: "REPAIR_SUGGESTED" }
>["suggestions"][number];

export const CORRECTION_FORM_FIELD_NAMES = [
  "brand",
  "productLine",
  "category",
  "shaftFlex",
  "conditionGrade",
  "demoValue",
] as const;

export type CorrectionFormFieldName =
  (typeof CORRECTION_FORM_FIELD_NAMES)[number];

export const REVIEW_LEARNING_SOURCE_MATCH_FIELDS = [
  "brand",
  "productLine",
  "category",
  "shaftFlex",
  "conditionGrade",
  "demoValue",
] as const;

export type ReviewLearningSourceMatchField =
  (typeof REVIEW_LEARNING_SOURCE_MATCH_FIELDS)[number];

export type InventoryProductLineCandidate = {
  productId: string | null;
  sku: string | null;
  productLine: string;
  brand: string | null;
  category: string | null;
  confidence: number;
  reason: string | null;
};

export function canResolveReviewItem(reviewItem: ReviewQueueItem | null) {
  return reviewItem?.status === "OPEN" || reviewItem?.status === "IN_REVIEW";
}

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

export function getSourceTextMatchSuggestion(
  card: RecordReviewCard,
  fieldName: ReviewLearningSourceMatchField,
) {
  const sourceEvidence = card.sourceEvidence;

  if (
    !sourceEvidence ||
    sourceEvidence === "No source evidence captured for this record."
  ) {
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
      ? (getFirstString(card.parsedRecord, ["brand"]) ??
        getFirstString(proposedRecord, ["brand"]))
      : fieldName === "productLine"
        ? (getFirstString(card.parsedRecord, [
            "productLine",
            "model",
            "title",
          ]) ??
          getFirstString(proposedRecord, ["productLine", "model", "title"]))
        : null;

  if (!rawValue) {
    return "";
  }

  const compactValue = normalizeComparable(rawValue);
  const matchingToken = sourceEvidence
    .split(/\s+/)
    .find((token) => normalizeComparable(token).includes(compactValue));

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

export function getCurrentValueForField(
  card: RecordReviewCard,
  fieldName: string,
) {
  const proposedRecord = getProposedRecord(card.reviewItem);

  if (fieldName === "brand") {
    return (
      getFirstString(card.parsedRecord, ["brand"]) ??
      getFirstString(proposedRecord, ["brand"]) ??
      ""
    );
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
      getFirstValue(card.parsedRecord, ["category"]) ??
        getFirstValue(proposedRecord, ["category"]),
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
      getFirstValue(card.parsedRecord, [
        "tradeInValue",
        "demoValue",
        "value",
      ]) ??
        getFirstValue(proposedRecord, ["tradeInValue", "demoValue", "value"]),
    );
  }

  return "";
}

export function getCorrectedValueForField(
  draft: ReviewCorrectionDraft,
  fieldName: string,
) {
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

export function getUnresolvedMissingFields(card: RecordReviewCard) {
  return card.missingFields.filter((fieldName) => {
    const currentValue = getCurrentValueForField(card, fieldName);

    return !currentValue || currentValue === "—";
  });
}

function isPlaceholderProductLine(card: RecordReviewCard, productLine: string) {
  const normalizedProductLine = normalizeComparable(productLine);
  const normalizedCategory = normalizeComparable(
    getFirstString(card.parsedRecord, ["category"]) ??
      getFirstString(getProposedRecord(card.reviewItem), ["category"]) ??
      "",
  );

  return (
    !normalizedProductLine ||
    normalizedProductLine === normalizedCategory ||
    [
      "mystery",
      "unknown",
      "unclear",
      "pending",
      "unspecified",
      "notprovided",
      "tbd",
    ].some((placeholder) => normalizedProductLine.includes(placeholder))
  );
}

export function isStoreInspectionRequired(card: RecordReviewCard) {
  if (card.modelReviewOutcome?.outcomeType !== "NO_SAFE_REPAIR") {
    return false;
  }

  const currentProductLine = getCurrentValueForField(
    card,
    "productLine",
  ).trim();
  const normalizedReasonCodes =
    card.modelReviewOutcome.reasonCodes.map(normalizeComparable);
  const lacksRequiredEvidence = normalizedReasonCodes.some((reasonCode) =>
    ["missingrequiredfields", "lowconfidence", "uncertaintynotes"].includes(
      reasonCode,
    ),
  );

  return (
    lacksRequiredEvidence &&
    (isPlaceholderProductLine(card, currentProductLine) ||
      getUnresolvedMissingFields(card).length >= 2)
  );
}

export function isSourceSupportedProductCatalogConfirmation(
  card: RecordReviewCard,
) {
  const currentProductLine = getCurrentValueForField(
    card,
    "productLine",
  ).trim();

  if (
    !currentProductLine ||
    currentProductLine === "—" ||
    isPlaceholderProductLine(card, currentProductLine)
  ) {
    return false;
  }

  const productLineIsMissing = getUnresolvedMissingFields(card).some(
    (fieldName) => normalizeComparable(fieldName) === "productline",
  );

  if (productLineIsMissing) {
    return false;
  }

  if (card.modelReviewOutcome?.outcomeType === "CANDIDATE_COMPARISON") {
    return true;
  }

  const modelReasonCodes =
    card.modelReviewOutcome?.outcomeType === "NO_SAFE_REPAIR"
      ? card.modelReviewOutcome.reasonCodes
      : [];
  const signals = [
    card.reviewItem?.reason ?? "",
    ...card.reviewReasons,
    ...modelReasonCodes,
  ];

  return signals.some((signal) => {
    const normalizedSignal = normalizeComparable(signal);

    return (
      normalizedSignal.includes("productunresolved") ||
      normalizedSignal.includes("unresolvedproduct") ||
      normalizedSignal.includes("productresolutionisunresolved")
    );
  });
}

function asUnknownRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getCandidateConfidence(record: Record<string, unknown>) {
  const value = record.confidence;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function getInventoryProductLineCandidates(
  card: RecordReviewCard,
): InventoryProductLineCandidate[] {
  const proposedRecord = getProposedRecord(card.reviewItem);
  const inventoryLookup = asUnknownRecord(card.inventoryEvidence?.lookup);
  const proposedInventoryMatch = asUnknownRecord(
    proposedRecord?.inventoryMatch,
  );
  const similarProductsValue =
    inventoryLookup?.similarProducts ?? proposedInventoryMatch?.similarProducts;
  const similarProducts = Array.isArray(similarProductsValue)
    ? similarProductsValue
    : [];
  const currentBrand = normalizeComparable(
    getFirstString(card.parsedRecord, ["brand"]) ??
      getFirstString(proposedRecord, ["brand"]) ??
      "",
  );
  const currentCategory = normalizeComparable(
    getFirstString(card.parsedRecord, ["category"]) ??
      getFirstString(proposedRecord, ["category"]) ??
      "",
  );

  const rankedCandidates = similarProducts
    .map((value): InventoryProductLineCandidate | null => {
      const candidate = asUnknownRecord(value);

      if (!candidate) {
        return null;
      }

      const productLine = getFirstString(candidate, ["productLine"]);
      const confidence = getCandidateConfidence(candidate);

      if (!productLine || confidence === null) {
        return null;
      }

      return {
        productId: getFirstString(candidate, ["productId"]),
        sku: getFirstString(candidate, ["sku"]),
        productLine,
        brand: getFirstString(candidate, ["brand"]),
        category: getFirstString(candidate, ["category"]),
        confidence,
        reason: getFirstString(candidate, ["reason"]),
      };
    })
    .filter(
      (candidate): candidate is InventoryProductLineCandidate =>
        candidate !== null,
    )
    .filter((candidate) => {
      const candidateBrand = normalizeComparable(candidate.brand ?? "");
      const candidateCategory = normalizeComparable(candidate.category ?? "");
      const brandMatches =
        !currentBrand || !candidateBrand || candidateBrand === currentBrand;
      const categoryMatches =
        !currentCategory ||
        !candidateCategory ||
        candidateCategory === currentCategory;

      return brandMatches && categoryMatches;
    })
    .sort((first, second) => second.confidence - first.confidence);

  const dedupedCandidates = rankedCandidates.filter(
    (candidate, index, candidates) =>
      candidates.findIndex(
        (otherCandidate) =>
          normalizeComparable(otherCandidate.productLine) ===
          normalizeComparable(candidate.productLine),
      ) === index,
  );
  const bestConfidence = dedupedCandidates[0]?.confidence;

  if (bestConfidence === undefined) {
    return [];
  }

  return dedupedCandidates
    .filter((candidate) => candidate.confidence >= bestConfidence - 0.05)
    .slice(0, 4);
}

function getCorrectionFieldFromSignal(value: string) {
  const normalized = normalizeComparable(value);

  if (normalized.includes("serial")) return null;
  if (normalized.includes("brand")) return "brand";
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
  if (normalized.includes("condition")) return "conditionGrade";
  if (
    normalized.includes("tradein") ||
    normalized.includes("tradevalue") ||
    normalized.includes("value") ||
    normalized.includes("valuation")
  ) {
    return "demoValue";
  }
  if (normalized.includes("store")) return "storeId";

  return null;
}

export function getCorrectionFieldLabel(fieldName: string) {
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

function addSourceMissingFieldSignals(
  card: RecordReviewCard,
  fields: Set<string>,
) {
  const sourceText = card.sourceEvidence.toLowerCase();

  if (
    /missing\s+(?:trade\s*-?\s*in\s*)?value|missing\s+tradeinvalue|value\s+(?:missing|unknown|unclear|pending)|trade\s*-?\s*in\s+value\s+(?:missing|unknown|unclear|pending)/i.test(
      sourceText,
    )
  ) {
    fields.add("demoValue");
  }
  if (
    /missing\s+condition|condition\s+(?:missing|unknown|unclear|pending)|conditionnotes/i.test(
      sourceText,
    )
  ) {
    fields.add("conditionGrade");
  }
  if (
    /missing\s+category|category\s+(?:missing|unknown|unclear|pending|could not be classified)/i.test(
      sourceText,
    )
  ) {
    fields.add("category");
  }
  if (
    /missing\s+(?:shaft\s*)?flex|shaft(?:\s*flex)?\s+(?:missing|unknown|unclear|pending)|flex\s+(?:missing|unknown|unclear|pending)/i.test(
      sourceText,
    )
  ) {
    fields.add("shaftFlex");
  }
  if (
    /missing\s+product|product\s+(?:line\s+)?(?:missing|unknown|unclear|pending)/i.test(
      sourceText,
    )
  ) {
    fields.add("productLine");
  }
  if (
    /missing\s+brand|brand\s+(?:missing|unknown|unclear|pending)/i.test(
      sourceText,
    )
  ) {
    fields.add("brand");
  }
}

function addBlankCorrectableFieldSignals(
  card: RecordReviewCard,
  fields: Set<string>,
) {
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

  if (
    (demoValue === null || demoValue === undefined || demoValue === "") &&
    fields.has("demoValue")
  ) {
    fields.add("demoValue");
  }
  if (
    (conditionGrade === null ||
      conditionGrade === undefined ||
      conditionGrade === "") &&
    fields.has("conditionGrade")
  ) {
    fields.add("conditionGrade");
  }
  if (
    (category === null || category === undefined || category === "") &&
    fields.has("category")
  ) {
    fields.add("category");
  }
}

function cardHasActiveCorrectionWork(card: RecordReviewCard) {
  return (
    card.status === "needs-review" && canResolveReviewItem(card.reviewItem)
  );
}

export function canApplyModelReviewSuggestion(card: RecordReviewCard) {
  return (
    card.modelReviewOutcome?.outcomeType === "REPAIR_SUGGESTED" &&
    cardHasActiveCorrectionWork(card)
  );
}

function hasCurrentCorrectionFieldValue(
  card: RecordReviewCard,
  fieldName: string,
) {
  const value = getCurrentValueForField(card, fieldName);

  return value !== null && value !== undefined && value !== "" && value !== "—";
}

function isValuationEvidenceSignal(signal: string) {
  const normalizedSignal = signal.toLowerCase();
  const describesValuationEvidence =
    normalizedSignal.includes("valuation") ||
    normalizedSignal.includes("trade-in range") ||
    normalizedSignal.includes("trade in range");
  const explicitlyDescribesMissingSourceValue =
    /missing\s+(?:trade\s*-?\s*in\s*)?value|trade\s*-?\s*in\s+value\s+(?:missing|unknown|unclear|pending)|value\s+(?:missing|unknown|unclear|pending)/i.test(
      signal,
    );

  return describesValuationEvidence && !explicitlyDescribesMissingSourceValue;
}

function shouldAddCorrectionFieldFromSignal(
  card: RecordReviewCard,
  fieldName: string,
  signal: string,
) {
  if (fieldName !== "demoValue") return true;
  if (!hasCurrentCorrectionFieldValue(card, "demoValue")) return true;

  return !isValuationEvidenceSignal(signal);
}

export function getCorrectionFocusFields(card: RecordReviewCard) {
  if (!cardHasActiveCorrectionWork(card)) {
    return [];
  }

  const fields = new Set<string>();
  addSourceMissingFieldSignals(card, fields);

  for (const field of getUnresolvedMissingFields(card)) {
    const correctionField = getCorrectionFieldFromSignal(field);
    if (correctionField) fields.add(correctionField);
  }

  for (const check of card.validationChecks) {
    if (check.status === "PASS") continue;

    const signal = [check.field ?? "", check.label, check.message].join(" ");
    const correctionField =
      getCorrectionFieldFromSignal(check.field ?? "") ??
      getCorrectionFieldFromSignal(check.label) ??
      getCorrectionFieldFromSignal(check.message);

    if (
      correctionField &&
      shouldAddCorrectionFieldFromSignal(card, correctionField, signal)
    ) {
      fields.add(correctionField);
    }
  }

  for (const event of card.retryEvents) {
    if (event.status === "RESOLVED") continue;

    const signal = [event.targetField ?? "", event.reason, event.message].join(
      " ",
    );
    const correctionField =
      getCorrectionFieldFromSignal(event.targetField ?? "") ??
      getCorrectionFieldFromSignal(event.reason) ??
      getCorrectionFieldFromSignal(event.message);

    if (
      correctionField &&
      shouldAddCorrectionFieldFromSignal(card, correctionField, signal)
    ) {
      fields.add(correctionField);
    }
  }

  for (const reason of card.reviewReasons) {
    const correctionField = getCorrectionFieldFromSignal(reason);
    if (
      correctionField &&
      shouldAddCorrectionFieldFromSignal(card, correctionField, reason)
    ) {
      fields.add(correctionField);
    }
  }

  addBlankCorrectableFieldSignals(card, fields);
  return Array.from(fields);
}

function isCorrectionFormFieldName(
  value: string,
): value is CorrectionFormFieldName {
  return CORRECTION_FORM_FIELD_NAMES.includes(value as CorrectionFormFieldName);
}

function shouldStartCorrectionFieldBlank(
  card: RecordReviewCard,
  fieldName: CorrectionFormFieldName,
) {
  if (
    fieldName === "productLine" &&
    isSourceSupportedProductCatalogConfirmation(card)
  ) {
    return false;
  }

  return getCorrectionFocusFields(card).some(
    (focusField) =>
      normalizeComparable(focusField) === normalizeComparable(fieldName),
  );
}

export function buildCorrectionDraft(
  card: RecordReviewCard,
): ReviewCorrectionDraft {
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
    productLine: shouldStartCorrectionFieldBlank(card, "productLine")
      ? ""
      : productLine,
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
    reviewerNotes: "Confirmed corrected values in guided review.",
  };
}

export function buildCorrectedRecord(
  draft: ReviewCorrectionDraft,
): StructuredReviewCorrectedRecord {
  const demoValue =
    draft.demoValue.trim().length > 0 ? Number(draft.demoValue) : null;

  return {
    ...(draft.brand.trim() ? { brand: draft.brand.trim() } : {}),
    ...(draft.productLine.trim()
      ? { productLine: draft.productLine.trim() }
      : {}),
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
  const focusFieldNames = getCorrectionFocusFields(card).filter(
    isCorrectionFormFieldName,
  );
  const events: StructuredReviewLearningEventInput[] = [];

  for (const fieldName of fieldNames) {
    const correctedValue = getCorrectedValueForField(draft, fieldName).trim();
    if (!correctedValue) continue;

    const proposedValue = getCurrentValueForField(card, fieldName);
    const changed =
      normalizeComparable(proposedValue) !==
      normalizeComparable(correctedValue);
    const wasMissing = getUnresolvedMissingFields(card).some(
      (field) => normalizeComparable(field) === normalizeComparable(fieldName),
    );
    const isFocusedReviewField =
      focusFieldNames.length === 0 ||
      focusFieldNames.includes(fieldName as CorrectionFormFieldName);
    const hasKnownCurrentValue =
      proposedValue.trim().length > 0 && proposedValue !== "—";

    if (!isFocusedReviewField && (!changed || !hasKnownCurrentValue)) continue;
    if (!changed && !(isFocusedReviewField && wasMissing)) continue;

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

function getRequiredCorrectionFields(card: RecordReviewCard) {
  const requiredFields: CorrectionFormFieldName[] = [];

  for (const fieldName of getCorrectionFocusFields(card)) {
    if (
      isCorrectionFormFieldName(fieldName) &&
      !requiredFields.includes(fieldName)
    ) {
      requiredFields.push(fieldName);
    }
  }

  return requiredFields;
}

export function getBlockingCorrectionFields(
  card: RecordReviewCard,
  draft: ReviewCorrectionDraft,
) {
  return getRequiredCorrectionFields(card).filter((fieldName) => {
    const correctedValue = getCorrectedValueForField(draft, fieldName).trim();
    if (!correctedValue) return true;
    if (fieldName !== "productLine") return false;

    const currentValue = getCurrentValueForField(card, fieldName).trim();
    if (
      isSourceSupportedProductCatalogConfirmation(card) &&
      card.modelReviewOutcome?.outcomeType !== "CANDIDATE_COMPARISON" &&
      normalizeComparable(correctedValue) === normalizeComparable(currentValue)
    ) {
      return false;
    }

    const inventoryCandidates = getInventoryProductLineCandidates(card);
    if (inventoryCandidates.length > 0) {
      return !inventoryCandidates.some(
        (candidate) =>
          normalizeComparable(candidate.productLine) ===
          normalizeComparable(correctedValue),
      );
    }

    if (!currentValue || currentValue === "—") return false;
    return (
      normalizeComparable(correctedValue) === normalizeComparable(currentValue)
    );
  });
}

export function getRecordCardSummary(card: RecordReviewCard) {
  if (!cardHasActiveCorrectionWork(card)) {
    if (card.status === "resolved") return "Review item resolved.";
    if (card.status === "ready") {
      return "No action required. This record passed the current review gates.";
    }
  }

  if (isStoreInspectionRequired(card)) {
    return "Store inspection required: insufficient source data.";
  }

  if (isSourceSupportedProductCatalogConfirmation(card)) {
    return `Catalog identity confirmation: ${getCurrentValueForField(card, "productLine")}`;
  }

  const focusFields = getCorrectionFocusFields(card);
  if (focusFields.length > 0) {
    return `Needs attention: ${focusFields.map(getCorrectionFieldLabel).join(", ")}`;
  }
  if (card.reviewReasons.length > 0) return card.reviewReasons[0]!;

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

export function getVisibleCorrectionFields(
  card: RecordReviewCard,
): CorrectionFormFieldName[] {
  const focusFields = getCorrectionFocusFields(card).filter(
    isCorrectionFormFieldName,
  );

  return focusFields.length > 0
    ? focusFields
    : [...CORRECTION_FORM_FIELD_NAMES];
}

export function getSecondaryCorrectionFields(
  visibleFields: CorrectionFormFieldName[],
) {
  return CORRECTION_FORM_FIELD_NAMES.filter(
    (field) => !visibleFields.includes(field),
  );
}

export function getSuggestionDraftFieldName(
  fieldName: string,
): CorrectionFormFieldName | null {
  const normalized = normalizeComparable(fieldName);

  if (normalized === "brand") return "brand";
  if (normalized === "productline" || normalized === "model") {
    return "productLine";
  }
  if (normalized === "category") return "category";
  if (normalized === "shaftflex" || normalized === "flex") {
    return "shaftFlex";
  }
  if (normalized === "conditiongrade" || normalized === "condition") {
    return "conditionGrade";
  }
  if (
    normalized === "demovalue" ||
    normalized === "tradeinvalue" ||
    normalized === "value"
  ) {
    return "demoValue";
  }

  return null;
}

export function getPriorReviewSuggestionKey(
  suggestion: PriorReviewLearningSuggestion,
) {
  return [
    suggestion.sourceLearningEventId,
    suggestion.fieldName,
    suggestion.rawTextMatch ?? "no-source-phrase",
  ].join("-");
}

export function getAppliedSuggestionFieldNames(
  suggestions: PriorReviewLearningSuggestion[],
  appliedSuggestionIds: Set<string>,
) {
  const appliedFieldNames = new Set<CorrectionFormFieldName>();

  for (const suggestion of suggestions) {
    if (!appliedSuggestionIds.has(getPriorReviewSuggestionKey(suggestion))) {
      continue;
    }

    const fieldName = getSuggestionDraftFieldName(suggestion.fieldName);
    if (fieldName) appliedFieldNames.add(fieldName);
  }

  return appliedFieldNames;
}

export function getAppliedCorrectionSummaries(
  draft: ReviewCorrectionDraft,
  appliedSuggestionFieldNames: ReadonlySet<string>,
) {
  return Array.from(appliedSuggestionFieldNames)
    .filter(isCorrectionFormFieldName)
    .map((fieldName) => ({
      fieldName,
      label: getCorrectionFieldLabel(fieldName),
      value: getCorrectedValueForField(draft, fieldName).trim(),
    }))
    .filter((summary) => summary.value.length > 0);
}

export function getVisibleCorrectionFieldsAfterAppliedSuggestions(
  card: RecordReviewCard,
  appliedSuggestionFieldNames: Set<CorrectionFormFieldName>,
) {
  return getVisibleCorrectionFields(card).filter(
    (fieldName) => !appliedSuggestionFieldNames.has(fieldName),
  );
}

function applySuggestionValueToDraft(
  draft: ReviewCorrectionDraft,
  suggestion: {
    fieldName: string;
    suggestedValue: string | number | null | undefined;
    sourcePhrase: string | null | undefined;
  },
): ReviewCorrectionDraft {
  const fieldName = getSuggestionDraftFieldName(suggestion.fieldName);
  const suggestedValue = String(suggestion.suggestedValue ?? "").trim();
  const sourcePhrase = suggestion.sourcePhrase?.trim() ?? "";

  if (!fieldName || !suggestedValue) return draft;

  const sourceTextMatches = sourcePhrase
    ? { ...draft.sourceTextMatches, [fieldName]: sourcePhrase }
    : draft.sourceTextMatches;

  if (fieldName === "brand") {
    return { ...draft, brand: suggestedValue, sourceTextMatches };
  }
  if (fieldName === "productLine") {
    return { ...draft, productLine: suggestedValue, sourceTextMatches };
  }
  if (fieldName === "category") {
    return {
      ...draft,
      category: normalizeCategoryValue(suggestedValue),
      sourceTextMatches,
    };
  }
  if (fieldName === "shaftFlex") {
    return {
      ...draft,
      shaftFlex: normalizeShaftFlexValue(suggestedValue),
      sourceTextMatches,
    };
  }
  if (fieldName === "conditionGrade") {
    return {
      ...draft,
      conditionGrade: normalizeConditionGradeValue(suggestedValue),
      sourceTextMatches,
    };
  }

  return {
    ...draft,
    demoValue: suggestedValue.replace(/[^\d.]+/g, ""),
    sourceTextMatches,
  };
}

export function applyPriorReviewSuggestionToDraft(
  draft: ReviewCorrectionDraft,
  suggestion: PriorReviewLearningSuggestion,
) {
  return applySuggestionValueToDraft(draft, {
    fieldName: suggestion.fieldName,
    suggestedValue: suggestion.suggestedValue,
    sourcePhrase: suggestion.rawTextMatch,
  });
}

export function applyModelReviewSuggestionToDraft(
  draft: ReviewCorrectionDraft,
  suggestion: ModelReviewSuggestion,
) {
  return applySuggestionValueToDraft(draft, {
    fieldName: suggestion.fieldName,
    suggestedValue: suggestion.candidateValue,
    sourcePhrase: suggestion.sourcePhrase,
  });
}

function suggestionDraftCanResolveReview(
  card: RecordReviewCard,
  draft: ReviewCorrectionDraft,
) {
  return (
    getBlockingCorrectionFields(card, draft).length === 0 &&
    getOpenPriorReviewSuggestions(
      card.priorReviewSuggestions,
      new Set<string>(),
      draft,
    ).length === 0
  );
}

export function canResolveWithModelReviewSuggestion(
  card: RecordReviewCard,
  draft: ReviewCorrectionDraft,
  suggestion: ModelReviewSuggestion,
) {
  if (!canApplyModelReviewSuggestion(card)) return false;

  return suggestionDraftCanResolveReview(
    card,
    applyModelReviewSuggestionToDraft(draft, suggestion),
  );
}

export function canResolveWithPriorReviewSuggestion(
  card: RecordReviewCard,
  draft: ReviewCorrectionDraft,
  suggestion: PriorReviewLearningSuggestion,
) {
  if (!cardHasActiveCorrectionWork(card)) return false;

  return suggestionDraftCanResolveReview(
    card,
    applyPriorReviewSuggestionToDraft(draft, suggestion),
  );
}

export function isPriorReviewSuggestionLoadedInDraft(
  draft: ReviewCorrectionDraft,
  suggestion: Pick<
    PriorReviewLearningSuggestion,
    "fieldName" | "rawTextMatch" | "suggestedValue"
  >,
) {
  const fieldName = getSuggestionDraftFieldName(suggestion.fieldName);
  const suggestedValue = String(suggestion.suggestedValue ?? "").trim();

  if (!fieldName || !suggestedValue) return false;

  const draftValue = getCorrectedValueForField(draft, fieldName);
  const sourceTextMatch = draft.sourceTextMatches[fieldName]?.trim() ?? "";
  const expectedSourceTextMatch = suggestion.rawTextMatch?.trim() ?? "";

  return (
    normalizeComparable(draftValue) === normalizeComparable(suggestedValue) &&
    (!expectedSourceTextMatch ||
      normalizeComparable(sourceTextMatch) ===
        normalizeComparable(expectedSourceTextMatch))
  );
}

export function getActionablePriorReviewSuggestions(
  suggestions: PriorReviewLearningSuggestion[],
) {
  return suggestions.filter(
    (suggestion) => String(suggestion.suggestedValue ?? "").trim().length > 0,
  );
}

export function getOpenPriorReviewSuggestions(
  suggestions: PriorReviewLearningSuggestion[],
  handledSuggestionIds: Set<string>,
  draft?: ReviewCorrectionDraft,
) {
  return getActionablePriorReviewSuggestions(suggestions).filter(
    (suggestion) => {
      if (handledSuggestionIds.has(getPriorReviewSuggestionKey(suggestion))) {
        return false;
      }

      return draft
        ? !isPriorReviewSuggestionLoadedInDraft(draft, suggestion)
        : true;
    },
  );
}

export function getLoadedPriorReviewSuggestionFieldNames(
  draft: ReviewCorrectionDraft,
  suggestions: PriorReviewLearningSuggestion[],
) {
  const fieldNames = new Set<CorrectionFormFieldName>();

  for (const suggestion of suggestions) {
    if (!isPriorReviewSuggestionLoadedInDraft(draft, suggestion)) continue;

    const fieldName = getSuggestionDraftFieldName(suggestion.fieldName);
    if (fieldName) fieldNames.add(fieldName);
  }

  return fieldNames;
}

export function getSourceMatchFieldsForForm(
  card: RecordReviewCard,
  appliedSuggestionFieldNames: Set<CorrectionFormFieldName>,
) {
  return getCorrectionFocusFields(card).filter(
    (fieldName): fieldName is CorrectionFormFieldName =>
      isCorrectionFormFieldName(fieldName) &&
      !(
        fieldName === "productLine" &&
        isSourceSupportedProductCatalogConfirmation(card)
      ) &&
      !appliedSuggestionFieldNames.has(fieldName) &&
      REVIEW_LEARNING_SOURCE_MATCH_FIELDS.includes(
        fieldName as ReviewLearningSourceMatchField,
      ),
  );
}
