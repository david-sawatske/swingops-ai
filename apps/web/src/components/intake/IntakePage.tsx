import type { FormEvent, ReactNode } from "react";
import type {
  IntakeBatchDetail,
  IntakeBatchSourceType,
  IntakeBatchSummary,
} from "../../types/intake";
import type {
  ModelCallLog,
  ReviewQueueItem,
  ToolCallLog,
  WorkflowExecutionScenario,
  WorkflowRunDetail,
} from "../../types/workflow";
import {
  formatIntakeBatchSourceType,
  formatIntakeBatchStatus,
} from "../../utils/intakeLabels";
import { formatShortId } from "../../utils/formatting";
import {
  getGroundingMatchNamesFromReviewItem,
  getGroundingSummaryFromReviewItem,
  getWorkflowReviewQueueDisplayText,
} from "../../utils/reviewQueueDisplay";
import { isGroundingToolCallLog } from "../../utils/toolCallDisplay";
import { DashboardSection } from "../DashboardSection";
import { EmptyState } from "../EmptyState";
import { ModelRouteCard } from "../model-routing/ModelRouteCard";
import { ToolCallLogCard } from "../workflows/ToolCallLogCard";

export function IntakePage({
  name,
  description,
  sourceType,
  rawText,
  createBatchError,
  createBatchSuccess,
  isCreatingBatch,
  intakeBatches,
  isLoadingIntakeBatches,
  intakeBatchesError,
  selectedBatchDetail,
  isLoadingBatchDetail,
  batchDetailError,
  isStartingWorkflow,
  startWorkflowError,
  startWorkflowSuccess,
  latestModelCallLog,
  isExecutingWorkflowRun,
  executeWorkflowRunSuccess,
  executeWorkflowRunError,
  isLoadingWorkflowRunDetail,
  workflowRunDetailError,
  selectedWorkflowRunDetail,
  onNameChange,
  onDescriptionChange,
  onSourceTypeChange,
  onRawTextChange,
  onCreateBatch,
  onSelectBatch,
  onStartWorkflow,
  onExecuteWorkflowRun,
  onSelectWorkflowRun,
  renderReviewQueueActionControls,
}: {
  name: string;
  description: string;
  sourceType: IntakeBatchSourceType;
  rawText: string;
  createBatchError: string | null;
  createBatchSuccess: string | null;
  isCreatingBatch: boolean;
  intakeBatches: IntakeBatchSummary[];
  isLoadingIntakeBatches: boolean;
  intakeBatchesError: string | null;
  selectedBatchDetail: IntakeBatchDetail | null;
  isLoadingBatchDetail: boolean;
  batchDetailError: string | null;
  isStartingWorkflow: boolean;
  startWorkflowError: string | null;
  startWorkflowSuccess: string | null;
  latestModelCallLog: ModelCallLog | null;
  isExecutingWorkflowRun: boolean;
  executeWorkflowRunSuccess: string | null;
  executeWorkflowRunError: string | null;
  isLoadingWorkflowRunDetail: boolean;
  workflowRunDetailError: string | null;
  selectedWorkflowRunDetail: WorkflowRunDetail | null;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onSourceTypeChange: (sourceType: IntakeBatchSourceType) => void;
  onRawTextChange: (rawText: string) => void;
  onCreateBatch: (event: FormEvent<HTMLFormElement>) => void;
  onSelectBatch: (intakeBatchId: string) => void;
  onStartWorkflow: () => void;
  onExecuteWorkflowRun: (
    workflowRunId: string,
    scenario: WorkflowExecutionScenario,
  ) => void;
  onSelectWorkflowRun: (workflowRunId: string) => void;
  renderReviewQueueActionControls: (input: {
    item: ReviewQueueItem;
    workflowRunId?: string | null;
    intakeBatchId?: string | null;
  }) => ReactNode;
}) {
  return (
    <>
      <DashboardSection
        title="Create Intake Batch"
        description="Add messy golf trade-in data for later workflow processing."
      >
        <form className="intake-form" onSubmit={onCreateBatch}>
          <label>
            Batch Name
            <input
              name="name"
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="May trade-in notes"
              type="text"
              value={name}
            />
          </label>

          <label>
            Description
            <input
              name="description"
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="Optional context for this batch"
              type="text"
              value={description}
            />
          </label>

          <label>
            Source Type
            <select
              name="sourceType"
              onChange={(event) =>
                onSourceTypeChange(event.target.value as IntakeBatchSourceType)
              }
              value={sourceType}
            >
              <option value="FREEFORM_NOTES">Freeform Notes</option>
              <option value="BAD_CSV">Bad CSV</option>
              <option value="EMAIL">Email</option>
              <option value="PDF_TEXT">PDF Text</option>
              <option value="MANUAL_ENTRY">Manual Entry</option>
            </select>
          </label>

          <label>
            Raw Trade-In Text
            <textarea
              name="rawText"
              onChange={(event) => onRawTextChange(event.target.value)}
              placeholder={
                "TM Stealth 2 driver, 10.5, stiff, RH\nPing G425 irons 5-PW, regular flex, LH"
              }
              rows={5}
              value={rawText}
            />
          </label>

          {createBatchError ? (
            <p className="form-message form-message--error">
              {createBatchError}
            </p>
          ) : null}

          {createBatchSuccess ? (
            <p className="form-message form-message--success">
              {createBatchSuccess}
            </p>
          ) : null}

          <button disabled={isCreatingBatch} type="submit">
            {isCreatingBatch ? "Creating…" : "Create Intake Batch"}
          </button>
        </form>
      </DashboardSection>

      <DashboardSection
        title="Selected Intake Batch"
        description="Raw trade-in items that will become workflow input for future AI processing."
      >
        {isLoadingBatchDetail ? <p>Loading batch details…</p> : null}

        {batchDetailError ? (
          <EmptyState
            title="Unable to load selected batch"
            message={batchDetailError}
          />
        ) : null}

        {!isLoadingBatchDetail && !batchDetailError && !selectedBatchDetail ? (
          <EmptyState
            title="No intake batch selected"
            message="Choose View Details on an intake batch to inspect its raw trade-in items."
          />
        ) : null}

        {!isLoadingBatchDetail && !batchDetailError && selectedBatchDetail ? (
          <div className="batch-detail">
            <div className="batch-detail__header batch-detail__header--with-action">
              <div>
                <h3>{selectedBatchDetail.intakeBatch.name}</h3>
                <p>
                  {selectedBatchDetail.intakeBatch.description ??
                    "No description provided."}
                </p>
              </div>

              <button
                disabled={isStartingWorkflow}
                onClick={onStartWorkflow}
                type="button"
              >
                {isStartingWorkflow ? "Starting…" : "Start Workflow"}
              </button>
            </div>

            {startWorkflowError ? (
              <p className="form-message form-message--error">
                {startWorkflowError}
              </p>
            ) : null}

            {startWorkflowSuccess ? (
              <p className="form-message form-message--success">
                {startWorkflowSuccess}
              </p>
            ) : null}

            {latestModelCallLog ? (
              <ModelRouteCard modelCallLog={latestModelCallLog} />
            ) : null}

            <div className="raw-item-list">
              {selectedBatchDetail.items.map((item, index) => (
                <article className="raw-item-card" key={item.id}>
                  <span>Item {index + 1}</span>
                  <p>{item.rawText}</p>
                </article>
              ))}
            </div>

            {selectedBatchDetail.workflowRuns.length === 0 ? (
              <EmptyState
                title="No workflow runs yet"
                message="Click Start Workflow to create a queued workflow run with planned steps."
              />
            ) : (
              <div className="workflow-run-list">
                <h4>Workflow Runs</h4>

                {selectedBatchDetail.workflowRuns.map((run) => (
                  <article className="workflow-run-card" key={run.id}>
                    <div>
                      <h5>{run.workflowName}</h5>
                      <p title={run.id}>{formatShortId(run.id)}</p>
                    </div>

                    <div className="workflow-run-card__actions">
                      <strong>{run.status}</strong>

                      <button
                        disabled={isExecutingWorkflowRun}
                        onClick={() =>
                          onExecuteWorkflowRun(run.id, "HAPPY_PATH")
                        }
                        type="button"
                      >
                        Run Happy Path
                      </button>

                      <button
                        disabled={isExecutingWorkflowRun}
                        onClick={() =>
                          onExecuteWorkflowRun(run.id, "NEEDS_REVIEW")
                        }
                        type="button"
                      >
                        Run Needs Review
                      </button>

                      <button
                        disabled={isLoadingWorkflowRunDetail}
                        onClick={() => onSelectWorkflowRun(run.id)}
                        type="button"
                      >
                        View Logs
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {isExecutingWorkflowRun ? <p>Running workflow simulation…</p> : null}

            {executeWorkflowRunSuccess ? (
              <p className="form-message form-message--success">
                {executeWorkflowRunSuccess}
              </p>
            ) : null}

            {executeWorkflowRunError ? (
              <p className="form-message form-message--error">
                {executeWorkflowRunError}
              </p>
            ) : null}

            {isLoadingWorkflowRunDetail ? <p>Loading workflow run logs…</p> : null}

            {workflowRunDetailError ? (
              <p className="form-message form-message--error">
                {workflowRunDetailError}
              </p>
            ) : null}

            {selectedWorkflowRunDetail ? (
              <div className="workflow-run-detail-panel">
                <div>
                  <span className="model-route-card__eyebrow">
                    Workflow Run Detail
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

                  <h5>Grounding / Connector Calls</h5>

                  {selectedWorkflowRunDetail.toolCallLogs.filter(isGroundingToolCallLog).length === 0 ? (
                    <p>No grounding connector calls recorded yet.</p>
                  ) : (
                    <div className="workflow-tool-log-list">
                      {selectedWorkflowRunDetail.toolCallLogs
                        .filter(isGroundingToolCallLog)
                        .map((log: ToolCallLog) => (
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
                              {getWorkflowReviewQueueDisplayText(
                                item,
                                selectedBatchDetail.items,
                              )}
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
                              <p>Reviewer notes: {item.reviewerNotes}</p>
                            ) : null}
                            {item.resolvedAt ? (
                              <p>Resolved at: {item.resolvedAt}</p>
                            ) : null}

                            {renderReviewQueueActionControls({
                              item,
                              workflowRunId:
                                selectedWorkflowRunDetail.workflowRun.id,
                              intakeBatchId:
                                selectedWorkflowRunDetail.workflowRun
                                  .intakeBatchId,
                            })}
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
                          .map((log: ToolCallLog) => (
                            <ToolCallLogCard key={log.id} toolCallLog={log} />
                          ))}
                      </div>
                    )}
                  </details>
                </div>

                {selectedWorkflowRunDetail.modelCallLogs.length === 0 ? (
                  <EmptyState
                    title="No model call logs"
                    message="This workflow run does not have persisted model call logs yet."
                  />
                ) : (
                  <div className="workflow-model-log-list">
                    {selectedWorkflowRunDetail.modelCallLogs.map((log) => (
                      <ModelRouteCard
                        key={log.id}
                        modelCallLog={log}
                        title="Persisted Model Route"
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </DashboardSection>

      <DashboardSection
        title="Intake Batches"
        description="Messy golf trade-in notes, CSV rows, and email text imported for workflow processing."
      >
        {!isLoadingIntakeBatches && !intakeBatchesError ? (
          <p className="section-summary">
            {intakeBatches.length} intake{" "}
            {intakeBatches.length === 1 ? "batch" : "batches"} loaded
          </p>
        ) : null}

        {isLoadingIntakeBatches ? <p>Loading intake batches…</p> : null}

        {intakeBatchesError ? (
          <EmptyState
            title="Unable to load intake batches"
            message={intakeBatchesError}
          />
        ) : null}

        {!isLoadingIntakeBatches &&
        !intakeBatchesError &&
        intakeBatches.length === 0 ? (
          <EmptyState
            title="No intake batches found"
            message="Create an intake batch through the API to see it here."
          />
        ) : null}

        {!isLoadingIntakeBatches &&
        !intakeBatchesError &&
        intakeBatches.length > 0 ? (
          <div className="intake-batch-list">
            {intakeBatches.map((batch) => (
              <article className="intake-batch-card" key={batch.id}>
                <div>
                  <h3>{batch.name}</h3>
                  <p>{batch.description ?? "No description provided."}</p>
                </div>

                <div className="intake-batch-card__actions">
                  <dl>
                    <div>
                      <dt>Status</dt>
                      <dd>{formatIntakeBatchStatus(batch.status)}</dd>
                    </div>

                    <div>
                      <dt>Source</dt>
                      <dd>{formatIntakeBatchSourceType(batch.sourceType)}</dd>
                    </div>

                    <div>
                      <dt>Items</dt>
                      <dd>{batch.itemCount}</dd>
                    </div>
                  </dl>

                  <button
                    onClick={() => onSelectBatch(batch.id)}
                    type="button"
                  >
                    View Details
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </DashboardSection>
    </>
  );
}
