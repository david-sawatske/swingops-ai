import type { FormEvent } from "react";

import type { ExecuteEndToEndAgenticTradeInDemoResponse } from "../../../types/workflow";

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

function getPriorReviewEvidence(
  result: ExecuteEndToEndAgenticTradeInDemoResponse | null,
) {
  return result?.priorReviewLearningEvidenceByItem.flatMap((item) => item.evidence) ?? [];
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
  const priorReviewEvidence = getPriorReviewEvidence(result);

  return (
    <article className="guided-workflow-card">
      <section className="guided-step-orientation">
        <span className="model-route-card__eyebrow">
          Step 3 · Guarded Agent Execution
        </span>
        <h3>How do AI-ready records become a guarded workflow run?</h3>
        <p>
          The structured records from Step 2 are converted into workflow input. The agent
          can then plan the run, route the model call, ground decisions with knowledge,
          use read-only internal tools, and preserve an audit trail for review.
        </p>

        <div className="guided-step-mini-list" aria-label="Guarded execution explanation">
          <article>
            <strong>Input</strong>
            <p>AI-ready records generated from the normalized source intake step.</p>
          </article>

          <article>
            <strong>Action</strong>
            <p>Run a controlled agent workflow with model routing, grounding, tools, and validation.</p>
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

        <div className="guided-guarded-systems-strip" aria-label="Systems touched by the guarded workflow">
          <article>
            <strong>Model router</strong>
            <span>Selects the model path for parsing and reasoning.</span>
          </article>
          <article>
            <strong>Knowledge base</strong>
            <span>Grounds product and trade-in policy decisions.</span>
          </article>
          <article>
            <strong>Read-only tools</strong>
            <span>Looks up inventory and valuation evidence safely.</span>
          </article>
          <article>
            <strong>Review gate</strong>
            <span>Escalates uncertain records before final approval.</span>
          </article>
        </div>

        <form className="agentic-demo-form guided-workflow-run-form guided-guarded-run-form" onSubmit={onRunWorkflow}>
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

          <div className="guided-guarded-action-row">
            {hasCompletedGuardedRun ? (
              <button
                className="guided-step-primary-action guided-guarded-continue-action"
                onClick={onContinue}
                type="button"
              >
                Continue to Validation and Review
              </button>
            ) : null}

            <button
              className={result ? "guided-guarded-rerun-action" : undefined}
              disabled={!canRunWorkflow}
              type="submit"
            >
              {isRunning
                ? "Running…"
                : result
                  ? "Rerun Guarded Workflow"
                  : "Run Guarded Workflow"}
            </button>
          </div>
        </form>

        {error ? <p className="guided-workflow-message guided-workflow-message--error">{error}</p> : null}

        {hasCompletedGuardedRun && result ? (
          <div className="guided-guarded-completion-strip">
            <strong>Workflow run completed</strong>
            <span>{result.finalSummary.parsedItemCount} parsed</span>
            <span>{result.finalSummary.knowledgeMatchCount} RAG matches</span>
            <span>{result.finalSummary.priorReviewEvidenceCount} prior review evidence</span>
            <span>{result.reviewQueueItemsCreated.length} review items</span>
            <span>{result.finalSummary.blockedMutationToolCallCount} blocked mutation(s)</span>
          </div>
        ) : success ? (
          <p className="guided-workflow-message guided-workflow-message--success">{success}</p>
        ) : null}

        {hasCompletedGuardedRun && result ? (
          <div className="guided-guarded-run-result">
            <div>
              <span className="model-route-card__eyebrow">Evidence created for Step 4</span>
              <h4>Guarded workflow evidence is ready</h4>
              <p>
                The guarded workflow produced the model, grounding, tool, validation, and
                safety evidence used by Validation and Human Review.
              </p>
            </div>

            {priorReviewEvidence.length > 0 ? (
              <div className="guided-final-review-callout">
                <strong>Prior review evidence found</strong>
                <p>{priorReviewEvidence[0]?.summary}</p>
                {priorReviewEvidence.length > 1 ? (
                  <p className="guided-validation-empty-note">
                    {priorReviewEvidence.length - 1} additional prior review evidence item(s) found.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="guided-guarded-result-grid">
              <article>
                <strong>{result.finalSummary.parsedItemCount}</strong>
                <span>parsed items</span>
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
          </div>
        ) : null}
      </section>
    </article>
  );
}
