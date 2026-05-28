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
  createdAt: string;
};

export type StartWorkflowResponse = {
  workflowRun: WorkflowRunSummary;
  steps: WorkflowStep[];
  modelCallLog: ModelCallLog;
};
