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

export type WorkflowQualityBundle = {
  agentPlan: AgentPlanStep[];
  validationChecks: ValidationCheck[];
  retryEvents: RetryEvent[];
  providerFallbackTrace: ProviderFallbackTrace;
  toolSelectionRationales: ToolSelectionRationale[];
  reviewOutcomes: ReviewOutcome[];
  workflowQualitySummary: WorkflowQualitySummary;
};
