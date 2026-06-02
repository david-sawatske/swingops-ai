import type { FormEvent } from "react";
import type {
  ConnectorCatalogItem,
  ConnectorInvocationHistoryItem,
  ExecuteReadOnlyToolInvocationResponse,
} from "../../types/mcp";
import type { GlobalWorkflowRunSummary } from "../../types/workflow";
import {
  READ_ONLY_MCP_TOOL_OPTIONS,
  type ReadOnlyMcpToolDemoOption,
  type ReadOnlyMcpToolName,
} from "../../constants/mcpDemoTools";
import { formatEnabledLabel } from "../../utils/formatting";
import { DashboardSection } from "../DashboardSection";
import { EmptyState } from "../EmptyState";
import { ConnectorCatalogCard } from "./ConnectorCatalogCard";
import { ConnectorInvocationHistoryCard } from "./ConnectorInvocationHistoryCard";
import { ReadOnlyMcpConnectorResultCard } from "./ReadOnlyMcpConnectorResultCard";

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
  invocationResult: ExecuteReadOnlyToolInvocationResponse | null;
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
      title="MCP Connector Catalog and Run History"
      description="Catalog internal connector tools, try policy-governed read-only execution, and review persisted ToolCallLog audit history."
    >
      <div className="section-intro-card">
        <span className="model-route-card__eyebrow">Internal MCP-style Surface</span>
        <h3>Policy-governed tool invocation with audit history</h3>
        <p>
          This is currently an internal MCP-style connector invocation surface,
          not an external MCP server. The page shows which tools are exposed,
          why policy allows or blocks them, whether execution was attempted,
          and the persisted ToolCallLog trail for portfolio review.
        </p>
      </div>

      <div className="mcp-page-grid">
        <section className="mcp-page-section">
          <div className="mcp-page-section__header">
            <div>
              <span className="model-route-card__eyebrow">Connector Catalog</span>
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
                <ConnectorCatalogCard connector={connector} key={connector.name} />
              ))}
            </div>
          ) : null}
        </section>

        <section className="mcp-page-section">
          <div className="mcp-page-section__header">
            <div>
              <span className="model-route-card__eyebrow">Try a Connector</span>
              <h3>Run a safe read-only connector or blocked mutation demo</h3>
              <p>
                The request is evaluated by policy first. Allowed read-only
                calls execute. Disabled or mutating calls are blocked and still
                persisted as ToolCallLog audit records.
              </p>
            </div>
          </div>

          <form className="read-only-mcp-demo-form" onSubmit={onExecuteTool}>
            <label>
              Tool
              <select
                onChange={(event) =>
                  onSelectedToolNameChange(event.target.value as ReadOnlyMcpToolName)
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
                    ? "Blocked mutation demo"
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
                ? "Executing connector…"
                : selectedTool.blockedDemo
                  ? "Run Blocked Demo"
                  : "Execute Read-Only Tool"}
            </button>
          </form>

          {invocationResult ? (
            <ReadOnlyMcpConnectorResultCard result={invocationResult} />
          ) : (
            <EmptyState
              title="No connector invocation yet"
              message="Choose a safe read-only connector or the blocked mutation demo to see policy enforcement and persisted audit logs."
            />
          )}
        </section>

        <section className="mcp-page-section">
          <div className="mcp-page-section__header">
            <div>
              <span className="model-route-card__eyebrow">Invocation History</span>
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
              message="Run the safe read-only connector and the blocked mutation demo to populate the audit history."
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
