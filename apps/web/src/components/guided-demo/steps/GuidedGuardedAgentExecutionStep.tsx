import type { FormEvent } from "react";

import type { ExecuteEndToEndAgenticTradeInDemoResponse } from "../../../types/workflow";
import {
  formatCostEstimate,
  formatFieldRepairValue,
  formatLatencyMs,
  formatProvider,
  getModelExecutionValidationLabel,
} from "./final-run-report/finalRunReportUtils";

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
  const fieldRepairSuggestions = result?.fieldRepairExecution.suggestions ?? [];

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
              <span>Field repair</span>
            </div>
            <div className="guided-guarded-system-details">
              <p>
                <b>Implemented here:</b> Routes permitted field-repair work through the
                configured provider, validates the response contract, and records
                deterministic fallback evidence.
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
                The guarded workflow kept knowledge, inventory, valuation, model-repair,
                validation, and reviewer-facing evidence separate for Validation and
                Human Review.
              </p>
            </div>

            <section className="guided-model-execution-card" aria-label="Model execution summary">
              <div className="guided-model-execution-card__header">
                <div>
                  <span className="model-route-card__eyebrow">Model execution</span>
                  <h5>{formatProvider(result.providerFallbackTrace.finalProvider, result.providerFallbackTrace.finalModel)}</h5>
                  <p>
                    Field repair ran through the provider execution layer. Suggestions are
                    review-facing and do not override deterministic parsing on their own.
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
                  <dt>Field repair suggestions</dt>
                  <dd>{fieldRepairSuggestions.length}</dd>
                </div>
              </dl>

              {fieldRepairSuggestions.length > 0 ? (
                <ol className="guided-field-repair-suggestion-list">
                  {fieldRepairSuggestions.slice(0, 3).map((suggestion, index) => (
                    <li key={`${suggestion.recordId ?? "record"}-${suggestion.fieldName}-${suggestion.sourcePhrase}-${index}`}>
                      <strong>
                        {suggestion.fieldName}: {formatFieldRepairValue(suggestion.candidateValue)}
                      </strong>
                      <p>
                        Source phrase “{suggestion.sourcePhrase}” · confidence{" "}
                        {Math.round(suggestion.confidence * 100)}% ·{" "}
                        {suggestion.reviewRequired ? "review required" : "review optional"}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="guided-validation-empty-note">
                  Deterministic parsing and system evidence were sufficient for this run, so no model repair suggestions were added.
                </p>
              )}
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
