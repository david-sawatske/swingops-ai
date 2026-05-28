import { FormEvent, useEffect, useState } from "react";
import {
  createIntakeBatch,
  getIntakeBatch,
  listIntakeBatches,
} from "./api/intakeBatches";
import {
  dismissReviewQueueItem,
  executeWorkflowRun,
  getWorkflowRun,
  listWorkflowRuns,
  listReviewQueueItems,
  resolveReviewQueueItem,
  startWorkflowForIntakeBatch,
} from "./api/workflows";
import { DashboardSection } from "./components/DashboardSection";
import { EmptyState } from "./components/EmptyState";
import type {
  IntakeBatchDetail,
  IntakeBatchSourceType,
  IntakeBatchSummary,
} from "./types/intake";
import type {
  GlobalReviewQueueItem,
  GlobalWorkflowRunSummary,
  ModelCallLog,
  ReviewQueueItem,
  WorkflowExecutionScenario,
  WorkflowRunDetail,
  WorkflowRunStatus,
} from "./types/workflow";
import { buildCreateIntakeBatchRequest } from "./utils/intakeForm";
import {
  formatIntakeBatchSourceType,
  formatIntakeBatchStatus,
} from "./utils/intakeLabels";

type WorkflowRunStatusFilter = "ALL" | WorkflowRunStatus;

const WORKFLOW_RUN_STATUS_FILTERS: WorkflowRunStatusFilter[] = [
  "ALL",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "NEEDS_REVIEW",
  "FAILED",
  "CANCELLED",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringField(
  record: Record<string, unknown> | null,
  fieldName: string,
): string {
  if (!record) {
    return "—";
  }

  const value = record[fieldName];

  return typeof value === "string" ? value : "—";
}

function getRoutingDecision(
  modelCallLog: ModelCallLog | null,
): Record<string, unknown> | null {
  if (!modelCallLog || !isRecord(modelCallLog.responseJson)) {
    return null;
  }

  const routingDecision = modelCallLog.responseJson.routingDecision;

  return isRecord(routingDecision) ? routingDecision : null;
}

function getRoutingGoal(modelCallLog: ModelCallLog | null): string {
  if (!modelCallLog || !isRecord(modelCallLog.requestJson)) {
    return "—";
  }

  const routingGoal = modelCallLog.requestJson.routingGoal;

  return typeof routingGoal === "string" ? routingGoal : "—";
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "No proposed golf club data captured.";
  }

  return JSON.stringify(value, null, 2);
}

function getReviewActionFallbackNote(action: "resolve" | "dismiss") {
  return action === "resolve"
    ? "Resolved during human review."
    : "Dismissed during human review.";
}

function getReviewQueueItemBatchId(item: GlobalReviewQueueItem): string | null {
  return item.intakeBatch?.id ?? item.workflowRun?.intakeBatchId ?? null;
}

function ModelRouteCard({
  modelCallLog,
  title = "Model Route Logged",
}: {
  modelCallLog: ModelCallLog;
  title?: string;
}) {
  const routingDecision = getRoutingDecision(modelCallLog);
  const routingGoal = getRoutingGoal(modelCallLog);

  return (
    <article className="model-route-card">
      <div>
        <span className="model-route-card__eyebrow">{title}</span>
        <h4>
          {modelCallLog.provider} / {modelCallLog.model}
        </h4>
        <p>Mock model call recorded for workflow run {modelCallLog.workflowRunId}</p>
      </div>

      <dl>
        <div>
          <dt>Status</dt>
          <dd>{modelCallLog.status}</dd>
        </div>

        <div>
          <dt>Goal</dt>
          <dd>{routingGoal}</dd>
        </div>

        <div>
          <dt>Cost</dt>
          <dd>{getStringField(routingDecision, "estimatedCostTier")}</dd>
        </div>

        <div>
          <dt>Latency</dt>
          <dd>{getStringField(routingDecision, "expectedLatencyTier")}</dd>
        </div>

        <div>
          <dt>Quality</dt>
          <dd>{getStringField(routingDecision, "qualityTier")}</dd>
        </div>
      </dl>

      <p className="model-route-card__reason">
      </p>
    </article>
  );
}

