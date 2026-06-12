import { FormEvent, useEffect, useMemo, useState } from "react";

import type { AppView } from "../../constants/appNav";
import type {
  ExecuteEndToEndAgenticTradeInDemoResponse,
  ExecuteMultiSourceIntakeDemoRequest,
  ExecuteMultiSourceIntakeDemoResponse,
  GlobalReviewQueueItem,
  GlobalWorkflowRunSummary,
} from "../../types/workflow";
import { EmptyState } from "../EmptyState";
import { GuidedSourceIntakeBuilder } from "./GuidedSourceIntakeBuilder";

export type GuidedStep =
  | "SCENARIO"
  | "SOURCE_INTAKE"
  | "AI_READY_OUTPUT"
  | "TRADE_IN_WORKFLOW"
  | "EXECUTION_TRACE"
  | "HUMAN_REVIEW"
  | "QUALITY_SUMMARY";

const GUIDED_STEPS: {
  id: GuidedStep;
  label: string;
  eyebrow: string;
  description: string;
}[] = [
  {
    id: "SCENARIO",
    label: "Scenario",
    eyebrow: "Business context",
    description: "What problem this workflow solves.",
  },
  {
    id: "SOURCE_INTAKE",
    label: "Source Intake",
    eyebrow: "Messy inputs",
    description: "Stage customer email, store notes, broken CSV rows, and logs.",
  },
  {
    id: "AI_READY_OUTPUT",
    label: "AI-Ready Output",
    eyebrow: "Normalized assets",
    description: "Review extracted records, schema, metadata, and RAG readiness.",
  },
  {
    id: "TRADE_IN_WORKFLOW",
    label: "Trade-In Workflow",
    eyebrow: "Agent plan",
    description: "Run the safe golf trade-in workflow.",
  },
  {
    id: "EXECUTION_TRACE",
    label: "Execution Trace",
    eyebrow: "Audit trail",
    description: "Inspect routing, tools, evidence, validation, and blocked mutations.",
  },
  {
    id: "HUMAN_REVIEW",
    label: "Human Review",
    eyebrow: "Control point",
    description: "See what uncertainty was routed to review.",
  },
  {
    id: "QUALITY_SUMMARY",
    label: "Quality Summary",
    eyebrow: "Outcome",
    description: "Summarize the current guided run.",
  },
];

const AGENT_PLAN = [
  "Validate extracted trade-in fields.",
  "Search product knowledge.",
  "Use approved internal tools.",
  "Prepare valuation context when evidence is available.",
  "Validate confidence and evidence.",
  "Escalate uncertainty to human review.",
  "Block unsafe mutations unless approved.",
];

function formatScore(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : value.toFixed(2);
}

function formatList(values: string[] | undefined) {
  return values && values.length > 0 ? values.join(", ") : "—";
}

function getStatusClassName(status: string) {
  return `agentic-demo-audit-event__status agentic-demo-audit-event__status--${status.toLowerCase().replace(/_/g, "-")}`;
}

function getStepIndex(step: GuidedStep) {
  return GUIDED_STEPS.findIndex((item) => item.id === step);
}

function getInitialCurrentRunReviewItems(
  tradeInResult: ExecuteEndToEndAgenticTradeInDemoResponse | null,
) {
  return tradeInResult?.reviewQueueItemsCreated ?? [];
}


