import type {
  AiReadyIntakeRecord,
  ExecuteEndToEndAgenticTradeInDemoResponse,
  GlobalReviewQueueItem,
  ReviewedTradeInRecord,
} from "../../../../types/workflow";

import type {
  CorrectionSummary,
  MergedRecordSummary,
  RecordSummary,
} from "./finalRunReportTypes";

export function formatProvider(provider: string, model: string) {
  return `${provider} · ${model}`;
}

export function formatQualityStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

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

function getFirstString(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];
    const stringValue = asString(value);

    if (stringValue) {
      return stringValue;
    }

    const numberValue = asNumber(value);

    if (numberValue !== null) {
      return String(numberValue);
    }
  }

  return null;
}

function getFirstNumber(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];
    const numberValue = asNumber(value);

    if (numberValue !== null) {
      return numberValue;
    }

    const stringValue = asString(value);

    if (stringValue && /^\d+(\.\d+)?$/.test(stringValue)) {
      return Number(stringValue);
    }
  }

  return null;
}

function normalizeComparable(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function formatEnumLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const normalized = value.toUpperCase().replace(/[\s-]+/g, "_");

  const labels: Record<string, string> = {
    DRIVER: "Driver",
    FAIRWAY_WOOD: "Fairway Wood",
    HYBRID: "Hybrid",
    IRON_SET: "Iron Set",
    WEDGE: "Wedge",
    PUTTER: "Putter",
    LADIES: "Ladies",
    SENIOR: "Senior",
    REGULAR: "Regular",
    STIFF: "Stiff",
    X_STIFF: "X-Stiff",
    TOUR_X_STIFF: "Tour X-Stiff",
    READY_FOR_REVIEW: "Ready for review",
    READY_FOR_RAG: "Ready for RAG",
    NEEDS_REVIEW: "Needs review",
  };

  return (
    labels[normalized] ??
    value
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function formatFieldLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (first) => first.toUpperCase());
}

function formatCurrency(value: number | null) {
  return value === null ? "—" : `$${value.toLocaleString()}`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getNormalizedRecord(record: AiReadyIntakeRecord) {
  return asRecord(record.normalizedJson);
}

export function getRecordSummary(record: AiReadyIntakeRecord, index: number): RecordSummary {
  const normalizedRecord = getNormalizedRecord(record);
  const brand = getFirstString(normalizedRecord, ["brand", "correctedBrand"]);
  const productLine = getFirstString(normalizedRecord, [
    "productLine",
    "model",
    "title",
    "correctedProductLine",
  ]);
  const category = getFirstString(normalizedRecord, ["category", "correctedCategory"]);
  const shaftFlex = getFirstString(normalizedRecord, [
    "shaftFlex",
    "correctedShaftFlex",
  ]);
  const conditionGrade = getFirstString(normalizedRecord, [
    "conditionGrade",
    "correctedConditionGrade",
  ]);
  const tradeInValue = getFirstNumber(normalizedRecord, [
    "tradeInValue",
    "demoValue",
    "correctedDemoValue",
  ]);
  const labelParts = [
    brand,
    productLine,
    category ? formatEnumLabel(category) : null,
  ].filter(Boolean);

  return {
    id: record.id,
    intakeItemId: record.intakeItemId,
    label: labelParts.length > 0 ? labelParts.join(" · ") : `Record ${index + 1}`,
    brand,
    productLine,
    category,
    shaftFlex,
    conditionGrade,
    tradeInValue,
    valueLabel: formatCurrency(tradeInValue),
    status: record.status,
    reviewNeeded: record.reviewNeeded,
    ragReady: record.ragReady || record.status === "READY_FOR_RAG",
    missingFields: asStringArray(normalizedRecord?.missingFields),
    rawText: record.rawText,
    cleanedText: record.cleanedText,
  };
}

function getProposedRecord(item: GlobalReviewQueueItem) {
  return asRecord(item.proposedGolfClubJson);
}

function getReviewedRecordLabel(
  reviewedRecord: ReviewedTradeInRecord,
  fallbackIndex: number,
) {
  const labelParts = [
    reviewedRecord.correctedBrand,
    reviewedRecord.correctedProductLine,
    reviewedRecord.correctedCategory
      ? formatEnumLabel(reviewedRecord.correctedCategory)
      : null,
  ].filter(Boolean);

  return labelParts.length > 0
    ? labelParts.join(" · ")
    : `Reviewed record ${fallbackIndex + 1}`;
}

function formatCorrectionBeforeValue(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue || trimmedValue === "—" || trimmedValue === "-") {
    return "Missing";
  }

  return trimmedValue;
}

