import { FormEvent, useEffect, useState } from "react";
import { previewModelRouting } from "./api/modelRouting";
import {
  executeReadOnlyToolInvocation,
  listConnectorCatalog,
  listConnectorInvocationHistory,
} from "./api/mcp";
import {
  createIntakeBatch,
  getIntakeBatch,
  listIntakeBatches,
} from "./api/intakeBatches";
import {
  createProviderFallbackDemo,
  executeAgenticTradeInRun,
  dismissReviewQueueItem,
  executeWorkflowRun,
  executeWorkflowToolCallingPlan,
  getWorkflowRun,
  listWorkflowRuns,
  listReviewQueueItems,
  resolveReviewQueueItem,
  startWorkflowForIntakeBatch,
} from "./api/workflows";
import type {
  ConnectorCatalogItem,
  ConnectorInvocationHistoryItem,
  ExecuteReadOnlyToolInvocationResponse,
} from "./types/mcp";
import type {
  ModelRoutingGoal,
  ModelTaskType,
  PreviewModelRoutingResponse,
} from "./types/ai";
import type {
  IntakeBatchDetail,
  IntakeBatchSourceType,
  IntakeBatchSummary,
} from "./types/intake";
import type {
  ExecuteAgenticTradeInRunResponse,
  GlobalReviewQueueItem,
  ExecuteWorkflowToolCallingPlanResponse,
  GlobalWorkflowRunSummary,
  ModelCallLog,
  ReviewQueueItem,
  ToolCallLog,
  WorkflowExecutionScenario,
  WorkflowRunDetail,
  WorkflowRunStatus,
} from "./types/workflow";
import { buildCreateIntakeBatchRequest } from "./utils/intakeForm";
import { type AppView } from "./constants/appNav";
import { type WorkflowRunStatusFilter } from "./constants/workflows";
import {
  READ_ONLY_MCP_TOOL_OPTIONS,
  type ReadOnlyMcpToolName,
} from "./constants/mcpDemoTools";
import { getReviewActionFallbackNote } from "./utils/reviewQueueDisplay";
import { getReadOnlyMcpToolInput } from "./utils/readOnlyMcpToolInput";
import { McpConnectorsPage } from "./components/mcp/McpConnectorsPage";
import { AppHeroNav } from "./components/layout/AppHeroNav";
import { OverviewPage } from "./components/overview/OverviewPage";
import { ModelRoutingPage } from "./components/model-routing/ModelRoutingPage";
import { ReviewQueuePage } from "./components/review-queue/ReviewQueuePage";
import { WorkflowRunsPage } from "./components/workflows/WorkflowRunsPage";
import { IntakePage } from "./components/intake/IntakePage";

