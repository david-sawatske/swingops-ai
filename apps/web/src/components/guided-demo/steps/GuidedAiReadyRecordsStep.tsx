import { useState } from "react";

import type {
  AiReadyIntakeRecord,
  ExecuteMultiSourceIntakeDemoResponse,
} from "../../../types/workflow";

type GuidedAiReadyRecordsStepProps = {
  onContinue: () => void;
  persistedRecords: AiReadyIntakeRecord[];
  result: ExecuteMultiSourceIntakeDemoResponse | null;
};

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatSourceType(sourceType: string) {
  return formatLabel(sourceType);
}

function formatTradeInValue(value: number | null) {
  return value === null ? "—" : `$${value}`;
}

export function GuidedAiReadyRecordsStep({
  onContinue,
  persistedRecords,
  result,
}: GuidedAiReadyRecordsStepProps) {
  const [isFullTableOpen, setIsFullTableOpen] = useState(false);

  const previewRecords = result?.cleanedDatasetPreview ?? [];
  const visiblePreviewRecords = previewRecords.slice(0, 6);
  const readyRecords = previewRecords.filter((record) => !record.reviewNeeded).length;
  const reviewRecords = previewRecords.filter((record) => record.reviewNeeded).length;
  const recordsWithMissingFields = previewRecords.filter(
    (record) => record.missingFields.length > 0,
  ).length;

  return (
    <article className="guided-workflow-card">
      <section className="guided-step-orientation">
        <span className="model-route-card__eyebrow">
          Step 2 · AI-Ready Record Creation
        </span>
        <h3>What did intake create?</h3>
        <p>
          The messy source text becomes normalized records with fields like brand,
          product, category, shaft flex, condition grade, value, store, and review
          status. This is the handoff point between source intake and the guarded
          workflow.
        </p>

        <div className="guided-step-mini-list" aria-label="AI-ready record explanation">
          <article>
            <strong>Input</strong>
            <p>Normalized source output from Step 1.</p>
          </article>

          <article>
            <strong>Action</strong>
            <p>Map extracted fields into consistent trade-in records with review signals.</p>
          </article>

          <article>
            <strong>Output</strong>
            <p>AI-ready records that can be grounded, validated, and safely handed to tools.</p>
          </article>
        </div>

        <details className="guided-workflow-details guided-workflow-details--compact">
          <summary>What makes a record AI-ready?</summary>
          <p className="guided-workflow-details__intro">
            AI-ready does not mean every record is automatically approved. It means the
            workflow has a structured schema, preserved source context, known missing
            fields, and a review flag when human judgment is still needed.
          </p>
        </details>
      </section>

      <section className="guided-step-workspace">
        <div className="guided-step-workspace__header">
          <div>
            <span className="model-route-card__eyebrow">Do the work</span>
            <h4>Inspect the records created from source intake</h4>
            <p>
              Review the normalized output before the guarded workflow uses it. Records
              with missing fields or uncertainty remain visible instead of being silently
              treated as complete.
            </p>
          </div>
        </div>

        {result ? (
          <>
            <div className="guided-ai-ready-summary-grid">
              <article>
                <strong>{previewRecords.length}</strong>
                <span>Extracted</span>
              </article>
              <article>
                <strong>{readyRecords}</strong>
                <span>Ready</span>
              </article>
              <article>
                <strong>{reviewRecords}</strong>
                <span>Need review</span>
              </article>
              <article>
                <strong>{persistedRecords.length}</strong>
                <span>Persisted</span>
              </article>
            </div>

            <div className="guided-ai-ready-quality-strip">
              <article>
                <strong>Schema check</strong>
                <p>
                  Brand, product, category, flex, condition grade, value, and store are
                  separated into fields.
                </p>
              </article>
              <article>
                <strong>Missing-field check</strong>
                <p>
                  {recordsWithMissingFields === 0
                    ? "No preview records reported missing fields."
                    : `${recordsWithMissingFields} preview record${
                        recordsWithMissingFields === 1 ? "" : "s"
                      } reported missing fields.`}
                </p>
              </article>
              <article>
                <strong>Review gate</strong>
                <p>Records that still need judgment are marked before tool execution.</p>
              </article>
            </div>

            <div>
              <div className="guided-ai-ready-preview-header">
                <div>
                  <h4>Cleaned record preview</h4>
                  <p>
                    Compact view of the normalized records. Open the full table to inspect
                    every field.
                  </p>
                </div>
              </div>

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
                    {visiblePreviewRecords.map((record) => (
                      <tr key={record.id}>
                        <td title={record.brand ?? undefined}>{record.brand ?? "—"}</td>
                        <td title={record.productLine ?? undefined}>
                          {record.productLine ?? "—"}
                        </td>
                        <td>{formatLabel(record.category)}</td>
                        <td>{formatLabel(record.shaftFlex)}</td>
                        <td>{record.conditionGrade ?? "—"}</td>
                        <td>{record.reviewNeeded ? "Needed" : "Clear"}</td>
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
            </div>

            {isFullTableOpen ? (
              <div
                aria-label="Full cleaned record table"
                className="guided-expanded-table-backdrop"
                role="dialog"
              >
                <div className="guided-expanded-table-panel">
                  <div className="guided-expanded-table-header">
                    <div>
                      <span className="model-route-card__eyebrow">
                        Expanded record view
                      </span>
                      <h4>Full AI-ready record table</h4>
                      <p>
                        All normalized fields from the source intake step, including value,
                        store, review status, and missing-field signals.
                      </p>
                    </div>

                    <button
                      aria-label="Close expanded record view"
                      className="guided-expanded-table-close-button"
                      onClick={() => setIsFullTableOpen(false)}
                      title="Close"
                      type="button"
                    >
                      ×
                    </button>
                  </div>

                  <div className="multi-source-intake-table-wrap guided-expanded-table-wrap">
                    <table className="multi-source-intake-table guided-expanded-table">
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th>Brand</th>
                          <th>Model</th>
                          <th>Category</th>
                          <th>Flex</th>
                          <th>Condition</th>
                          <th>Value</th>
                          <th>Store</th>
                          <th>Review</th>
                          <th>Missing fields</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRecords.map((record) => (
                          <tr key={record.id}>
                            <td>{formatSourceType(record.sourceType)}</td>
                            <td>{record.brand ?? "—"}</td>
                            <td>{record.productLine ?? "—"}</td>
                            <td>{formatLabel(record.category)}</td>
                            <td>{formatLabel(record.shaftFlex)}</td>
                            <td>{record.conditionGrade ?? "—"}</td>
                            <td>{formatTradeInValue(record.tradeInValue)}</td>
                            <td>{record.storeId ?? "—"}</td>
                            <td>{record.reviewNeeded ? "Needed" : "Clear"}</td>
                            <td>
                              {record.missingFields.length === 0
                                ? "—"
                                : record.missingFields.join(", ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="guided-next-step-note">
              <h4>Next handoff</h4>
              <p>
                Step 3 converts these records into guarded workflow input and runs the
                agent through model routing, grounding, read-only tools, validation, and
                review routing.
              </p>
            </div>

            <button className="guided-step-primary-action" onClick={onContinue} type="button">
              Continue to Guarded Agent Execution
            </button>
          </>
        ) : (
          <p>Run Step 1 first so this step has records to show.</p>
        )}
      </section>
    </article>
  );
}
