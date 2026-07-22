import type { WorkflowStep } from "@prisma/client";

import { buildEndToEndAgenticTradeInDemoAuditTrail } from "./end-to-end-agentic-trade-in-demo-audit.js";
import type { EndToEndAgenticTradeInDemoResult } from "./end-to-end-agentic-trade-in-demo.types.js";
import type { TradeInDemoEvidenceBundle } from "./trade-in-demo-evidence.js";
import { tradeInDemoItemNeedsReview } from "./trade-in-demo-review-queue.js";
import { buildTradeInWorkflowOrchestrationTrace } from "./workflow-orchestration-trace.js";
import { buildWorkflowQualityBundle } from "./workflow-quality.js";

export type TradeInDemoResultAssemblyInput = {
  rawInput: string;
  parsedItems: EndToEndAgenticTradeInDemoResult["parsedItems"];
  evidence: TradeInDemoEvidenceBundle;
  modelAssistanceScope: EndToEndAgenticTradeInDemoResult["modelAssistanceScope"];
  modelRoutingDecision: EndToEndAgenticTradeInDemoResult["modelRoutingDecision"];
  modelCallLog: EndToEndAgenticTradeInDemoResult["modelCallLog"];
  fieldRepairExecution: EndToEndAgenticTradeInDemoResult["fieldRepairExecution"];
  workflowSteps: WorkflowStep[];
  plannedCalls: EndToEndAgenticTradeInDemoResult["toolCallingPlan"]["plannedCalls"];
  toolCallResults: EndToEndAgenticTradeInDemoResult["toolCallResults"];
  reviewQueueItemsCreated: EndToEndAgenticTradeInDemoResult["reviewQueueItemsCreated"];
  retryEvents: EndToEndAgenticTradeInDemoResult["retryEvents"];
  providerFallbackSimulationRequested: boolean;
  persistedIds: {
    intakeBatchId: string;
    intakeItemIds: string[];
    workflowRunId: string;
    toolCallLogIds: string[];
  };
};

function buildTradeInDemoFinalSummary(
  input: TradeInDemoResultAssemblyInput,
): EndToEndAgenticTradeInDemoResult["finalSummary"] {
  const successfulReadOnlyToolCallCount = input.toolCallResults.filter(
    (result) => result.status === "SUCCEEDED",
  ).length;
  const blockedMutationToolCallCount = input.toolCallResults.filter(
    (result) => result.status === "BLOCKED",
  ).length;
  const knowledgeMatchCount = input.evidence.knowledgeMatchesByItem.reduce(
    (count, item) => count + item.search.results.length,
    0,
  );
  const inventoryMatchCount = input.evidence.inventoryMatchesByItem.filter(
    (match) => match.lookup.productId !== null,
  ).length;
  const valuationRangeCount = input.evidence.valuationEvidenceByItem.filter(
    (evidence) => evidence.estimate.highValue > 0,
  ).length;
  const valuationReviewRequiredCount =
    input.evidence.valuationEvidenceByItem.filter(
      (evidence) => evidence.estimate.reviewRequired,
    ).length;
  const priorReviewEvidenceCount =
    input.evidence.priorReviewLearningEvidenceByItem.reduce(
      (count, item) => count + item.evidence.length,
      0,
    );
  const priorReviewSuggestionCount =
    input.evidence.priorReviewLearningSuggestionsByItem.reduce(
      (count, item) => count + item.suggestions.length,
      0,
    );

  return {
    parsedItemCount: input.parsedItems.length,
    knowledgeMatchCount,
    lowConfidenceItemCount: input.parsedItems.filter(tradeInDemoItemNeedsReview)
      .length,
    reviewQueueItemCount: input.reviewQueueItemsCreated.length,
    successfulReadOnlyToolCallCount,
    blockedMutationToolCallCount,
    inventoryMatchCount,
    valuationRangeCount,
    valuationReviewRequiredCount,
    priorReviewEvidenceCount,
    priorReviewSuggestionCount,
    selectedProvider: input.modelRoutingDecision.selectedProvider,
    selectedModel: input.modelRoutingDecision.selectedModel,
    productStory:
      "Messy golf trade-in intake became structured, grounded with weighted RAG matches, matched to seeded internal inventory products, assigned demo valuation ranges, routed through provider/cost/quality logic, tool-executed through safe read-only MCP-compatible connectors, policy-guarded against mutation, logged, and reviewable.",
  };
}

export function buildTradeInDemoResult(
  input: TradeInDemoResultAssemblyInput,
): EndToEndAgenticTradeInDemoResult {
  const {
    knowledgeMatchesByItem,
    inventoryMatchesByItem,
    valuationEvidenceByItem,
    priorReviewLearningEvidenceByItem,
    priorReviewLearningSuggestionsByItem,
  } = input.evidence;
  const finalSummary = buildTradeInDemoFinalSummary(input);
  const toolCallingPlan: EndToEndAgenticTradeInDemoResult["toolCallingPlan"] = {
    planId: `trade_in_workflow_${input.persistedIds.workflowRunId}`,
    plannedCalls: input.plannedCalls,
  };
  const blockedToolCallResult =
    input.toolCallResults.find((result) => result.status === "BLOCKED") ?? null;
  const orchestrationTrace = buildTradeInWorkflowOrchestrationTrace(
    input.workflowSteps,
  );
  const workflowQualityBundle = buildWorkflowQualityBundle({
    parsedItems: input.parsedItems,
    knowledgeMatchesByItem,
    inventoryMatchesByItem,
    valuationEvidenceByItem,
    modelCallLog: input.modelCallLog,
    providerFallbackSimulationRequested:
      input.providerFallbackSimulationRequested,
    retryEvents: input.retryEvents,
    toolCallingPlan,
    toolCallResults: input.toolCallResults,
    reviewQueueItemsCreated: input.reviewQueueItemsCreated,
  });
  const resultWithoutAuditTrail: Omit<
    EndToEndAgenticTradeInDemoResult,
    "auditTrail"
  > = {
    rawInput: input.rawInput,
    parsedItems: input.parsedItems,
    knowledgeMatchesByItem,
    inventoryMatchesByItem,
    valuationEvidenceByItem,
    priorReviewLearningEvidenceByItem,
    priorReviewLearningSuggestionsByItem,
    modelAssistanceScope: input.modelAssistanceScope,
    modelRoutingDecision: input.modelRoutingDecision,
    modelCallLog: input.modelCallLog,
    fieldRepairExecution: input.fieldRepairExecution,
    orchestrationTrace,
    toolCallingPlan,
    toolCallResults: input.toolCallResults,
    blockedToolCallResult,
    reviewQueueItemsCreated: input.reviewQueueItemsCreated,
    persisted: {
      intakeBatchId: input.persistedIds.intakeBatchId,
      intakeItemIds: input.persistedIds.intakeItemIds,
      workflowRunId: input.persistedIds.workflowRunId,
      modelCallLogId: input.modelCallLog.id,
      toolCallLogIds: input.persistedIds.toolCallLogIds,
      reviewQueueItemIds: input.reviewQueueItemsCreated.map((item) => item.id),
    },
    finalSummary,
    ...workflowQualityBundle,
  };

  return {
    ...resultWithoutAuditTrail,
    auditTrail: buildEndToEndAgenticTradeInDemoAuditTrail(
      resultWithoutAuditTrail,
    ),
  };
}