function getCorrectionRecordLabel(
  item: GlobalReviewQueueItem,
  fallbackIndex: number,
) {
  if (item.reviewedTradeInRecord) {
    return getReviewedRecordLabel(item.reviewedTradeInRecord, fallbackIndex);
  }

  const proposed = getProposedRecord(item);
  const labelParts = [
    getFirstString(proposed, ["brand", "correctedBrand"]),
    getFirstString(proposed, [
      "productLine",
      "model",
      "title",
      "correctedProductLine",
    ]),
    getFirstString(proposed, ["category", "correctedCategory"]),
  ]
    .map((value, index) => (index === 2 ? formatEnumLabel(value) : value))
    .filter(Boolean);

  return labelParts.length > 0
    ? labelParts.join(" · ")
    : `Reviewed record ${fallbackIndex + 1}`;
}

export function getCorrectionSummaries(
  reviewItems: GlobalReviewQueueItem[],
): CorrectionSummary[] {
  return reviewItems.flatMap((item, itemIndex) => {
    const recordLabel = getCorrectionRecordLabel(item, itemIndex);

    return item.humanReviewLearningEvents.map((event) => ({
      fieldName: event.fieldName,
      label: formatFieldLabel(event.fieldName),
      recordLabel,
      beforeValue: formatCorrectionBeforeValue(event.proposedValue),
      afterValue: event.correctedValue?.trim() || "Confirmed",
    }));
  });
}

export function getGroupedCorrectionSummaries(corrections: CorrectionSummary[]) {
  const groups = new Map<string, CorrectionSummary[]>();

  corrections.forEach((correction) => {
    const existing = groups.get(correction.recordLabel) ?? [];
    groups.set(correction.recordLabel, [...existing, correction]);
  });

  return Array.from(groups.entries()).map(([recordLabel, recordCorrections]) => ({
    recordLabel,
    corrections: recordCorrections,
  }));
}

function recordMatchesReviewItem(record: RecordSummary, item: GlobalReviewQueueItem) {
  if (record.intakeItemId && item.intakeItemId && record.intakeItemId === item.intakeItemId) {
    return true;
  }

  const proposed = getProposedRecord(item);
  const reviewed = item.reviewedTradeInRecord;

  const reviewBrand =
    reviewed?.correctedBrand ?? getFirstString(proposed, ["brand", "correctedBrand"]);
  const reviewProduct =
    reviewed?.correctedProductLine ??
    getFirstString(proposed, ["productLine", "model", "title", "correctedProductLine"]);
  const reviewCategory =
    reviewed?.correctedCategory ??
    getFirstString(proposed, ["category", "correctedCategory"]);

  const brandMatches =
    normalizeComparable(record.brand) &&
    normalizeComparable(record.brand) === normalizeComparable(reviewBrand);
  const productMatches =
    normalizeComparable(record.productLine) &&
    normalizeComparable(record.productLine) === normalizeComparable(reviewProduct);
  const categoryMatches =
    !record.category ||
    !reviewCategory ||
    normalizeComparable(record.category) === normalizeComparable(reviewCategory);

  return Boolean(brandMatches && productMatches && categoryMatches);
}

function getMatchingReviewItem(
  record: RecordSummary,
  reviewItems: GlobalReviewQueueItem[],
) {
  return reviewItems.find((item) => recordMatchesReviewItem(record, item)) ?? null;
}

function getEvidenceEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const record = asRecord(value);

  return record ? Object.values(record) : [];
}

