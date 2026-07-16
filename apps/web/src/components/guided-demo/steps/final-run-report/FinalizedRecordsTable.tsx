import { formatEnumLabel } from "../../../../utils/formatting";
import { useState } from "react";

import type { MergedRecordSummary } from "./finalRunReportTypes";
import { getFinalizedBySummary } from "./finalRunReportUtils";

export function FinalizedRecordsTable({
  records,
}: {
  records: MergedRecordSummary[];
}) {
  const [isFullTableOpen, setIsFullTableOpen] = useState(false);
  const visibleRecords = records.slice(0, 6);

  if (records.length === 0) {
    return (
      <div className="guided-final-review-callout">
        <strong>No current records loaded for this run</strong>
        <p>
          Step 5 did not receive any current-run records to merge. Start a new intake run
          or rerun Step 3 after Step 2 records are available.
        </p>
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
          aria-label="Full record outcomes table"
          className="guided-expanded-table-backdrop guided-finalized-table-backdrop"
          role="dialog"
        >
          <div className="guided-expanded-table-panel guided-finalized-table-panel">
            <div className="guided-expanded-table-header">
              <div>
                <span className="model-route-card__eyebrow">
                  Expanded record outcome view
                </span>
                <h4>Full record outcomes table</h4>
                <p>
                  This table shows the current values assembled from the evidence and
                  saved review decisions that applied to each record.
                </p>
              </div>

              <button
              aria-label="Close expanded record outcome view"
              className="guided-expanded-table-close-button"
              onClick={() => setIsFullTableOpen(false)}
              title="Close"
              type="button"
            >
              ×
            </button>
            </div>

            <div className="multi-source-intake-table-wrap guided-expanded-table-wrap guided-finalized-table-wrap">
              <table className="multi-source-intake-table guided-expanded-table guided-finalized-table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Model</th>
                    <th>Category</th>
                    <th>Flex</th>
                    <th>Condition</th>
                    <th>Value / range</th>
                    <th>Step 2 status</th>
                    <th>Final status</th>
                    <th>How assembled</th>
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
