import { FormEvent } from "react";

import type { ExecuteEndToEndAgenticTradeInDemoResponse } from "../../types/workflow";
import { DashboardSection } from "../DashboardSection";
import { EmptyState } from "../EmptyState";

const DEFAULT_DEMO_INPUT = [
  "TM stealth2 drv 10.5 Ventus stiff, no hc, sky mark on crown",
  "Titleist TSR maybe TS2 3w 15 deg Tensei s flex, face wear, hc included",
  "Cally Rogue ST Max driver 9 Project X HZRDUS x-stiff, paint wear, no wrench",
  "PING G425 irons 5-PW reg, worn grips, condition unclear",
].join("\n");

function formatScore(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return "—";
  }

  return score.toFixed(2);
}

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "—";
}

function getAuditStatusClassName(status: string) {
  return `agentic-demo-audit-event__status agentic-demo-audit-event__status--${status.toLowerCase().replace(/_/g, "-")}`;
}

export function AgenticTradeInDemoPage({
  rawInput,
  result,
  isRunning,
  error,
  success,
  onRawInputChange,
  onSubmit,
}: {
  rawInput: string;
  result: ExecuteEndToEndAgenticTradeInDemoResponse | null;
  isRunning: boolean;
  error: string | null;
  success: string | null;
  onRawInputChange: (rawInput: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <DashboardSection
      title="Agentic Trade-In Demo"
      description="One polished end-to-end flow: messy golf notes → structured records → RAG grounding → model routing → safe MCP tool execution → blocked mutation → review queue."
    >
      <div className="agentic-demo-layout">
        <form className="agentic-demo-form" onSubmit={onSubmit}>
          <div>
            <label htmlFor="agentic-demo-raw-input">
              Messy trade-in text
            </label>
            <textarea
              id="agentic-demo-raw-input"
              onChange={(event) => onRawInputChange(event.target.value)}
              rows={8}
              value={rawInput}
            />
          </div>

          <div className="agentic-demo-form__actions">
            <button disabled={isRunning} type="submit">
              {isRunning ? "Running Demo…" : "Run Agentic Trade-In Demo"}
            </button>
            <button
              disabled={isRunning}
              onClick={() => onRawInputChange(DEFAULT_DEMO_INPUT)}
              type="button"
            >
              Reset Sample
            </button>
          </div>
        </form>

        <article className="agentic-demo-story-card">
          <span className="model-route-card__eyebrow">Product story</span>
          <h3>Why this workflow matters</h3>
          <p>
            This page ties together the app’s core trade-in automation capabilities in one
            workflow: structured orchestration, golf-domain parsing, pgvector/RAG
            grounding, provider-aware model routing, MCP-compatible tool calls,
            policy-blocked mutations, persisted audit logs, and human review.
          </p>
          <p>
            For the richest RAG section, first open MCP Connectors and ingest the demo
            knowledge base. The seed data includes sample-matching examples for the
            TaylorMade Stealth 2 driver, Titleist TSR fairway, and Callaway Rogue ST Max
            driver used below. The PING G425 irons are intentionally less grounded so the review path stays visible.
          </p>
        </article>
      </div>

      {error ? (
        <EmptyState title="Unable to run agentic demo" message={error} />
      ) : null}

      {success ? <p className="success-message">{success}</p> : null}

      {!result ? (
        <EmptyState
          title="No demo run yet"
          message="Run the sample input to create a full audit trail and persisted workflow artifacts."
        />
      ) : null}

      {result ? (
        <div className="agentic-demo-result">
          <section className="agentic-demo-summary-grid">
            <article>
              <span className="model-route-card__eyebrow">Parsed</span>
              <strong>{result.finalSummary.parsedItemCount}</strong>
              <p>equipment records</p>
            </article>
            <article>
              <span className="model-route-card__eyebrow">RAG</span>
              <strong>{result.finalSummary.knowledgeMatchCount}</strong>
              <p>knowledge matches</p>
            </article>
            <article>
              <span className="model-route-card__eyebrow">Review</span>
              <strong>{result.finalSummary.reviewQueueItemCount}</strong>
              <p>items created</p>
            </article>
            <article>
              <span className="model-route-card__eyebrow">Tools</span>
              <strong>
                {result.finalSummary.successfulReadOnlyToolCallCount}/
                {result.toolCallResults.length}
              </strong>
              <p>safe calls succeeded</p>
            </article>
          </section>

          <section className="agentic-demo-section">
            <h3>1. Parsed equipment with uncertainty</h3>
            <div className="agentic-demo-card-list">
              {result.parsedItems.map((item) => (
                <article className="agentic-demo-card" key={item.id}>
                  <div className="agentic-demo-card__header">
                    <div>
                      <span className="model-route-card__eyebrow">
                        Confidence {formatScore(item.confidence)}
                      </span>
                      <h4>
                        {item.brand ?? "Unknown brand"}{" "}
                        {item.productLine ?? "Unknown model"}
                      </h4>
                    </div>
                    {item.missingFields.length > 0 ? (
                      <span className="agentic-demo-pill agentic-demo-pill--warning">
                        Needs review
                      </span>
                    ) : (
                      <span className="agentic-demo-pill agentic-demo-pill--success">
                        Structured
                      </span>
                    )}
                  </div>

                  <dl className="agentic-demo-metadata">
                    <div>
                      <dt>Category</dt>
                      <dd>{item.category ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Loft / club</dt>
                      <dd>{item.loft ?? item.clubNumber ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Shaft</dt>
                      <dd>
                        {[item.shaftBrand, item.shaftModel, item.shaftFlex]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Condition</dt>
                      <dd>{formatList(item.conditionNotes)}</dd>
                    </div>
                    <div>
                      <dt>Accessories</dt>
                      <dd>{formatList(item.accessoriesNotes)}</dd>
                    </div>
                    <div>
                      <dt>Missing / uncertain</dt>
                      <dd>
                        {[...item.missingFields, ...item.uncertaintyNotes].join(", ") ||
                          "—"}
                      </dd>
                    </div>
                  </dl>

                  <p className="agentic-demo-raw-line">{item.rawLine}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="agentic-demo-section">
            <h3>2. RAG matches with weighted scoring</h3>
            <div className="agentic-demo-card-list">
              {result.knowledgeMatchesByItem.map((match) => {
                const parsedItem = result.parsedItems.find(
                  (item) => item.id === match.parsedItemId,
                );
                const topResults = match.search.results.slice(0, 3);

                return (
                  <article className="agentic-demo-card" key={match.parsedItemId}>
                    <span className="model-route-card__eyebrow">
                      {parsedItem?.brand ?? "Unknown"}{" "}
                      {parsedItem?.productLine ?? "model"}
                    </span>
                    <h4>Query: {match.query}</h4>

                    {topResults.length === 0 ? (
                      <p>
                        No knowledge chunks matched. The demo still records this
                        as a grounding gap for the audit trail.
                      </p>
                    ) : (
                      topResults.map((resultItem) => (
                        <div
                          className="agentic-demo-rag-match"
                          key={resultItem.chunkId}
                        >
                          <strong>
                            {resultItem.documentTitle} · score{" "}
                            {formatScore(resultItem.score)}
                          </strong>
                          <p>{resultItem.chunkText}</p>
                          {resultItem.scoreBreakdown ? (
                            <dl className="agentic-demo-score-grid">
                              {Object.entries(
                                resultItem.scoreBreakdown.components,
                              ).map(([componentName, component]) => (
                                <div key={componentName}>
                                  <dt>{componentName}</dt>
                                  <dd>
                                    {formatScore(component.score)} ×{" "}
                                    {component.weight}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                        </div>
                      ))
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="agentic-demo-section">
            <h3>3. Model route decision</h3>
            <article className="agentic-demo-card">
              <div className="agentic-demo-card__header">
                <div>
                  <span className="model-route-card__eyebrow">
                    {result.modelRoutingDecision.healthStatus}
                  </span>
                  <h4>
                    {result.modelRoutingDecision.selectedProvider} /{" "}
                    {result.modelRoutingDecision.selectedModel}
                  </h4>
                </div>
                <span className="agentic-demo-pill">
                  {result.modelRoutingDecision.qualityTier}
                </span>
              </div>

              <p>{result.modelRoutingDecision.selectedReason}</p>

              <dl className="agentic-demo-metadata">
                <div>
                  <dt>Cost tier</dt>
                  <dd>{result.modelRoutingDecision.estimatedCostTier}</dd>
                </div>
                <div>
                  <dt>Latency tier</dt>
                  <dd>{result.modelRoutingDecision.expectedLatencyTier}</dd>
                </div>
                <div>
                  <dt>Estimated cost</dt>
                  <dd>${result.modelRoutingDecision.estimatedCostUsd.toFixed(6)}</dd>
                </div>
                <div>
                  <dt>Fallback</dt>
                  <dd>
                    {result.modelRoutingDecision.fallbackProvider
                      ? `${result.modelRoutingDecision.fallbackProvider} / ${result.modelRoutingDecision.fallbackModel}`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </article>
          </section>

          <section className="agentic-demo-section">
            <h3>4. Tool plan, execution, and blocked mutation</h3>
            <div className="agentic-demo-card-list">
              {result.toolCallingPlan.plannedCalls.map((call) => {
                const callResult = result.toolCallResults.find(
                  (item) => item.toolName === call.toolName,
                );

                return (
                  <article
                    className={
                      callResult?.status === "BLOCKED"
                        ? "agentic-demo-card agentic-demo-card--blocked"
                        : "agentic-demo-card"
                    }
                    key={`${call.orderIndex}-${call.toolName}`}
                  >
                    <div className="agentic-demo-card__header">
                      <div>
                        <span className="model-route-card__eyebrow">
                          Step {call.orderIndex} · {call.expectedRiskLevel}
                        </span>
                        <h4>{call.toolName}</h4>
                      </div>
                      <span
                        className={
                          call.expectedMutatesData
                            ? "agentic-demo-pill agentic-demo-pill--blocked"
                            : "agentic-demo-pill agentic-demo-pill--success"
                        }
                      >
                        {call.expectedMutatesData ? "Mutation blocked" : "Read-only"}
                      </span>
                    </div>

                    <p>{call.reason}</p>
                    {callResult ? (
                      <dl className="agentic-demo-metadata">
                        <div>
                          <dt>Status</dt>
                          <dd>{callResult.status}</dd>
                        </div>
                        <div>
                          <dt>Policy</dt>
                          <dd>{callResult.policyDecision}</dd>
                        </div>
                        <div>
                          <dt>Executed</dt>
                          <dd>{callResult.executionAttempted ? "Yes" : "No"}</dd>
                        </div>
                        <div>
                          <dt>Reason</dt>
                          <dd>{callResult.policyReason}</dd>
                        </div>
                      </dl>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="agentic-demo-section">
            <h3>5. Review queue outcomes</h3>
            {result.reviewQueueItemsCreated.length === 0 ? (
              <p>No review queue items were created.</p>
            ) : (
              <div className="agentic-demo-card-list">
                {result.reviewQueueItemsCreated.map((item) => (
                  <article className="agentic-demo-card" key={item.id}>
                    <span className="model-route-card__eyebrow">
                      {item.status}
                    </span>
                    <h4>{item.reason}</h4>
                    <p>{item.originalText}</p>
                    <pre>{JSON.stringify(item.proposedGolfClubJson, null, 2)}</pre>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="agentic-demo-section">
            <h3>6. Audit trail</h3>
            <div className="agentic-demo-audit-list">
              {result.auditTrail.map((event) => (
                <article className="agentic-demo-audit-event" key={event.orderIndex}>
                  <div className="agentic-demo-card__header">
                    <div>
                      <span className="model-route-card__eyebrow">
                        #{event.orderIndex}
                      </span>
                      <h4>{event.label}</h4>
                    </div>
                    <span className={getAuditStatusClassName(event.status)}>
                      {event.status}
                    </span>
                  </div>
                  <p>{event.summary}</p>
                </article>
              ))}
            </div>

            <article className="agentic-demo-final-summary">
              <h3>Final summary</h3>
              <p>{result.finalSummary.productStory}</p>
              <dl className="agentic-demo-metadata">
                <div>
                  <dt>Workflow run</dt>
                  <dd>{result.persisted.workflowRunId}</dd>
                </div>
                <div>
                  <dt>Intake batch</dt>
                  <dd>{result.persisted.intakeBatchId}</dd>
                </div>
                <div>
                  <dt>Model log</dt>
                  <dd>{result.persisted.modelCallLogId}</dd>
                </div>
                <div>
                  <dt>Tool logs</dt>
                  <dd>{result.persisted.toolCallLogIds.length}</dd>
                </div>
              </dl>
            </article>
          </section>
        </div>
      ) : null}
    </DashboardSection>
  );
}
