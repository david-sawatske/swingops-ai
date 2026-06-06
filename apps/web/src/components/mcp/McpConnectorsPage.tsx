import type { FormEvent } from "react";
import type {
  ConnectorCatalogItem,
  ConnectorInvocationHistoryItem,
  McpCompatibleToolCallResponse,
} from "../../types/mcp";
import type { GlobalWorkflowRunSummary } from "../../types/workflow";
import {
  type ReadOnlyMcpToolDemoOption,
  type ReadOnlyMcpToolName,
} from "../../constants/mcpDemoTools";
import { formatEnabledLabel } from "../../utils/formatting";
import { DashboardSection } from "../DashboardSection";
import { EmptyState } from "../EmptyState";
import { ConnectorCatalogCard } from "./ConnectorCatalogCard";
import { ConnectorInvocationHistoryCard } from "./ConnectorInvocationHistoryCard";
import { McpCompatibleToolCallResultCard } from "./McpCompatibleToolCallResultCard";

export function McpConnectorsPage({
  connectorCatalog,
  isLoadingConnectorCatalog,
  connectorCatalogError,
  invocationHistory,
  isLoadingInvocationHistory,
  invocationHistoryError,
  auditStory,
  readOnlyMcpToolOptions,
  selectedToolName,
  selectedWorkflowRunId,
  selectedTool,
  workflowRuns,
  invocationResult,
  invocationError,
  isExecutingTool,
  onRefreshCatalog,
  onRefreshHistory,
  onSelectedToolNameChange,
  onSelectedWorkflowRunIdChange,
  onExecuteTool,
}: {
  connectorCatalog: ConnectorCatalogItem[];
  isLoadingConnectorCatalog: boolean;
  connectorCatalogError: string | null;
  invocationHistory: ConnectorInvocationHistoryItem[];
  isLoadingInvocationHistory: boolean;
  invocationHistoryError: string | null;
  auditStory: string;
  readOnlyMcpToolOptions: ReadOnlyMcpToolDemoOption[];
  selectedToolName: ReadOnlyMcpToolName;
  selectedWorkflowRunId: string;
  selectedTool: ReadOnlyMcpToolDemoOption;
  workflowRuns: GlobalWorkflowRunSummary[];
  invocationResult: McpCompatibleToolCallResponse | null;
  invocationError: string | null;
  isExecutingTool: boolean;
  onRefreshCatalog: () => void;
  onRefreshHistory: () => void;
  onSelectedToolNameChange: (toolName: ReadOnlyMcpToolName) => void;
  onSelectedWorkflowRunIdChange: (workflowRunId: string) => void;
  onExecuteTool: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <DashboardSection
      title="MCP-Compatible Connector Surface"
      description="Expose internal SwingOps tools through a protocol-shaped adapter, run policy-governed calls, and inspect persisted ToolCallLog audit history."
    >
      <div className="section-intro-card">
        <span className="model-route-card__eyebrow">
          Internal MCP-compatible surface
        </span>
        <h3>Connector registry exposed through a guarded tool-call boundary</h3>
        <p>
          This page now uses a REST adapter shaped around MCP tools/list and
          tools/call semantics. It does not claim an external MCP server yet.
          The demo proves the safer boundary: list exposed tools, call an
          allowed read-only tool, block a visible mutation tool before
          execution, and persist both outcomes to ToolCallLog.
        </p>
      </div>

      <div className="mcp-page-grid">
        <section className="mcp-page-section">
          <div className="mcp-page-section__header">
            <div>
              <span className="model-route-card__eyebrow">
                Connector Catalog
              </span>
              <h3>Available internal connector tools</h3>
              <p>
                Each card shows risk, mutation behavior, approval requirements,
                allowed mode, last invocation, and audit counts.
              </p>
            </div>

            <button onClick={onRefreshCatalog} type="button">
              Refresh Catalog
            </button>
          </div>

          {isLoadingConnectorCatalog ? <p>Loading connector catalog…</p> : null}

          {connectorCatalogError ? (
            <EmptyState
              title="Unable to load connector catalog"
              message={connectorCatalogError}
            />
          ) : null}

          {!isLoadingConnectorCatalog &&
          !connectorCatalogError &&
          connectorCatalog.length === 0 ? (
            <EmptyState
              title="No connectors registered"
              message="No internal connector tools were returned by the API."
            />
          ) : null}

          {!isLoadingConnectorCatalog &&
          !connectorCatalogError &&
          connectorCatalog.length > 0 ? (
            <div className="mcp-connector-catalog-grid">
              {connectorCatalog.map((connector) => (
                <ConnectorCatalogCard
                  connector={connector}
                  key={connector.name}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section className="mcp-page-section">
          <div className="mcp-page-section__header">
            <div>
              <span className="model-route-card__eyebrow">
                MCP-compatible tools/call
              </span>
              <h3>Run a safe read-only tool or blocked mutation proof</h3>
              <p>
                The browser sends a tool ID and JSON arguments to
                /mcp/tools/:toolId/call. The backend reuses the internal policy
                evaluator and executor, then returns an MCP-compatible response
                with policy, status, result JSON, and ToolCallLog ID.
              </p>
            </div>
          </div>

          <form className="read-only-mcp-demo-form" onSubmit={onExecuteTool}>
            <label>
              Tool
              <select
                onChange={(event) =>
                  onSelectedToolNameChange(
                    event.target.value as ReadOnlyMcpToolName,
                  )
                }
                value={selectedToolName}
              >
                {readOnlyMcpToolOptions.map((tool) => (
                  <option key={tool.name} value={tool.name}>
                    {tool.label}
                  </option>
                ))}
              </select>
            </label>

            {selectedToolName === "swingops.workflowRuns.get" ? (
              <label>
                Workflow Run
                <select
                  onChange={(event) =>
                    onSelectedWorkflowRunIdChange(event.target.value)
                  }
                  value={selectedWorkflowRunId}
                >
                  {workflowRuns.map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.workflowName} / {run.status}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <article className="read-only-mcp-tool-card">
              <div>
                <span className="model-route-card__eyebrow">
                  {selectedTool.blockedDemo
                    ? "Blocked mutation proof"
                    : "Safe read-only tool"}
                </span>
                <h3>{selectedTool.name}</h3>
                <p>{selectedTool.description}</p>
              </div>

              <dl>
                <div>
                  <dt>Risk</dt>
                  <dd>{selectedTool.riskLevel}</dd>
                </div>

                <div>
                  <dt>Mutates Data</dt>
                  <dd>{String(selectedTool.mutatesData)}</dd>
                </div>

                <div>
                  <dt>Requires Approval</dt>
                  <dd>{String(selectedTool.requiresHumanApproval)}</dd>
                </div>

                <div>
                  <dt>Enabled</dt>
                  <dd>{formatEnabledLabel(selectedTool.enabled)}</dd>
                </div>
              </dl>
            </article>

            {invocationError ? (
              <p className="form-message form-message--error">
                {invocationError}
              </p>
            ) : null}

            <button disabled={isExecutingTool} type="submit">
              {isExecutingTool
                ? "Calling MCP-compatible tool…"
                : selectedTool.blockedDemo
                  ? "Run Blocked Mutation Proof"
                  : "Call Read-Only Tool"}
            </button>
          </form>

          {invocationResult ? (
            <McpCompatibleToolCallResultCard result={invocationResult} />
          ) : (
            <EmptyState
              title="No MCP-compatible tool call yet"
              message="Choose a safe read-only connector or the blocked mutation proof to see policy enforcement, result JSON, and persisted audit logs."
            />
          )}
        </section>

        <section className="mcp-page-section">
          <div className="mcp-page-section__header">
            <div>
              <span className="model-route-card__eyebrow">
                Invocation History
              </span>
              <h3>Recent ToolCallLog audit records</h3>
              <p>{auditStory}</p>
            </div>

            <button onClick={onRefreshHistory} type="button">
              Refresh History
            </button>
          </div>

          {isLoadingInvocationHistory ? (
            <p>Loading invocation history…</p>
          ) : null}

          {invocationHistoryError ? (
            <EmptyState
              title="Unable to load invocation history"
              message={invocationHistoryError}
            />
          ) : null}

          {!isLoadingInvocationHistory &&
          !invocationHistoryError &&
          invocationHistory.length === 0 ? (
            <EmptyState
              title="No connector history yet"
              message="Run the safe read-only connector and the blocked mutation proof to populate the audit history."
            />
          ) : null}

          {!isLoadingInvocationHistory &&
          !invocationHistoryError &&
          invocationHistory.length > 0 ? (
            <div className="mcp-invocation-history-list">
              {invocationHistory.map((invocation) => (
                <ConnectorInvocationHistoryCard
                  invocation={invocation}
                  key={invocation.id}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </DashboardSection>
  );
}
