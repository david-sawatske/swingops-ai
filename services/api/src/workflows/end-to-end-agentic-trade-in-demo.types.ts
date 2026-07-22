import type { ModelCallLog, ReviewQueueItem } from "@prisma/client";

import type { ModelRouteDecision } from "../ai/model-router.js";
import type { InventoryProductLookupResult } from "../internal-systems/inventory-service.js";
import type { TradeInValuationResult } from "../internal-systems/trade-in-valuation-service.js";
import type { KnowledgeSearchResult } from "../knowledge/knowledge-search.js";
import type {
  PriorReviewLearningEvidence,
  PriorReviewLearningSuggestion,
} from "../review-learning/review-learning-evidence.js";
import type {
  FieldRepairRecordOutcome,
  FieldRepairSuggestion,
} from "./main-run-field-repair.js";
import type { ParsedTradeInDemoItem } from "./trade-in-demo-parser.js";
import type { WorkflowOrchestrationTrace } from "./workflow-orchestration-trace.js";
import type { WorkflowQualityBundle } from "./workflow-quality-types.js";

export type EndToEndAgenticTradeInDemoAuditEvent = {
  orderIndex: number;
  label: string;
  status: "SUCCEEDED" | "NEEDS_REVIEW" | "BLOCKED" | "INFO";
  summary: string;
  details: unknown;
};

export type AgenticTradeInKnowledgeMatch = {
  parsedItemId: string;
  query: string;
  search: KnowledgeSearchResult;
};

export type AgenticTradeInInventoryMatch = {
  parsedItemId: string;
  lookup: InventoryProductLookupResult;
};

export type AgenticTradeInValuationEvidence = {
  parsedItemId: string;
  estimate: TradeInValuationResult;
};

export type AgenticTradeInPriorReviewEvidence = {
  parsedItemId: string;
  evidence: PriorReviewLearningEvidence[];
};

export type AgenticTradeInPriorReviewSuggestions = {
  parsedItemId: string;
  suggestions: PriorReviewLearningSuggestion[];
};

export type AgenticTradeInToolCallResult = {
  toolName: string;
  status: "SUCCEEDED" | "FAILED" | "BLOCKED";
  policyDecision: string;
  policyReason: string;
  executionAttempted: boolean;
  toolCallLogId: string;
  outputPreview: unknown | null;
  errorMessage: string | null;
};

export type AgenticTradeInToolCallingPlan = {
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

export type AgenticTradeInFieldRepairExecution = {
  modelCallLogId: string;
  recordOutcomes: FieldRepairRecordOutcome[];
  suggestions: FieldRepairSuggestion[];
  jsonValid: boolean;
  validationPassed: boolean;
  validationErrors: string[];
};

export type AgenticTradeInFinalSummary = {
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

export type EndToEndAgenticTradeInDemoResult = {
  rawInput: string;
  parsedItems: ParsedTradeInDemoItem[];
  knowledgeMatchesByItem: AgenticTradeInKnowledgeMatch[];
  inventoryMatchesByItem: AgenticTradeInInventoryMatch[];
  valuationEvidenceByItem: AgenticTradeInValuationEvidence[];
  priorReviewLearningEvidenceByItem: AgenticTradeInPriorReviewEvidence[];
  priorReviewLearningSuggestionsByItem: AgenticTradeInPriorReviewSuggestions[];
  modelAssistanceScope: {
    eligibleRecordCount: number;
    selectedRecordCount: number;
    deferredRecordCount: number;
    maxSelectedRecordCount: number;
  };
  modelRoutingDecision: ModelRouteDecision;
  modelCallLog: ModelCallLog;
  fieldRepairExecution: AgenticTradeInFieldRepairExecution;
  orchestrationTrace: WorkflowOrchestrationTrace;
  toolCallingPlan: AgenticTradeInToolCallingPlan;
  toolCallResults: AgenticTradeInToolCallResult[];
  blockedToolCallResult: AgenticTradeInToolCallResult | null;
  reviewQueueItemsCreated: ReviewQueueItem[];
  persisted: {
    intakeBatchId: string;
    intakeItemIds: string[];
    workflowRunId: string;
    modelCallLogId: string;
    toolCallLogIds: string[];
    reviewQueueItemIds: string[];
  };
  finalSummary: AgenticTradeInFinalSummary;
  executionPlan: WorkflowQualityBundle["executionPlan"];
  validationChecks: WorkflowQualityBundle["validationChecks"];
  retryEvents: WorkflowQualityBundle["retryEvents"];
  providerFallbackTrace: WorkflowQualityBundle["providerFallbackTrace"];
  toolSelectionRationales: WorkflowQualityBundle["toolSelectionRationales"];
  reviewOutcomes: WorkflowQualityBundle["reviewOutcomes"];
  workflowQualitySummary: WorkflowQualityBundle["workflowQualitySummary"];
  auditTrail: EndToEndAgenticTradeInDemoAuditEvent[];
};
