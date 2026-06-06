import type { McpCompatibleToolCallResponse } from "../../types/mcp";
import { formatConnectorJson, formatShortId } from "../../utils/formatting";

export function McpCompatibleToolCallResultCard({
  result,
}: {
  result: McpCompatibleToolCallResponse;
}) {
  return (
    <article className="read-only-mcp-result-card">
      <div className="read-only-mcp-result-card__header">
        <div>
          <span className="model-route-card__eyebrow">
            MCP-compatible tool call response
          </span>
          <h3>{result.toolId}</h3>
          <p>
            {result.mcpSurface.protocolShape} · {result.mcpSurface.transport} ·
            ToolCallLog {formatShortId(result.toolCallLogId)}
          </p>
        </div>

        <span>{result.status}</span>
      </div>

      <dl className="read-only-mcp-result-card__metadata">
        <div>
          <dt>Policy</dt>
          <dd>{result.policyDecision.decision}</dd>
        </div>

        <div>
          <dt>Reason Codes</dt>
          <dd>{result.policyDecision.reasonCodes.join(", ")}</dd>
        </div>

        <div>
          <dt>Execution Attempted</dt>
          <dd>{String(result.executionAttempted)}</dd>
        </div>

        <div>
          <dt>External MCP Server</dt>
          <dd>{String(result.mcpSurface.externalMcpServer)}</dd>
        </div>

        <div>
          <dt>Policy Reused</dt>
          <dd>{String(result.mcpSurface.reusedInternalPolicyAndExecutor)}</dd>
        </div>

        <div>
          <dt>Audit Persistence</dt>
          <dd>{result.mcpSurface.auditLogPersistence}</dd>
        </div>
      </dl>

      {result.errorMessage ? (
        <p className="form-message form-message--error">
          {result.errorMessage}
        </p>
      ) : null}

      <details className="workflow-tool-calling-plan-card__preview" open>
        <summary>Response JSON</summary>
        <pre>{formatConnectorJson(result)}</pre>
      </details>

      <details className="workflow-tool-calling-plan-card__preview">
        <summary>Tool result JSON</summary>
        <pre>{formatConnectorJson(result.resultJson)}</pre>
      </details>
    </article>
  );
}
