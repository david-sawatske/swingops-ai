import { useState } from "react";

import type {
  AiReadyIntakeRecord,
  ExecuteEndToEndAgenticTradeInDemoResponse,
  GlobalReviewQueueItem,
  HumanReviewLearningEvent,
  ReviewedTradeInRecord,
} from "../../../types/workflow";

type GuidedFinalRunReportStepProps = {
  currentRunAiReadyRecords: AiReadyIntakeRecord[];
  currentRunReviewQueueItems: GlobalReviewQueueItem[];
  onReset: () => void;
  result: ExecuteEndToEndAgenticTradeInDemoResponse | null;
  sourceIntakePersistedRecords: AiReadyIntakeRecord[];
};

type RecordSummary = {
  id: string;
  intakeItemId: string | null;
  label: string;
  brand: string | null;
  productLine: string | null;
  category: string | null;
  shaftFlex: string | null;
  conditionGrade: string | null;
  tradeInValue: number | null;
  valueLabel: string;
  status: string;
  reviewNeeded: boolean;
  ragReady: boolean;
  missingFields: string[];
  rawText: string;
  cleanedText: string;
};

type MergedRecordSummary = RecordSummary & {
  finalReviewLabel: string;
  finalReviewDetail: string;
  sourceStageLabel: string;
  transformationNotes: string[];
};

type CorrectionSummary = {
  fieldName: string;
  label: string;
  recordLabel: string;
  beforeValue: string;
  afterValue: string;
};

function formatProvider(provider: string, model: string) {
  return `${provider} · ${model}`;
}