function App() {
  const [intakeBatches, setIntakeBatches] = useState<IntakeBatchSummary[]>([]);
  const [isLoadingIntakeBatches, setIsLoadingIntakeBatches] = useState(true);
  const [intakeBatchesError, setIntakeBatchesError] = useState<string | null>(
    null,
  );

  const [globalWorkflowRuns, setGlobalWorkflowRuns] = useState<
    GlobalWorkflowRunSummary[]
  >([]);
  const [isLoadingGlobalWorkflowRuns, setIsLoadingGlobalWorkflowRuns] =
    useState(true);
  const [globalWorkflowRunsError, setGlobalWorkflowRunsError] = useState<
    string | null
  >(null);
  const [workflowRunStatusFilter, setWorkflowRunStatusFilter] =
    useState<WorkflowRunStatusFilter>("ALL");

  const [globalReviewQueueItems, setGlobalReviewQueueItems] = useState<
    GlobalReviewQueueItem[]
  >([]);
  const [isLoadingGlobalReviewQueue, setIsLoadingGlobalReviewQueue] =
    useState(true);
  const [globalReviewQueueError, setGlobalReviewQueueError] = useState<
    string | null
  >(null);

  const [selectedBatchDetail, setSelectedBatchDetail] =
    useState<IntakeBatchDetail | null>(null);
  const [isLoadingBatchDetail, setIsLoadingBatchDetail] = useState(false);
  const [batchDetailError, setBatchDetailError] = useState<string | null>(null);

  const [selectedWorkflowRunDetail, setSelectedWorkflowRunDetail] =
    useState<WorkflowRunDetail | null>(null);
  const [isLoadingWorkflowRunDetail, setIsLoadingWorkflowRunDetail] =
    useState(false);
  const [workflowRunDetailError, setWorkflowRunDetailError] = useState<
    string | null
  >(null);
  const [isExecutingWorkflowRun, setIsExecutingWorkflowRun] = useState(false);
  const [activeReviewQueueItemId, setActiveReviewQueueItemId] = useState<
    string | null
  >(null);
  const [reviewQueueNotesById, setReviewQueueNotesById] = useState<
    Record<string, string>
  >({});
  const [reviewQueueActionError, setReviewQueueActionError] = useState<
    string | null
  >(null);
  const [reviewQueueActionSuccess, setReviewQueueActionSuccess] = useState<
    string | null
  >(null);
  const [executeWorkflowRunError, setExecuteWorkflowRunError] = useState<
    string | null
  >(null);
  const [executeWorkflowRunSuccess, setExecuteWorkflowRunSuccess] = useState<
    string | null
  >(null);

  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);
  const [startWorkflowError, setStartWorkflowError] = useState<string | null>(
    null,
  );
  const [startWorkflowSuccess, setStartWorkflowSuccess] = useState<
    string | null
  >(null);
  const [latestModelCallLog, setLatestModelCallLog] =
    useState<ModelCallLog | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] =
    useState<IntakeBatchSourceType>("FREEFORM_NOTES");
  const [rawText, setRawText] = useState("");
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [createBatchError, setCreateBatchError] = useState<string | null>(null);
  const [createBatchSuccess, setCreateBatchSuccess] = useState<string | null>(
    null,
  );

  const openReviewQueueItemCount = globalReviewQueueItems.filter(
    (item) => item.status === "OPEN" || item.status === "IN_REVIEW",
  ).length;

  const workflowRunStatusCounts = globalWorkflowRuns.reduce<
    Record<WorkflowRunStatus, number>
  >((counts, run) => {
    counts[run.status] = (counts[run.status] ?? 0) + 1;

    return counts;
  }, {} as Record<WorkflowRunStatus, number>);

  const filteredGlobalWorkflowRuns =
    workflowRunStatusFilter === "ALL"
      ? globalWorkflowRuns
      : globalWorkflowRuns.filter(
          (run) => run.status === workflowRunStatusFilter,
        );

  const selectedWorkflowRunId =
    selectedWorkflowRunDetail?.workflowRun.id ?? null;

  async function loadIntakeBatches() {
    try {
      setIsLoadingIntakeBatches(true);
      setIntakeBatchesError(null);

      const batches = await listIntakeBatches();

      setIntakeBatches(batches);
    } catch (error) {
      setIntakeBatchesError(
        error instanceof Error
          ? error.message
          : "Unable to load intake batches.",
      );
    } finally {
      setIsLoadingIntakeBatches(false);
    }
  }

  async function loadGlobalWorkflowRuns() {
    try {
      setIsLoadingGlobalWorkflowRuns(true);
      setGlobalWorkflowRunsError(null);

      const response = await listWorkflowRuns();

      setGlobalWorkflowRuns(response.workflowRuns);
    } catch (error) {
      setGlobalWorkflowRunsError(
        error instanceof Error
          ? error.message
          : "Unable to load workflow runs.",
      );
    } finally {
      setIsLoadingGlobalWorkflowRuns(false);
    }
  }

  async function loadGlobalReviewQueueItems() {
    try {
      setIsLoadingGlobalReviewQueue(true);
      setGlobalReviewQueueError(null);

      const response = await listReviewQueueItems();

      setGlobalReviewQueueItems(response.reviewQueueItems);
    } catch (error) {
      setGlobalReviewQueueError(
        error instanceof Error
          ? error.message
          : "Unable to load review queue items.",
      );
    } finally {
      setIsLoadingGlobalReviewQueue(false);
    }
  }

  useEffect(() => {
    void loadIntakeBatches();
    void loadGlobalWorkflowRuns();
    void loadGlobalReviewQueueItems();
  }, []);

  function handleReviewQueueNotesChange(
    reviewQueueItemId: string,
    reviewerNotes: string,
  ) {
    setReviewQueueNotesById((current) => ({
      ...current,
      [reviewQueueItemId]: reviewerNotes,
    }));
  }

  async function refreshSelectedBatchDetail() {
    if (!selectedBatchDetail) {
      return;
    }

    const refreshedBatchDetail = await getIntakeBatch(
      selectedBatchDetail.intakeBatch.id,
    );

    setSelectedBatchDetail(refreshedBatchDetail);
  }

  async function refreshSelectedWorkflowRunDetail(workflowRunId: string) {
    const refreshedWorkflowRunDetail = await getWorkflowRun(workflowRunId);

    setSelectedWorkflowRunDetail(refreshedWorkflowRunDetail);
  }

  async function handleSelectBatch(intakeBatchId: string) {
    try {
      setIsLoadingBatchDetail(true);
      setBatchDetailError(null);
      setStartWorkflowError(null);
      setStartWorkflowSuccess(null);
      setLatestModelCallLog(null);
      setSelectedWorkflowRunDetail(null);
      setWorkflowRunDetailError(null);

      const detail = await getIntakeBatch(intakeBatchId);

      setSelectedBatchDetail(detail);
    } catch (error) {
      setBatchDetailError(
        error instanceof Error
          ? error.message
          : "Unable to load intake batch details.",
      );
    } finally {
      setIsLoadingBatchDetail(false);
    }
  }

  async function handleSelectWorkflowRun(workflowRunId: string) {
    try {
      setIsLoadingWorkflowRunDetail(true);
      setWorkflowRunDetailError(null);
      setReviewQueueActionError(null);
      setReviewQueueActionSuccess(null);

      const detail = await getWorkflowRun(workflowRunId);

      setSelectedWorkflowRunDetail(detail);
    } catch (error) {
      setWorkflowRunDetailError(
        error instanceof Error
          ? error.message
          : "Unable to load workflow run detail.",
      );
    } finally {
      setIsLoadingWorkflowRunDetail(false);
    }
  }

  async function handleExecuteWorkflowRun(
    workflowRunId: string,
    scenario: WorkflowExecutionScenario = "HAPPY_PATH",
  ) {
    try {
      setIsExecutingWorkflowRun(true);
      setExecuteWorkflowRunError(null);
      setExecuteWorkflowRunSuccess(null);
      setWorkflowRunDetailError(null);
      setReviewQueueActionError(null);
      setReviewQueueActionSuccess(null);

      const result = await executeWorkflowRun(workflowRunId, { scenario });
      const detail = await getWorkflowRun(workflowRunId);

      setSelectedWorkflowRunDetail(detail);
      setExecuteWorkflowRunSuccess(
        `Executed ${
          scenario === "NEEDS_REVIEW" ? "review-needed" : "happy-path"
        } workflow simulation: ${result.workflowRun.workflowName}`,
      );

      await loadGlobalWorkflowRuns();
      await loadGlobalReviewQueueItems();
      await refreshSelectedBatchDetail();
    } catch (error) {
      setExecuteWorkflowRunError(
        error instanceof Error
          ? error.message
          : "Unable to execute workflow simulation.",
      );
    } finally {
      setIsExecutingWorkflowRun(false);
    }
  }

  async function handleReviewQueueItemAction(input: {
    reviewQueueItemId: string;
    action: "resolve" | "dismiss";
    workflowRunId?: string | null;
    intakeBatchId?: string | null;
  }) {
    const reviewerNotes =
      reviewQueueNotesById[input.reviewQueueItemId]?.trim() ||
      getReviewActionFallbackNote(input.action);

    try {
      setActiveReviewQueueItemId(input.reviewQueueItemId);
      setReviewQueueActionError(null);
      setReviewQueueActionSuccess(null);
      setWorkflowRunDetailError(null);

      if (input.action === "resolve") {
        await resolveReviewQueueItem(input.reviewQueueItemId, {
          reviewerNotes,
        });
      } else {
        await dismissReviewQueueItem(input.reviewQueueItemId, {
          reviewerNotes,
        });
      }

      await loadGlobalWorkflowRuns();
      await loadGlobalReviewQueueItems();

      if (
        input.workflowRunId &&
        selectedWorkflowRunDetail?.workflowRun.id === input.workflowRunId
      ) {
        await refreshSelectedWorkflowRunDetail(input.workflowRunId);
      }

      if (
        selectedBatchDetail &&
        (!input.intakeBatchId ||
          selectedBatchDetail.intakeBatch.id === input.intakeBatchId)
      ) {
        await refreshSelectedBatchDetail();
      }

      setReviewQueueNotesById((current) => {
        const next = { ...current };
        delete next[input.reviewQueueItemId];

        return next;
      });
      setReviewQueueActionSuccess(
        input.action === "resolve"
          ? "Review queue item resolved."
          : "Review queue item dismissed.",
      );
    } catch (error) {
      setReviewQueueActionError(
        error instanceof Error
          ? error.message
          : "Unable to update review queue item.",
      );
    } finally {
      setActiveReviewQueueItemId(null);
    }
  }

  async function handleCreateBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = buildCreateIntakeBatchRequest({
      name,
      description,
      sourceType,
      rawText,
    });

    if (!result.ok) {
      setCreateBatchError(result.error);
      setCreateBatchSuccess(null);
      return;
    }

    try {
      setIsCreatingBatch(true);
      setCreateBatchError(null);
      setCreateBatchSuccess(null);

      const createdBatch = await createIntakeBatch(result.request);

      setName("");
      setDescription("");
      setSourceType("FREEFORM_NOTES");
      setRawText("");
      setCreateBatchSuccess(`Created intake batch: ${createdBatch.name}`);

      await loadIntakeBatches();
      await handleSelectBatch(createdBatch.id);
      await loadGlobalWorkflowRuns();
      await loadGlobalReviewQueueItems();
    } catch (error) {
      setCreateBatchError(
        error instanceof Error
          ? error.message
          : "Unable to create intake batch.",
      );
    } finally {
      setIsCreatingBatch(false);
    }
  }

  async function handleStartWorkflow() {
    if (!selectedBatchDetail) {
      return;
    }

    const intakeBatchId = selectedBatchDetail.intakeBatch.id;

    try {
      setIsStartingWorkflow(true);
      setStartWorkflowError(null);
      setStartWorkflowSuccess(null);
      setLatestModelCallLog(null);
      setSelectedWorkflowRunDetail(null);
      setWorkflowRunDetailError(null);
      setExecuteWorkflowRunError(null);
      setExecuteWorkflowRunSuccess(null);

      const response = await startWorkflowForIntakeBatch(intakeBatchId);

      setLatestModelCallLog(response.modelCallLog);
      setStartWorkflowSuccess(
        `Started workflow run: ${response.workflowRun.workflowName}`,
      );

      const refreshedDetail = await getIntakeBatch(intakeBatchId);

      setSelectedBatchDetail(refreshedDetail);
      await loadGlobalWorkflowRuns();
      await loadGlobalReviewQueueItems();
    } catch (error) {
      setStartWorkflowError(
        error instanceof Error ? error.message : "Unable to start workflow.",
      );
    } finally {
      setIsStartingWorkflow(false);
    }
  }

  function renderReviewQueueActionControls(input: {
    item: ReviewQueueItem;
    workflowRunId?: string | null;
    intakeBatchId?: string | null;
  }) {
    if (input.item.status !== "OPEN") {
      return null;
    }

    return (
      <div className="review-queue-card__review-actions">
        <label>
          Reviewer Notes
          <textarea
            onChange={(event) =>
              handleReviewQueueNotesChange(input.item.id, event.target.value)
            }
            placeholder="Add reviewer notes before resolving or dismissing."
            rows={3}
            value={reviewQueueNotesById[input.item.id] ?? ""}
          />
        </label>

        <div className="workflow-run-card__actions">
          <button
            disabled={activeReviewQueueItemId === input.item.id}
            onClick={() =>
              void handleReviewQueueItemAction({
                reviewQueueItemId: input.item.id,
                action: "resolve",
                workflowRunId: input.workflowRunId ?? input.item.workflowRunId,
                intakeBatchId: input.intakeBatchId ?? null,
              })
            }
            type="button"
          >
            {activeReviewQueueItemId === input.item.id
              ? "Updating…"
              : "Resolve"}
          </button>

          <button
            disabled={activeReviewQueueItemId === input.item.id}
            onClick={() =>
              void handleReviewQueueItemAction({
                reviewQueueItemId: input.item.id,
                action: "dismiss",
                workflowRunId: input.workflowRunId ?? input.item.workflowRunId,
                intakeBatchId: input.intakeBatchId ?? null,
              })
            }
            type="button"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <h1>SwingOps AI</h1>

        <p className="subtitle">Agentic Golf Retail Workflow Platform</p>
      </section>

      <DashboardSection
        title="Create Intake Batch"
        description="Add messy golf trade-in data for later workflow processing."
      >
        <form className="intake-form" onSubmit={handleCreateBatch}>
          <label>
            Batch Name
            <input
              name="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="May trade-in notes"
              type="text"
              value={name}
            />
          </label>

          <label>
            Description
            <input
              name="description"
              onChange={(event) => setDescription(event.target.value)}
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
                setSourceType(event.target.value as IntakeBatchSourceType)
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
              onChange={(event) => setRawText(event.target.value)}
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
        title="Global Workflow Runs"
        description="Operations view for every workflow run across intake batches."
      >
        {!isLoadingGlobalWorkflowRuns && !globalWorkflowRunsError ? (
          <div className="global-workflow-run-toolbar">
            <p className="section-summary">
              {filteredGlobalWorkflowRuns.length} shown /{" "}
              {globalWorkflowRuns.length} total workflow{" "}
              {globalWorkflowRuns.length === 1 ? "run" : "runs"}
            </p>

            <div
              aria-label="Filter workflow runs by status"
              className="workflow-run-status-filter"
            >
              {WORKFLOW_RUN_STATUS_FILTERS.map((statusFilter) => {
                const count =
                  statusFilter === "ALL"
                    ? globalWorkflowRuns.length
                    : workflowRunStatusCounts[statusFilter] ?? 0;

                return (
                  <button
                    className={
                      workflowRunStatusFilter === statusFilter
                        ? "workflow-run-status-filter__button workflow-run-status-filter__button--active"
                        : "workflow-run-status-filter__button"
                    }
                    key={statusFilter}
                    onClick={() => setWorkflowRunStatusFilter(statusFilter)}
                    type="button"
                  >
                    <span>{statusFilter}</span>
                    <strong>{count}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {isLoadingGlobalWorkflowRuns ? <p>Loading workflow runs…</p> : null}

        {globalWorkflowRunsError ? (
          <EmptyState
            title="Unable to load workflow runs"
            message={globalWorkflowRunsError}
          />
        ) : null}

        {!isLoadingGlobalWorkflowRuns &&
        !globalWorkflowRunsError &&
        globalWorkflowRuns.length === 0 ? (
          <EmptyState
            title="No workflow runs found"
            message="Create an intake batch and start a workflow to populate the operations dashboard."
          />
        ) : null}

        {!isLoadingGlobalWorkflowRuns &&
        !globalWorkflowRunsError &&
        globalWorkflowRuns.length > 0 &&
        filteredGlobalWorkflowRuns.length === 0 ? (
          <EmptyState
            title="No runs match this filter"
            message="Choose a different workflow status to inspect runs across the platform."
          />
        ) : null}

        {!isLoadingGlobalWorkflowRuns &&
        !globalWorkflowRunsError &&
        filteredGlobalWorkflowRuns.length > 0 ? (
          <div className="global-workflow-run-list">
            {filteredGlobalWorkflowRuns.map((run) => (
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
                    <p>{run.id}</p>
                  </div>

                  <button
                    disabled={isLoadingWorkflowRunDetail}
                    onClick={() => void handleSelectWorkflowRun(run.id)}
                    type="button"
                  >
                    {selectedWorkflowRunId === run.id ? "Viewing Logs" : "View Logs"}
                  </button>
                </div>

                <dl className="global-workflow-run-card__context">
                  <div>
                    <dt>Batch</dt>
                    <dd>{run.intakeBatch?.name ?? "—"}</dd>
                  </div>

                  <div>
                    <dt>Item</dt>
                    <dd>{run.intakeItem?.rawText ?? "—"}</dd>
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
      </DashboardSection>

      <DashboardSection
        title="Global Review Queue"
        description="All human-in-the-loop review work across workflow runs."
      >
        {!isLoadingGlobalReviewQueue && !globalReviewQueueError ? (
          <p className="section-summary">
            {openReviewQueueItemCount} open review{" "}
            {openReviewQueueItemCount === 1 ? "item" : "items"} /{" "}
            {globalReviewQueueItems.length} total
          </p>
        ) : null}

        {reviewQueueActionSuccess ? (
          <p className="form-message form-message--success">
            {reviewQueueActionSuccess}
          </p>
        ) : null}

        {reviewQueueActionError ? (
          <p className="form-message form-message--error">
            {reviewQueueActionError}
          </p>
        ) : null}

        {isLoadingGlobalReviewQueue ? <p>Loading review queue…</p> : null}

        {globalReviewQueueError ? (
          <EmptyState
            title="Unable to load review queue"
            message={globalReviewQueueError}
          />
        ) : null}

        {!isLoadingGlobalReviewQueue &&
        !globalReviewQueueError &&
        globalReviewQueueItems.length === 0 ? (
          <EmptyState
            title="No review work queued"
            message="Run a needs-review workflow simulation to create human review items."
          />
        ) : null}

        {!isLoadingGlobalReviewQueue &&
        !globalReviewQueueError &&
        globalReviewQueueItems.length > 0 ? (
          <div className="review-queue-list">
            {globalReviewQueueItems.map((item) => (
              <article className="review-queue-card" key={item.id}>
                <div className="review-queue-card__header">
                  <div>
                    <span className="model-route-card__eyebrow">
                      {item.status}
                    </span>
                    <h3>{item.reason}</h3>
                    <p>{item.originalText ?? "No original text captured."}</p>
                  </div>

                  <span className="review-queue-card__status">
                    {item.status}
                  </span>
                </div>

                <dl className="review-queue-card__context">
                  <div>
                    <dt>Batch</dt>
                    <dd>{item.intakeBatch?.name ?? "—"}</dd>
                  </div>

                  <div>
                    <dt>Workflow</dt>
                    <dd>{item.workflowRun?.workflowName ?? "—"}</dd>
                  </div>

                  <div>
                    <dt>Run Status</dt>
                    <dd>{item.workflowRun?.status ?? "—"}</dd>
                  </div>
                </dl>

                <div className="review-queue-card__json">
                  <strong>Proposed Golf Club</strong>
                  <pre>{formatJson(item.proposedGolfClubJson)}</pre>
                </div>

                {item.reviewerNotes ? (
                  <p className="review-queue-card__meta">
                    Reviewer notes: {item.reviewerNotes}
                  </p>
                ) : null}

                {item.resolvedAt ? (
                  <p className="review-queue-card__meta">
                    Resolved at: {item.resolvedAt}
                  </p>
                ) : null}

                {renderReviewQueueActionControls({
                  item,
                  workflowRunId: item.workflowRunId,
                  intakeBatchId: getReviewQueueItemBatchId(item),
                })}
              </article>
            ))}
          </div>
        ) : null}
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
                onClick={() => void handleStartWorkflow()}
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
                      <p>{run.id}</p>
                    </div>

                    <div className="workflow-run-card__actions">
                      <strong>{run.status}</strong>

                      <button
                        disabled={isExecutingWorkflowRun}
                        onClick={() =>
                          void handleExecuteWorkflowRun(run.id, "HAPPY_PATH")
                        }
                        type="button"
                      >
                        Run Happy Path
                      </button>

                      <button
                        disabled={isExecutingWorkflowRun}
                        onClick={() =>
                          void handleExecuteWorkflowRun(run.id, "NEEDS_REVIEW")
                        }
                        type="button"
                      >
                        Run Needs Review
                      </button>

                      <button
                        disabled={isLoadingWorkflowRunDetail}
                        onClick={() => void handleSelectWorkflowRun(run.id)}
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
                  <p>{selectedWorkflowRunDetail.workflowRun.id}</p>
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

                  <h5>Review Queue</h5>

                  {selectedWorkflowRunDetail.reviewQueueItems.length === 0 ? (
                    <p>No review queue items created yet.</p>
                  ) : (
                    <div className="workflow-tool-log-list">
                      {selectedWorkflowRunDetail.reviewQueueItems.map((item) => (
                        <article className="workflow-tool-log-card" key={item.id}>
                          <div>
                            <strong>{item.reason}</strong>
                            <p>{item.originalText ?? "No original text captured."}</p>
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

                  <h5>Tool Calls</h5>

                  {selectedWorkflowRunDetail.toolCallLogs.length === 0 ? (
                    <p>No tool calls recorded yet.</p>
                  ) : (
                    <div className="workflow-tool-log-list">
                      {selectedWorkflowRunDetail.toolCallLogs.map((log) => (
                        <article className="workflow-tool-log-card" key={log.id}>
                          <strong>{log.toolName}</strong>
                          <span>{log.status}</span>
                        </article>
                      ))}
                    </div>
                  )}
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
                    onClick={() => void handleSelectBatch(batch.id)}
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
    </main>
  );
}

export default App;
