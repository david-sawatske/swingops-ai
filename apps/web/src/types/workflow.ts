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

export type AgenticTradeInDemoInventoryLookup = {
  productId: string | null;
  sku: string | null;
  displayName: string | null;
  brand: string | null;
  productLine: string | null;
  category: string | null;
  year: number | null;
  confidence: number;
  matchReasons: string[];
  similarProducts: {
    productId: string;
    sku: string;
    displayName: string;
    brand: string;
    productLine: string;
    category: string;
    year: number;
    confidence: number;
    matchReasons: string[];
  }[];
};

export type AgenticTradeInDemoValuationEstimate = {
  productId: string | null;
  sku: string | null;
  lowValue: number;
  highValue: number;
  currency: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  valueFactors: string[];
  adjustments: {
    factor: string;
    direction: "INCREASE" | "DECREASE" | "NEUTRAL";
    amount: number;
    reason: string;
  }[];
  reviewRequired: boolean;
  reviewReasons: string[];
};

export type AgentPlanActionType =
  | "VALIDATE_FIELDS"
  | "SEARCH_KNOWLEDGE"
  | "MATCH_INVENTORY"
  | "ESTIMATE_VALUE"
  | "SELECT_TOOLS"
  | "EXECUTE_TOOLS"
  | "VALIDATE_CONFIDENCE"
  | "RETRY_EXTRACTION"
  | "ESCALATE_REVIEW"
  | "ENFORCE_POLICY"
  | "RECORD_TRACE";

export type AgentPlanStepStatus =
  | "PENDING"
  | "COMPLETED"
  | "NEEDS_REVIEW"
  | "BLOCKED"
  | "SKIPPED";

export type AgentPlanStep = {
  id: string;
  label: string;
  purpose: string;
  actionType: AgentPlanActionType;
  expectedOutput: string;
  status: AgentPlanStepStatus;
  linkedTraceEventIds: string[];
  requiredTools: string[];
  validationRules: string[];
  retryPolicy: string | null;
  safetyPolicy: string | null;
};

export type ValidationCheckStatus = "PASS" | "WARNING" | "FAIL";

export type ValidationCheckSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH";

export type ValidationCheck = {
  id: string;
  label: string;
  status: ValidationCheckStatus;
  severity: ValidationCheckSeverity;
  message: string;
  field: string | null;
  recordId: string | null;
  reviewRequired: boolean;
};

export type RetryEventStatus = "RESOLVED" | "UNRESOLVED" | "SKIPPED";

export type RetryEvent = {
  id: string;
  reason: string;
  targetField: string | null;
  recordId: string | null;
  policy: string;
  status: RetryEventStatus;
  before: unknown;
  after: unknown;
  message: string;
};

export type ProviderFallbackTraceAttempt = {
  provider: string;
  model: string;
  attemptOrder: number;
  status: string;
  reason: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  estimatedCostUsd: number | null;
};

export type ProviderFallbackTrace = {
  routingGoal: string;
  selectedProvider: string;
  selectedModel: string;
  finalProvider: string;
  finalModel: string;
  fallbackUsed: boolean;
  attempts: ProviderFallbackTraceAttempt[];
  summary: string;
};

export type ToolSelectionRationale = {
  toolName: string;
  rationale: string;
  expectedRiskLevel: "LOW" | "HIGH";
  expectedMutatesData: boolean;
  expectedRequiresHumanApproval: boolean;
};

export type ReviewOutcome = {
  reviewQueueItemId: string;
  recordId: string | null;
  reason: string;
  validationWarnings: string[];
  suggestedNextAction: string;
};

export type WorkflowQualityStatus =
  | "READY"
  | "NEEDS_REVIEW"
  | "FAILED_VALIDATION"
  | "BLOCKED";

