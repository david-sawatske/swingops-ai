import type { ExecuteEndToEndAgenticTradeInDemoResponse } from "../../../types/workflow";

type GuidedFinalRunReportStepProps = {
  onReset: () => void;
  result: ExecuteEndToEndAgenticTradeInDemoResponse | null;
};

function formatProvider(provider: string, model: string) {
  return `${provider} · ${model}`;
}

function formatQualityStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase();
}

export function GuidedFinalRunReportStep({
  onReset,
  result,
}: GuidedFinalRunReportStepProps) {
  const finalSummary = result?.finalSummary ?? null;
  const qualitySummary = result?.workflowQualitySummary ?? null;

  return (
    <article className="guided-workflow-card">
      <section className="guided-step-orientation">
        <span className="model-route-card__eyebrow">
          Step 6 · Final Run Report
        </span>
        <h3>What happened in this run?</h3>
        <p>
          The final report translates technical workflow evidence into a clear business
          outcome. It shows what was automated, which systems were touched, what was
          blocked, and what still needs review.
        </p>

        <div className="guided-step-mini-list" aria-label="Final report explanation">
          <article>
            <strong>Input</strong>
            <p>Workflow evidence from intake, guarded execution, validation, and review routing.</p>
          </article>

          <article>
            <strong>Action</strong>
            <p>Summarize the run into business outcome, system activity, and traceability.</p>
          </article>

          <article>
            <strong>Output</strong>
            <p>A study-friendly run report that explains the workflow from end to end.</p>
          </article>
        </div>

        <details className="guided-workflow-details guided-workflow-details--compact">
          <summary>Why end with a run report?</summary>
          <p className="guided-workflow-details__intro">
            Production-style AI workflows need more than a successful response. They need a
            clear summary of decisions, evidence, system interactions, review gates, and
            safety controls so the run can be understood later.
          </p>
        </details>
      </section>

      <section className="guided-step-workspace">
        <div className="guided-step-workspace__header">
          <div>
            <span className="model-route-card__eyebrow">Do the work</span>
            <h4>Review the completed workflow run</h4>
            <p>
              This is the final handoff for the guided demo. It turns the technical trace
              into a readable summary of what happened and why it matters.
            </p>
          </div>
        </div>

        {result && finalSummary && qualitySummary ? (
          <>
            <section className="guided-final-outcome-card">
              <span className="model-route-card__eyebrow">Run outcome</span>
              <h4>{qualitySummary.summary}</h4>
              <p>{finalSummary.productStory}</p>
            </section>

            <div className="guided-final-summary-grid">
              <article>
                <strong>{finalSummary.parsedItemCount}</strong>
                <span>parsed records</span>
              </article>
              <article>
                <strong>{finalSummary.knowledgeMatchCount}</strong>
                <span>knowledge matches</span>
              </article>
              <article>
                <strong>{finalSummary.successfulReadOnlyToolCallCount}</strong>
                <span>read-only calls</span>
              </article>
              <article>
                <strong>{finalSummary.reviewQueueItemCount}</strong>
                <span>review items</span>
              </article>
              <article>
                <strong>{finalSummary.blockedMutationToolCallCount}</strong>
                <span>blocked mutations</span>
              </article>
              <article>
                <strong>{formatQualityStatus(qualitySummary.status)}</strong>
                <span>quality status</span>
              </article>
            </div>

            <section className="guided-final-section">
              <div className="guided-final-section__header">
                <h4>Systems touched</h4>
                <p>
                  The run demonstrates a production-style workflow across model routing,
                  retrieval, internal systems, safety controls, and review.
                </p>
              </div>

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
                  <p>{finalSummary.reviewQueueItemCount} review item(s) created.</p>
                </article>
                <article>
                  <strong>Safety policy</strong>
                  <p>{finalSummary.blockedMutationToolCallCount} unsafe mutation request(s) blocked.</p>
                </article>
              </div>
            </section>

            <section className="guided-final-section">
              <div className="guided-final-section__header">
                <h4>What still needs attention?</h4>
                <p>
                  The run completed, but review items remain when validation found
                  unresolved uncertainty or missing fields.
                </p>
              </div>

              <div className="guided-final-review-callout">
                <strong>
                  {finalSummary.reviewQueueItemCount === 0
                    ? "No human review required"
                    : `${finalSummary.reviewQueueItemCount} item(s) need human review`}
                </strong>
                <p>
                  {finalSummary.reviewQueueItemCount === 0
                    ? "All records passed the current review gates for this demo run."
                    : "A reviewer should inspect the original evidence, confirm unresolved fields, and approve or correct the proposed structured records."}
                </p>
              </div>
            </section>

            <section className="guided-final-section">
              <div className="guided-final-section__header">
                <h4>Traceability</h4>
                <p>
                  These identifiers and counts make the run auditable after the demo flow is
                  complete.
                </p>
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
            </section>

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
