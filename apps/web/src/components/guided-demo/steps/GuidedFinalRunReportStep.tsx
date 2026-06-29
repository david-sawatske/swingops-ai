import type {
  ExecuteEndToEndAgenticTradeInDemoResponse,
  GlobalReviewQueueItem,
} from "../../../types/workflow";

type GuidedFinalRunReportStepProps = {
  currentRunReviewQueueItems: GlobalReviewQueueItem[];
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
  currentRunReviewQueueItems,
  onReset,
  result,
}: GuidedFinalRunReportStepProps) {
  const finalSummary = result?.finalSummary ?? null;
  const qualitySummary = result?.workflowQualitySummary ?? null;
  const createdReviewItemCount = finalSummary?.reviewQueueItemCount ?? 0;
  const liveReviewItemCount =
    currentRunReviewQueueItems.length > 0
      ? currentRunReviewQueueItems.length
      : createdReviewItemCount;
  const openReviewItemCount =
    currentRunReviewQueueItems.length > 0
      ? currentRunReviewQueueItems.filter((item) => item.status === "OPEN").length
      : createdReviewItemCount;
  const resolvedReviewItemCount = currentRunReviewQueueItems.filter(
    (item) => item.status === "RESOLVED",
  ).length;
  const dismissedReviewItemCount = currentRunReviewQueueItems.filter(
    (item) => item.status === "DISMISSED",
  ).length;
  const hasLiveReviewState = currentRunReviewQueueItems.length > 0;
  const reviewStatusSummary =
    liveReviewItemCount === 0
      ? "No review items created."
      : [
          `${createdReviewItemCount} created`,
          hasLiveReviewState ? `${openReviewItemCount} open` : null,
          hasLiveReviewState ? `${resolvedReviewItemCount} resolved` : null,
          hasLiveReviewState && dismissedReviewItemCount > 0
            ? `${dismissedReviewItemCount} dismissed`
            : null,
        ]
          .filter(Boolean)
          .join("; ");
  const outcomeTitle =
    hasLiveReviewState && createdReviewItemCount > 0 && openReviewItemCount === 0
      ? "Workflow completed with all current-run review items resolved."
      : qualitySummary?.summary ?? "";
  const outcomeDescription =
    hasLiveReviewState && createdReviewItemCount > 0 && openReviewItemCount === 0
      ? `${finalSummary?.productStory ?? ""} Human review resolved the current run's review item(s), so no review items remain open.`
      : finalSummary?.productStory ?? "";
  const qualityStatusLabel =
    hasLiveReviewState && createdReviewItemCount > 0 && openReviewItemCount === 0
      ? "review resolved"
      : qualitySummary
        ? formatQualityStatus(qualitySummary.status)
        : "";

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
              <h4>{outcomeTitle}</h4>
              <p>{outcomeDescription}</p>
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
                <strong>{openReviewItemCount}</strong>
                <span>open review items</span>
              </article>
              <article>
                <strong>{finalSummary.blockedMutationToolCallCount}</strong>
                <span>blocked mutations</span>
              </article>
              <article>
                <strong>{qualityStatusLabel}</strong>
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
                  <p>{reviewStatusSummary}</p>
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
                  The report separates review items created during validation from review
                  items that still remain open after Step 5.
                </p>
              </div>

              <div className="guided-final-review-callout">
                <strong>
                  {openReviewItemCount === 0
                    ? "No current-run review items remain open"
                    : `${openReviewItemCount} item(s) need human review`}
                </strong>
                <p>
                  {openReviewItemCount === 0
                    ? createdReviewItemCount === 0
                      ? "All records passed the current review gates for this demo run."
                      : "Step 5 resolved the current run's review item(s), so the final report has no open human-review work remaining."
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
