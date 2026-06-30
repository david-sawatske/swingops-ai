import { useState } from "react";

import type { MergedRecordSummary } from "./finalRunReportTypes";
import {
  formatEnumLabel,
  getFinalizedBySummary,
} from "./finalRunReportUtils";

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
        <strong>No finalized records loaded for this run</strong>
        <p>
          Step 6 did not receive any current-run records to merge. Start a new intake run
          or rerun Step 4 after Step 3 records are available.
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
                  This table shows the final record values after intake cleanup,
                  guarded enrichment, valuation evidence, and human review corrections.
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
