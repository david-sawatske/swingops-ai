import type { FormEvent } from "react";

import type { ExecuteEndToEndAgenticTradeInDemoResponse } from "../../../types/workflow";
import {
  formatCostEstimate,
  formatLatencyMs,
  formatProvider,
  getModelExecutionValidationLabel,
  getProviderAttemptLabel,
} from "./final-run-report/finalRunReportUtils";
import {
  GuidedModelReviewAssistance,
} from "./GuidedModelReviewAssistance";

type GuidedGuardedAgentExecutionStepProps = {
  error: string | null;
  generatedWorkflowInput: string;
  isRunning: boolean;
  onContinue: () => void;
  onRawInputChange: (value: string) => void;
  onRunWorkflow: (event: FormEvent<HTMLFormElement>) => void;
  rawInput: string;
  result: ExecuteEndToEndAgenticTradeInDemoResponse | null;
  success: string | null;
};

function getWorkflowInput(rawInput: string, generatedWorkflowInput: string) {
  return rawInput || generatedWorkflowInput;
}

function getPriorReviewSuggestions(
  result: ExecuteEndToEndAgenticTradeInDemoResponse | null,
) {
  return result?.priorReviewLearningSuggestionsByItem.flatMap((item) => item.suggestions) ?? [];
}

const SUCCESSFUL_PROVIDER_ATTEMPT_STATUSES = new Set([
  "SUCCESS",
  "SUCCEEDED",
]);

export function getProviderFallbackNotice(
  trace: ExecuteEndToEndAgenticTradeInDemoResponse["providerFallbackTrace"],
  fieldRepairExecution: ExecuteEndToEndAgenticTradeInDemoResponse["fieldRepairExecution"],
) {
  if (!trace.fallbackUsed) {
    return null;
  }

  const unsuccessfulAttempt =
    trace.attempts.find(
      (attempt, index) =>
        index < trace.attempts.length - 1 &&
        !SUCCESSFUL_PROVIDER_ATTEMPT_STATUSES.has(attempt.status),
    ) ??
    trace.attempts.find(
      (attempt) =>
        !SUCCESSFUL_PROVIDER_ATTEMPT_STATUSES.has(attempt.status),
    ) ??
    null;
  const finalAttempt = trace.attempts.at(-1) ?? null;
  const preferredProvider = formatProvider(
    unsuccessfulAttempt?.provider ?? trace.selectedProvider,
    unsuccessfulAttempt?.model ?? trace.selectedModel,
  );
  const finalProvider = formatProvider(
    trace.finalProvider,
    trace.finalModel,
  );

  return {
    title: "Provider fallback completed this run",
    summary: `${preferredProvider} did not complete successfully. ${finalProvider} completed the model review assistance.`,
    preferredProvider,
    preferredStatus: unsuccessfulAttempt
      ? getProviderAttemptLabel(unsuccessfulAttempt.status)
      : "not completed",
    reason:
      unsuccessfulAttempt?.errorMessage ??
      unsuccessfulAttempt?.reason ??
      "The preferred provider did not complete successfully.",
    preferredLatencyMs: unsuccessfulAttempt?.latencyMs ?? null,
    finalProvider,
    finalStatus: finalAttempt
      ? getProviderAttemptLabel(finalAttempt.status)
      : "completed",
    validationLabel:
      getModelExecutionValidationLabel(fieldRepairExecution),
  };
}

