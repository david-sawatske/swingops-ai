import { formatEnumLabel } from "../../../../utils/formatting";
import type {
  AiReadyIntakeRecord,
  ExecuteEndToEndAgenticTradeInDemoResponse,
  GlobalReviewQueueItem,
  ReviewedTradeInRecord,
} from "../../../../types/workflow";

import type {
  CorrectionSummary,
  FinalRecordProvenanceEntry,
  MergedRecordSummary,
  RecordSummary,
} from "./finalRunReportTypes";

export function formatProvider(provider: string, model: string) {
  return `${provider} · ${model}`;
}

export function formatQualityStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase();
}

export function formatLatencyMs(value: number | null) {
  return value === null ? "—" : `${value.toLocaleString()} ms`;
}

export function formatCostEstimate(value: number | null) {
  if (value === null) {
    return "—";
  }

  if (value > 0 && value < 0.01) {
    return "< $0.01";
  }

  return `${value.toFixed(2)}`;
}

export function formatFieldRepairValue(value: string | number) {
  return typeof value === "number" ? formatCurrency(value) : formatEnumLabel(value);
}

export function getModelExecutionValidationLabel(input: {
  jsonValid: boolean;
  validationPassed: boolean;
}) {
  if (!input.jsonValid) {
    return "JSON invalid";
  }

  return input.validationPassed ? "Validation passed" : "Validation failed";
}

