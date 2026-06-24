import type { ExecuteEndToEndAgenticTradeInDemoResponse } from "../../../types/workflow";

type GuidedValidationReviewStepProps = {
  onContinue: () => void;
  onOpenReviewQueue: () => void;
  result: ExecuteEndToEndAgenticTradeInDemoResponse | null;
};

function formatStatusLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

function getStatusClassName(status: string) {
  return `guided-validation-status guided-validation-status--${status.toLowerCase()}`;
}

export function GuidedValidationReviewStep({
  onContinue,
  onOpenReviewQueue,
  result,
}: GuidedValidationReviewStepProps) {
  const validationChecks = result?.validationChecks ?? [];
  const retryEvents = result?.retryEvents ?? [];
  const reviewOutcomes = result?.reviewOutcomes ?? [];
  const qualitySummary = result?.workflowQualitySummary ?? null;

  const warningChecks = validationChecks.filter((check) => check.status === "WARNING");
  const failedChecks = validationChecks.filter((check) => check.status === "FAIL");
  const reviewRequiredChecks = validationChecks.filter((check) => check.reviewRequired);
  const unresolvedRetries = retryEvents.filter((event) => event.status === "UNRESOLVED");

  return (
    <article className="guided-workflow-card">
      <section className="guided-step-orientation">
        <span className="model-route-card__eyebrow">
          Step 5 · Validation and Review
        </span>
        <h3>What did the workflow trust, retry, or escalate?</h3>
        <p>
          After the guarded workflow runs, the app should not simply declare success.
          This step explains which checks passed, which fields still need attention, and
          which records were routed to human review.
        </p>

        <div className="guided-step-mini-list" aria-label="Validation and review explanation">
          <article>
            <strong>Input</strong>
            <p>Execution evidence from Step 4: parsed records, tool results, validation checks, and review items.</p>
          </article>

          <article>
            <strong>Action</strong>
            <p>Separate trusted evidence from warnings, unresolved fields, retries, and human review work.</p>
          </article>

          <article>
            <strong>Output</strong>
            <p>A clear review handoff before the final run report is considered complete.</p>
          </article>
        </div>

        <details className="guided-workflow-details guided-workflow-details--compact">
          <summary>Why does review happen after execution?</summary>
          <p className="guided-workflow-details__intro">
            The workflow can gather evidence and identify problems, but uncertain trade-in
            values, missing fields, and policy-sensitive outcomes should stay visible until
            a person approves or resolves them.
          </p>
        </details>
      </section>

      <section className="guided-step-workspace">
        <div className="guided-step-workspace__header">
          <div>
            <span className="model-route-card__eyebrow">Do the work</span>
            <h4>Inspect validation, retry, and review evidence</h4>
            <p>
              This is the control checkpoint. It shows how the workflow decides what can be
              trusted automatically and what needs a human before downstream action.
            </p>
          </div>
        </div>

        {result && qualitySummary ? (
          <>
            <div className="guided-validation-summary-grid">
              <article>
                <strong>{formatStatusLabel(qualitySummary.status)}</strong>
                <span>quality status</span>
              </article>
              <article>
                <strong>{qualitySummary.validationPassed}</strong>
                <span>checks passed</span>
              </article>
              <article>
                <strong>{qualitySummary.validationWarnings}</strong>
                <span>warnings</span>
              </article>
              <article>
                <strong>{qualitySummary.reviewItemsCreated}</strong>
                <span>review items</span>
              </article>
            </div>

            <div className="guided-validation-quality-callout">
              <strong>Workflow quality summary</strong>
              <p>{qualitySummary.summary}</p>
              <small>Evidence coverage: {qualitySummary.evidenceCoverage}</small>
            </div>

            <section className="guided-validation-section">
              <div className="guided-validation-section__header">
                <div>
                  <h4>Validation results</h4>
                  <p>
                    Field completeness, confidence, evidence coverage, and routing rules are
                    checked before the workflow moves forward.
                  </p>
                </div>
                <span>{reviewRequiredChecks.length} require review</span>
              </div>

              <ol className="guided-validation-evidence-list">
                {validationChecks.slice(0, 6).map((check) => (
                  <li key={check.id}>
                    <span className={getStatusClassName(check.status)}>{check.status}</span>
                    <div>
                      <strong>{check.label}</strong>
                      <p>{check.message}</p>
                      <small>
                        Severity {check.severity.toLowerCase()}
                        {check.field ? ` · field ${check.field}` : ""}
                        {check.reviewRequired ? " · review required" : ""}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>

              {validationChecks.length > 6 ? (
                <p className="guided-validation-footnote">
                  Showing 6 of {validationChecks.length} validation checks.
                </p>
              ) : null}
            </section>

            <section className="guided-validation-section">
              <div className="guided-validation-section__header">
                <div>
                  <h4>Retry behavior</h4>
                  <p>
                    Retry events show whether the workflow was able to resolve missing or
                    uncertain fields before escalating them.
                  </p>
                </div>
                <span>{unresolvedRetries.length} unresolved</span>
              </div>

              {retryEvents.length > 0 ? (
                <ol className="guided-validation-evidence-list">
                  {retryEvents.slice(0, 4).map((event) => (
                    <li key={event.id}>
                      <span className={getStatusClassName(event.status)}>
                        {event.status}
                      </span>
                      <div>
                        <strong>{event.reason}</strong>
                        <p>{event.message}</p>
                        <small>
                          {event.targetField ? `Target field ${event.targetField}` : "Workflow-level retry"}
                          {" · "}
                          {event.policy}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="guided-validation-empty-note">
                  No retry events were needed for this run.
                </p>
              )}
            </section>

            <section className="guided-validation-section">
              <div className="guided-validation-section__header">
                <div>
                  <h4>Human review handoff</h4>
                  <p>
                    Review items are created when the workflow should not silently accept a
                    record. The review queue is where missing values and uncertain records
                    can be resolved.
                  </p>
                </div>
                <span>{result.reviewQueueItemsCreated.length} created</span>
              </div>

              {reviewOutcomes.length > 0 ? (
                <ol className="guided-review-outcome-list">
                  {reviewOutcomes.map((outcome) => (
                    <li key={outcome.reviewQueueItemId}>
                      <strong>{outcome.reason}</strong>
                      <p>{outcome.suggestedNextAction}</p>
                      {outcome.validationWarnings.length > 0 ? (
                        <small>
                          Warnings: {outcome.validationWarnings.join(", ")}
                        </small>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="guided-validation-empty-note">
                  No review outcomes were created for this run.
                </p>
              )}

              <div className="guided-review-action-row">
                <button onClick={onOpenReviewQueue} type="button">
                  Open Review Queue
                </button>

                <button
                  className="guided-step-primary-action"
                  onClick={onContinue}
                  type="button"
                >
                  Continue to Step 6
                </button>
              </div>
            </section>
          </>
        ) : (
          <p>Run Step 4 first so this step has workflow evidence to explain.</p>
        )}
      </section>
    </article>
  );
}
