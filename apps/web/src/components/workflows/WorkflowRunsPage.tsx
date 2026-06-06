import type { IntakeBatchDetail } from "../../types/intake";
import type {
  ExecuteAgenticTradeInRunResponse,
  ExecuteWorkflowToolCallingPlanResponse,
  GlobalWorkflowRunSummary,
  ModelCallAttemptStatus,
  ModelCallLog,
  WorkflowRunDetail,
  WorkflowRunStatus,
} from "../../types/workflow";
import {
  WORKFLOW_RUN_STATUS_FILTERS,
  type WorkflowRunStatusFilter,
} from "../../constants/workflows";
import { formatShortId } from "../../utils/formatting";
import {
  getGroundingMatchNamesFromReviewItem,
  getGroundingSummaryFromReviewItem,
  getWorkflowReviewQueueDisplayText,
} from "../../utils/reviewQueueDisplay";
import { getWorkflowRunSourcePreview } from "../../utils/workflowDisplay";
import { isGroundingToolCallLog } from "../../utils/toolCallDisplay";
import { DashboardSection } from "../DashboardSection";
import { EmptyState } from "../EmptyState";
import { ToolCallLogCard } from "./ToolCallLogCard";
import { WorkflowToolCallingPlanPanel } from "./WorkflowToolCallingPlanPanel";

function formatProviderAttemptCost(cost: number | null) {
  if (cost === null) {
    return "—";
  }

  return `$${cost.toFixed(6)}`;
}

function formatProviderAttemptLatency(latencyMs: number | null) {
  if (latencyMs === null) {
    return "—";
  }

  return `${latencyMs}ms`;
}

function getProviderAttemptStatusClassName(status: ModelCallAttemptStatus) {
  const normalizedStatus = status.toLowerCase().replace(/_/g, "-");

  return `provider-attempt-card__status provider-attempt-card__status--${normalizedStatus}`;
}

