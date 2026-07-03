import type { ExecuteMultiSourceIntakeDemoResponse } from "../../types/workflow";

type CleanedDatasetPreviewRecord =
  ExecuteMultiSourceIntakeDemoResponse["cleanedDatasetPreview"][number];

type FormatGuidedWorkflowInputOptions = {
  includeMissingFields?: boolean;
};

export function formatGuidedWorkflowInputFromRecords(
  records: CleanedDatasetPreviewRecord[],
  options: FormatGuidedWorkflowInputOptions = {},
) {
  return records
    .map((record, index) => {
      const sourceText = record.sourceText?.trim();

      if (sourceText) {
        return sourceText;
      }

      const identity = [record.brand, record.productLine, record.category]
        .filter(Boolean)
        .join(" ");

      const details = [
        record.shaftFlex ? "shaft flex " + record.shaftFlex : null,
        record.conditionGrade ? "condition " + record.conditionGrade : null,
        record.tradeInValue === null ? null : "trade value $" + record.tradeInValue,
        record.storeId ? "store " + record.storeId : null,
        record.reviewNeeded ? "review needed" : "review clear",
        options.includeMissingFields && record.missingFields.length > 0
          ? "missing " + record.missingFields.join(", ")
          : null,
      ].filter(Boolean);

      return (
        String(index + 1) +
        ". " +
        (identity || "Unknown equipment") +
        (details.length > 0 ? " — " + details.join("; ") : "")
      );
    })
    .join("\n");
}

export function formatGuidedWorkflowInputFromSourceResult(
  result: ExecuteMultiSourceIntakeDemoResponse,
  options: FormatGuidedWorkflowInputOptions = {},
) {
  return formatGuidedWorkflowInputFromRecords(
    result.cleanedDatasetPreview,
    options,
  );
}
