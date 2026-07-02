import type { ReviewQueueIntakeBatchSummary, ReviewQueueIntakeItemSummary, ReviewQueueItem } from "./reviewQueue";

export type WorkflowRunStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "NEEDS_REVIEW"
  | "CANCELLED";

export type WorkflowStepStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED"
  | "RETRYING";

export type WorkflowStepType =
  | "PARSE_INPUT"
  | "NORMALIZE_DATA"
  | "EXTRACT_GOLF_CLUB_FIELDS"
  | "VALIDATE_STRUCTURED_OUTPUT"
  | "CREATE_REVIEW_ITEM"
  | "PERSIST_GOLF_CLUB";

export type ModelProviderName =
  | "MOCK"
  | "OPENAI"
  | "ANTHROPIC"
  | "AZURE_OPENAI"
  | "OLLAMA";

export type ModelCallStatus =
  | "STARTED"
  | "SUCCEEDED"
  | "FAILED"
  | "RETRIED"
  | "SKIPPED";

export type ModelCallAttemptStatus =
  | "SUCCESS"
  | "SUCCEEDED"
  | "SKIPPED"
  | "FAILED"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "DISABLED"
  | "UNHEALTHY";

export type WorkflowRunSummary = {
  id: string;
  intakeBatchId: string | null;
  intakeItemId: string | null;
  workflowName: string;
  status: WorkflowRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowStep = {
  id: string;
  workflowRunId: string;
  stepName: string;
  stepType: WorkflowStepType;
  status: WorkflowStepStatus;
  orderIndex: number;
  inputJson: unknown;
  outputJson: unknown;
  errorMessage: string | null;
  retryCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ModelCallAttemptLog = {
  id: string;
  modelCallLogId: string;
  provider: ModelProviderName;
  model: string;
  status: ModelCallAttemptStatus;
  reason: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  estimatedCostUsd: number | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
};

export type ModelCallLog = {
  id: string;
  workflowRunId: string | null;
  workflowStepId: string | null;
  provider: ModelProviderName;
  model: string;
  status: ModelCallStatus;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  estimatedCostUsd: number | null;
  requestJson: unknown;
  responseJson: unknown;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  attemptLogs?: ModelCallAttemptLog[];
  createdAt: string;
};

export type ToolCallLog = {
  id: string;
  workflowRunId: string | null;
  workflowStepId: string | null;
  toolName: string;
  status: string;
  inputJson: unknown;
  outputJson: unknown;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
};

export type GlobalWorkflowRunSummary = WorkflowRunSummary & {
  intakeBatch: ReviewQueueIntakeBatchSummary | null;
  intakeItem: ReviewQueueIntakeItemSummary | null;
  latestModelCallLog: ModelCallLog | null;
  latestToolCallLog: ToolCallLog | null;
  totalToolCallLogCount: number;
  auditOnlyToolCallLogCount: number;
  totalReviewQueueItemCount: number;
  openReviewQueueItemCount: number;
};

export type WorkflowRunDetail = {
  workflowRun: WorkflowRunSummary;
  steps: WorkflowStep[];
  toolCallLogs: ToolCallLog[];
  modelCallLogs: ModelCallLog[];
  reviewQueueItems: ReviewQueueItem[];
};

export type StartWorkflowResponse = {
  workflowRun: WorkflowRunSummary;
  steps: WorkflowStep[];
  modelCallLog: ModelCallLog;
};

export type WorkflowExecutionScenario = "HAPPY_PATH" | "NEEDS_REVIEW";

export type ExecuteWorkflowRunRequest = {
  scenario?: WorkflowExecutionScenario;
};

export type ExecuteWorkflowRunResponse = {
  workflowRun: WorkflowRunSummary;
  steps: WorkflowStep[];
  toolCallLogs: ToolCallLog[];
  reviewQueueItems: ReviewQueueItem[];
};

export type CreateProviderFallbackDemoResponse = {
  modelCallLog: ModelCallLog;
};

export type ListWorkflowRunsResponse = {
  workflowRuns: GlobalWorkflowRunSummary[];
};

export type WorkflowToolCallingPlanStatus =
  | "PLANNED"
  | "EXECUTED"
  | "PARTIALLY_EXECUTED"
  | "FAILED"
  | "BLOCKED";

export type WorkflowToolCallingPlannedCall = {
  planCallId: string;
  orderIndex: number;
  toolName: string;
  reason: string;
  inputJson: Record<string, unknown>;
  expectedRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
  expectedMutatesData: boolean;
  expectedRequiresHumanApproval: boolean;
};

export type WorkflowToolCallingPlanCallResult = WorkflowToolCallingPlannedCall & {
  status: "SUCCEEDED" | "FAILED" | "BLOCKED";
  policyDecision: "ALLOW" | "REQUIRE_HUMAN_APPROVAL" | "BLOCK";
  policyReasonCodes: string[];
  policyReason: string;
  executionAttempted: boolean;
  toolCallLogId: string;
  connectorResultPreview: unknown | null;
  failurePreview: string | null;
};

export type ExecuteWorkflowToolCallingPlanResponse = {
  plan: {
    planId: string;
    workflowRunId: string;
    status: WorkflowToolCallingPlanStatus;
    plannedCalls: WorkflowToolCallingPlannedCall[];
  };
  results: WorkflowToolCallingPlanCallResult[];
  toolCallLogs: ToolCallLog[];
  executionMetadata: {
    planner: string;
    requestedBy: string;
    readOnlyConnectorSurface: boolean;
    mutationToolsEnabled: boolean;
    policyCheckedBeforeEachExecution: boolean;
  };
};