function ModelCallLogCard({ modelCallLog }: { modelCallLog: ModelCallLog }) {
  const attemptLogs = modelCallLog.attemptLogs ?? [];

  return (
    <article className="workflow-model-log-card">
      <div className="workflow-model-log-card__header">
        <div>
          <strong>
            Final model: {modelCallLog.provider} / {modelCallLog.model}
          </strong>
          <p>
            Status: {modelCallLog.status} · Latency:{" "}
            {formatProviderAttemptLatency(modelCallLog.latencyMs)} · Estimated
            cost: {formatProviderAttemptCost(modelCallLog.estimatedCostUsd)}
          </p>
          {modelCallLog.errorMessage ? (
            <p className="workflow-model-log-card__error">
              Error: {modelCallLog.errorMessage}
            </p>
          ) : null}
        </div>
      </div>

      <div className="provider-attempt-list">
        <h6>Provider attempts</h6>

        {attemptLogs.length === 0 ? (
          <p>No provider attempts recorded for this model call.</p>
        ) : (
          attemptLogs.map((attempt, attemptIndex) => (
            <article className="provider-attempt-card" key={attempt.id}>
              <div className="provider-attempt-card__header">
                <strong>
                  {attemptIndex + 1}. {attempt.provider} / {attempt.model}
                </strong>
                <span className={getProviderAttemptStatusClassName(attempt.status)}>
                  {attempt.status}
                </span>
              </div>

              <dl className="provider-attempt-card__metadata">
                <div>
                  <dt>Reason</dt>
                  <dd>{attempt.reason ?? "—"}</dd>
                </div>
                <div>
                  <dt>Error</dt>
                  <dd>{attempt.errorMessage ?? "—"}</dd>
                </div>
                <div>
                  <dt>Latency</dt>
                  <dd>{formatProviderAttemptLatency(attempt.latencyMs)}</dd>
                </div>
                <div>
                  <dt>Estimated cost</dt>
                  <dd>{formatProviderAttemptCost(attempt.estimatedCostUsd)}</dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </div>
    </article>
  );
}


export function WorkflowRunsPage({
  workflowRuns,
  filteredWorkflowRuns,
  workflowRunStatusCounts,
  statusFilter,
  selectedWorkflowRunId,
  selectedWorkflowRunDetail,
  selectedBatchItems,
  isLoading,
  error,
  isLoadingWorkflowRunDetail,
  workflowToolCallingPlanResult,
  isExecutingWorkflowToolCallingPlan,
  workflowToolCallingPlanError,
  workflowToolCallingPlanSuccess,
  isCreatingProviderFallbackDemo,
  providerFallbackDemoError,
  providerFallbackDemoSuccess,
  agenticTradeInRunResult,
  isExecutingAgenticTradeInRun,
  agenticTradeInRunError,
  agenticTradeInRunSuccess,
  onStatusFilterChange,
  onSelectWorkflowRun,
  onRunWorkflowToolCallingPlan,
  onCreateProviderFallbackDemo,
  onExecuteAgenticTradeInRun,
}: {
  workflowRuns: GlobalWorkflowRunSummary[];
  filteredWorkflowRuns: GlobalWorkflowRunSummary[];
  workflowRunStatusCounts: Record<WorkflowRunStatus, number>;
  statusFilter: WorkflowRunStatusFilter;
  selectedWorkflowRunId: string | null;
  selectedWorkflowRunDetail: WorkflowRunDetail | null;
  selectedBatchItems: IntakeBatchDetail["items"] | undefined;
  isLoading: boolean;
  error: string | null;
  isLoadingWorkflowRunDetail: boolean;
  workflowToolCallingPlanResult: ExecuteWorkflowToolCallingPlanResponse | null;
  isExecutingWorkflowToolCallingPlan: boolean;
  workflowToolCallingPlanError: string | null;
  workflowToolCallingPlanSuccess: string | null;
  isCreatingProviderFallbackDemo: boolean;
  providerFallbackDemoError: string | null;
  providerFallbackDemoSuccess: string | null;
  agenticTradeInRunResult: ExecuteAgenticTradeInRunResponse | null;
  isExecutingAgenticTradeInRun: boolean;
  agenticTradeInRunError: string | null;
  agenticTradeInRunSuccess: string | null;
  onStatusFilterChange: (statusFilter: WorkflowRunStatusFilter) => void;
  onSelectWorkflowRun: (workflowRunId: string) => void;
  onRunWorkflowToolCallingPlan: (workflowRunId: string) => void;
  onCreateProviderFallbackDemo: (workflowRunId: string) => void;
  onExecuteAgenticTradeInRun: (workflowRunId: string) => void;
}) {
  return (
    <DashboardSection
      title="Global Workflow Runs"
      description="Operations view for every workflow run across intake batches."
    >
      {!isLoading && !error ? (
        <div className="global-workflow-run-toolbar">
          <p className="section-summary">
            {filteredWorkflowRuns.length} shown /{" "}
            {workflowRuns.length} total workflow{" "}
            {workflowRuns.length === 1 ? "run" : "runs"}
          </p>

          <div
            aria-label="Filter workflow runs by status"
            className="workflow-run-status-filter"
          >
            {WORKFLOW_RUN_STATUS_FILTERS.map((nextStatusFilter) => {
              const count =
                nextStatusFilter === "ALL"
                  ? workflowRuns.length
                  : workflowRunStatusCounts[nextStatusFilter] ?? 0;

              return (
                <button
                  className={
                    statusFilter === nextStatusFilter
                      ? "workflow-run-status-filter__button workflow-run-status-filter__button--active"
                      : "workflow-run-status-filter__button"
                  }
                  key={nextStatusFilter}
                  onClick={() => onStatusFilterChange(nextStatusFilter)}
                  type="button"
                >
                  <span>{nextStatusFilter}</span>
                  <strong>{count}</strong>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {isLoading ? <p>Loading workflow runs…</p> : null}

      {error ? (
        <EmptyState title="Unable to load workflow runs" message={error} />
      ) : null}

      {!isLoading && !error && workflowRuns.length === 0 ? (
        <EmptyState
          title="No workflow runs found"
          message="Create an intake batch and start a workflow to populate the operations dashboard."
        />
      ) : null}

      {!isLoading &&
      !error &&
      workflowRuns.length > 0 &&
      filteredWorkflowRuns.length === 0 ? (
        <EmptyState
          title="No runs match this filter"
          message="Choose a different workflow status to inspect runs across the platform."
        />
      ) : null}

      {!isLoading && !error && filteredWorkflowRuns.length > 0 ? (
        <div className="global-workflow-run-list">
          {filteredWorkflowRuns.map((run) => (
            <article
              className={
                selectedWorkflowRunId === run.id
                  ? "global-workflow-run-card global-workflow-run-card--selected"
                  : "global-workflow-run-card"
              }
              key={run.id}
            >
              <div className="global-workflow-run-card__header">
                <div>
                  <span className="model-route-card__eyebrow">
                    {run.status}
                  </span>
                  <h3>{run.workflowName}</h3>
                  <p title={run.id}>{formatShortId(run.id)}</p>
                </div>

                <div className="global-workflow-run-card__actions">
                  <button
                    disabled={isLoadingWorkflowRunDetail}
                    onClick={() => onSelectWorkflowRun(run.id)}
                    type="button"
                  >
                    {selectedWorkflowRunId === run.id
                      ? "Logs Shown Below"
                      : "View Logs"}
                  </button>

                  <button
                    disabled={isCreatingProviderFallbackDemo}
                    onClick={() => onCreateProviderFallbackDemo(run.id)}
                    type="button"
                  >
                    {isCreatingProviderFallbackDemo
                      ? "Running Fallback Demo…"
                      : "Log High-Quality Fallback Demo"}
                  </button>

                  <button
                    disabled={isExecutingAgenticTradeInRun}
                    onClick={() => onExecuteAgenticTradeInRun(run.id)}
                    type="button"
                  >
                    {isExecutingAgenticTradeInRun
                      ? "Running Agentic Workflow…"
                      : "Run Agentic Trade-In Workflow"}
                  </button>
                </div>
              </div>

              <dl className="global-workflow-run-card__context">
                <div>
                  <dt>Batch</dt>
                  <dd>{run.intakeBatch?.name ?? "—"}</dd>
                </div>

                <div>
                  <dt>Item</dt>
                  <dd>{getWorkflowRunSourcePreview(run)}</dd>
                </div>

                <div>
                  <dt>Latest Model</dt>
                  <dd>
                    {run.latestModelCallLog
                      ? `${run.latestModelCallLog.provider} / ${run.latestModelCallLog.model}`
                      : "—"}
                  </dd>
                </div>

                <div>
                  <dt>Tool Audit Logs</dt>
                  <dd>
                    {run.auditOnlyToolCallLogCount} audit-only /{" "}
                    {run.totalToolCallLogCount} total
                  </dd>
                </div>

                <div>
                  <dt>Review Queue</dt>
                  <dd>
                    {run.openReviewQueueItemCount} open /{" "}
                    {run.totalReviewQueueItemCount} total
                  </dd>
                </div>
              </dl>

              {run.errorMessage ? (
                <p className="global-workflow-run-card__meta">
                  Error: {run.errorMessage}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {selectedWorkflowRunDetail ? (
        <div className="workflow-run-detail-panel global-workflow-run-detail-panel">
          <div>
            <span className="model-route-card__eyebrow">
              Selected Workflow Run Detail
            </span>
            <h4>{selectedWorkflowRunDetail.workflowRun.workflowName}</h4>
            <p title={selectedWorkflowRunDetail.workflowRun.id}>
              {formatShortId(selectedWorkflowRunDetail.workflowRun.id)}
            </p>
          </div>

          <div className="workflow-execution-summary">
            <p className="section-summary">
              High-quality fallback demo creates a HIGH_QUALITY routing log that attempts OpenAI, Azure OpenAI, then falls back to Mock.
            </p>

            {providerFallbackDemoSuccess ? (
              <p className="success-message">{providerFallbackDemoSuccess}</p>
            ) : null}

            {providerFallbackDemoError ? (
              <p className="error-message">{providerFallbackDemoError}</p>
            ) : null}

            {agenticTradeInRunSuccess ? (
              <p className="success-message">{agenticTradeInRunSuccess}</p>
            ) : null}

            {agenticTradeInRunError ? (
              <p className="error-message">{agenticTradeInRunError}</p>
            ) : null}

            {agenticTradeInRunResult?.workflowRunId === selectedWorkflowRunDetail.workflowRun.id ? (
              <article className="workflow-agentic-run-summary">
                <div>
                  <span className="model-route-card__eyebrow">Agentic Trade-In Run</span>
                  <h5>Routing + MCP + Eval</h5>
                  <p>
                    One deterministic workflow connected model routing, provider fallback attempts, policy-checked MCP connector calls, and a quality eval summary.
                  </p>
                </div>

                <dl className="global-workflow-run-card__context">
                  <div>
                    <dt>Extraction</dt>
                    <dd>{Math.round(agenticTradeInRunResult.evalSummary.extractionCompleteness * 100)}%</dd>
                  </div>
                  <div>
                    <dt>Grounding</dt>
                    <dd>{Math.round(agenticTradeInRunResult.evalSummary.groundingConfidence * 100)}%</dd>
                  </div>
                  <div>
                    <dt>Tool Calls</dt>
                    <dd>{agenticTradeInRunResult.evalSummary.toolCallsSucceeded} / {agenticTradeInRunResult.evalSummary.toolCallsAttempted} succeeded</dd>
                  </div>
                  <div>
                    <dt>Provider Fallback</dt>
                    <dd>{agenticTradeInRunResult.evalSummary.modelProviderFallbackUsed ? "Used" : "Not used"}</dd>
                  </div>
                  <div>
                    <dt>Review Required</dt>
                    <dd>{agenticTradeInRunResult.evalSummary.reviewRequired ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt>Pass</dt>
                    <dd>{agenticTradeInRunResult.evalSummary.pass ? "Yes" : "No"}</dd>
                  </div>
                </dl>
              </article>
            ) : null}

            <h5>Workflow Steps</h5>

            {selectedWorkflowRunDetail.steps.length === 0 ? (
              <p>No workflow steps recorded yet.</p>
            ) : (
              <div className="workflow-step-list">
                {selectedWorkflowRunDetail.steps.map((step) => (
                  <article className="workflow-step-card" key={step.id}>
                    <div>
                      <strong>
                        {step.orderIndex}. {step.stepName}
                      </strong>
                      <p>{step.stepType}</p>
                    </div>
                    <span>{step.status}</span>
                  </article>
                ))}
              </div>
            )}

            <h5>Model Routing / Provider Attempts</h5>

            {selectedWorkflowRunDetail.modelCallLogs.length === 0 ? (
              <p>No model call logs recorded yet.</p>
            ) : (
              <div className="workflow-model-log-list">
                {selectedWorkflowRunDetail.modelCallLogs.map((modelCallLog) => (
                  <ModelCallLogCard
                    key={modelCallLog.id}
                    modelCallLog={modelCallLog}
                  />
                ))}
              </div>
            )}

            <WorkflowToolCallingPlanPanel
              workflowRunId={selectedWorkflowRunDetail.workflowRun.id}
              result={
                workflowToolCallingPlanResult?.plan.workflowRunId ===
                selectedWorkflowRunDetail.workflowRun.id
                  ? workflowToolCallingPlanResult
                  : null
              }
              isRunning={isExecutingWorkflowToolCallingPlan}
              error={workflowToolCallingPlanError}
              success={workflowToolCallingPlanSuccess}
              onRun={onRunWorkflowToolCallingPlan}
            />

            <h5>Grounding / Connector Calls</h5>

            {selectedWorkflowRunDetail.toolCallLogs.filter(isGroundingToolCallLog).length === 0 ? (
              <p>No grounding connector calls recorded yet.</p>
            ) : (
              <div className="workflow-tool-log-list">
                {selectedWorkflowRunDetail.toolCallLogs
                  .filter(isGroundingToolCallLog)
                  .map((log) => (
                    <ToolCallLogCard key={log.id} toolCallLog={log} />
                  ))}
              </div>
            )}

            <h5>Review Queue</h5>

            {selectedWorkflowRunDetail.reviewQueueItems.length === 0 ? (
              <p>No review queue items created yet.</p>
            ) : (
              <div className="workflow-tool-log-list">
                {selectedWorkflowRunDetail.reviewQueueItems.map((item) => (
                  <article className="workflow-tool-log-card" key={item.id}>
                    <div>
                      <strong>{item.reason}</strong>
                      <p>
                        <strong>Source:</strong>{" "}
                        {getWorkflowReviewQueueDisplayText(item, selectedBatchItems)}
                      </p>
                      <p>
                        <strong>Grounding:</strong>{" "}
                        {getGroundingSummaryFromReviewItem(item) ?? "—"}
                      </p>
                      <p>
                        <strong>Possible matches:</strong>{" "}
                        {getGroundingMatchNamesFromReviewItem(item)}
                      </p>
                      {item.reviewerNotes ? (
                        <p>
                          <strong>Reviewer notes:</strong>{" "}
                          {item.reviewerNotes}
                        </p>
                      ) : null}
                    </div>
                    <span>{item.status}</span>
                  </article>
                ))}
              </div>
            )}

            <details className="workflow-audit-log-details">
              <summary>
                MCP / Tool Invocation Audit Logs
                <span>{selectedWorkflowRunDetail.toolCallLogs.length} recorded</span>
              </summary>

              {selectedWorkflowRunDetail.toolCallLogs.length === 0 ? (
                <p>No MCP or workflow simulation tool logs recorded yet.</p>
              ) : (
                <div className="workflow-tool-log-list">
                  {selectedWorkflowRunDetail.toolCallLogs
                    .filter((log) => !isGroundingToolCallLog(log))
                    .map((log) => (
                      <ToolCallLogCard key={log.id} toolCallLog={log} />
                    ))}
                </div>
              )}
            </details>
          </div>
        </div>
      ) : null}
    </DashboardSection>
  );
}
