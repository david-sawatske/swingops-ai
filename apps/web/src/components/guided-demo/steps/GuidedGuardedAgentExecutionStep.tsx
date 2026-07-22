import type { FormEvent } from "react";

import {
  AGENTIC_TRADE_IN_DEMO_MAX_INPUT_CHARACTERS,
  type ExecuteEndToEndAgenticTradeInDemoResponse,
} from "../../../types/workflow";
import {
  formatCostEstimate,
  formatLatencyMs,
  formatProvider,
  getModelExecutionValidationLabel,
  getProviderAttemptLabel,
} from "./final-run-report/finalRunReportUtils";
import { GuidedModelReviewAssistance } from "./GuidedModelReviewAssistance";

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
  return (
    result?.priorReviewLearningSuggestionsByItem.flatMap(
      (item) => item.suggestions,
    ) ?? []
  );
}

export function getModelAssistanceScopeNotice(
  scope: ExecuteEndToEndAgenticTradeInDemoResponse["modelAssistanceScope"],
) {
  if (!scope || scope.deferredRecordCount === 0) {
    return null;
  }

  return `${scope.selectedRecordCount} of ${scope.eligibleRecordCount} eligible records were included in this bounded model request. The remaining ${scope.deferredRecordCount} stayed in deterministic processing and were routed to human review.`;
}

const SUCCESSFUL_PROVIDER_ATTEMPT_STATUSES = new Set(["SUCCESS", "SUCCEEDED"]);

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
      (attempt) => !SUCCESSFUL_PROVIDER_ATTEMPT_STATUSES.has(attempt.status),
    ) ??
    null;
  const finalAttempt = trace.attempts.at(-1) ?? null;
  const preferredProvider = formatProvider(
    unsuccessfulAttempt?.provider ?? trace.selectedProvider,
    unsuccessfulAttempt?.model ?? trace.selectedModel,
  );
  const finalProvider = formatProvider(trace.finalProvider, trace.finalModel);
  const simulationRequested = trace.simulationRequested;

  return {
    title: simulationRequested
      ? "Fallback test passed"
      : "Automatic fallback completed this run",
    summary: simulationRequested
      ? `A simulated service error prevented ${preferredProvider} from completing. ${finalProvider} completed the model review assistance.`
      : `${preferredProvider} did not complete successfully. ${finalProvider} completed the model review assistance.`,
    statusLabel: simulationRequested
      ? "Simulated outage"
      : "Automatic recovery",
    preferredProvider,
    preferredStatus: unsuccessfulAttempt
      ? getProviderAttemptLabel(unsuccessfulAttempt.status)
      : "not completed",
    reason:
      unsuccessfulAttempt?.errorMessage ??
      unsuccessfulAttempt?.reason ??
      "The preferred provider did not complete successfully.",
    preferredLatencyMs: unsuccessfulAttempt?.latencyMs ?? null,
    attemptDeadlineMs: unsuccessfulAttempt?.timeoutMs ?? null,
    failureClass: unsuccessfulAttempt?.failureClass ?? "UNKNOWN",
    retryable: unsuccessfulAttempt?.retryable ?? false,
    finalProvider,
    finalStatus: finalAttempt
      ? getProviderAttemptLabel(finalAttempt.status)
      : "completed",
    validationLabel: getModelExecutionValidationLabel(fieldRepairExecution),
  };
}

