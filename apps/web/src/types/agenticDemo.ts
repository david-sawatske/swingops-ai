import type { ReviewQueueItem } from "./reviewQueue";
import type { ModelCallLog, ToolCallLog } from "./workflowRun";
import type { ParserEvidence } from "./parserEvidence";

export type AgenticTradeInRunEvalSummary = {
  extractionCompleteness: number;
  groundingConfidence: number;
  toolCallsAttempted: number;
  toolCallsSucceeded: number;
  modelProviderFallbackUsed: boolean;
  reviewRequired: boolean;
  pass: boolean;
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
  conditionGrade: string | null;
  tradeInValue: number | null;
  parserEvidence?: ParserEvidence;
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

export type PriorReviewLearningEvidence = {
  fieldName: string;
  correctedValue: string | null;
  proposedValue: string | null;
  rawTextMatch: string | null;
  evidenceText: string | null;
  confidence: number;
  strength: "WEAK" | "MEDIUM" | "STRONG";
  reasonCodes: string[];
  summary: string;
  learningEventId: string;
  createdAt: string;
};

export type PriorReviewLearningSuggestion = {
  fieldName: string;
  rawTextMatch: string | null;
  suggestedValue: string | null;
  previousCorrectedValue: string | null;
  proposedValue: string | null;
  evidenceText: string | null;
  confidence: number;
  strength: "WEAK" | "MEDIUM" | "STRONG";
  confidenceImpact: string;
  reasonCodes: string[];
  summary: string;
  whySuggestionExists: string;
  sourceLearningEventId: string;
  status: "SUGGESTED";
  createdAt: string;
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
  priorReviewLearningEvidenceByItem: {
    parsedItemId: string;
    evidence: PriorReviewLearningEvidence[];
  }[];
  priorReviewLearningSuggestionsByItem: {
    parsedItemId: string;
    suggestions: PriorReviewLearningSuggestion[];
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
    priorReviewEvidenceCount: number;
    priorReviewSuggestionCount: number;
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
