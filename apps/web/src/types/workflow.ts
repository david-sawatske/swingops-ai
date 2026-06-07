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

export type ReviewQueueItemStatus =
  | "OPEN"
  | "IN_REVIEW"
  | "RESOLVED"
  | "DISMISSED";

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

export type ReviewQueueItem = {
  id: string;
  intakeItemId: string | null;
  golfClubId: string | null;
  workflowRunId: string | null;
  reason: string;
  status: ReviewQueueItemStatus;
  originalText: string | null;
  proposedGolfClubJson: unknown;
  reviewerNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewQueueIntakeItemSummary = {
  id: string;
  intakeBatchId: string;
  rawText: string;
  sourceRowNumber: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewQueueIntakeBatchSummary = {
  id: string;
  name: string;
  description: string | null;
  sourceType: string;
  status: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
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

export type GlobalReviewQueueItem = ReviewQueueItem & {
  workflowRun: WorkflowRunSummary | null;
  intakeItem: ReviewQueueIntakeItemSummary | null;
  intakeBatch: ReviewQueueIntakeBatchSummary | null;
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

export type ListReviewQueueItemsResponse = {
  reviewQueueItems: GlobalReviewQueueItem[];
};

export type ReviewQueueItemActionRequest = {
  reviewerNotes?: string;
};

export type ReviewQueueItemActionResponse = {
  reviewQueueItem: ReviewQueueItem;
  workflowRun: WorkflowRunSummary | null;
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

export type AgenticTradeInRunEvalSummary = {
  extractionCompleteness: number;
  groundingConfidence: number;
  toolCallsAttempted: number;
  toolCallsSucceeded: number;
  modelProviderFallbackUsed: boolean;
  reviewRequired: boolean;
  pass: boolean;
};

export type ExecuteAgenticTradeInRunResponse = {
  workflowRunId: string;
  modelCallLog: ModelCallLog;
  plan: ExecuteWorkflowToolCallingPlanResponse["plan"];
  results: ExecuteWorkflowToolCallingPlanResponse["results"];
  toolCallLogs: ToolCallLog[];
  evalSummary: AgenticTradeInRunEvalSummary;
  executionMetadata: {
    orchestrator: string;
    modelRoutingGoal: "HIGH_QUALITY";
    modelTaskType: "INTAKE_PARSING";
    providerFallbackExecutor: boolean;
    deterministicToolPlan: boolean;
    readOnlyMcpConnectorSurface: boolean;
    qualityEvalPersisted: boolean;
  };
};

export type AgenticTradeInDemoParsedItem = {
  id: string;
  rawLine: string;
  brand: string | null;
  productLine: string | null;
  model: string | null;
  category: string | null;
  loft: string | null;
  clubNumber: string | null;
  shaftBrand: string | null;
  shaftModel: string | null;
  shaftFlex: string | null;
  conditionNotes: string[];
  accessoriesNotes: string[];
  uncertaintyNotes: string[];
  confidence: number;
  missingFields: string[];
};

export type AgenticTradeInDemoAuditEvent = {
  orderIndex: number;
  label: string;
  status: "SUCCEEDED" | "NEEDS_REVIEW" | "BLOCKED" | "INFO";
  summary: string;
  details: unknown;
};

export type AgenticTradeInDemoToolCallResult = {
  toolName: string;
  status: "SUCCEEDED" | "FAILED" | "BLOCKED";
  policyDecision: string;
  policyReason: string;
  executionAttempted: boolean;
  toolCallLogId: string;
  outputPreview: unknown | null;
  errorMessage: string | null;
};

export type ExecuteEndToEndAgenticTradeInDemoRequest = {
  rawInput?: string;
};

export type ExecuteEndToEndAgenticTradeInDemoResponse = {
  rawInput: string;
  parsedItems: AgenticTradeInDemoParsedItem[];
  knowledgeMatchesByItem: {
    parsedItemId: string;
    query: string;
    search: {
      query: string;
      results: {
        chunkId: string;
        documentTitle: string;
        sourceName: string;
        chunkText: string;
        chunkType: string;
        brand: string | null;
        productLine: string | null;
        category: string | null;
        score: number;
        scoreBreakdown?: {
          weightedScore: number;
          vectorScore: number | null;
          components: Record<
            string,
            {
              score: number | null;
              weight: number;
              explanation: string | null;
            }
          >;
        };
        matchedTerms: string[];
        scoringExplanation: string[];
      }[];
      summary: string;
    };
  }[];
  modelRoutingDecision: {
    selectedProvider: string;
    selectedModel: string;
    selectedReason: string;
    estimatedCostTier: string;
    expectedLatencyTier: string;
    qualityTier: string;
    healthStatus: string;
    estimatedCostUsd: number;
    fallbackProvider: string | null;
    fallbackModel: string | null;
    routingFactors: string[];
    candidatesConsidered: unknown[];
    rejectedCandidates: unknown[];
  };
  modelCallLog: ModelCallLog;
  toolCallingPlan: {
    planId: string;
    plannedCalls: {
      orderIndex: number;
      toolName: string;
      reason: string;
      inputJson: Record<string, unknown>;
      expectedRiskLevel: "LOW" | "HIGH";
      expectedMutatesData: boolean;
      expectedRequiresHumanApproval: boolean;
    }[];
  };
  toolCallResults: AgenticTradeInDemoToolCallResult[];
  blockedToolCallResult: AgenticTradeInDemoToolCallResult | null;
  reviewQueueItemsCreated: ReviewQueueItem[];
  persisted: {
    intakeBatchId: string;
    intakeItemIds: string[];
    workflowRunId: string;
    modelCallLogId: string;
    toolCallLogIds: string[];
    reviewQueueItemIds: string[];
  };
  finalSummary: {
    parsedItemCount: number;
    knowledgeMatchCount: number;
    lowConfidenceItemCount: number;
    reviewQueueItemCount: number;
    successfulReadOnlyToolCallCount: number;
    blockedMutationToolCallCount: number;
    selectedProvider: string;
    selectedModel: string;
    productStory: string;
  };
  auditTrail: AgenticTradeInDemoAuditEvent[];
};
