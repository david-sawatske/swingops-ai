import type { FormEvent } from "react";
import type {
  ConnectorCatalogItem,
  ConnectorInvocationHistoryItem,
  ExternalMcpServerReadiness,
  McpCompatibleToolCallResponse,
} from "../../types/mcp";
import type {
  KnowledgeEvalSummary,
  KnowledgeIngestionSummary,
  KnowledgeSearchResponse,
} from "../../types/knowledge";
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

function formatScore(score: number): string {
  return score.toFixed(2);
}

function formatNullableScore(score: number | null): string {
  return score === null ? "n/a" : score.toFixed(2);
}

const SCORE_BREAKDOWN_LABELS = [
  ["brand", "Brand"],
  ["productLine", "Product line"],
  ["category", "Category"],
  ["shaft", "Shaft"],
  ["notes", "Notes"],
  ["vector", "Vector"],
] as const;

export function McpConnectorsPage({
  connectorCatalog,
  externalMcpReadiness,
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
  knowledgeSearchQuery,
  knowledgeIngestionSummary,
  knowledgeSearchResult,
  knowledgeEvalSummary,
  isIngestingKnowledgeBase,
  isSearchingKnowledgeBase,
  isRunningKnowledgeEvals,
  knowledgeBaseError,
  knowledgeBaseSuccess,
  onRefreshCatalog,
  onRefreshHistory,
  onSelectedToolNameChange,
  onSelectedWorkflowRunIdChange,
  onExecuteTool,
  onKnowledgeSearchQueryChange,
  onIngestDemoKnowledgeBase,
  onSearchKnowledgeBase,
  onRunKnowledgeRetrievalEvals,
}: {
  connectorCatalog: ConnectorCatalogItem[];
  externalMcpReadiness: ExternalMcpServerReadiness | null;
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
  knowledgeSearchQuery: string;
  knowledgeIngestionSummary: KnowledgeIngestionSummary | null;
  knowledgeSearchResult: KnowledgeSearchResponse | null;
  knowledgeEvalSummary: KnowledgeEvalSummary | null;
  isIngestingKnowledgeBase: boolean;
  isSearchingKnowledgeBase: boolean;
  isRunningKnowledgeEvals: boolean;
  knowledgeBaseError: string | null;
  knowledgeBaseSuccess: string | null;
  onRefreshCatalog: () => void;
  onRefreshHistory: () => void;
  onSelectedToolNameChange: (toolName: ReadOnlyMcpToolName) => void;
  onSelectedWorkflowRunIdChange: (workflowRunId: string) => void;
  onExecuteTool: (event: FormEvent<HTMLFormElement>) => void;
  onKnowledgeSearchQueryChange: (query: string) => void;
  onIngestDemoKnowledgeBase: () => void;
  onSearchKnowledgeBase: (event: FormEvent<HTMLFormElement>) => void;
  onRunKnowledgeRetrievalEvals: () => void;
}) {
  const topKnowledgeResults = knowledgeSearchResult?.results.slice(0, 3) ?? [];

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

      <section className="mcp-readiness-card">
        <div>
          <span className="model-route-card__eyebrow">
            External MCP Server Readiness
          </span>
          <h3>{externalMcpReadiness?.statusLabel ?? "Checking readiness"}</h3>
          <p>
            This is still an internal REST adapter shaped around MCP tools/list and tools/call. Contracts, policy, validation, audit logging, and output sanitization are being prepared so a future external MCP server can wrap the same guarded surface.
          </p>
        </div>

        <div className="mcp-readiness-list">
          {(externalMcpReadiness?.readinessChecks ?? []).map((check) => (
            <article className="mcp-readiness-check" key={check.name}>
              <strong>{check.name}</strong>
              <span className={check.status === "PASS" ? "status-pill status-pill--success" : "status-pill status-pill--warning"}>
                {check.status}
              </span>
              <p>{check.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mcp-page-grid">
        <section className="mcp-page-section">
          <div className="mcp-page-section__header">
            <div>
              <span className="model-route-card__eyebrow">
                RAG-ready trade-in knowledge
              </span>
              <h3>Ingest, search, and evaluate grounding chunks</h3>
              <p>
                Load local golf trade-in knowledge, run pgvector-backed retrieval with deterministic local embeddings, and inspect citations before using the same search through the MCP-compatible connector.
              </p>
            </div>

            <button
              disabled={isIngestingKnowledgeBase}
              onClick={onIngestDemoKnowledgeBase}
              type="button"
            >
              {isIngestingKnowledgeBase ? "Ingesting…" : "Ingest Demo KB"}
            </button>
          </div>

          <form className="knowledge-base-search-form" onSubmit={onSearchKnowledgeBase}>
            <label>
              Knowledge search query
              <input
                onChange={(event) =>
                  onKnowledgeSearchQueryChange(event.target.value)
                }
                value={knowledgeSearchQuery}
              />
            </label>

            <div className="knowledge-base-actions">
              <button disabled={isSearchingKnowledgeBase} type="submit">
                {isSearchingKnowledgeBase ? "Searching…" : "Search Knowledge"}
              </button>

              <button
                disabled={isRunningKnowledgeEvals}
                onClick={onRunKnowledgeRetrievalEvals}
                type="button"
              >
                {isRunningKnowledgeEvals ? "Running evals…" : "Run Evals"}
              </button>
            </div>
          </form>

          {knowledgeBaseError ? (
            <p className="form-message form-message--error">
              {knowledgeBaseError}
            </p>
          ) : null}

          {knowledgeBaseSuccess ? (
            <p className="form-message form-message--success">
              {knowledgeBaseSuccess}
            </p>
          ) : null}

          <div className="knowledge-base-summary-grid">
            <article className="knowledge-base-summary-card">
              <span className="model-route-card__eyebrow">Ingestion</span>
              <h3>
                {knowledgeIngestionSummary
                  ? knowledgeIngestionSummary.status
                  : "Not run"}
              </h3>
              <p>
                {knowledgeIngestionSummary
                  ? `${knowledgeIngestionSummary.documentsCreated} docs, ${knowledgeIngestionSummary.chunksCreated} chunks from ${knowledgeIngestionSummary.sourceName}.`
                  : "Ingest the demo knowledge base to create persisted documents and chunks."}
              </p>
            </article>

            <article className="knowledge-base-summary-card">
              <span className="model-route-card__eyebrow">Retrieval evals</span>
              <h3>
                {knowledgeEvalSummary
                  ? `${knowledgeEvalSummary.passCount}/${knowledgeEvalSummary.casesEvaluated} passed`
                  : "Not run"}
              </h3>
              <p>
                {knowledgeEvalSummary
                  ? `Mode: ${knowledgeEvalSummary.evalMetadata.retrievalMode}. Production vector embeddings: ${String(
                      knowledgeEvalSummary.evalMetadata.productionVectorEmbeddings,
                    )}.`
                  : "Run evals against known messy trade-in examples."}
              </p>
            </article>
          </div>

          {knowledgeSearchResult ? (
            <div className="knowledge-base-results">
              <div>
                <span className="model-route-card__eyebrow">
                  {knowledgeSearchResult.queryMetadata.retrievalMode}
                </span>
                <h3>{knowledgeSearchResult.summary}</h3>
                <p>
                  Production vector embeddings:{" "}
                  {String(
                    knowledgeSearchResult.queryMetadata.productionVectorEmbeddings,
                  )}
                </p>
              </div>

              {topKnowledgeResults.map((result) => (
                <article className="knowledge-base-result-card" key={result.chunkId}>
                  <div className="knowledge-base-result-card__header">
                    <div>
                      <h4>
                        {result.brand ?? "Unknown brand"}{" "}
                        {result.productLine ?? "Unknown product"}
                      </h4>
                      <p>
                        {result.category ?? "Unknown category"} /{" "}
                        {result.chunkType}
                      </p>
                    </div>
                    <span title="Weighted trade-in relevance score">
                      {formatScore(result.score)}
                    </span>
                  </div>

                  <p>{result.chunkText}</p>

                  <dl>
                    <div>
                      <dt>Citation</dt>
                      <dd>
                        {result.citation.documentTitle} #{result.citation.chunkIndex}
                      </dd>
                    </div>
                    <div>
                      <dt>Matched Terms</dt>
                      <dd>{result.matchedTerms.join(", ") || "None"}</dd>
                    </div>
                    <div>
                      <dt>Scoring</dt>
                      <dd>
                        Weighted {formatScore(result.scoreBreakdown.weightedScore)}
                        {result.scoreBreakdown.vectorScore === null
                          ? " / vector n/a"
                          : ` / vector ${formatScore(result.scoreBreakdown.vectorScore)}`}
                      </dd>
                    </div>
                  </dl>

                  <div className="knowledge-base-score-breakdown">
                    {SCORE_BREAKDOWN_LABELS.map(([key, label]) => {
                      const component = result.scoreBreakdown.components[key];

                      return (
                        <div key={key}>
                          <strong>{label}</strong>{" "}
                          {formatNullableScore(component.score)} ×{" "}
                          {Math.round(component.weight * 100)}%
                          {component.explanation ? (
                            <span> — {component.explanation}</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No knowledge search yet"
              message="Ingest the demo KB, then search messy golf shorthand to see grounded chunks with citations."
            />
          )}
        </section>

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
