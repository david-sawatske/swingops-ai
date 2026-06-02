import type { ConnectorInvocationHistoryItem } from "../../types/mcp";
import {
  formatShortId,
  formatToolCallTimestamp,
} from "../../utils/formatting";

export function ConnectorInvocationHistoryCard({
  invocation,
}: {
  invocation: ConnectorInvocationHistoryItem;
}) {
  return (
    <article className="mcp-invocation-history-card">
      <div className="mcp-invocation-history-card__header">
        <div>
          <span className="model-route-card__eyebrow">
            {invocation.executionAttempted
              ? "Execution attempted"
              : "Blocked before execution"}
          </span>
          <h3>{invocation.displayName}</h3>
          <p>{invocation.toolName}</p>
        </div>

        <span
          className={
            invocation.policyDecision === "ALLOW"
              ? "mcp-policy-pill mcp-policy-pill--allow"
              : "mcp-policy-pill mcp-policy-pill--block"
          }
        >
          {invocation.policyDecision}
        </span>
      </div>

      <dl className="mcp-invocation-history-card__metadata">
        <div>
          <dt>Status</dt>
          <dd>{invocation.status}</dd>
        </div>

        <div>
          <dt>Execution Attempted</dt>
          <dd>{String(invocation.executionAttempted)}</dd>
        </div>

        <div>
          <dt>Risk</dt>
          <dd>{invocation.riskLevel ?? "—"}</dd>
        </div>

        <div>
          <dt>Requested By</dt>
          <dd>{invocation.requestedBy ?? "—"}</dd>
        </div>

        <div>
          <dt>Workflow Run</dt>
          <dd title={invocation.workflowRunId ?? undefined}>
            {invocation.workflowRunId
              ? formatShortId(invocation.workflowRunId)
              : "—"}
          </dd>
        </div>

        <div>
          <dt>Workflow Step</dt>
          <dd title={invocation.workflowStepId ?? undefined}>
            {invocation.workflowStepId
              ? formatShortId(invocation.workflowStepId)
              : "—"}
          </dd>
        </div>

        <div>
          <dt>Started</dt>
          <dd>{formatToolCallTimestamp(invocation.startedAt)}</dd>
        </div>

        <div>
          <dt>Completed</dt>
          <dd>{formatToolCallTimestamp(invocation.completedAt)}</dd>
        </div>
      </dl>

      <p className="mcp-invocation-history-card__reason">
        {invocation.failureReason ??
          invocation.resultPreview ??
          invocation.policyReason ??
          "ToolCallLog persisted."}
      </p>

      {invocation.policyReasonCodes.length > 0 ? (
        <p className="mcp-invocation-history-card__codes">
          {invocation.policyReasonCodes.join(", ")}
        </p>
      ) : null}
    </article>
  );
}