export function GuidedGuardedAgentExecutionStep({
  error,
  generatedWorkflowInput,
  isRunning,
  onContinue,
  onRawInputChange,
  onRunWorkflow,
  rawInput,
  result,
  success,
}: GuidedGuardedAgentExecutionStepProps) {
  const workflowInput = getWorkflowInput(rawInput, generatedWorkflowInput);
  const canRunWorkflow = workflowInput.trim().length > 0 && !isRunning;
  const hasCompletedGuardedRun = Boolean(result) && !isRunning;
  const priorReviewSuggestions = getPriorReviewSuggestions(result);
  const finalProviderAttempt = result?.providerFallbackTrace.attempts.at(-1) ?? null;
  const fieldRepairOutcomes =
    result?.fieldRepairExecution.recordOutcomes ?? [];
  const fallbackNotice = result
    ? getProviderFallbackNotice(
        result.providerFallbackTrace,
        result.fieldRepairExecution,
      )
    : null;

  return (
    <article className="guided-workflow-card">
      <section className="guided-step-orientation">
        <span className="model-route-card__eyebrow">
          Step 3 · Guarded Agent Execution
        </span>
        <h3>How do AI-ready records become a guarded workflow run?</h3>
        <p>
          The structured records from Step 2 are converted into workflow input. The
          workflow then plans the run, gathers separate knowledge, inventory, and
          valuation evidence, routes only permitted repair work through the model
          execution layer, and preserves an audit trail for review.
        </p>

        <div className="guided-step-mini-list" aria-label="Guarded execution explanation">
          <article>
            <strong>Input</strong>
            <p>AI-ready records generated from the normalized source intake step.</p>
          </article>

          <article>
            <strong>Action</strong>
            <p>Gather distinct knowledge, inventory, valuation, model-repair, and validation evidence.</p>
          </article>

          <article>
            <strong>Output</strong>
            <p>Workflow evidence for Step 4, including tool activity, review routing, and run trace data.</p>
          </article>
        </div>

        <details className="guided-workflow-details guided-workflow-details--compact">
          <summary>Why is this step guarded?</summary>
          <p className="guided-workflow-details__intro">
            The workflow is allowed to gather evidence and call read-only tools, but unsafe
            mutations are blocked or routed through review. This keeps automation useful
            without hiding risk.
          </p>
        </details>
      </section>

      <section className="guided-step-workspace">
        <div className="guided-step-workspace__header">
          <div>
            <span className="model-route-card__eyebrow">Do the work</span>
            <h4>Run the guarded trade-in workflow</h4>
            <p>
              Inspect the generated handoff text, then run the workflow. The result becomes
              the evidence package used by validation and review in Step 4.
            </p>
          </div>
        </div>

        <div
          className="guided-guarded-systems-strip"
          aria-label="System contributions in the guarded workflow"
        >
          <article>
            <div className="guided-guarded-system-heading">
              <strong>Model execution layer</strong>
              <span>Review assistance</span>
            </div>
            <div className="guided-guarded-system-details">
              <p>
                <b>Implemented here:</b> Sends only selected records and their evidence
                packet through the configured provider. The response must return one
                validated advisory outcome for every selected record.
              </p>
              <p>
                <b>Production connection:</b> Approved provider credentials, execution
                policies, budgets, and model configurations.
              </p>
            </div>
          </article>

          <article>
            <div className="guided-guarded-system-heading">
              <strong>Seeded knowledge service</strong>
              <span>Reference context</span>
            </div>
            <div className="guided-guarded-system-details">
              <p>
                <b>Implemented here:</b> Retrieves terminology and product-family evidence
                from locally seeded reference documents.
              </p>
              <p>
                <b>Production connection:</b> Authorized internal product knowledge,
                catalog reference data, or another approved knowledge service.
              </p>
            </div>
          </article>

          <article>
            <div className="guided-guarded-system-heading">
              <strong>Seeded product catalog</strong>
              <span>Product matching</span>
            </div>
            <div className="guided-guarded-system-details">
              <p>
                <b>Implemented here:</b> Matches normalized records against a read-only
                seeded catalog and returns product-identity evidence. It does not
                represent live inventory quantities.
              </p>
              <p>
                <b>Production connection:</b> A retailer product catalog, inventory
                database, PIM, or ERP.
              </p>
            </div>
          </article>

          <article>
            <div className="guided-guarded-system-heading">
              <strong>Seeded valuation engine</strong>
              <span>Trade-in range</span>
            </div>
            <div className="guided-guarded-system-details">
              <p>
                <b>Implemented here:</b> Produces estimated trade-in ranges using seeded
                values and deterministic condition adjustments after product
                identification.
              </p>
              <p>
                <b>Production connection:</b> An authorized valuation guide, internal
                pricing service, or historical transaction data.
              </p>
            </div>
          </article>

          <article>
            <div className="guided-guarded-system-heading">
              <strong>Validation and human review controls</strong>
              <span>Final authority</span>
            </div>
            <div className="guided-guarded-system-details">
              <p>
                <b>Implemented here:</b> Applies deterministic validation, retry, and
                review-routing rules. Saved human corrections remain authoritative.
              </p>
              <p>
                <b>Production connection:</b> A broader operational approval,
                exception-management, or case-management workflow.
              </p>
            </div>
          </article>
        </div>

        <form
          className="agentic-demo-form guided-workflow-run-form guided-guarded-run-form"
          id="guided-guarded-workflow-run-form"
          onSubmit={onRunWorkflow}
        >
          <label className="guided-guarded-input-label" htmlFor="guided-guarded-workflow-input">
            Generated workflow input
          </label>
          <p className="guided-guarded-input-help">
            This handoff text is generated from the AI-ready records in Step 2. It
            preserves missing-field and review signals so the guarded workflow can route
            them correctly.
          </p>

          <textarea
            id="guided-guarded-workflow-input"
            onChange={(event) => onRawInputChange(event.target.value)}
            rows={7}
            value={workflowInput}
          />
        </form>

        {error ? <p className="guided-workflow-message guided-workflow-message--error">{error}</p> : null}

        {hasCompletedGuardedRun && result ? (
          <div className="guided-guarded-completion-strip">
            <strong>Workflow run completed</strong>
            <span>Evidence package ready for validation and review</span>
          </div>
        ) : success ? (
          <p className="guided-workflow-message guided-workflow-message--success">{success}</p>
        ) : null}

        {!hasCompletedGuardedRun ? (
          <div className="guided-guarded-action-row">
            <button
              disabled={!canRunWorkflow}
              form="guided-guarded-workflow-run-form"
              type="submit"
            >
              {isRunning ? "Running…" : "Run Guarded Workflow"}
            </button>
          </div>
        ) : null}

        {hasCompletedGuardedRun && result ? (
          <div className="guided-guarded-run-result">
            <div>
              <span className="model-route-card__eyebrow">Evidence created for Step 4</span>
              <h4>Guarded workflow evidence is ready</h4>
              <p>
                The guarded workflow kept knowledge, inventory, valuation, model review
                assistance, validation, and reviewer-facing evidence separate for
                Validation and Human Review.
              </p>
            </div>

            <section className="guided-model-execution-card" aria-label="Model execution summary">
              <div className="guided-model-execution-card__header">
                <div>
                  <span className="model-route-card__eyebrow">
                    Model review assistance
                  </span>
                  <h5>{formatProvider(result.providerFallbackTrace.finalProvider, result.providerFallbackTrace.finalModel)}</h5>
                  <p>
                    The provider assessed only selected records using the supplied evidence
                    packet. Repair suggestions, candidate comparisons, and decisions to
                    withhold unsafe repairs remain advisory until human review.
                  </p>
                </div>
                <span className="guided-validation-status guided-validation-status--pass">
                  {getModelExecutionValidationLabel(result.fieldRepairExecution)}
                </span>
              </div>

              <dl className="guided-model-execution-metrics">
                <div>
                  <dt>Fallback</dt>
                  <dd>{result.providerFallbackTrace.fallbackUsed ? "Used" : "Not used"}</dd>
                </div>
                <div>
                  <dt>Latency</dt>
                  <dd>{formatLatencyMs(finalProviderAttempt?.latencyMs ?? null)}</dd>
                </div>
                <div>
                  <dt>Est. cost</dt>
                  <dd>{formatCostEstimate(finalProviderAttempt?.estimatedCostUsd ?? null)}</dd>
                </div>
                <div>
                  <dt>Records assessed</dt>
                  <dd>{fieldRepairOutcomes.length}</dd>
                </div>
              </dl>

              {fallbackNotice ? (
                <section
                  aria-label="Provider fallback details"
                  className="guided-model-fallback-notice"
                >
                  <div className="guided-model-fallback-notice__header">
                    <div>
                      <span className="model-route-card__eyebrow">
                        Provider fallback
                      </span>
                      <strong>{fallbackNotice.title}</strong>
                      <p>{fallbackNotice.summary}</p>
                    </div>
                    <span className="guided-validation-status guided-validation-status--warning">
                      Fallback used
                    </span>
                  </div>

                  <details className="guided-model-fallback-notice__details">
                    <summary>View provider attempt details</summary>
                    <dl>
                      <div>
                        <dt>Preferred attempt</dt>
                        <dd>
                          {fallbackNotice.preferredProvider} ·{" "}
                          {fallbackNotice.preferredStatus}
                        </dd>
                      </div>
                      <div>
                        <dt>Failure detail</dt>
                        <dd>{fallbackNotice.reason}</dd>
                      </div>
                      <div>
                        <dt>Preferred latency</dt>
                        <dd>
                          {formatLatencyMs(
                            fallbackNotice.preferredLatencyMs,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Final provider</dt>
                        <dd>
                          {fallbackNotice.finalProvider} ·{" "}
                          {fallbackNotice.finalStatus}
                        </dd>
                      </div>
                      <div>
                        <dt>Accepted output</dt>
                        <dd>{fallbackNotice.validationLabel}</dd>
                      </div>
                    </dl>
                  </details>
                </section>
              ) : null}

              <GuidedModelReviewAssistance
                outcomes={fieldRepairOutcomes}
              />
            </section>

            {priorReviewSuggestions.length > 0 ? (
              <div className="guided-final-review-callout">
                <strong>Prior review suggestion surfaced</strong>
                <p>{priorReviewSuggestions[0]?.summary}</p>
                {priorReviewSuggestions.length > 1 ? (
                  <p className="guided-validation-empty-note">
                    {priorReviewSuggestions.length - 1} additional prior review suggestion(s) surfaced.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="guided-guarded-result-grid">
              <article>
                <strong>{result.finalSummary.parsedItemCount}</strong>
                <span>validated records</span>
              </article>
              <article>
                <strong>{result.finalSummary.successfulReadOnlyToolCallCount}</strong>
                <span>read-only calls</span>
              </article>
              <article>
                <strong>{result.reviewQueueItemsCreated.length}</strong>
                <span>review items</span>
              </article>
              <article>
                <strong>{result.finalSummary.blockedMutationToolCallCount}</strong>
                <span>blocked mutations</span>
              </article>
            </div>

            <div className="guided-guarded-action-row guided-guarded-action-row--after-evidence">
              <button
                className="guided-step-primary-action guided-guarded-continue-action"
                onClick={onContinue}
                type="button"
              >
                Continue to Validation and Review
              </button>

              <button
                className="guided-guarded-rerun-action"
                disabled={!canRunWorkflow}
                form="guided-guarded-workflow-run-form"
                type="submit"
              >
                {isRunning ? "Running…" : "Rerun Guarded Workflow"}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </article>
  );
}