function getValuationEvidenceForRecord(
  result: ExecuteEndToEndAgenticTradeInDemoResponse,
  record: RecordSummary,
  index: number,
) {
  const entries = getEvidenceEntries(result.valuationEvidenceByItem);

  return (
    entries.find((entry, entryIndex) => {
      const evidence = asRecord(entry);

      if (!evidence) {
        return false;
      }

      const indexedValues = [
        getFirstNumber(evidence, ["recordIndex", "itemIndex", "parsedItemIndex"]),
        getFirstNumber(evidence, ["sourceRecordIndex"]),
      ].filter((value): value is number => value !== null);

      if (
        indexedValues.includes(index) ||
        indexedValues.includes(index + 1) ||
        entryIndex === index
      ) {
        return true;
      }

      const evidenceText = normalizeComparable(JSON.stringify(evidence));
      const brand = normalizeComparable(record.brand);
      const product = normalizeComparable(record.productLine);

      return Boolean(
        brand &&
          product &&
          evidenceText.includes(brand) &&
          evidenceText.includes(product),
      );
    }) ?? null
  );
}

function getValuationRangeLabel(evidence: unknown) {
  const evidenceRecord = asRecord(evidence);
  const estimate =
    asRecord(evidenceRecord?.estimate) ??
    asRecord(evidenceRecord?.valuationEstimate) ??
    asRecord(evidenceRecord?.demoValuationRange) ??
    evidenceRecord;

  const lowValue = getFirstNumber(estimate, [
    "lowValue",
    "minValue",
    "valueLow",
    "tradeInValueLow",
  ]);
  const highValue = getFirstNumber(estimate, [
    "highValue",
    "maxValue",
    "valueHigh",
    "tradeInValueHigh",
  ]);
  const value = getFirstNumber(estimate, ["tradeInValue", "demoValue", "value"]);

  if (lowValue !== null && highValue !== null) {
    return `$${lowValue.toLocaleString()}–$${highValue.toLocaleString()}`;
  }

  if (value !== null) {
    return `$${value.toLocaleString()}`;
  }

  return null;
}

