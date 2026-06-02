import type { ToolCallLog } from "../../types/workflow";
import { formatToolCallTimestamp } from "../../utils/formatting";
import {
  getBooleanField,
  getStringField,
  getStringListField,
} from "../../utils/objectFields";
import {
  getGroundingSummaryFromToolCall,
  getToolCallOutputJson,
  isAuditOnlyToolCallLog,
  isGroundingToolCallLog,
} from "../../utils/toolCallDisplay";

export function ToolCallLogCard({ toolCallLog }: { toolCallLog: ToolCallLog }) {
  const outputJson = getToolCallOutputJson(toolCallLog);
  const isAuditOnly = isAuditOnlyToolCallLog(toolCallLog);
  const isGroundingCall = isGroundingToolCallLog(toolCallLog);
  const groundingSummary = isGroundingCall
    ? getGroundingSummaryFromToolCall(toolCallLog)
    : null;

  return (
    <article
      className={
        isAuditOnly
          ? "workflow-tool-log-card workflow-tool-log-card--audit-only"
          : "workflow-tool-log-card workflow-tool-log-card--executed"
      }
    >
      <div className="workflow-tool-log-card__body">
        <div className="workflow-tool-log-card__header">
          <div>
            <span className="model-route-card__eyebrow">
              {isAuditOnly
                ? "Audit-only planned MCP invocation"
                : "Executed tool call"}
            </span>
            <strong>{toolCallLog.toolName}</strong>
            <p>{toolCallLog.workflowStepId ?? "Run-level tool log"}</p>
          </div>

          <span>{toolCallLog.status}</span>
        </div>

        {groundingSummary ? (
          <p className="workflow-tool-log-card__audit-note">
            {groundingSummary}
          </p>
        ) : null}

        {isAuditOnly ? (
          <>
            <p className="workflow-tool-log-card__audit-note">
              Planned preview log only. No tool execution was attempted and no
              actual tool output is present.
            </p>

            <dl className="workflow-tool-log-card__metadata">
              <div>
                <dt>Policy Decision</dt>
                <dd>{getStringField(outputJson, "policyDecision")}</dd>
              </div>

              <div>
                <dt>Reason Codes</dt>
                <dd>{getStringListField(outputJson, "policyReasonCodes")}</dd>
              </div>

              <div>
                <dt>Invocation Status</dt>
                <dd>{getStringField(outputJson, "invocationStatus")}</dd>
              </div>

              <div>
                <dt>Requested By</dt>
                <dd>{getStringField(outputJson, "requestedBy")}</dd>
              </div>

              <div>
                <dt>Execution Attempted</dt>
                <dd>{getBooleanField(outputJson, "executionAttempted")}</dd>
              </div>

              <div>
                <dt>Preview Only</dt>
                <dd>{getBooleanField(outputJson, "previewOnly")}</dd>
              </div>
            </dl>
          </>
        ) : (
          <dl className="workflow-tool-log-card__metadata">
            <div>
              <dt>Started</dt>
              <dd>{formatToolCallTimestamp(toolCallLog.startedAt)}</dd>
            </div>

            <div>
              <dt>Completed</dt>
              <dd>{formatToolCallTimestamp(toolCallLog.completedAt)}</dd>
            </div>

            <div>
              <dt>Workflow Run</dt>
              <dd>{toolCallLog.workflowRunId ?? "—"}</dd>
            </div>

            <div>
              <dt>Workflow Step</dt>
              <dd>{toolCallLog.workflowStepId ?? "—"}</dd>
            </div>
          </dl>
        )}
      </div>
    </article>
  );
}