export function getProviderAttemptLabel(status: string) {
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

function normalizeSourceComparable(value: unknown) {
  return normalizeComparable(
    String(value ?? "").replace(/^\s*\d+\s*[).:-]\s*/, ""),
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

export function getSourceCandidateRecords(
  sourceRecords: AiReadyIntakeRecord[],
  currentRunRecords: AiReadyIntakeRecord[],
) {
  const currentRunRecordIds = new Set(
    currentRunRecords.map((record) => record.id),
  );

  return sourceRecords.filter(
    (record) => !currentRunRecordIds.has(record.id),
  );
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
    sourceRecordId: record.sourceRecordId,
    sourceName: record.sourceName,
    sourceType: record.sourceType,
    supersededByAiReadyIntakeRecordId:
      record.supersededByAiReadyIntakeRecordId ?? null,
    supersededAt: record.supersededAt ?? null,
    supersededReason: record.supersededReason ?? null,
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
  const proposed = getProposedRecord(item);
  const reviewed = item.reviewedTradeInRecord;
  const reviewIntakeItemIds = [item.intakeItemId, reviewed?.intakeItemId].filter(
    (value): value is string => Boolean(value),
  );

  if (record.intakeItemId && reviewIntakeItemIds.includes(record.intakeItemId)) {
    return true;
  }

  const candidateSourceTexts = [record.rawText, record.cleanedText]
    .map(normalizeSourceComparable)
    .filter(Boolean);
  const reviewSourceTexts = [
    item.originalText,
    reviewed?.originalText,
    getFirstString(proposed, [
      "rawText",
      "rawLine",
      "sourceText",
      "originalText",
      "normalizedText",
      "cleanedText",
    ]),
  ]
    .map(normalizeSourceComparable)
    .filter(Boolean);

  if (
    candidateSourceTexts.length > 0 &&
    reviewSourceTexts.length > 0 &&
    candidateSourceTexts.some((candidateText) => reviewSourceTexts.includes(candidateText))
  ) {
    return true;
  }

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

function getShortRecordId(value: string) {
  return value.length > 10 ? `${value.slice(0, 8)}…` : value;
}

function recordMatchesRecord(
  candidateRecord: RecordSummary,
  possibleMatch: RecordSummary,
) {
  if (
    candidateRecord.supersededByAiReadyIntakeRecordId &&
    candidateRecord.supersededByAiReadyIntakeRecordId === possibleMatch.id
  ) {
    return true;
  }

  if (
    candidateRecord.sourceRecordId &&
    possibleMatch.sourceRecordId &&
    candidateRecord.sourceRecordId === possibleMatch.sourceRecordId
  ) {
    return true;
  }

  if (
    candidateRecord.intakeItemId &&
    possibleMatch.intakeItemId &&
    candidateRecord.intakeItemId === possibleMatch.intakeItemId
  ) {
    return true;
  }

  const candidateSourceTexts = [
    candidateRecord.rawText,
    candidateRecord.cleanedText,
  ]
    .map(normalizeSourceComparable)
    .filter(Boolean);
  const possibleSourceTexts = [
    possibleMatch.rawText,
    possibleMatch.cleanedText,
  ]
    .map(normalizeSourceComparable)
    .filter(Boolean);

  if (
    candidateSourceTexts.some((candidateText) =>
      possibleSourceTexts.includes(candidateText),
    )
  ) {
    return true;
  }

  return Boolean(
    normalizeComparable(candidateRecord.brand) &&
      normalizeComparable(candidateRecord.brand) ===
        normalizeComparable(possibleMatch.brand) &&
      normalizeComparable(candidateRecord.productLine) &&
      normalizeComparable(candidateRecord.productLine) ===
        normalizeComparable(possibleMatch.productLine),
  );
}

function getParsedItemForRecord(
  result: ExecuteEndToEndAgenticTradeInDemoResponse,
  record: RecordSummary,
  index: number,
) {
  const directIdMatch = record.sourceRecordId
    ? result.parsedItems.find(
        (item) =>
          normalizeComparable(item.id) ===
          normalizeComparable(record.sourceRecordId),
      )
    : null;

  if (directIdMatch) {
    return directIdMatch;
  }

  const recordSourceTexts = [record.rawText, record.cleanedText]
    .map(normalizeSourceComparable)
    .filter(Boolean);
  const sourceTextMatch = result.parsedItems.find((item) =>
    recordSourceTexts.includes(normalizeSourceComparable(item.rawLine)),
  );

  if (sourceTextMatch) {
    return sourceTextMatch;
  }

  const identityMatch = result.parsedItems.find(
    (item) =>
      normalizeComparable(item.brand) &&
      normalizeComparable(item.brand) === normalizeComparable(record.brand) &&
      normalizeComparable(item.productLine ?? item.model) &&
      normalizeComparable(item.productLine ?? item.model) ===
        normalizeComparable(record.productLine),
  );

  return identityMatch ?? null;
}

function getRecordEvidence(input: {
  candidateRecord: RecordSummary;
  finalRecords: RecordSummary[];
  index: number;
  result: ExecuteEndToEndAgenticTradeInDemoResponse;
  reviewItem: GlobalReviewQueueItem | null;
  valuationRange: string | null;
}) {
  const parsedItem = getParsedItemForRecord(
    input.result,
    input.candidateRecord,
    input.index,
  );
  const parsedItemId = parsedItem?.id ?? null;
  const knowledgeEvidence = parsedItemId
    ? input.result.knowledgeMatchesByItem.find(
        (item) => item.parsedItemId === parsedItemId,
      ) ?? null
    : null;
  const inventoryEvidence = parsedItemId
    ? input.result.inventoryMatchesByItem.find(
        (item) => item.parsedItemId === parsedItemId,
      ) ?? null
    : null;
  const matchingModelSuggestions = parsedItemId
    ? input.result.fieldRepairExecution.suggestions.filter(
        (suggestion) => suggestion.recordId === parsedItemId,
      )
    : [];
  const reviewedRecord = input.reviewItem?.reviewedTradeInRecord ?? null;
  const learningEventCount =
    input.reviewItem?.humanReviewLearningEvents.length ?? 0;
  const activePersistedRecord =
    input.finalRecords.find((record) =>
      recordMatchesRecord(input.candidateRecord, record),
    ) ?? null;

  const entries: FinalRecordProvenanceEntry[] = [
    {
      key: "SOURCE_NORMALIZATION",
      label: "Source normalization",
      detail:
        `${input.candidateRecord.sourceName} (${formatEnumLabel(input.candidateRecord.sourceType)}) was deterministically normalized and persisted as candidate ${getShortRecordId(input.candidateRecord.id)}.`,
    },
  ];

  if ((knowledgeEvidence?.search.results.length ?? 0) > 0) {
    entries.push({
      key: "KNOWLEDGE_EVIDENCE",
      label: "Knowledge evidence",
      detail:
        `The seeded knowledge service returned ${knowledgeEvidence?.search.results.length ?? 0} supporting reference match(es).`,
    });
  }

  if (inventoryEvidence?.lookup.productId) {
    const matchedProduct =
      inventoryEvidence.lookup.displayName ??
      [inventoryEvidence.lookup.brand, inventoryEvidence.lookup.productLine]
        .filter(Boolean)
        .join(" ") ??
      inventoryEvidence.lookup.productId;

    entries.push({
      key: "INVENTORY_MATCH",
      label: "Inventory match",
      detail:
        `The seeded product catalog matched ${matchedProduct || inventoryEvidence.lookup.productId} as the product candidate.`,
    });
  }

  if (input.valuationRange) {
    entries.push({
      key: "VALUATION_EVIDENCE",
      label: "Valuation evidence",
      detail:
        `The seeded valuation engine returned ${input.valuationRange} after product identification.`,
    });
  }

  if (matchingModelSuggestions.length > 0) {
    entries.push({
      key: "MODEL_SUGGESTION",
      label: "Model-assisted suggestion",
      detail:
        `${matchingModelSuggestions.length} field-repair suggestion(s) were generated for review. They did not approve or overwrite the record automatically.`,
    });
  }

  if (reviewedRecord) {
    entries.push({
      key: "HUMAN_CORRECTION",
      label: "Human-approved correction",
      detail:
        learningEventCount > 0
          ? `A saved human correction resolved the review item and wrote ${learningEventCount} reusable learning event(s).`
          : "A saved human correction resolved the review item and became authoritative for the final record.",
    });
  }

  let persistedRecordId = input.candidateRecord.id;
  let persistenceLabel = "Finalized without review";
  let replacedRecordId: string | null = null;
  let persistenceDetail =
    `Persisted candidate ${getShortRecordId(input.candidateRecord.id)} remains the active record shown in this report.`;

  if (
    activePersistedRecord &&
    activePersistedRecord.id !== input.candidateRecord.id
  ) {
    persistedRecordId = activePersistedRecord.id;
    persistenceLabel = "Finalized after human review";
    replacedRecordId = input.candidateRecord.id;
    persistenceDetail =
      `Active record ${getShortRecordId(activePersistedRecord.id)} replaced candidate ${getShortRecordId(input.candidateRecord.id)} in the persisted lifecycle.`;
  } else if (
    input.candidateRecord.status === "SUPERSEDED" &&
    input.candidateRecord.supersededByAiReadyIntakeRecordId
  ) {
    persistedRecordId =
      input.candidateRecord.supersededByAiReadyIntakeRecordId;
    persistenceLabel = "Finalized after human review";
    replacedRecordId = input.candidateRecord.id;
    persistenceDetail =
      `Candidate ${getShortRecordId(input.candidateRecord.id)} was superseded by persisted record ${getShortRecordId(input.candidateRecord.supersededByAiReadyIntakeRecordId)}.`;
  }

  entries.push({
    key: "PERSISTED_RECORD",
    label: "Persisted record",
    detail: persistenceDetail,
  });

  return {
    entries,
    persistedRecordId,
    persistenceLabel,
    replacedRecordId,
  };
}

function getValuationEvidenceForRecord(
  result: ExecuteEndToEndAgenticTradeInDemoResponse,
  record: RecordSummary,
  index: number,
) {
  const entries = getEvidenceEntries(result.valuationEvidenceByItem);
  const parsedItemId =
    getParsedItemForRecord(result, record, index)?.id ?? null;

  return (
    entries.find((entry) => {
      const evidence = asRecord(entry);

      if (!evidence) {
        return false;
      }

      const evidenceParsedItemId = getFirstString(evidence, [
        "parsedItemId",
        "recordId",
        "itemId",
      ]);

      if (
        parsedItemId &&
        evidenceParsedItemId &&
        evidenceParsedItemId === parsedItemId
      ) {
        return true;
      }

      const indexedValues = [
        getFirstNumber(evidence, [
          "recordIndex",
          "itemIndex",
          "parsedItemIndex",
        ]),
        getFirstNumber(evidence, ["sourceRecordIndex"]),
      ].filter((value): value is number => value !== null);

      if (
        indexedValues.includes(index) ||
        indexedValues.includes(index + 1)
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
  finalRecords?: RecordSummary[];
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

  const recordEvidence = getRecordEvidence({
    candidateRecord: input.candidateRecord,
    finalRecords: input.finalRecords ?? [],
    index: input.index,
    result: input.result,
    reviewItem,
    valuationRange,
  });

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
      transformationNotes.length > 0
        ? transformationNotes
        : ["No field changes; workflow evidence checked"],
    provenanceEntries: recordEvidence.entries,
    persistedRecordId: recordEvidence.persistedRecordId,
    persistenceLabel: recordEvidence.persistenceLabel,
    replacedRecordId: recordEvidence.replacedRecordId,
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
