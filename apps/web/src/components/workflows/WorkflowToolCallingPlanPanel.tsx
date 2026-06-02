import type { ExecuteWorkflowToolCallingPlanResponse } from "../../types/workflow";
import { formatConnectorJson, formatShortId } from "../../utils/formatting";

export function WorkflowToolCallingPlanPanel({
  workflowRunId,
  result,
  isRunning,
  error,
  success,
  onRun,
}: {
  workflowRunId: string;
  result: ExecuteWorkflowToolCallingPlanResponse | null;
  isRunning: boolean;
  error: string | null;
  success: string | null;
  onRun: (workflowRunId: string) => void;
}) {
  return (
    <section className="workflow-tool-calling-plan">
      <div className="workflow-tool-calling-plan__header">
        <div>
          <h5>Tool-Calling Plan</h5>
          <p>
            Deterministic agent plan → policy check → safe read-only execution → persisted ToolCallLog audit records.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRun(workflowRunId)}
          disabled={isRunning}
        >
          {isRunning ? "Running Plan…" : "Run Tool-Calling Plan"}
        </button>
      </div>

      {error ? (
        <p className="form-message form-message--error">{error}</p>
      ) : null}

      {success ? (
        <p className="form-message form-message--success">{success}</p>
      ) : null}

      {result ? (
        <div className="workflow-tool-calling-plan__result">
          <dl className="workflow-tool-calling-plan__metadata">
            <div>
              <dt>Plan</dt>
              <dd>{formatShortId(result.plan.planId)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{result.plan.status}</dd>
            </div>
            <div>
              <dt>Planner</dt>
              <dd>{result.executionMetadata.planner}</dd>
            </div>
            <div>
              <dt>Mutation tools</dt>
              <dd>{result.executionMetadata.mutationToolsEnabled ? "Enabled" : "Disabled"}</dd>
            </div>
          </dl>

          <div className="workflow-tool-calling-plan__steps">
            {result.results.map((toolResult) => (
              <article
                className={
                  toolResult.status === "SUCCEEDED"
                    ? "workflow-tool-calling-plan-card workflow-tool-calling-plan-card--success"
                    : "workflow-tool-calling-plan-card workflow-tool-calling-plan-card--blocked"
                }
                key={toolResult.planCallId}
              >
                <div className="workflow-tool-calling-plan-card__header">
                  <div>
                    <strong>
                      {toolResult.orderIndex}. {toolResult.toolName}
                    </strong>
                    <p>{toolResult.reason}</p>
                  </div>
                  <span>{toolResult.status}</span>
                </div>

                <dl className="workflow-tool-calling-plan-card__metadata">
                  <div>
                    <dt>Policy</dt>
                    <dd>{toolResult.policyDecision}</dd>
                  </div>
                  <div>
                    <dt>Reason Codes</dt>
                    <dd>{toolResult.policyReasonCodes.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Execution Attempted</dt>
                    <dd>{toolResult.executionAttempted ? "true" : "false"}</dd>
                  </div>
                  <div>
                    <dt>ToolCallLog</dt>
                    <dd>{formatShortId(toolResult.toolCallLogId)}</dd>
                  </div>
                  <div>
                    <dt>Expected Risk</dt>
                    <dd>{toolResult.expectedRiskLevel}</dd>
                  </div>
                  <div>
                    <dt>Mutates Data</dt>
                    <dd>{toolResult.expectedMutatesData ? "true" : "false"}</dd>
                  </div>
                </dl>

                <p className="workflow-tool-calling-plan-card__reason">
                  {toolResult.failurePreview ?? toolResult.policyReason}
                </p>

                <details className="workflow-tool-calling-plan-card__preview">
                  <summary>Connector result / failure preview</summary>
                  <pre>
                    {formatConnectorJson(
                      toolResult.connectorResultPreview ?? toolResult.failurePreview,
                    )}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <p className="workflow-tool-calling-plan__empty">
          No tool-calling plan has been run for this selected workflow run in the current UI session.
        </p>
      )}
    </section>
  );
}
