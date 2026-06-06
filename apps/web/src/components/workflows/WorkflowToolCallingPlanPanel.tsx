import type {
  ExecuteWorkflowToolCallingPlanResponse,
  ToolCallLog,
} from "../../types/workflow";
import { formatConnectorJson, formatShortId } from "../../utils/formatting";

type PersistedToolAuditReplayItem = {
  id: string;
  toolName: string;
  status: "SUCCEEDED" | "FAILED" | "BLOCKED" | string;
  policyDecision: string;
  policyReasonCodes: string[];
  executionAttempted: boolean;
  requestedBy: string | null;
  resultPreview: unknown | null;
  failurePreview: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getConnectorResult(outputJson: unknown): unknown | null {
  if (!isRecord(outputJson)) {
    return null;
  }

  const connectorResult = outputJson.connectorResult;

  if (isRecord(connectorResult) && "data" in connectorResult) {
    return connectorResult.data;
  }

  return connectorResult ?? null;
}

function isPersistedToolPlanReplayLog(log: ToolCallLog): boolean {
  const outputJson = isRecord(log.outputJson) ? log.outputJson : {};
  const requestedBy =
    typeof outputJson.requestedBy === "string" ? outputJson.requestedBy : "";

  return (
    outputJson.connectorInvocation === true ||
    log.toolName.startsWith("swingops.") ||
    requestedBy.startsWith("agent.workflow-tool-calling-plan")
  );
}

function toPersistedReplayItem(log: ToolCallLog): PersistedToolAuditReplayItem {
  const outputJson = isRecord(log.outputJson) ? log.outputJson : {};
  const executionAttempted =
    typeof outputJson.executionAttempted === "boolean"
      ? outputJson.executionAttempted
      : log.status === "SUCCEEDED";
  const policyDecision =
    typeof outputJson.policyDecision === "string"
      ? outputJson.policyDecision
      : log.status === "SUCCEEDED"
        ? "ALLOW"
        : "UNKNOWN";
  const policyReasonCodes = getStringArray(outputJson.policyReasonCodes);
  const requestedBy =
    typeof outputJson.requestedBy === "string" ? outputJson.requestedBy : null;
  const failureReason =
    typeof outputJson.failureReason === "string"
      ? outputJson.failureReason
      : log.errorMessage;

  return {
    id: log.id,
    toolName: log.toolName,
    status:
      !executionAttempted && log.status === "FAILED" ? "BLOCKED" : log.status,
    policyDecision,
    policyReasonCodes,
    executionAttempted,
    requestedBy,
    resultPreview: getConnectorResult(log.outputJson),
    failurePreview: failureReason,
  };
}

function getPersistedReplayStatus(
  items: PersistedToolAuditReplayItem[],
): "EXECUTED" | "PARTIALLY_EXECUTED" | "FAILED" | "BLOCKED" {
  const succeededCount = items.filter((item) => item.status === "SUCCEEDED").length;
  const blockedCount = items.filter((item) => item.status === "BLOCKED").length;

  if (succeededCount === items.length) {
    return "EXECUTED";
  }

  if (blockedCount === items.length) {
    return "BLOCKED";
  }

  if (succeededCount > 0 && blockedCount > 0) {
    return "PARTIALLY_EXECUTED";
  }

  return "FAILED";
}

export function WorkflowToolCallingPlanPanel({
  workflowRunId,
  result,
  persistedToolCallLogs,
  isRunning,
  error,
  success,
  onRun,
}: {
  workflowRunId: string;
  result: ExecuteWorkflowToolCallingPlanResponse | null;
  persistedToolCallLogs: ToolCallLog[];
  isRunning: boolean;
  error: string | null;
  success: string | null;
  onRun: (workflowRunId: string) => void;
}) {
  const persistedReplayItems = persistedToolCallLogs
    .filter(isPersistedToolPlanReplayLog)
    .map(toPersistedReplayItem);
  const shouldShowPersistedReplay =
    !result && persistedReplayItems.length > 0;

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
      ) : null}

      {shouldShowPersistedReplay ? (
        <div className="workflow-tool-calling-plan__result">
          <dl className="workflow-tool-calling-plan__metadata">
            <div>
              <dt>Replay Source</dt>
              <dd>ToolCallLog</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{getPersistedReplayStatus(persistedReplayItems)}</dd>
            </div>
            <div>
              <dt>Calls</dt>
              <dd>{persistedReplayItems.length}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>Persisted Audit Replay</dd>
            </div>
          </dl>

          <p className="workflow-tool-calling-plan__empty">
            Reconstructed from persisted ToolCallLog records because the full
            in-memory plan result is not available in this UI session.
          </p>

          <div className="workflow-tool-calling-plan__steps">
            {persistedReplayItems.map((item, index) => (
              <article
                className={
                  item.status === "SUCCEEDED"
                    ? "workflow-tool-calling-plan-card workflow-tool-calling-plan-card--success"
                    : "workflow-tool-calling-plan-card workflow-tool-calling-plan-card--blocked"
                }
                key={item.id}
              >
                <div className="workflow-tool-calling-plan-card__header">
                  <div>
                    <strong>
                      {index + 1}. {item.toolName}
                    </strong>
                    <p>Persisted connector/tool audit record.</p>
                  </div>
                  <span>{item.status}</span>
                </div>

                <dl className="workflow-tool-calling-plan-card__metadata">
                  <div>
                    <dt>Policy</dt>
                    <dd>{item.policyDecision}</dd>
                  </div>
                  <div>
                    <dt>Reason Codes</dt>
                    <dd>{item.policyReasonCodes.join(", ") || "—"}</dd>
                  </div>
                  <div>
                    <dt>Execution Attempted</dt>
                    <dd>{item.executionAttempted ? "true" : "false"}</dd>
                  </div>
                  <div>
                    <dt>ToolCallLog</dt>
                    <dd>{formatShortId(item.id)}</dd>
                  </div>
                  <div>
                    <dt>Requested By</dt>
                    <dd>{item.requestedBy ?? "—"}</dd>
                  </div>
                </dl>

                {item.failurePreview ? (
                  <p className="workflow-tool-calling-plan-card__reason">
                    {item.failurePreview}
                  </p>
                ) : null}

                <details className="workflow-tool-calling-plan-card__preview">
                  <summary>Persisted result / failure preview</summary>
                  <pre>
                    {formatConnectorJson(
                      item.resultPreview ?? item.failurePreview,
                    )}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {!result && !shouldShowPersistedReplay ? (
        <p className="workflow-tool-calling-plan__empty">
          No tool-calling plan or persisted connector audit logs have been
          recorded for this selected workflow run yet.
        </p>
      ) : null}
    </section>
  );
}