export type WorkflowQualitySummary = {
  status: WorkflowQualityStatus;
  recordsProcessed: number;
  validationPassed: number;
  validationWarnings: number;
  validationFailures: number;
  retryAttempts: number;
  reviewItemsCreated: number;
  toolCalls: number;
  blockedMutations: number;
  inventoryMatches: number;
  valuationRangesGenerated: number;
  valuationReviewRequired: number;
  providerFallbackUsed: boolean;
  evidenceCoverage: string;
  summary: string;
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
  inventoryMatchesByItem: {
    parsedItemId: string;
    lookup: AgenticTradeInDemoInventoryLookup;
  }[];
  valuationEvidenceByItem: {
    parsedItemId: string;
    estimate: AgenticTradeInDemoValuationEstimate;
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
    inventoryMatchCount: number;
    valuationRangeCount: number;
    valuationReviewRequiredCount: number;
    selectedProvider: string;
    selectedModel: string;
    productStory: string;
  };
  agentPlan: AgentPlanStep[];
  validationChecks: ValidationCheck[];
  retryEvents: RetryEvent[];
  providerFallbackTrace: ProviderFallbackTrace;
  toolSelectionRationales: ToolSelectionRationale[];
  reviewOutcomes: ReviewOutcome[];
  workflowQualitySummary: WorkflowQualitySummary;
  auditTrail: AgenticTradeInDemoAuditEvent[];
};

export type MultiSourceIntakeSourceType =
  | "FREE_TEXT"
  | "POORLY_FORMED_CSV"
  | "EMAIL"
  | "LOG";

export type MultiSourceIntakeSourceInput = {
  sourceType: MultiSourceIntakeSourceType;
  sourceName?: string;
  rawContent: string;
};

export type MultiSourceIntakeRecord = {
  id: string;
  sourceId: string;
  sourceType: MultiSourceIntakeSourceType;
  brand: string | null;
  productLine: string | null;
  category: string | null;
  shaftFlex: string | null;
  condition: string | null;
  tradeInValue: number | null;
  customerName: string | null;
  customerEmail: string | null;
  storeId: string | null;
  eventTimestamp: string | null;
  attachmentsMentioned: string[];
  missingFields: string[];
  confidence: number;
  reviewNeeded: boolean;
  normalizedText: string;
};

export type MultiSourceIntakeSchemaField = {
  fieldName: string;
  type: "string" | "number" | "boolean" | "datetime" | "string[]";
  nullable: boolean;
  description: string;
  examples: string[];
};

export type MultiSourceIntakeSourceResult = {
  id: string;
  sourceType: MultiSourceIntakeSourceType;
  sourceName: string;
  rawContent: string;
  cleanedText: string;
  extractedRecords: MultiSourceIntakeRecord[];
  inferredSchema: MultiSourceIntakeSchemaField[];
  metadata: {
    detectedBrands: string[];
    detectedCategories: string[];
    detectedStoreIds: string[];
    customerEmails: string[];
    attachmentNames: string[];
    eventTimestamps: string[];
    operationalTags: string[];
  };
  qualitySignals: {
    signal: string;
    severity: "INFO" | "WARNING" | "REVIEW";
    message: string;
  }[];
  missingFields: string[];
  confidence: number;
  embeddingReadiness: {
    ready: boolean;
    chunkCount: number;
    reason: string;
    suggestedChunkStrategy: string;
  };
  ragIndexReadiness: {
    ready: boolean;
    indexName: string;
    metadataFields: string[];
    reason: string;
  };
};

export type ExecuteMultiSourceIntakeDemoRequest = {
  sourceTypes?: MultiSourceIntakeSourceType[];
  sources?: MultiSourceIntakeSourceInput[];
};

export type ExecuteMultiSourceIntakeDemoResponse = {
  sourcesProcessed: number;
  recordsExtracted: number;
  assetsCreated: number;
  reviewNeeded: number;
  sourceResults: MultiSourceIntakeSourceResult[];
  inferredDatasetSchema: MultiSourceIntakeSchemaField[];
  cleanedDatasetPreview: MultiSourceIntakeRecord[];
  metadataSummary: {
    sourceTypes: MultiSourceIntakeSourceType[];
    detectedBrands: string[];
    detectedCategories: string[];
    detectedStoreIds: string[];
    customerEmails: string[];
    attachmentNames: string[];
    eventTimestamps: string[];
    operationalTags: string[];
  };
  ragReadinessSummary: {
    readySourceCount: number;
    totalSourceCount: number;
    readyRecordCount: number;
    totalRecordCount: number;
    embeddingReady: boolean;
    ragIndexReady: boolean;
    summary: string;
  };
  auditTrail: {
    orderIndex: number;
    label: string;
    status: "SUCCEEDED" | "NEEDS_REVIEW" | "INFO";
    summary: string;
    details: unknown;
  }[];
  finalSummary: string;
  persistedIds: {
    intakeBatchId: string;
    intakeItemIds: string[];
    workflowRunId: string;
    reviewQueueItemIds: string[];
    toolCallLogIds: string[];
  };
};