export function getOrchestrationSummary(
  trace: ExecuteEndToEndAgenticTradeInDemoResponse["orchestrationTrace"],
) {
  return {
    stateCount: trace.states.length,
    completedStateCount: trace.states.filter(
      (state) => state.status === "COMPLETED" || state.status === "SKIPPED",
    ).length,
    modelAssistedStateCount: trace.states.filter(
      (state) => state.executionKind === "BOUNDED_MODEL_ASSISTANCE",
    ).length,
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
  const finalProviderAttempt =
    result?.providerFallbackTrace.attempts.at(-1) ?? null;
  const fieldRepairOutcomes = result?.fieldRepairExecution.recordOutcomes ?? [];
  const fallbackNotice = result
    ? getProviderFallbackNotice(
        result.providerFallbackTrace,
        result.fieldRepairExecution,
      )
    : null;
  const modelAssistanceScopeNotice = result
    ? getModelAssistanceScopeNotice(result.modelAssistanceScope)
    : null;
  const orchestrationSummary = result
    ? getOrchestrationSummary(result.orchestrationTrace)
    : null;

  return (
    <article className="guided-workflow-card">
      <section className="guided-step-orientation">
        <span className="model-route-card__eyebrow">
          Step 3 · Guarded Workflow Execution
        </span>
        <h3>How do AI-ready records become a guarded workflow run?</h3>
        <p>
          The structured records from Step 2 are converted into workflow input.
          The application-controlled state machine advances through a fixed
          sequence, gathers separate knowledge, inventory, and valuation
          evidence, routes only permitted repair work through the model layer,
          and preserves an audit trail for review.
        </p>

        <div
          className="guided-step-mini-list"
          aria-label="Guarded execution explanation"
        >
          <article>
            <strong>Input</strong>
            <p>
              AI-ready records generated from the normalized source intake step.
            </p>
          </article>

          <article>
            <strong>Action</strong>
            <p>
              Gather distinct knowledge, inventory, valuation, model-repair, and
              validation evidence.
            </p>
          </article>

          <article>
            <strong>Output</strong>
            <p>
              Workflow evidence for Step 4, including tool activity, review
              routing, and run trace data.
            </p>
          </article>
        </div>

        <details className="guided-workflow-details guided-workflow-details--compact">
          <summary>Why is this step guarded?</summary>
          <p className="guided-workflow-details__intro">
            Application code owns every state transition and tool-policy
            decision. The model can return bounded repair advice, but it cannot
            choose the next state, execute tools, write final records, or
            approve review work.
          </p>
        </details>
      </section>

      <section className="guided-step-workspace">
        <div className="guided-step-workspace__header">
          <div>
            <span className="model-route-card__eyebrow">Do the work</span>
            <h4>Run the guarded trade-in workflow</h4>
            <p>
              Inspect the generated handoff text, then run the workflow. The
              result becomes the evidence package used by validation and review
              in Step 4.
            </p>
          </div>
        </div>

        <div
          className="guided-guarded-systems-strip"
          aria-label="System contributions in the guarded workflow"
        >
          <article>
            <div className="guided-guarded-system-heading">
              <strong>Bounded model assistance</strong>
              <span>Advisory only</span>
            </div>
            <div className="guided-guarded-system-details">
              <p>
                <b>Implemented here:</b> Sends only selected records and their
                evidence packet through the configured provider. The response
                must return one schema-validated advisory outcome for every
                selected record; application code retains transition, tool,
                persistence, and review authority.
              </p>
              <p>
                <b>Production connection:</b> Approved provider credentials,
                execution policies, budgets, and model configurations.
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
                <b>Implemented here:</b> Retrieves terminology and
                product-family evidence from locally seeded reference documents.
              </p>
              <p>
                <b>Production connection:</b> Authorized internal product
                knowledge, catalog reference data, or another approved knowledge
                service.
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
                <b>Implemented here:</b> Matches normalized records against a
                read-only seeded catalog and returns product-identity evidence.
                It does not represent live inventory quantities.
              </p>
              <p>
                <b>Production connection:</b> A retailer product catalog,
                inventory database, PIM, or ERP.
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
                <b>Implemented here:</b> Produces estimated trade-in ranges
                using seeded values and deterministic condition adjustments
                after product identification.
              </p>
              <p>
                <b>Production connection:</b> An authorized valuation guide,
                internal pricing service, or historical transaction data.
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
                <b>Implemented here:</b> Applies deterministic validation,
                retry, and review-routing rules. Saved human corrections remain
                authoritative.
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
          <label
            className="guided-guarded-input-label"
            htmlFor="guided-guarded-workflow-input"
          >
            Generated workflow input
          </label>
          <p className="guided-guarded-input-help">
            This handoff text is generated from the AI-ready records in Step 2.
            It preserves missing-field and review signals so the guarded
            workflow can route them correctly.
          </p>

          <textarea
            id="guided-guarded-workflow-input"
            maxLength={AGENTIC_TRADE_IN_DEMO_MAX_INPUT_CHARACTERS}
            onChange={(event) => onRawInputChange(event.target.value)}
            rows={7}
            value={workflowInput}
          />

          <label className="guided-provider-fallback-control">
            <input name="demonstrateProviderFallback" type="checkbox" />
            <span>
              <strong>Test fallback on the next run</strong>
              <small>
                Optional: simulate a service error from the first model
                provider. The workflow should continue with a backup, and the
                completed run will be labeled as a simulation. No live provider
                request is made for this test.
              </small>
            </span>
          </label>
        </form>

        {error ? (
          <p className="guided-workflow-message guided-workflow-message--error">
            {error}
          </p>
        ) : null}

        {hasCompletedGuardedRun && result ? (
          <div className="guided-guarded-completion-strip">
            <strong>Workflow run completed</strong>
            <span>Evidence package ready for validation and review</span>
          </div>
        ) : success ? (
          <p className="guided-workflow-message guided-workflow-message--success">
            {success}
          </p>
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
              <span className="model-route-card__eyebrow">
                Evidence created for Step 4
              </span>
              <h4>Guarded workflow evidence is ready</h4>
              <p>
                The guarded workflow kept knowledge, inventory, valuation, model
                review assistance, validation, and reviewer-facing evidence
                separate for Validation and Human Review.
              </p>
            </div>

            {orchestrationSummary ? (
              <section
                aria-label="Deterministic workflow orchestration"
                className="guided-orchestration-card"
              >
                <div className="guided-orchestration-card__header">
                  <div>
                    <span className="model-route-card__eyebrow">
                      Deterministic orchestration
                    </span>
                    <h5>Application-controlled state machine</h5>
                    <p>{result.orchestrationTrace.description}</p>
                  </div>
                  <span className="guided-validation-status guided-validation-status--pass">
                    Transitions enforced
                  </span>
                </div>

                <dl className="guided-orchestration-metrics">
                  <div>
                    <dt>Persisted states</dt>
                    <dd>{orchestrationSummary.stateCount}</dd>
                  </div>
                  <div>
                    <dt>Terminal states</dt>
                    <dd>{orchestrationSummary.completedStateCount}</dd>
                  </div>
                  <div>
                    <dt>Model-assisted</dt>
                    <dd>{orchestrationSummary.modelAssistedStateCount}</dd>
                  </div>
                  <div>
                    <dt>Transition owner</dt>
                    <dd>Application code</dd>
                  </div>
                </dl>

                <details className="guided-orchestration-details">
                  <summary>
                    View persisted state sequence and model boundary
                  </summary>
                  <ol className="guided-orchestration-state-list">
                    {result.orchestrationTrace.states.map((state) => (
                      <li key={state.stateId}>
                        <span>{state.orderIndex}</span>
                        <div>
                          <strong>{state.label}</strong>
                          <p>{state.transitionGuard}</p>
                        </div>
                        <small>
                          {state.executionKind === "BOUNDED_MODEL_ASSISTANCE"
                            ? "Advisory model assistance"
                            : "Deterministic application logic"}
                          {" · "}
                          {state.status.toLowerCase()}
                        </small>
                      </li>
                    ))}
                  </ol>

                  <div className="guided-orchestration-boundary">
                    <strong>The model cannot</strong>
                    <p>
                      {result.orchestrationTrace.modelBoundary.prohibitedActions.join(
                        " ",
                      )}
                    </p>
                  </div>
                </details>
              </section>
            ) : null}

            <section
              className="guided-model-execution-card"
              aria-label="Model execution summary"
            >
              <div className="guided-model-execution-card__header">
                <div>
                  <span className="model-route-card__eyebrow">
                    Model review assistance
                  </span>
                  <h5>
                    {formatProvider(
                      result.providerFallbackTrace.finalProvider,
                      result.providerFallbackTrace.finalModel,
                    )}
                  </h5>
                  <p>
                    The provider assessed only selected records using the
                    supplied evidence packet. Repair suggestions, candidate
                    comparisons, and decisions to withhold unsafe repairs remain
                    advisory until human review.
                  </p>
                </div>
                <span className="guided-validation-status guided-validation-status--pass">
                  {getModelExecutionValidationLabel(
                    result.fieldRepairExecution,
                  )}
                </span>
              </div>

              <dl className="guided-model-execution-metrics">
                <div>
                  <dt>Fallback</dt>
                  <dd>
                    {result.providerFallbackTrace.fallbackUsed
                      ? result.providerFallbackTrace.simulationRequested
                        ? "Used · simulated"
                        : "Used · automatic"
                      : "Not used"}
                  </dd>
                </div>
                <div>
                  <dt>Latency</dt>
                  <dd>
                    {formatLatencyMs(finalProviderAttempt?.latencyMs ?? null)}
                  </dd>
                </div>
                <div>
                  <dt>Est. cost</dt>
                  <dd>
                    {formatCostEstimate(
                      finalProviderAttempt?.estimatedCostUsd ?? null,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Records assessed</dt>
                  <dd>{fieldRepairOutcomes.length}</dd>
                </div>
              </dl>

              {modelAssistanceScopeNotice ? (
                <p className="guided-model-assistance-scope-notice">
                  <strong>Demo-scale model boundary:</strong>{" "}
                  {modelAssistanceScopeNotice}
                </p>
              ) : null}

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
                      {fallbackNotice.statusLabel}
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
                        <dt>Failure class</dt>
                        <dd>
                          {fallbackNotice.failureClass} ·{" "}
                          {fallbackNotice.retryable
                            ? "eligible for fallback"
                            : "not retryable"}
                        </dd>
                      </div>
                      <div>
                        <dt>Preferred latency</dt>
                        <dd>
                          {formatLatencyMs(fallbackNotice.preferredLatencyMs)}
                        </dd>
                      </div>
                      <div>
                        <dt>Attempt deadline</dt>
                        <dd>
                          {formatLatencyMs(fallbackNotice.attemptDeadlineMs)}
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

              <GuidedModelReviewAssistance outcomes={fieldRepairOutcomes} />
            </section>

            {priorReviewSuggestions.length > 0 ? (
              <div className="guided-final-review-callout">
                <strong>Prior review suggestion surfaced</strong>
                <p>{priorReviewSuggestions[0]?.summary}</p>
                {priorReviewSuggestions.length > 1 ? (
                  <p className="guided-validation-empty-note">
                    {priorReviewSuggestions.length - 1} additional prior review
                    suggestion(s) surfaced.
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
                <strong>
                  {result.finalSummary.successfulReadOnlyToolCallCount}
                </strong>
                <span>read-only calls</span>
              </article>
              <article>
                <strong>{result.reviewQueueItemsCreated.length}</strong>
                <span>review items</span>
              </article>
              <article>
                <strong>
                  {result.finalSummary.blockedMutationToolCallCount}
                </strong>
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
