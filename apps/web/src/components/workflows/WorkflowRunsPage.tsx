import type { IntakeBatchDetail } from "../../types/intake";
import type {
  ExecuteWorkflowToolCallingPlanResponse,
  GlobalWorkflowRunSummary,
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
  onStatusFilterChange,
  onSelectWorkflowRun,
  onRunWorkflowToolCallingPlan,
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
  onStatusFilterChange: (statusFilter: WorkflowRunStatusFilter) => void;
  onSelectWorkflowRun: (workflowRunId: string) => void;
  onRunWorkflowToolCallingPlan: (workflowRunId: string) => void;
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

                <button
                  disabled={isLoadingWorkflowRunDetail}
                  onClick={() => onSelectWorkflowRun(run.id)}
                  type="button"
                >
                  {selectedWorkflowRunId === run.id
                    ? "Logs Shown Below"
                    : "View Logs"}
                </button>
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