export function buildMergedRecord(input: {
  candidateRecord: RecordSummary;
  index: number;
  result: ExecuteEndToEndAgenticTradeInDemoResponse;
  reviewItems: GlobalReviewQueueItem[];
}) {
  const reviewItem = getMatchingReviewItem(input.candidateRecord, input.reviewItems);
  const reviewedRecord = reviewItem?.reviewedTradeInRecord ?? null;
  const valuationRange = getValuationRangeLabel(
    getValuationEvidenceForRecord(input.result, input.candidateRecord, input.index),
  );
  const correctedValue =
    reviewedRecord?.correctedDemoValue ?? input.candidateRecord.tradeInValue;
  const correctedValueLabel = formatCurrency(correctedValue);
  const finalValueLabel = correctedValueLabel !== "—" ? correctedValueLabel : valuationRange ?? "—";
  const hasOpenReviewItem =
    reviewItem?.status === "OPEN" || reviewItem?.status === "IN_REVIEW";
  const unresolvedNonValueMissingFields = input.candidateRecord.missingFields.filter(
    (field) => {
      const normalizedField = normalizeComparable(field);

      return !["demovalue", "tradeinvalue", "value"].includes(normalizedField);
    },
  );
  const valuationEvidenceClearsReview =
    Boolean(valuationRange) &&
    !hasOpenReviewItem &&
    unresolvedNonValueMissingFields.length === 0;
  const finalStatus =
    reviewedRecord || valuationEvidenceClearsReview || input.candidateRecord.ragReady
      ? "READY_FOR_RAG"
      : hasOpenReviewItem
        ? "NEEDS_REVIEW"
        : input.candidateRecord.status;
  const finalReviewNeeded = finalStatus === "NEEDS_REVIEW" || hasOpenReviewItem;
  const finalReviewLabel = reviewedRecord
    ? "Resolved"
    : finalReviewNeeded
      ? "Needs review"
      : "Clear";
  const finalReviewDetail = reviewedRecord
    ? "Human correction applied"
    : hasOpenReviewItem
      ? "Review item still open"
      : valuationEvidenceClearsReview
        ? "Cleared with workflow evidence"
        : finalReviewNeeded
          ? "Record still flagged for review"
          : valuationRange
            ? "Valuation evidence checked"
            : "No review item open";

  const transformationNotes = [
    valuationRange && input.candidateRecord.tradeInValue === null
      ? `Step 3 added valuation range ${valuationRange}`
      : null,
    valuationRange && input.candidateRecord.tradeInValue !== null
      ? `Step 3 checked valuation evidence`
      : null,
    reviewedRecord?.correctedShaftFlex &&
    normalizeComparable(reviewedRecord.correctedShaftFlex) !==
      normalizeComparable(input.candidateRecord.shaftFlex)
      ? `Step 4 corrected flex: ${formatEnumLabel(input.candidateRecord.shaftFlex)} → ${formatEnumLabel(reviewedRecord.correctedShaftFlex)}`
      : null,
    reviewedRecord?.correctedConditionGrade &&
    normalizeComparable(reviewedRecord.correctedConditionGrade) !==
      normalizeComparable(input.candidateRecord.conditionGrade)
      ? `Step 4 corrected condition: ${input.candidateRecord.conditionGrade ?? "—"} → ${reviewedRecord.correctedConditionGrade}`
      : null,
    reviewedRecord ? "Step 4 resolved review item" : null,
  ].filter((note): note is string => Boolean(note));

  const mergedRecord: MergedRecordSummary = {
    ...input.candidateRecord,
    brand: reviewedRecord?.correctedBrand ?? input.candidateRecord.brand,
    productLine:
      reviewedRecord?.correctedProductLine ?? input.candidateRecord.productLine,
    category: reviewedRecord?.correctedCategory ?? input.candidateRecord.category,
    shaftFlex:
      reviewedRecord?.correctedShaftFlex ?? input.candidateRecord.shaftFlex,
    conditionGrade:
      reviewedRecord?.correctedConditionGrade ?? input.candidateRecord.conditionGrade,
    tradeInValue: correctedValue,
    valueLabel: finalValueLabel,
    reviewNeeded: finalReviewNeeded,
    ragReady: finalStatus === "READY_FOR_RAG",
    status: finalStatus,
    finalReviewLabel,
    finalReviewDetail,
    sourceStageLabel: input.candidateRecord.reviewNeeded ? "Needed in Step 2" : "Clear in Step 2",
    transformationNotes:
      transformationNotes.length > 0 ? transformationNotes : ["No field changes; workflow evidence checked"],
  };

  mergedRecord.label = [
    mergedRecord.brand,
    mergedRecord.productLine,
    mergedRecord.category ? formatEnumLabel(mergedRecord.category) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return mergedRecord;
}

export function getFinalizedBySummary(record: MergedRecordSummary) {
  return record.transformationNotes.join(" · ");
}

export function getRunSummaryText(input: {
  candidateRecordCount: number;
  currentRunFinalRecordCount: number;
  parsedItemCount: number;
  reviewItemCount: number;
  resolvedReviewItemCount: number;
  openReviewItemCount: number;
  reviewedRecordCount: number;
  learningEventCount: number;
  ragReadyRecordCount: number;
}) {
  return [
    `This run started with ${pluralize(input.parsedItemCount, "messy source record")}.`,
    `Step 2 produced ${pluralize(input.candidateRecordCount, "candidate AI-ready record")} from the intake data.`,
    `Step 3 grounded and enriched those records, then validation routed ${pluralize(input.reviewItemCount, "record")} to human review.`,
    input.openReviewItemCount === 0
      ? `Step 4 resolved ${pluralize(input.resolvedReviewItemCount, "review item")}.`
      : `Step 4 still has ${pluralize(input.openReviewItemCount, "open review item")}.`,
    `The final merged table now shows Step 2 records with Step 3 evidence and Step 4 corrections applied where available.`,
    `${pluralize(input.ragReadyRecordCount, "record")} is ready for RAG or downstream use, and ${pluralize(input.learningEventCount, "learning event")} was captured from review.`,
  ].join(" ");
}
