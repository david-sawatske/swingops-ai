import type { ExecuteReadOnlyToolInvocationResponse } from "../../types/mcp";
import {
  formatConnectorJson,
  formatShortId,
} from "../../utils/formatting";

export function ReadOnlyMcpConnectorResultCard({
  result,
}: {
  result: ExecuteReadOnlyToolInvocationResponse;
}) {
  const tool = result.policyEvaluation.tool;

  return (
    <article className="read-only-mcp-result-card">
      <div className="read-only-mcp-result-card__header">
        <div>
          <span className="model-route-card__eyebrow">
            {result.invocation.status === "SUCCEEDED"
              ? "Executed read-only connector"
              : "Blocked by connector policy"}
          </span>
          <h3>{result.invocation.toolName}</h3>
          <p>
            Policy checked before execution. External MCP transport remains off;
            this demo uses the internal connector invocation surface.
          </p>
        </div>

        <span>{result.invocation.status}</span>
      </div>

      <dl className="read-only-mcp-result-card__metadata">
        <div>
          <dt>Policy Decision</dt>
          <dd>{result.policyEvaluation.decision}</dd>
        </div>

        <div>
          <dt>Reason Codes</dt>
          <dd>{result.policyEvaluation.reasonCodes.join(", ")}</dd>
        </div>

        <div>
          <dt>Execution Attempted</dt>
          <dd>{String(result.invocation.executionAttempted)}</dd>
        </div>

        <div>
          <dt>Persisted ToolCallLog</dt>
          <dd title={result.invocation.toolCallLogId}>
            {formatShortId(result.invocation.toolCallLogId)}
          </dd>
        </div>

        <div>
          <dt>Risk Level</dt>
          <dd>{tool?.riskLevel ?? "—"}</dd>
        </div>

        <div>
          <dt>Mutates Data</dt>
          <dd>{tool ? String(tool.mutatesData) : "—"}</dd>
        </div>

        <div>
          <dt>Requires Approval</dt>
          <dd>{tool ? String(tool.requiresHumanApproval) : "—"}</dd>
        </div>

        <div>
          <dt>Enabled</dt>
          <dd>{tool ? String(tool.enabled) : "—"}</dd>
        </div>
      </dl>

      <p className="read-only-mcp-result-card__reason">
        {result.policyEvaluation.reason}
      </p>

      <div className="read-only-mcp-result-card__preview">
        <strong>Connector Result Preview</strong>
        <pre>
          {formatConnectorJson(
            result.connectorResult?.data ?? result.invocation.outputJson,
          )}
        </pre>
      </div>
    </article>
  );
}