function App() {
  const [activeView, setActiveView] = useState<AppView>("OVERVIEW");
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
  const [workflowToolCallingPlanResult, setWorkflowToolCallingPlanResult] =
    useState<ExecuteWorkflowToolCallingPlanResponse | null>(null);
  const [isExecutingWorkflowToolCallingPlan, setIsExecutingWorkflowToolCallingPlan] =
    useState(false);
  const [workflowToolCallingPlanError, setWorkflowToolCallingPlanError] =
    useState<string | null>(null);
  const [workflowToolCallingPlanSuccess, setWorkflowToolCallingPlanSuccess] =
    useState<string | null>(null);
  const [isCreatingProviderFallbackDemo, setIsCreatingProviderFallbackDemo] =
    useState(false);
  const [providerFallbackDemoError, setProviderFallbackDemoError] =
    useState<string | null>(null);
  const [providerFallbackDemoSuccess, setProviderFallbackDemoSuccess] =
    useState<string | null>(null);
  const [agenticTradeInRunResult, setAgenticTradeInRunResult] =
    useState<ExecuteAgenticTradeInRunResponse | null>(null);
  const [isExecutingAgenticTradeInRun, setIsExecutingAgenticTradeInRun] =
    useState(false);
  const [agenticTradeInRunError, setAgenticTradeInRunError] =
    useState<string | null>(null);
  const [agenticTradeInRunSuccess, setAgenticTradeInRunSuccess] =
    useState<string | null>(null);

  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);
  const [startWorkflowError, setStartWorkflowError] = useState<string | null>(
    null,
  );
  const [startWorkflowSuccess, setStartWorkflowSuccess] = useState<
    string | null
  >(null);
  const [latestModelCallLog, setLatestModelCallLog] =
    useState<ModelCallLog | null>(null);

  const [modelRoutingTaskType, setModelRoutingTaskType] =
    useState<ModelTaskType>("INTAKE_PARSING");
  const [modelRoutingGoal, setModelRoutingGoal] =
    useState<ModelRoutingGoal>("HIGH_QUALITY");
  const [modelRoutingRequireJson, setModelRoutingRequireJson] = useState(true);
  const [modelRoutingAllowDisabledProviders, setModelRoutingAllowDisabledProviders] =
    useState(true);
  const [modelRoutingPreview, setModelRoutingPreview] =
    useState<PreviewModelRoutingResponse | null>(null);
  const [isPreviewingModelRouting, setIsPreviewingModelRouting] =
    useState(false);
  const [modelRoutingPreviewError, setModelRoutingPreviewError] = useState<
    string | null
  >(null);

  const [selectedReadOnlyMcpToolName, setSelectedReadOnlyMcpToolName] =
    useState<ReadOnlyMcpToolName>("swingops.workflowRuns.list");
  const [selectedReadOnlyMcpWorkflowRunId, setSelectedReadOnlyMcpWorkflowRunId] =
    useState("");
  const [readOnlyMcpInvocationResult, setReadOnlyMcpInvocationResult] =
    useState<ExecuteReadOnlyToolInvocationResponse | null>(null);
  const [isExecutingReadOnlyMcpTool, setIsExecutingReadOnlyMcpTool] =
    useState(false);
  const [readOnlyMcpInvocationError, setReadOnlyMcpInvocationError] = useState<
    string | null
  >(null);
  const [mcpConnectorCatalog, setMcpConnectorCatalog] = useState<
    ConnectorCatalogItem[]
  >([]);
  const [isLoadingMcpConnectorCatalog, setIsLoadingMcpConnectorCatalog] =
    useState(true);
  const [mcpConnectorCatalogError, setMcpConnectorCatalogError] = useState<
    string | null
  >(null);
  const [mcpInvocationHistory, setMcpInvocationHistory] = useState<
    ConnectorInvocationHistoryItem[]
  >([]);
  const [isLoadingMcpInvocationHistory, setIsLoadingMcpInvocationHistory] =
    useState(true);
  const [mcpInvocationHistoryError, setMcpInvocationHistoryError] = useState<
    string | null
  >(null);
  const [mcpAuditStory, setMcpAuditStory] = useState(
    "agent/tool request → policy decision → execution or block → persisted ToolCallLog audit record",
  );

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
  const needsReviewWorkflowRunCount = globalWorkflowRuns.filter(
    (run) => run.status === "NEEDS_REVIEW",
  ).length;
  const totalToolCallLogCount = globalWorkflowRuns.reduce(
    (count, run) => count + run.totalToolCallLogCount,
    0,
  );

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
  const firstAvailableWorkflowRunId = globalWorkflowRuns[0]?.id ?? "";
  const selectedMcpWorkflowRunId =
    selectedReadOnlyMcpWorkflowRunId || firstAvailableWorkflowRunId;
  const readOnlyMcpToolOptions = READ_ONLY_MCP_TOOL_OPTIONS.filter(
    (tool) =>
      tool.name !== "swingops.workflowRuns.get" || Boolean(selectedMcpWorkflowRunId),
  );
  const selectedReadOnlyMcpTool =
    READ_ONLY_MCP_TOOL_OPTIONS.find(
      (tool) => tool.name === selectedReadOnlyMcpToolName,
    ) ?? READ_ONLY_MCP_TOOL_OPTIONS[0];

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

  async function loadMcpConnectorCatalog() {
    try {
      setIsLoadingMcpConnectorCatalog(true);
      setMcpConnectorCatalogError(null);

      const response = await listConnectorCatalog();

      setMcpConnectorCatalog(response.connectors);
    } catch (error) {
      setMcpConnectorCatalogError(
        error instanceof Error
          ? error.message
          : "Unable to load connector catalog.",
      );
    } finally {
      setIsLoadingMcpConnectorCatalog(false);
    }
  }

  async function loadMcpInvocationHistory() {
    try {
      setIsLoadingMcpInvocationHistory(true);
      setMcpInvocationHistoryError(null);

      const response = await listConnectorInvocationHistory(25);

      setMcpInvocationHistory(response.invocations);
      setMcpAuditStory(response.historyMetadata.auditStory);
    } catch (error) {
      setMcpInvocationHistoryError(
        error instanceof Error
          ? error.message
          : "Unable to load connector invocation history.",
      );
    } finally {
      setIsLoadingMcpInvocationHistory(false);
    }
  }

  useEffect(() => {
    void loadIntakeBatches();
    void loadGlobalWorkflowRuns();
    void loadGlobalReviewQueueItems();
    void loadMcpConnectorCatalog();
    void loadMcpInvocationHistory();
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
      setWorkflowToolCallingPlanError(null);
      setWorkflowToolCallingPlanSuccess(null);
      setWorkflowToolCallingPlanResult(null);
      setProviderFallbackDemoError(null);
      setProviderFallbackDemoSuccess(null);
      setAgenticTradeInRunResult(null);
      setAgenticTradeInRunError(null);
      setAgenticTradeInRunSuccess(null);

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


  async function handleCreateProviderFallbackDemo(workflowRunId: string) {
    try {
      setIsCreatingProviderFallbackDemo(true);
      setProviderFallbackDemoError(null);
      setProviderFallbackDemoSuccess(null);

      const result = await createProviderFallbackDemo(workflowRunId);
      const attemptCount = result.modelCallLog.attemptLogs?.length ?? 0;

      setProviderFallbackDemoSuccess(
        `Created high-quality provider fallback demo: final ${result.modelCallLog.provider} / ${result.modelCallLog.model} with ${attemptCount} provider attempts.`,
      );

      await refreshSelectedWorkflowRunDetail(workflowRunId);
      await loadGlobalWorkflowRuns();
    } catch (error) {
      setProviderFallbackDemoError(
        error instanceof Error
          ? error.message
          : "Unable to create provider fallback demo.",
      );
    } finally {
      setIsCreatingProviderFallbackDemo(false);
    }
  }

  async function handleExecuteWorkflowToolCallingPlan(workflowRunId: string) {
    try {
      setIsExecutingWorkflowToolCallingPlan(true);
      setWorkflowToolCallingPlanError(null);
      setWorkflowToolCallingPlanSuccess(null);

      const result = await executeWorkflowToolCallingPlan(workflowRunId);

      setWorkflowToolCallingPlanResult(result);
      setWorkflowToolCallingPlanSuccess(
        `Tool-calling plan ${result.plan.status.toLowerCase().replace(/_/g, " ")} with ${result.results.length} planned calls and ${result.toolCallLogs.length} persisted audit logs.`,
      );

      await refreshSelectedWorkflowRunDetail(workflowRunId);
      await loadGlobalWorkflowRuns();
      await loadMcpInvocationHistory();
    } catch (error) {
      setWorkflowToolCallingPlanError(
        error instanceof Error
          ? error.message
          : "Unable to run tool-calling plan.",
      );
    } finally {
      setIsExecutingWorkflowToolCallingPlan(false);
    }
  }

  async function handleExecuteAgenticTradeInRun(workflowRunId: string) {
    try {
      setIsExecutingAgenticTradeInRun(true);
      setAgenticTradeInRunError(null);
      setAgenticTradeInRunSuccess(null);
      setWorkflowToolCallingPlanError(null);
      setWorkflowToolCallingPlanSuccess(null);
      setProviderFallbackDemoError(null);
      setProviderFallbackDemoSuccess(null);

      const result = await executeAgenticTradeInRun(workflowRunId);

      setAgenticTradeInRunResult(result);
      setWorkflowToolCallingPlanResult({
        plan: result.plan,
        results: result.results,
        toolCallLogs: result.toolCallLogs,
        executionMetadata: {
          planner: result.executionMetadata.orchestrator,
          requestedBy: "agentic-trade-in-run",
          readOnlyConnectorSurface:
            result.executionMetadata.readOnlyMcpConnectorSurface,
          mutationToolsEnabled: false,
          policyCheckedBeforeEachExecution: true,
        },
      });
      setAgenticTradeInRunSuccess(
        "Agentic trade-in run completed: " +
          result.evalSummary.toolCallsSucceeded +
          "/" +
          result.evalSummary.toolCallsAttempted +
          " MCP connector calls succeeded. Provider fallback " +
          (result.evalSummary.modelProviderFallbackUsed ? "used." : "not used."),
      );

      await refreshSelectedWorkflowRunDetail(workflowRunId);
      await loadGlobalWorkflowRuns();
      await loadGlobalReviewQueueItems();
      await loadMcpInvocationHistory();
    } catch (error) {
      setAgenticTradeInRunError(
        error instanceof Error
          ? error.message
          : "Unable to run agentic trade-in workflow.",
      );
    } finally {
      setIsExecutingAgenticTradeInRun(false);
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
      await loadMcpConnectorCatalog();
      await loadMcpInvocationHistory();

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

  async function handlePreviewModelRouting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsPreviewingModelRouting(true);
      setModelRoutingPreviewError(null);

      const preview = await previewModelRouting({
        taskType: modelRoutingTaskType,
        preferredGoal: modelRoutingGoal,
        requireJson: modelRoutingRequireJson,
        allowDisabledProvidersForSimulation: modelRoutingAllowDisabledProviders,
      });

      setModelRoutingPreview(preview);
    } catch (error) {
      setModelRoutingPreviewError(
        error instanceof Error
          ? error.message
          : "Unable to preview model routing.",
      );
    } finally {
      setIsPreviewingModelRouting(false);
    }
  }

  async function handleExecuteReadOnlyMcpTool(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      selectedReadOnlyMcpToolName === "swingops.workflowRuns.get" &&
      !selectedMcpWorkflowRunId
    ) {
      setReadOnlyMcpInvocationError(
        "Create or select a workflow run before using the get-by-id connector demo.",
      );
      return;
    }

    try {
      setIsExecutingReadOnlyMcpTool(true);
      setReadOnlyMcpInvocationError(null);

      const result = await executeReadOnlyToolInvocation({
        toolName: selectedReadOnlyMcpToolName,
        inputJson: getReadOnlyMcpToolInput(
          selectedReadOnlyMcpToolName,
          selectedMcpWorkflowRunId,
        ),
        requestedBy: "agent.web-readonly-demo",
        workflowRunId:
          selectedReadOnlyMcpToolName === "swingops.workflowRuns.get"
            ? selectedMcpWorkflowRunId
            : undefined,
        executionMode: selectedReadOnlyMcpTool.blockedDemo
          ? "HUMAN_APPROVED"
          : "AGENT_AUTONOMOUS",
        humanApprovalGranted: selectedReadOnlyMcpTool.blockedDemo,
      });

      setReadOnlyMcpInvocationResult(result);
      await loadGlobalWorkflowRuns();
      await loadGlobalReviewQueueItems();

      if (
        selectedWorkflowRunDetail &&
        result.invocation.workflowRunId === selectedWorkflowRunDetail.workflowRun.id
      ) {
        await refreshSelectedWorkflowRunDetail(
          selectedWorkflowRunDetail.workflowRun.id,
        );
      }
    } catch (error) {
      setReadOnlyMcpInvocationError(
        error instanceof Error
          ? error.message
          : "Unable to execute read-only MCP connector demo.",
      );
    } finally {
      setIsExecutingReadOnlyMcpTool(false);
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
      <AppHeroNav activeView={activeView} onViewChange={setActiveView} />

      {activeView === "OVERVIEW" ? (
        <OverviewPage
          intakeBatchCount={intakeBatches.length}
          workflowRunCount={globalWorkflowRuns.length}
          openReviewQueueItemCount={openReviewQueueItemCount}
          toolCallLogCount={totalToolCallLogCount}
          needsReviewWorkflowRunCount={needsReviewWorkflowRunCount}
        />
      ) : null}

      {activeView === "INTAKE" ? (
        <IntakePage
          name={name}
          description={description}
          sourceType={sourceType}
          rawText={rawText}
          createBatchError={createBatchError}
          createBatchSuccess={createBatchSuccess}
          isCreatingBatch={isCreatingBatch}
          intakeBatches={intakeBatches}
          isLoadingIntakeBatches={isLoadingIntakeBatches}
          intakeBatchesError={intakeBatchesError}
          selectedBatchDetail={selectedBatchDetail}
          isLoadingBatchDetail={isLoadingBatchDetail}
          batchDetailError={batchDetailError}
          isStartingWorkflow={isStartingWorkflow}
          startWorkflowError={startWorkflowError}
          startWorkflowSuccess={startWorkflowSuccess}
          latestModelCallLog={latestModelCallLog}
          isExecutingWorkflowRun={isExecutingWorkflowRun}
          executeWorkflowRunSuccess={executeWorkflowRunSuccess}
          executeWorkflowRunError={executeWorkflowRunError}
          isLoadingWorkflowRunDetail={isLoadingWorkflowRunDetail}
          workflowRunDetailError={workflowRunDetailError}
          selectedWorkflowRunDetail={selectedWorkflowRunDetail}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onSourceTypeChange={setSourceType}
          onRawTextChange={setRawText}
          onCreateBatch={handleCreateBatch}
          onSelectBatch={(intakeBatchId) => void handleSelectBatch(intakeBatchId)}
          onStartWorkflow={() => void handleStartWorkflow()}
          onExecuteWorkflowRun={(workflowRunId, scenario) =>
            void handleExecuteWorkflowRun(workflowRunId, scenario)
          }
          onSelectWorkflowRun={(workflowRunId) =>
            void handleSelectWorkflowRun(workflowRunId)
          }
          renderReviewQueueActionControls={renderReviewQueueActionControls}
        />
      ) : null}

      {activeView === "WORKFLOW_RUNS" ? (
        <WorkflowRunsPage
          workflowRuns={globalWorkflowRuns}
          filteredWorkflowRuns={filteredGlobalWorkflowRuns}
          workflowRunStatusCounts={workflowRunStatusCounts}
          statusFilter={workflowRunStatusFilter}
          selectedWorkflowRunId={selectedWorkflowRunId}
          selectedWorkflowRunDetail={selectedWorkflowRunDetail}
          selectedBatchItems={selectedBatchDetail?.items}
          isLoading={isLoadingGlobalWorkflowRuns}
          error={globalWorkflowRunsError}
          isLoadingWorkflowRunDetail={isLoadingWorkflowRunDetail}
          workflowToolCallingPlanResult={workflowToolCallingPlanResult}
          isExecutingWorkflowToolCallingPlan={isExecutingWorkflowToolCallingPlan}
          workflowToolCallingPlanError={workflowToolCallingPlanError}
          workflowToolCallingPlanSuccess={workflowToolCallingPlanSuccess}
          isCreatingProviderFallbackDemo={isCreatingProviderFallbackDemo}
          providerFallbackDemoError={providerFallbackDemoError}
          providerFallbackDemoSuccess={providerFallbackDemoSuccess}
          agenticTradeInRunResult={agenticTradeInRunResult}
          isExecutingAgenticTradeInRun={isExecutingAgenticTradeInRun}
          agenticTradeInRunError={agenticTradeInRunError}
          agenticTradeInRunSuccess={agenticTradeInRunSuccess}
          onStatusFilterChange={setWorkflowRunStatusFilter}
          onSelectWorkflowRun={(workflowRunId) =>
            void handleSelectWorkflowRun(workflowRunId)
          }
          onRunWorkflowToolCallingPlan={(workflowRunId) =>
            void handleExecuteWorkflowToolCallingPlan(workflowRunId)
          }
          onCreateProviderFallbackDemo={(workflowRunId) =>
            void handleCreateProviderFallbackDemo(workflowRunId)
          }
          onExecuteAgenticTradeInRun={(workflowRunId) =>
            void handleExecuteAgenticTradeInRun(workflowRunId)
          }
        />
      ) : null}

      {activeView === "REVIEW_QUEUE" ? (
        <ReviewQueuePage
          items={globalReviewQueueItems}
          openReviewQueueItemCount={openReviewQueueItemCount}
          isLoading={isLoadingGlobalReviewQueue}
          error={globalReviewQueueError}
          actionSuccess={reviewQueueActionSuccess}
          actionError={reviewQueueActionError}
          activeReviewQueueItemId={activeReviewQueueItemId}
          reviewQueueNotesById={reviewQueueNotesById}
          onNotesChange={handleReviewQueueNotesChange}
          onReviewQueueItemAction={(input) =>
            void handleReviewQueueItemAction(input)
          }
        />
      ) : null}

      {activeView === "MODEL_ROUTING" ? (
        <ModelRoutingPage
          taskType={modelRoutingTaskType}
          goal={modelRoutingGoal}
          requireJson={modelRoutingRequireJson}
          allowDisabledProviders={modelRoutingAllowDisabledProviders}
          preview={modelRoutingPreview}
          isPreviewing={isPreviewingModelRouting}
          error={modelRoutingPreviewError}
          onTaskTypeChange={setModelRoutingTaskType}
          onGoalChange={setModelRoutingGoal}
          onRequireJsonChange={setModelRoutingRequireJson}
          onAllowDisabledProvidersChange={setModelRoutingAllowDisabledProviders}
          onSubmit={handlePreviewModelRouting}
        />
      ) : null}

      {activeView === "MCP_CONNECTORS" ? (
        <McpConnectorsPage
          connectorCatalog={mcpConnectorCatalog}
          isLoadingConnectorCatalog={isLoadingMcpConnectorCatalog}
          connectorCatalogError={mcpConnectorCatalogError}
          invocationHistory={mcpInvocationHistory}
          isLoadingInvocationHistory={isLoadingMcpInvocationHistory}
          invocationHistoryError={mcpInvocationHistoryError}
          auditStory={mcpAuditStory}
          readOnlyMcpToolOptions={readOnlyMcpToolOptions}
          selectedToolName={selectedReadOnlyMcpToolName}
          selectedWorkflowRunId={selectedMcpWorkflowRunId}
          selectedTool={selectedReadOnlyMcpTool}
          workflowRuns={globalWorkflowRuns}
          invocationResult={readOnlyMcpInvocationResult}
          invocationError={readOnlyMcpInvocationError}
          isExecutingTool={isExecutingReadOnlyMcpTool}
          onRefreshCatalog={() => void loadMcpConnectorCatalog()}
          onRefreshHistory={() => void loadMcpInvocationHistory()}
          onSelectedToolNameChange={setSelectedReadOnlyMcpToolName}
          onSelectedWorkflowRunIdChange={setSelectedReadOnlyMcpWorkflowRunId}
          onExecuteTool={handleExecuteReadOnlyMcpTool}
        />
      ) : null}

    </main>
  );
}

export default App;