function formatQualityStatus(status: string) {
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

function formatEnumLabel(value: string | null | undefined) {
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

function getRecordSummary(record: AiReadyIntakeRecord, index: number): RecordSummary {
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

function getCorrectionSummaries(
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

function getGroupedCorrectionSummaries(corrections: CorrectionSummary[]) {
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

function buildMergedRecord(input: {
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

  const transformationNotes = [
    valuationRange && input.candidateRecord.tradeInValue === null
      ? `Step 4 added valuation range ${valuationRange}`
      : null,
    valuationRange && input.candidateRecord.tradeInValue !== null
      ? `Step 4 checked valuation evidence`
      : null,
    reviewedRecord?.correctedShaftFlex &&
    normalizeComparable(reviewedRecord.correctedShaftFlex) !==
      normalizeComparable(input.candidateRecord.shaftFlex)
      ? `Step 5 corrected flex: ${formatEnumLabel(input.candidateRecord.shaftFlex)} → ${formatEnumLabel(reviewedRecord.correctedShaftFlex)}`
      : null,
    reviewedRecord?.correctedConditionGrade &&
    normalizeComparable(reviewedRecord.correctedConditionGrade) !==
      normalizeComparable(input.candidateRecord.conditionGrade)
      ? `Step 5 corrected condition: ${input.candidateRecord.conditionGrade ?? "—"} → ${reviewedRecord.correctedConditionGrade}`
      : null,
    reviewedRecord ? "Step 5 resolved review item" : null,
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
    reviewNeeded:
      reviewItem?.status === "OPEN" || reviewItem?.status === "IN_REVIEW",
    ragReady:
      reviewedRecord ? true : input.candidateRecord.ragReady || !reviewItem,
    status: reviewedRecord
      ? "READY_FOR_RAG"
      : reviewItem?.status === "OPEN" || reviewItem?.status === "IN_REVIEW"
        ? "NEEDS_REVIEW"
        : input.candidateRecord.ragReady
          ? "READY_FOR_RAG"
          : input.candidateRecord.status,
    finalReviewLabel: reviewedRecord
      ? "Resolved"
      : reviewItem?.status === "OPEN" || reviewItem?.status === "IN_REVIEW"
        ? "Needs review"
        : "Clear",
    finalReviewDetail: reviewedRecord
      ? "Human correction applied"
      : reviewItem?.status === "OPEN" || reviewItem?.status === "IN_REVIEW"
        ? "Review item still open"
        : valuationRange
          ? "Cleared with workflow evidence"
          : "No review item open",
    sourceStageLabel: input.candidateRecord.reviewNeeded ? "Needed in Step 3" : "Clear in Step 3",
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

function getRunSummaryText(input: {
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
    `Step 3 produced ${pluralize(input.candidateRecordCount, "candidate AI-ready record")} from the intake data.`,
    `Step 4 grounded and enriched those records, then validation routed ${pluralize(input.reviewItemCount, "record")} to human review.`,
    input.openReviewItemCount === 0
      ? `Step 5 resolved ${pluralize(input.resolvedReviewItemCount, "review item")}.`
      : `Step 5 still has ${pluralize(input.openReviewItemCount, "open review item")}.`,
    `The final merged table now shows Step 3 records with Step 4 evidence and Step 5 corrections applied where available.`,
    `${pluralize(input.ragReadyRecordCount, "record")} is ready for RAG or downstream use, and ${pluralize(input.learningEventCount, "learning event")} was captured from review.`,
  ].join(" ");
}

function WorkflowRecapStep({
  body,
  eyebrow,
  metric,
  title,
}: {
  body: string;
  eyebrow: string;
  metric: string;
  title: string;
}) {
  return (
    <article className="guided-final-workflow-step-card">
      <span className="model-route-card__eyebrow">{eyebrow}</span>
      <div>
        <strong>{metric}</strong>
        <h5>{title}</h5>
      </div>
      <p>{body}</p>
    </article>
  );
}

function getFinalizedBySummary(record: MergedRecordSummary) {
  return record.transformationNotes.join(" · ");
}

function MergedFinalRecordTable({ records }: { records: MergedRecordSummary[] }) {
  const [isFullTableOpen, setIsFullTableOpen] = useState(false);
  const visibleRecords = records.slice(0, 6);

  if (records.length === 0) {
    return (
      <div className="guided-final-review-callout">
        <strong>No records loaded</strong>
        <p>No finalized records are available for this section yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="multi-source-intake-table-wrap guided-ai-ready-table-wrap">
        <table className="multi-source-intake-table guided-ai-ready-table guided-ai-ready-table--compact">
          <thead>
            <tr>
              <th>Brand</th>
              <th>Model</th>
              <th>Category</th>
              <th>Flex</th>
              <th>Condition</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((record) => (
              <tr key={record.id}>
                <td title={record.brand ?? undefined}>{record.brand ?? "—"}</td>
                <td title={record.productLine ?? undefined}>
                  {record.productLine ?? "—"}
                </td>
                <td>{formatEnumLabel(record.category)}</td>
                <td>{formatEnumLabel(record.shaftFlex)}</td>
                <td>{record.conditionGrade ?? "—"}</td>
                <td>{record.finalReviewLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        className="guided-ai-ready-table-action guided-ai-ready-table-action--text"
        onClick={() => setIsFullTableOpen(true)}
        type="button"
      >
        View full table
      </button>

      {isFullTableOpen ? (
        <div
          aria-label="Full finalized records table"
          className="guided-expanded-table-backdrop"
          role="dialog"
        >
          <div className="guided-expanded-table-panel">
            <div className="guided-expanded-table-header">
              <div>
                <span className="model-route-card__eyebrow">
                  Expanded finalized record view
                </span>
                <h4>Full finalized records table</h4>
                <p>
                  This table shows the final record values after intake cleanup, guarded
                  enrichment, valuation evidence, and human review corrections.
                </p>
              </div>

              <button onClick={() => setIsFullTableOpen(false)} type="button">
                Close
              </button>
            </div>

            <div className="multi-source-intake-table-wrap guided-expanded-table-wrap">
              <table className="multi-source-intake-table guided-expanded-table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Model</th>
                    <th>Category</th>
                    <th>Flex</th>
                    <th>Condition</th>
                    <th>Value / range</th>
                    <th>Step 3 status</th>
                    <th>Final status</th>
                    <th>How finalized</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.brand ?? "—"}</td>
                      <td>{record.productLine ?? "—"}</td>
                      <td>{formatEnumLabel(record.category)}</td>
                      <td>{formatEnumLabel(record.shaftFlex)}</td>
                      <td>{record.conditionGrade ?? "—"}</td>
                      <td>{record.valueLabel}</td>
                      <td>{record.sourceStageLabel}</td>
                      <td>
                        {formatEnumLabel(record.status)} · {record.finalReviewLabel}
                      </td>
                      <td>{getFinalizedBySummary(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function GuidedFinalRunReportStep({
  currentRunAiReadyRecords,
  currentRunReviewQueueItems,
  onReset,
  result,
  sourceIntakePersistedRecords,
}: GuidedFinalRunReportStepProps) {
  const finalSummary = result?.finalSummary ?? null;
  const qualitySummary = result?.workflowQualitySummary ?? null;
  const candidateRecords = sourceIntakePersistedRecords.map(getRecordSummary);
  const finalRecords = currentRunAiReadyRecords.map(getRecordSummary);
  const mergedRecords =
    result && candidateRecords.length > 0
      ? candidateRecords.map((candidateRecord, index) =>
          buildMergedRecord({
            candidateRecord,
            index,
            result,
            reviewItems: currentRunReviewQueueItems,
          }),
        )
      : [];
  const createdReviewItemCount = finalSummary?.reviewQueueItemCount ?? 0;
  const openReviewItemCount =
    currentRunReviewQueueItems.length > 0
      ? currentRunReviewQueueItems.filter(
          (item) => item.status === "OPEN" || item.status === "IN_REVIEW",
        ).length
      : createdReviewItemCount;
  const resolvedReviewItemCount = currentRunReviewQueueItems.filter(
    (item) => item.status === "RESOLVED",
  ).length;
  const dismissedReviewItemCount = currentRunReviewQueueItems.filter(
    (item) => item.status === "DISMISSED",
  ).length;
  const reviewedRecords = currentRunReviewQueueItems
    .map((item) => item.reviewedTradeInRecord)
    .filter((record): record is ReviewedTradeInRecord => Boolean(record));
  const learningEvents = currentRunReviewQueueItems.flatMap(
    (item) => item.humanReviewLearningEvents,
  );
  const correctionSummaries = getCorrectionSummaries(currentRunReviewQueueItems);
  const groupedCorrectionSummaries = getGroupedCorrectionSummaries(correctionSummaries);
  const ragReadyRecordCount = mergedRecords.filter((record) => record.ragReady).length;
  const finalRecordsStillNeedingReviewCount = mergedRecords.filter(
    (record) => record.finalReviewLabel === "Needed",
  ).length;
  const reviewStatusSummary =
    createdReviewItemCount === 0
      ? "No review items created."
      : [
          `${createdReviewItemCount} created`,
          `${openReviewItemCount} open`,
          `${resolvedReviewItemCount} resolved`,
          dismissedReviewItemCount > 0 ? `${dismissedReviewItemCount} dismissed` : null,
        ]
          .filter(Boolean)
          .join("; ");

  const outcomeTitle =
    openReviewItemCount > 0
      ? "Workflow completed with review work still open."
      : "Workflow completed and final output is ready.";

  const summaryText =
    finalSummary && qualitySummary
      ? getRunSummaryText({
          candidateRecordCount: candidateRecords.length,
          currentRunFinalRecordCount: finalRecords.length,
          learningEventCount: learningEvents.length,
          openReviewItemCount,
          parsedItemCount: finalSummary.parsedItemCount,
          ragReadyRecordCount,
          resolvedReviewItemCount,
          reviewedRecordCount: reviewedRecords.length,
          reviewItemCount: createdReviewItemCount,
        })
      : "";

  return (
    <article className="guided-workflow-card">
      <section className="guided-step-orientation">
        <span className="model-route-card__eyebrow">
          Step 6 · Final Run Report
        </span>
        <h3>What happened across the six-step workflow?</h3>
        <p>
          The final report mirrors the workflow you just walked through: setup, messy
          intake, AI-ready records, guarded execution, validation review, and final
          written output.
        </p>

        <div className="guided-step-mini-list" aria-label="Final report explanation">
          <article>
            <strong>Input</strong>
            <p>Source intake records, workflow trace, review decisions, and persisted output records.</p>
          </article>

          <article>
            <strong>Action</strong>
            <p>Summarize what each guided workflow step did to the data.</p>
          </article>

          <article>
            <strong>Output</strong>
            <p>A final report showing merged final records, review changes, final writes, and readiness.</p>
          </article>
        </div>
      </section>

      <section className="guided-step-workspace">
        <div className="guided-step-workspace__header">
          <div>
            <span className="model-route-card__eyebrow">Do the work</span>
            <h4>Read the workflow from intake to final output</h4>
            <p>
              This report uses the same six steps as the guided run and shows the merged
              final state first.
            </p>
          </div>
        </div>

        {result && finalSummary && qualitySummary ? (
          <>
            <section className="guided-final-outcome-card guided-final-outcome-card--story">
              <span className="model-route-card__eyebrow">Run outcome</span>
              <h4>{outcomeTitle}</h4>
              <p>{summaryText}</p>
            </section>

            <section className="guided-final-section">
              <div className="guided-final-section__header">
                <h4>Workflow recap</h4>
                <p>
                  These cards match the same numbered workflow shown in the left rail.
                </p>
              </div>

              <div className="guided-final-workflow-recap">
                <WorkflowRecapStep
                  body="Guarded trade-in run with review gates, read-only tools, and audit logging."
                  eyebrow="1 · Run Setup"
                  metric="Ready"
                  title="Configured"
                />
                <WorkflowRecapStep
                  body="Messy trade-in notes were submitted and prepared for normalization."
                  eyebrow="2 · Messy Source Intake"
                  metric={String(finalSummary.parsedItemCount)}
                  title="Records processed"
                />
                <WorkflowRecapStep
                  body={`${candidateRecords.length} candidate AI-ready record(s) were persisted from intake.`}
                  eyebrow="3 · AI-Ready Record Creation"
                  metric={String(candidateRecords.length)}
                  title="Candidates created"
                />
                <WorkflowRecapStep
                  body={`${finalSummary.knowledgeMatchCount} RAG match(es), ${finalSummary.inventoryMatchCount} inventory match(es), ${finalSummary.valuationRangeCount} valuation range(s), ${finalSummary.blockedMutationToolCallCount} blocked action(s).`}
                  eyebrow="4 · Guarded Agent Execution"
                  metric={`${finalSummary.successfulReadOnlyToolCallCount}`}
                  title="Tool calls"
                />
                <WorkflowRecapStep
                  body={`${createdReviewItemCount} review item(s) created. ${resolvedReviewItemCount} resolved and ${openReviewItemCount} open.`}
                  eyebrow="5 · Validation and Review"
                  metric={`${openReviewItemCount}`}
                  title="Open review"
                />
                <WorkflowRecapStep
                  body={`${mergedRecords.length} merged final record(s), ${reviewedRecords.length} reviewed write(s), ${learningEvents.length} learning event(s).`}
                  eyebrow="6 · Final Run Report"
                  metric={String(ragReadyRecordCount)}
                  title="Ready records"
                />
              </div>
            </section>

            <section className="guided-final-section">
              <div className="guided-final-section__header">
                <h4>Finalized records</h4>
                <p>
                  This table shows the final form of each record after intake cleanup,
                  guarded enrichment, valuation evidence, and human review corrections.
                  The preview uses the same columns and layout as the Step 3 snapshot. Open the full table to see value ranges and how each record was finalized.
                </p>
              </div>

              <MergedFinalRecordTable records={mergedRecords} />

            </section>

            <section className="guided-final-section">
              <div className="guided-final-section__header">
                <h4>Review changes written</h4>
                <p>
                  Human review changes are summarized here so the report stays readable
                  even when many records are corrected. The finalized records table above
                  is the primary output.
                </p>
              </div>

              <div className="guided-final-review-write-summary">
                <article>
                  <strong>{reviewedRecords.length}</strong>
                  <span>record(s) updated by review</span>
                </article>
                <article>
                  <strong>{correctionSummaries.length}</strong>
                  <span>field correction(s) captured</span>
                </article>
                <article>
                  <strong>{learningEvents.length}</strong>
                  <span>learning event(s) written</span>
                </article>
              </div>

              {correctionSummaries.length > 0 ? (
                <details className="guided-workflow-details guided-workflow-details--compact guided-final-correction-details">
                  <summary>View correction details</summary>
                  <div className="guided-final-correction-record-list">
                    {groupedCorrectionSummaries.slice(0, 8).map((group) => (
                      <article
                        className="guided-final-correction-record"
                        key={group.recordLabel}
                      >
                        <h5>{group.recordLabel}</h5>
                        <dl>
                          {group.corrections.map((correction) => (
                            <div
                              key={`${correction.fieldName}-${correction.afterValue}`}
                            >
                              <dt>{correction.label}</dt>
                              <dd>
                                <span>{correction.beforeValue}</span>
                                <strong>→</strong>
                                <span>{correction.afterValue}</span>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </article>
                    ))}
                  </div>
                  {groupedCorrectionSummaries.length > 8 ? (
                    <p className="guided-validation-empty-note">
                      Showing 8 of {groupedCorrectionSummaries.length} corrected records.
                    </p>
                  ) : null}
                </details>
              ) : (
                <div className="guided-final-review-callout">
                  <strong>No field-level review corrections captured</strong>
                  <p>
                    The final report still shows finalized records and audit details.
                  </p>
                </div>
              )}
            </section>

            <section className="guided-final-section">
              <div className="guided-final-section__header">
                <h4>Ready now / still needs attention</h4>
              </div>

              <div className="guided-final-review-callout">
                <strong>
                  {openReviewItemCount === 0
                    ? "No current-run review items remain open"
                    : `${openReviewItemCount} item(s) still need human review`}
                </strong>
                <p>
                  {openReviewItemCount === 0
                    ? finalRecordsStillNeedingReviewCount === 0
                      ? "The merged final output is ready for RAG or downstream use."
                      : `${finalRecordsStillNeedingReviewCount} merged record(s) are still flagged for review.`
                    : "Return to Step 5 to resolve the remaining review items before treating the run as complete."}
                </p>
              </div>
            </section>

            <details className="guided-final-section guided-run-validation-detail">
              <summary>
                <div className="guided-final-section__header">
                  <span className="model-route-card__eyebrow">Audit trace</span>
                  <h4>Systems, safety, and identifiers</h4>
                  <p>
                    Technical trace data is kept for auditability, but it is secondary to
                    the six-step workflow recap above.
                  </p>
                </div>
              </summary>

              <div className="guided-run-validation-detail__body">
                <div className="guided-final-system-list">
                  <article>
                    <strong>Model router</strong>
                    <p>{formatProvider(finalSummary.selectedProvider, finalSummary.selectedModel)}</p>
                  </article>
                  <article>
                    <strong>Knowledge / RAG</strong>
                    <p>{finalSummary.knowledgeMatchCount} grounded match(es) returned.</p>
                  </article>
                  <article>
                    <strong>Inventory system</strong>
                    <p>{finalSummary.inventoryMatchCount} inventory match(es) found.</p>
                  </article>
                  <article>
                    <strong>Valuation system</strong>
                    <p>{finalSummary.valuationRangeCount} valuation range(s) generated.</p>
                  </article>
                  <article>
                    <strong>Review queue</strong>
                    <p>{reviewStatusSummary}</p>
                  </article>
                  <article>
                    <strong>AI-ready record store</strong>
                    <p>
                      {candidateRecords.length} candidate record(s); {finalRecords.length} run-scoped final record(s).
                    </p>
                  </article>
                  <article>
                    <strong>Safety policy</strong>
                    <p>{finalSummary.blockedMutationToolCallCount} unsafe mutation request(s) blocked.</p>
                  </article>
                  <article>
                    <strong>Quality status</strong>
                    <p>
                      {openReviewItemCount === 0 && createdReviewItemCount > 0
                        ? "review resolved"
                        : formatQualityStatus(qualitySummary.status)}
                    </p>
                  </article>
                </div>

                <dl className="guided-final-trace-list">
                  <div>
                    <dt>Workflow run</dt>
                    <dd>{result.persisted.workflowRunId}</dd>
                  </div>
                  <div>
                    <dt>Model call log</dt>
                    <dd>{result.persisted.modelCallLogId}</dd>
                  </div>
                  <div>
                    <dt>Tool logs</dt>
                    <dd>{result.persisted.toolCallLogIds.length}</dd>
                  </div>
                  <div>
                    <dt>Audit events</dt>
                    <dd>{result.auditTrail.length}</dd>
                  </div>
                  <div>
                    <dt>Provider fallback</dt>
                    <dd>{result.providerFallbackTrace.fallbackUsed ? "Used" : "Not used"}</dd>
                  </div>
                  <div>
                    <dt>Evidence coverage</dt>
                    <dd>{qualitySummary.evidenceCoverage}</dd>
                  </div>
                </dl>
              </div>
            </details>

            <button className="guided-step-primary-action" onClick={onReset} type="button">
              Start over
            </button>
          </>
        ) : (
          <p>Run Step 4 first so this report has a workflow result.</p>
        )}
      </section>
    </article>
  );
}
