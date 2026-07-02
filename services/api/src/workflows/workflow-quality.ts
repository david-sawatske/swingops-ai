import type { ReviewQueueItem } from "@prisma/client";

import type { ParsedTradeInDemoItem } from "./trade-in-demo-parser.js";
import type { EndToEndAgenticTradeInDemoResult } from "./end-to-end-agentic-trade-in-demo.js";

import {
  buildAgentPlan,
  buildProviderFallbackTrace,
  buildReviewOutcomes,
  buildRetryEvents,
  buildToolSelectionRationales,
  buildValidationChecks,
  buildWorkflowQualitySummary
} from "./workflow-quality-builders.js";
import type { WorkflowQualityBundle } from "./workflow-quality-types.js";
export type {
  AgentPlanActionType,
  AgentPlanStepStatus,
  AgentPlanStep,
  ValidationCheckStatus,
  ValidationCheckSeverity,
  ValidationCheck,
  RetryEventStatus,
  RetryEvent,
  ProviderFallbackTraceAttempt,
  ProviderFallbackTrace,
  ToolSelectionRationale,
  ReviewOutcome,
  WorkflowQualityStatus,
  WorkflowQualitySummary,
  WorkflowQualityBundle
} from "./workflow-quality-types.js";

type ToolCallingPlan = EndToEndAgenticTradeInDemoResult["toolCallingPlan"];
type ToolCallResults = EndToEndAgenticTradeInDemoResult["toolCallResults"];
type KnowledgeMatchesByItem =
  EndToEndAgenticTradeInDemoResult["knowledgeMatchesByItem"];
type InventoryMatchesByItem =
  EndToEndAgenticTradeInDemoResult["inventoryMatchesByItem"];
type ValuationEvidenceByItem =
  EndToEndAgenticTradeInDemoResult["valuationEvidenceByItem"];
type ModelCallLog = EndToEndAgenticTradeInDemoResult["modelCallLog"];

export function buildWorkflowQualityBundle(input: {
  parsedItems: ParsedTradeInDemoItem[];
  knowledgeMatchesByItem: KnowledgeMatchesByItem;
  inventoryMatchesByItem: InventoryMatchesByItem;
  valuationEvidenceByItem: ValuationEvidenceByItem;
  modelCallLog: ModelCallLog;
  toolCallingPlan: ToolCallingPlan;
  toolCallResults: ToolCallResults;
  reviewQueueItemsCreated: ReviewQueueItem[];
}): WorkflowQualityBundle {
  const blockedMutationCount = input.toolCallResults.filter(
    (result) => result.status === "BLOCKED"
  ).length;
  const validationChecks = buildValidationChecks({
    parsedItems: input.parsedItems,
    knowledgeMatchesByItem: input.knowledgeMatchesByItem,
    inventoryMatchesByItem: input.inventoryMatchesByItem,
    valuationEvidenceByItem: input.valuationEvidenceByItem,
    blockedMutationCount
  });
  const retryEvents = buildRetryEvents(input.parsedItems);
  const providerFallbackTrace = buildProviderFallbackTrace(input.modelCallLog);
  const toolSelectionRationales = buildToolSelectionRationales(
    input.toolCallingPlan
  );
  const reviewOutcomes = buildReviewOutcomes({
    parsedItems: input.parsedItems,
    reviewQueueItemsCreated: input.reviewQueueItemsCreated,
    validationChecks
  });
  const agentPlan = buildAgentPlan({
    validationChecks,
    retryEvents,
    toolSelectionRationales,
    reviewOutcomes,
    providerFallbackTrace,
    blockedMutationCount
  });
  const workflowQualitySummary = buildWorkflowQualitySummary({
    parsedItems: input.parsedItems,
    validationChecks,
    retryEvents,
    reviewOutcomes,
    toolCallResults: input.toolCallResults,
    providerFallbackTrace,
    knowledgeMatchesByItem: input.knowledgeMatchesByItem,
    inventoryMatchesByItem: input.inventoryMatchesByItem,
    valuationEvidenceByItem: input.valuationEvidenceByItem
  });

  return {
    agentPlan,
    validationChecks,
    retryEvents,
    providerFallbackTrace,
    toolSelectionRationales,
    reviewOutcomes,
    workflowQualitySummary
  };
}