function formatGeneratedWorkflowInput(
  result: ExecuteMultiSourceIntakeDemoResponse,
) {
  if (result.cleanedDatasetPreview.length === 0) {
    return "";
  }

  return result.cleanedDatasetPreview
    .map((record, index) => {
      const identity = [record.brand, record.productLine, record.category]
        .filter(Boolean)
        .join(" ");

      const details = [
        record.shaftFlex ? "shaft flex " + record.shaftFlex : null,
        record.condition ? "condition " + record.condition : null,
        record.tradeInValue === null ? null : "trade value $" + record.tradeInValue,
        record.storeId ? "store " + record.storeId : null,
        record.reviewNeeded ? "review needed" : "review clear",
        record.missingFields.length > 0
          ? "missing " + record.missingFields.join(", ")
          : null,
      ].filter(Boolean);

      return String(index + 1) + ". " + (identity || "Unknown equipment") +
        (details.length > 0 ? " — " + details.join("; ") : "");
    })
    .join("\n");
}
export function GuidedDemoPathPage({
  activeStep,
  onActiveStepChange,
  sourceIntakeResult,
  sourceIntakeError,
  sourceIntakeSuccess,
  isRunningSourceIntake,
  tradeInRawInput,
  tradeInResult,
  tradeInError,
  tradeInSuccess,
  isRunningTradeInWorkflow,
  workflowRuns,
  reviewQueueItems,
  openReviewQueueItemCount,
  toolCallLogCount,
  onTradeInRawInputChange,
  onRunSourceIntake,
  onRunTradeInWorkflow,
  onViewChange,
}: {
  activeStep: GuidedStep;
  onActiveStepChange: (step: GuidedStep) => void;
  sourceIntakeResult: ExecuteMultiSourceIntakeDemoResponse | null;
  sourceIntakeError: string | null;
  sourceIntakeSuccess: string | null;
  isRunningSourceIntake: boolean;
  tradeInRawInput: string;
  tradeInResult: ExecuteEndToEndAgenticTradeInDemoResponse | null;
  tradeInError: string | null;
  tradeInSuccess: string | null;
  isRunningTradeInWorkflow: boolean;
  workflowRuns: GlobalWorkflowRunSummary[];
  reviewQueueItems: GlobalReviewQueueItem[];
  openReviewQueueItemCount: number;
  toolCallLogCount: number;
  onTradeInRawInputChange: (rawInput: string) => void;
  onRunSourceIntake: (request?: ExecuteMultiSourceIntakeDemoRequest) => void;
  onRunTradeInWorkflow: (event: FormEvent<HTMLFormElement>) => void;
  onViewChange: (view: AppView) => void;
}) {
  const setActiveStep = onActiveStepChange;
  const [workflowInputBaseline, setWorkflowInputBaseline] = useState("");

  const currentRunWorkflow = useMemo(() => {
    const workflowRunId =
      tradeInResult?.persisted.workflowRunId ?? sourceIntakeResult?.persistedIds.workflowRunId;

    if (!workflowRunId) {
      return null;
    }

    return workflowRuns.find((run) => run.id === workflowRunId) ?? null;
  }, [sourceIntakeResult, tradeInResult, workflowRuns]);

  const currentRunReviewItems = getInitialCurrentRunReviewItems(tradeInResult);

  const blockedMutation = tradeInResult?.blockedToolCallResult ?? null;
  const providerFallbackUsed = Boolean(
    tradeInResult?.modelRoutingDecision.fallbackProvider ||
      tradeInResult?.modelCallLog.attemptLogs?.some((attempt) => attempt.status === "SKIPPED"),
  );
  const currentStepIndex = getStepIndex(activeStep);
  const hasEditedGeneratedInput =
    Boolean(workflowInputBaseline) && tradeInRawInput !== workflowInputBaseline;

  function isStepComplete(step: GuidedStep) {
    const stepIndex = getStepIndex(step);

    if (stepIndex >= currentStepIndex) {
      return false;
    }

    if (step === "SCENARIO") {
      return true;
    }

    if (step === "SOURCE_INTAKE" || step === "AI_READY_OUTPUT") {
      return Boolean(sourceIntakeResult);
    }

    return Boolean(tradeInResult);
  }

  function canOpenStep(step: GuidedStep) {
    if (step === "SCENARIO" || step === "SOURCE_INTAKE") {
      return true;
    }

    if (step === "AI_READY_OUTPUT" || step === "TRADE_IN_WORKFLOW") {
      return Boolean(sourceIntakeResult);
    }

    return Boolean(tradeInResult);
  }

  function handleGuidedSourceIntakeRun(
    request?: ExecuteMultiSourceIntakeDemoRequest,
  ) {
    onRunSourceIntake(request);
    setActiveStep("AI_READY_OUTPUT");
  }

  function restoreGeneratedWorkflowInput() {
    if (!workflowInputBaseline) {
      return;
    }

    onTradeInRawInputChange(workflowInputBaseline);
  }

  useEffect(() => {
    if (activeStep !== "TRADE_IN_WORKFLOW") {
      return;
    }

    if (!tradeInRawInput || workflowInputBaseline) {
      return;
    }

    setWorkflowInputBaseline(tradeInRawInput);
  }, [activeStep, tradeInRawInput, workflowInputBaseline]);

  function renderStepStatus(step: GuidedStep, index: number) {
    if (isStepComplete(step)) {
      return "Done";
    }

    if (index === currentStepIndex) {
      return "Current";
    }

    if (!canOpenStep(step)) {
      return "Locked";
    }

    return "Ready";
  }

  return (
    <div className="guided-workflow-page">
      <div className="guided-workflow-shell">
        <aside className="guided-workflow-stepper" aria-label="Guided workflow steps">
          {GUIDED_STEPS.map((step, index) => {
            const status = renderStepStatus(step.id, index);

            return (
              <button
                className={
                  step.id === activeStep
                    ? "guided-workflow-stepper__item guided-workflow-stepper__item--active"
                    : "guided-workflow-stepper__item"
                }
                disabled={!canOpenStep(step.id)}
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                type="button"
              >
                <span>{index + 1}</span>
                <div>
                  <small>{step.eyebrow}</small>
                  <strong>{step.label}</strong>
                  <em>{status}</em>
                </div>
              </button>
            );
          })}
        </aside>

        <section className="guided-workflow-panel">
          {activeStep === "SCENARIO" ? (
            <article className="guided-workflow-card guided-workflow-card--hero">
              <span className="model-route-card__eyebrow">Scenario</span>
              <h3>Messy trade-in data should become controlled workflow output.</h3>
              <p>
                Golf retail trade-in information arrives through customer emails,
                counter notes, malformed CSV exports, and operations logs. SwingOps AI
                normalizes the data, prepares AI-ready assets, runs a safe workflow,
                validates confidence and evidence, escalates uncertainty, and preserves
                an execution trail.
              </p>

              <div className="guided-workflow-flowline">
                <span>Source Intake</span>
                <span>AI-Ready Output</span>
                <span>Trade-In Workflow</span>
                <span>Execution Trace</span>
                <span>Human Review</span>
                <span>Quality Summary</span>
              </div>

              <button onClick={() => setActiveStep("SOURCE_INTAKE")} type="button">
                Continue to Source Intake
              </button>

              <details className="guided-workflow-details">
                <summary>View more: what this workflow demonstrates</summary>
                <div className="guided-workflow-proof-grid">
                  <article>
                    <strong>Data readiness</strong>
                    <p>Raw operational inputs become records, schema, metadata, quality signals, and RAG readiness.</p>
                  </article>
                  <article>
                    <strong>Controlled execution</strong>
                    <p>Model routing, approved tools, policy checks, blocked mutations, and audit logs stay connected to the run.</p>
                  </article>
                  <article>
                    <strong>Human review</strong>
                    <p>Ambiguous equipment details are routed for review instead of being silently accepted.</p>
                  </article>
                </div>
              </details>
            </article>
          ) : null}

          {activeStep === "SOURCE_INTAKE" ? (
            <article className="guided-workflow-card guided-workflow-card--intake">
              <div className="guided-workflow-card__header">
                <div>
                  <span className="model-route-card__eyebrow">Source Intake</span>
                  <h3>Build the messy source set that starts the workflow.</h3>
                  <p>
                    Name each source, choose paste or upload, select the source type,
                    then provide content or populate sample data. Normalize sources when
                    the intake set is ready.
                  </p>
                </div>
              </div>

              <GuidedSourceIntakeBuilder
                error={sourceIntakeError}
                isRunning={isRunningSourceIntake}
                onRunSources={handleGuidedSourceIntakeRun}
                result={sourceIntakeResult}
                success={sourceIntakeSuccess}
              />
            </article>
          ) : null}

          {activeStep === "AI_READY_OUTPUT" ? (
            <article className="guided-workflow-card">
              <div className="guided-workflow-card__header guided-workflow-card__header--ai-ready">
                <div>
                  <span className="model-route-card__eyebrow">AI-Ready Output</span>
                  <h3>Raw source data becomes workflow-ready assets.</h3>
                </div>
                <button disabled={!sourceIntakeResult} onClick={() => setActiveStep("TRADE_IN_WORKFLOW")} type="button">
                  Continue to Trade-In Workflow
                </button>
                <p>
                  Review the structured output before running the trade-in workflow.
                </p>
              </div>

              {sourceIntakeResult ? (
                <>
                  <div className="guided-workflow-metrics">
                    <article>
                      <strong>{sourceIntakeResult.recordsExtracted}</strong>
                      <span>Records extracted</span>
                    </article>
                    <article>
                      <strong>{sourceIntakeResult.inferredDatasetSchema.length}</strong>
                      <span>Schema fields</span>
                    </article>
                    <article>
                      <strong>{sourceIntakeResult.reviewNeeded}</strong>
                      <span>Review signals</span>
                    </article>
                    <article>
                      <strong>
                        {sourceIntakeResult.ragReadinessSummary.ragIndexReady ? "Ready" : "Partial"}
                      </strong>
                      <span>RAG readiness</span>
                    </article>
                  </div>

                  <div className="multi-source-intake-table-wrap">
                    <table className="multi-source-intake-table">
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th>Brand</th>
                          <th>Product</th>
                          <th>Category</th>
                          <th>Flex</th>
                          <th>Condition</th>
                          <th>Value</th>
                          <th>Store</th>
                          <th>Review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sourceIntakeResult.cleanedDatasetPreview.slice(0, 6).map((record) => (
                          <tr key={record.id}>
                            <td>{record.sourceType.replace(/_/g, " ")}</td>
                            <td>{record.brand ?? "—"}</td>
                            <td>{record.productLine ?? "—"}</td>
                            <td>{record.category ?? "—"}</td>
                            <td>{record.shaftFlex ?? "—"}</td>
                            <td>{record.condition ?? "—"}</td>
                            <td>{record.tradeInValue === null ? "—" : `${record.tradeInValue}`}</td>
                            <td>{record.storeId ?? "—"}</td>
                            <td>{record.reviewNeeded ? "Needed" : "Clear"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <details className="guided-workflow-details guided-workflow-details--ai-ready">
                    <summary>
                      <span>Cleaned source evidence</span>
                    </summary>
                    <div className="guided-ai-ready-evidence-grid">
                      {sourceIntakeResult.sourceResults.map((sourceResult) => (
                        <article className="guided-ai-ready-evidence-card" key={sourceResult.id}>
                          <div className="guided-ai-ready-evidence-card__header">
                            <div>
                              <span className="model-route-card__eyebrow">
                                {sourceResult.sourceType.replace(/_/g, " ")}
                              </span>
                              <h4>{sourceResult.sourceName}</h4>
                            </div>
                            <span className="agentic-demo-pill agentic-demo-pill--success">
                              {formatScore(sourceResult.confidence)}
                            </span>
                          </div>

                          <dl className="agentic-demo-metadata">
                            <div>
                              <dt>Records</dt>
                              <dd>{sourceResult.extractedRecords.length}</dd>
                            </div>
                            <div>
                              <dt>Brands</dt>
                              <dd>{formatList(sourceResult.metadata.detectedBrands)}</dd>
                            </div>
                            <div>
                              <dt>Fields</dt>
                              <dd>{sourceResult.ragIndexReadiness.metadataFields.length}</dd>
                            </div>
                            <div>
                              <dt>Chunks</dt>
                              <dd>{sourceResult.embeddingReadiness.chunkCount}</dd>
                            </div>
                          </dl>

                          <pre>{sourceResult.cleanedText}</pre>
                        </article>
                      ))}
                    </div>
                  </details>
                </>
              ) : (
                <EmptyState
                  title="Normalize sources first"
                  message="The workflow needs AI-ready records before it can run."
                />
              )}
            </article>
          ) : null}

          {activeStep === "TRADE_IN_WORKFLOW" ? (
            <article className="guided-workflow-card guided-workflow-card--launch">
              <div className="guided-workflow-card__header">
                <div>
                  <span className="model-route-card__eyebrow">Trade-In Workflow</span>
                  <h3>Review and launch the controlled agent workflow.</h3>
                  <p>
                    The workflow input is generated from the AI-ready records, then
                    kept editable so store context, corrections, or edge cases can be
                    added before execution.
                  </p>
                </div>
              </div>

              <div className="guided-workflow-launch-grid">
                <section className="guided-workflow-input-card">
                  <div className="guided-workflow-input-card__header">
                    <div>
                      <span className="model-route-card__eyebrow">
                        Workflow input source
                      </span>
                      <h4>Workflow input</h4>
                      <p>
                        This text is the handoff passed into the trade-in workflow. It
                        can be edited before launch to simulate corrected store notes or
                        additional associate context.
                      </p>
                    </div>

                  </div>

                  <form
                    className="agentic-demo-form guided-workflow-run-form"
                    onSubmit={onRunTradeInWorkflow}
                  >
                    <div className="guided-workflow-generated-input-header">
                      <label htmlFor="guided-trade-in-input">
                        Workflow input
                      </label>
                      <button
                        disabled={isRunningTradeInWorkflow || !workflowInputBaseline}
                        onClick={(event) => {
                          event.preventDefault();
                          restoreGeneratedWorkflowInput();
                        }}
                        type="button"
                      >
                        Reset to AI-ready output
                      </button>
                    </div>

                    <textarea
                      id="guided-trade-in-input"
                      onChange={(event) =>
                        onTradeInRawInputChange(event.target.value)
                      }
                      rows={7}
                      value={tradeInRawInput}
                    />
                    <p className="guided-workflow-generated-input-state">
                      {hasEditedGeneratedInput
                        ? "Edited from AI-ready output"
                        : "Showing AI-ready output"}
                    </p>

                    <div className="guided-workflow-launch-callout">
                      <span className="model-route-card__eyebrow">Start will run</span>
                      <ul>
                        <li>model routing and fallback logging</li>
                        <li>knowledge search for product evidence</li>
                        <li>approved read-only tool calls</li>
                        <li>validation, blocked mutation checks, and review creation</li>
                      </ul>
                    </div>

                    <div className="guided-workflow-run-actions">
                      {tradeInSuccess ? (
                        <>
                          <button
                            className="guided-workflow-run-actions__secondary"
                            disabled={isRunningTradeInWorkflow}
                            type="submit"
                          >
                            {isRunningTradeInWorkflow ? "Running…" : "Run Again"}
                          </button>
                          <button
                            onClick={() => setActiveStep("EXECUTION_TRACE")}
                            type="button"
                          >
                            Continue to Execution Trace
                          </button>
                        </>
                      ) : (
                        <button disabled={isRunningTradeInWorkflow} type="submit">
                          {isRunningTradeInWorkflow
                            ? "Running…"
                            : "Start Trade-In Workflow"}
                        </button>
                      )}
                    </div>

                    {tradeInError ? (
                      <EmptyState title="Unable to run trade-in workflow" message={tradeInError} />
                    ) : null}
                    {tradeInSuccess ? (
                      <div className="guided-workflow-run-complete">
                        <span className="model-route-card__eyebrow">Workflow run complete</span>
                        <p>{tradeInSuccess}</p>
                        <p>
                          The run has created an execution trace, captured model routing,
                          checked product knowledge, executed approved read-only tools,
                          and prepared review work where needed.
                        </p>
                      </div>
                    ) : null}
                  </form>
                </section>

                <aside className="guided-workflow-policy-panel">
                  <span className="model-route-card__eyebrow">Run setup</span>
                  <h4>Controls applied to this workflow run</h4>

                  <div className="guided-workflow-policy-grid">
                    <article className="guided-workflow-policy-card">
                      <span>Validation</span>
                      <strong>Strict field checks</strong>
                      <p>Missing shaft, model, condition, or confidence gaps stay visible.</p>
                    </article>
                    <article className="guided-workflow-policy-card">
                      <span>Grounding</span>
                      <strong>Knowledge search enabled</strong>
                      <p>Product evidence is checked before workflow output is trusted.</p>
                    </article>
                    <article className="guided-workflow-policy-card">
                      <span>Tool safety</span>
                      <strong>Read-only first</strong>
                      <p>Approved internal tools can run. Unsafe mutations are blocked.</p>
                    </article>
                    <article className="guided-workflow-policy-card">
                      <span>Human review</span>
                      <strong>Escalate uncertainty</strong>
                      <p>Low-confidence or incomplete records create review work.</p>
                    </article>
                  </div>
                </aside>
              </div>

              <section className="guided-workflow-preview-panel">
                <div>
                  <span className="model-route-card__eyebrow">Execution preview</span>
                  <h4>What will happen when this workflow starts</h4>
                </div>

                <div className="guided-workflow-preview-list">
                  {AGENT_PLAN.map((planStep, index) => (
                    <article key={planStep}>
                      <span>{index + 1}</span>
                      <p>{planStep}</p>
                    </article>
                  ))}
                </div>
              </section>

              <details className="guided-workflow-details">
                <summary>View more: policy detail</summary>
                <div className="guided-workflow-proof-grid">
                  <article>
                    <strong>Tool-selection policy</strong>
                    <p>Use read-only internal tools by default and evaluate policy before every call.</p>
                  </article>
                  <article>
                    <strong>Validation policy</strong>
                    <p>Low confidence, missing shaft data, and weak product evidence stay visible for review.</p>
                  </article>
                  <article>
                    <strong>Fallback policy</strong>
                    <p>Model calls keep provider attempt logs so routing decisions can be audited.</p>
                  </article>
                </div>
              </details>
            </article>
          ) : null}

          {activeStep === "EXECUTION_TRACE" ? (
            <article className="guided-workflow-card">
              <div className="guided-workflow-card__header">
                <div>
                  <span className="model-route-card__eyebrow">Execution Trace</span>
                  <h3>Technical proof for the current run.</h3>
                  <p>
                    This trace only appears after the guided workflow creates evidence for
                    the current run.
                  </p>
                </div>
                <button onClick={() => onViewChange("WORKFLOW_RUNS")} type="button">
                  Inspect Full Audit Trail
                </button>
              </div>

              {tradeInResult ? (
                <>
                  <div className="guided-execution-evidence-grid">
                    <article className="guided-execution-evidence-card guided-execution-evidence-card--wide">
                      <span className="model-route-card__eyebrow">Agent plan</span>
                      <strong>
                        {tradeInResult.agentPlan.length} planned step(s)
                      </strong>
                      <p>
                        The agent planned validation, knowledge grounding, approved
                        tool selection, targeted retry, review handoff, policy
                        enforcement, and audit recording before summarizing the run.
                      </p>
                    </article>

                    <article className="guided-execution-evidence-card">
                      <span className="model-route-card__eyebrow">Validation checks</span>
                      <strong>
                        {tradeInResult.workflowQualitySummary.validationPassed} passed,{" "}
                        {tradeInResult.workflowQualitySummary.validationWarnings} warning(s)
                      </strong>
                      <p>
                        Field completeness, confidence, evidence, review routing,
                        and mutation policy checks are structured as first-class
                        validation output.
                      </p>
                    </article>

                    <article className="guided-execution-evidence-card">
                      <span className="model-route-card__eyebrow">Targeted retry</span>
                      <strong>
                        {tradeInResult.workflowQualitySummary.retryAttempts} retry attempt(s)
                      </strong>
                      <p>
                        Retry behavior is tracked separately from provider fallback
                        and focuses only on recoverable extraction uncertainty.
                      </p>
                    </article>
                    <article className="guided-execution-evidence-card">
                      <span className="model-route-card__eyebrow">Model routing</span>
                      <strong>
                        {tradeInResult.modelRoutingDecision.selectedProvider} /{" "}
                        {tradeInResult.modelRoutingDecision.selectedModel}
                      </strong>
                      <dl className="agentic-demo-metadata">
                        <div>
                          <dt>Fallback used</dt>
                          <dd>{tradeInResult.providerFallbackTrace.fallbackUsed ? "Yes" : "No"}</dd>
                        </div>
                        <div>
                          <dt>Provider attempts</dt>
                          <dd>{tradeInResult.providerFallbackTrace.attempts.length}</dd>
                        </div>
                      </dl>
                    </article>

                    <article className="guided-execution-evidence-card">
                      <span className="model-route-card__eyebrow">Knowledge grounding</span>
                      <strong>
                        {tradeInResult.finalSummary.knowledgeMatchCount} weighted match(es)
                      </strong>
                      <p>
                        Product knowledge search was attempted and logged before
                        workflow output was trusted.
                      </p>
                    </article>

                    <article className="guided-execution-evidence-card">
                      <span className="model-route-card__eyebrow">Tool safety</span>
                      <strong>
                        {tradeInResult.finalSummary.successfulReadOnlyToolCallCount} read-only call(s),{" "}
                        {tradeInResult.finalSummary.blockedMutationToolCallCount} blocked mutation(s)
                      </strong>
                      <p>
                        Approved read-only tools executed. Unsafe mutation requests
                        were blocked before execution.
                      </p>
                    </article>

                    <article className="guided-execution-evidence-card">
                      <span className="model-route-card__eyebrow">Human review</span>
                      <strong>
                        {tradeInResult.reviewQueueItemsCreated.length} review item(s) created
                      </strong>
                      <p>
                        Validation found uncertainty. A human review item was created
                        instead of silently accepting the record.
                      </p>
                    </article>

                    <article className="guided-execution-evidence-card guided-execution-evidence-card--wide">
                      <span className="model-route-card__eyebrow">Audit proof</span>
                      <strong>{tradeInResult.auditTrail.length} audit event(s) captured</strong>
                      <p>
                        The run includes ordered evidence for planning, validation,
                        retry behavior, routing, tool execution, blocked mutation
                        checks, and review creation.
                      </p>
                    </article>

                    {blockedMutation ? (
                      <article className="guided-execution-evidence-card guided-execution-evidence-card--blocked">
                        <span className="agentic-demo-audit-event__status agentic-demo-audit-event__status--blocked">
                          BLOCKED
                        </span>
                        <strong>Unsafe mutation blocked</strong>
                        <p>{blockedMutation.policyReason}</p>
                      </article>
                    ) : null}
                  </div>

                  <button onClick={() => setActiveStep("HUMAN_REVIEW")} type="button">
                    Continue to Human Review
                  </button>

                  <details className="guided-workflow-details">
                    <summary>View more: agent plan, validation, retry, tools, and knowledge evidence</summary>
                    <div className="guided-workflow-proof-grid">
                      <article>
                        <strong>Agent Plan</strong>
                        <ol className="guided-workflow-compact-list">
                          {tradeInResult.agentPlan.map((step) => (
                            <li key={step.id}>
                              <span>{step.label}</span>
                              <small>
                                {step.status} · {step.actionType}
                              </small>
                            </li>
                          ))}
                        </ol>
                      </article>

                      <article>
                        <strong>Validation Checks</strong>
                        <ol className="guided-workflow-compact-list">
                          {tradeInResult.validationChecks.slice(0, 8).map((check) => (
                            <li key={check.id}>
                              <span>{check.label}</span>
                              <small>
                                {check.status} · {check.message}
                              </small>
                            </li>
                          ))}
                        </ol>
                      </article>

                      <article>
                        <strong>Retry Events</strong>
                        <ol className="guided-workflow-compact-list">
                          {tradeInResult.retryEvents.map((event) => (
                            <li key={event.id}>
                              <span>{event.reason}</span>
                              <small>
                                {event.status} · {event.message}
                              </small>
                            </li>
                          ))}
                        </ol>
                      </article>
                      <article>
                        <strong>Model Routing & Fallback</strong>
                        <dl className="agentic-demo-metadata">
                          <div>
                            <dt>Provider</dt>
                            <dd>{tradeInResult.modelRoutingDecision.selectedProvider}</dd>
                          </div>
                          <div>
                            <dt>Model</dt>
                            <dd>{tradeInResult.modelRoutingDecision.selectedModel}</dd>
                          </div>
                          <div>
                            <dt>Fallback</dt>
                            <dd>{tradeInResult.providerFallbackTrace.fallbackUsed ? "Yes" : "No"}</dd>
                          </div>
                          <div>
                            <dt>Attempts</dt>
                            <dd>{tradeInResult.providerFallbackTrace.attempts.length}</dd>
                          </div>
                        </dl>
                      </article>

                      <article>
                        <strong>Provider Fallback Trace</strong>
                        <ol className="guided-workflow-compact-list">
                          {tradeInResult.providerFallbackTrace.attempts.map((attempt) => (
                            <li key={`${attempt.attemptOrder}-${attempt.provider}-${attempt.model}`}>
                              <span>
                                {attempt.provider} / {attempt.model}
                              </span>
                              <small>
                                {attempt.status}
                                {attempt.reason ? ` · ${attempt.reason}` : ""}
                              </small>
                            </li>
                          ))}
                        </ol>
                      </article>

                      <article>
                        <strong>Tool Selection Rationale</strong>
                        <ol className="guided-workflow-compact-list">
                          {tradeInResult.toolSelectionRationales.map((tool) => (
                            <li key={tool.toolName}>
                              <span>{tool.toolName}</span>
                              <small>{tool.rationale}</small>
                            </li>
                          ))}
                        </ol>
                      </article>

                      <article>
                        <strong>Internal Tool Connectors</strong>
                        <dl className="agentic-demo-metadata">
                          <div>
                            <dt>Total calls</dt>
                            <dd>{tradeInResult.toolCallResults.length}</dd>
                          </div>
                          <div>
                            <dt>Read-only success</dt>
                            <dd>{tradeInResult.finalSummary.successfulReadOnlyToolCallCount}</dd>
                          </div>
                          <div>
                            <dt>Blocked</dt>
                            <dd>{tradeInResult.finalSummary.blockedMutationToolCallCount}</dd>
                          </div>
                          <div>
                            <dt>Policy checked</dt>
                            <dd>Yes</dd>
                          </div>
                        </dl>
                      </article>

                      <article>
                        <strong>Knowledge Evidence</strong>
                        <dl className="agentic-demo-metadata">
                          <div>
                            <dt>Matches</dt>
                            <dd>{tradeInResult.finalSummary.knowledgeMatchCount}</dd>
                          </div>
                          <div>
                            <dt>Top query</dt>
                            <dd>{tradeInResult.knowledgeMatchesByItem[0]?.query ?? "—"}</dd>
                          </div>
                        </dl>
                      </article>
                    </div>
                  </details>
                </>
              ) : (
                <EmptyState
                  title="Run the trade-in workflow first"
                  message="The execution trace is intentionally locked until the current workflow creates model, tool, evidence, and review logs."
                />
              )}
            </article>
          ) : null}

          {activeStep === "HUMAN_REVIEW" ? (
            <article className="guided-workflow-card">
              <div className="guided-workflow-card__header">
                <div>
                  <span className="model-route-card__eyebrow">Human Review</span>
                  <h3>Review work created by this workflow.</h3>
                  <p>
                    The primary view focuses on review items from the current guided run.
                    Global queue depth stays secondary.
                  </p>
                </div>
                <button onClick={() => onViewChange("REVIEW_QUEUE")} type="button">
                  Inspect Full Review Queue
                </button>
              </div>

              {tradeInResult ? (
                <>
                  <div className="guided-workflow-metrics">
                    <article>
                      <strong>{currentRunReviewItems.length}</strong>
                      <span>Current-run review items</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.reviewOutcomes.length}</strong>
                      <span>Validation-linked outcomes</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.finalSummary.lowConfidenceItemCount}</strong>
                      <span>Low-confidence records</span>
                    </article>
                    <article>
                      <strong>{openReviewQueueItemCount}</strong>
                      <span>Global open queue</span>
                    </article>
                    <article>
                      <strong>Captured</strong>
                      <span>Source evidence</span>
                    </article>
                  </div>

                  {currentRunReviewItems.length > 0 ? (
                    <div className="agentic-demo-card-list">
                      {currentRunReviewItems.map((item) => (
                        <article className="agentic-demo-card" key={item.id}>
                          <div className="agentic-demo-card__header">
                            <div>
                              <span className="model-route-card__eyebrow">{item.status}</span>
                              <h4>{item.reason}</h4>
                            </div>
                            <span className="agentic-demo-pill agentic-demo-pill--warning">
                              Review needed
                            </span>
                          </div>
                          <p>
                            Validation found uncertainty. Suggested action: confirm
                            missing shaft, model, or condition details, then approve
                            or correct the normalized trade-in record.
                          </p>
                          <details className="guided-workflow-details">
                            <summary>View more: validation warnings and extracted fields</summary>
                            <pre>
                              {JSON.stringify(
                                {
                                  reviewOutcome: tradeInResult.reviewOutcomes.find(
                                    (outcome) => outcome.reviewQueueItemId === item.id,
                                  ),
                                  proposedGolfClubJson: item.proposedGolfClubJson,
                                },
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No current-run review item"
                      message="This run did not create a review item."
                    />
                  )}

                  <button onClick={() => setActiveStep("QUALITY_SUMMARY")} type="button">
                    Continue to Quality Summary
                  </button>
                </>
              ) : (
                <EmptyState
                  title="Run the trade-in workflow first"
                  message="Human review is intentionally locked until the workflow creates current-run results."
                />
              )}
            </article>
          ) : null}

          {activeStep === "QUALITY_SUMMARY" ? (
            <article className="guided-workflow-card">
              <div className="guided-workflow-card__header">
                <div>
                  <span className="model-route-card__eyebrow">Quality Summary</span>
                  <h3>Current guided run outcome.</h3>
                  <p>
                    The final summary reports only supported data from the guided run.
                  </p>
                </div>
                <button onClick={() => onViewChange("MCP_CONNECTORS")} type="button">
                  Inspect Tool Connectors
                </button>
              </div>

              {tradeInResult ? (
                <>
                  <div className="guided-workflow-metrics">
                    <article>
                      <strong>{tradeInResult.workflowQualitySummary.status}</strong>
                      <span>Quality status</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.workflowQualitySummary.recordsProcessed}</strong>
                      <span>Records processed</span>
                    </article>
                    <article>
                      <strong>
                        {tradeInResult.workflowQualitySummary.validationPassed}
                      </strong>
                      <span>Validation passed</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.workflowQualitySummary.validationWarnings}</strong>
                      <span>Validation warnings</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.workflowQualitySummary.retryAttempts}</strong>
                      <span>Retry attempts</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.workflowQualitySummary.reviewItemsCreated}</strong>
                      <span>Needs review</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.workflowQualitySummary.toolCalls}</strong>
                      <span>Tool calls</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.workflowQualitySummary.blockedMutations}</strong>
                      <span>Blocked mutations</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.workflowQualitySummary.providerFallbackUsed ? "Yes" : "No"}</strong>
                      <span>Provider fallback used</span>
                    </article>
                    <article>
                      <strong>{currentRunWorkflow?.status ?? "Created"}</strong>
                      <span>Workflow status</span>
                    </article>
                    <article>
                      <strong>{toolCallLogCount}</strong>
                      <span>System tool logs</span>
                    </article>
                  </div>

                  <article className="guided-execution-evidence-card guided-execution-evidence-card--wide">
                    <span className="model-route-card__eyebrow">Run summary</span>
                    <strong>{tradeInResult.workflowQualitySummary.evidenceCoverage}</strong>
                    <p>{tradeInResult.workflowQualitySummary.summary}</p>
                  </article>

                  <details className="guided-workflow-details">
                    <summary>View more: quality summary and persisted audit identifiers</summary>
                    <pre>
                      {JSON.stringify(
                        {
                          workflowQualitySummary: tradeInResult.workflowQualitySummary,
                          workflowRunId: tradeInResult.persisted.workflowRunId,
                          modelCallLogId: tradeInResult.persisted.modelCallLogId,
                          toolCallLogIds: tradeInResult.persisted.toolCallLogIds,
                          reviewQueueItemIds: tradeInResult.persisted.reviewQueueItemIds,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </>
              ) : (
                <EmptyState
                  title="No final summary yet"
                  message="Complete the trade-in workflow to produce a current-run quality summary."
                />
              )}
            </article>
          ) : null}
        </section>
      </div>
    </div>
  );
}
