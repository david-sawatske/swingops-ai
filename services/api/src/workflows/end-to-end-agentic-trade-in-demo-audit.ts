import type {
  EndToEndAgenticTradeInDemoAuditEvent,
  EndToEndAgenticTradeInDemoResult,
} from "./end-to-end-agentic-trade-in-demo.types.js";

type AuditTrailInput = Pick<
  EndToEndAgenticTradeInDemoResult,
  | "rawInput"
  | "parsedItems"
  | "knowledgeMatchesByItem"
  | "inventoryMatchesByItem"
  | "valuationEvidenceByItem"
  | "priorReviewLearningEvidenceByItem"
  | "priorReviewLearningSuggestionsByItem"
  | "modelRoutingDecision"
  | "fieldRepairExecution"
  | "retryEvents"
  | "toolCallResults"
  | "reviewQueueItemsCreated"
  | "finalSummary"
>;

export function buildEndToEndAgenticTradeInDemoAuditTrail(
  input: AuditTrailInput,
): EndToEndAgenticTradeInDemoAuditEvent[] {
  return [
    {
      orderIndex: 1,
      label: "Raw messy intake received",
      status: "INFO",
      summary:
        "Captured freeform golf trade-in text for deterministic parsing.",
      details: {
        rawInput: input.rawInput,
      },
    },
    {
      orderIndex: 2,
      label: "Structured equipment records parsed",
      status: "SUCCEEDED",
      summary: `Parsed ${input.parsedItems.length} equipment records with confidence and missing-field signals.`,
      details: {
        parsedItems: input.parsedItems,
      },
    },
    {
      orderIndex: 3,
      label: "RAG knowledge retrieved",
      status: "SUCCEEDED",
      summary: `Retrieved ${input.finalSummary.knowledgeMatchCount} weighted knowledge matches across parsed items.`,
      details: {
        knowledgeMatchesByItem: input.knowledgeMatchesByItem,
      },
    },
    {
      orderIndex: 4,
      label: "Inventory product matched",
      status: "SUCCEEDED",
      summary: `${input.finalSummary.inventoryMatchCount}/${input.parsedItems.length} parsed records matched seeded internal products or SKU candidates.`,
      details: {
        inventoryMatchesByItem: input.inventoryMatchesByItem,
      },
    },
    {
      orderIndex: 5,
      label: "Demo valuation range estimated",
      status:
        input.finalSummary.valuationReviewRequiredCount > 0
          ? "NEEDS_REVIEW"
          : "SUCCEEDED",
      summary: `${input.finalSummary.valuationRangeCount} demo valuation range(s) estimated with condition and accessory adjustments.`,
      details: {
        valuationEvidenceByItem: input.valuationEvidenceByItem,
      },
    },
    {
      orderIndex: 6,
      label: "Model route selected",
      status: input.fieldRepairExecution.validationPassed
        ? "SUCCEEDED"
        : "NEEDS_REVIEW",
      summary: `${input.modelRoutingDecision.selectedProvider} / ${input.modelRoutingDecision.selectedModel} executed field repair with ${input.fieldRepairExecution.suggestions.length} validated suggestion(s).`,
      details: {
        routingDecision: input.modelRoutingDecision,
        fieldRepairExecution: input.fieldRepairExecution,
      },
    },
    {
      orderIndex: 7,
      label: "Targeted field retry evaluated",
      status: input.retryEvents.some((event) => event.status === "UNRESOLVED")
        ? "NEEDS_REVIEW"
        : "SUCCEEDED",
      summary:
        input.retryEvents[0]?.message ??
        "No targeted retry evidence was recorded.",
      details: {
        retryEvents: input.retryEvents,
      },
    },
    {
      orderIndex: 8,
      label: "Read-only tools executed",
      status: "SUCCEEDED",
      summary: `${input.finalSummary.successfulReadOnlyToolCallCount} safe read-only tool calls executed and logged.`,
      details: {
        toolCallResults: input.toolCallResults.filter(
          (result) => result.status === "SUCCEEDED",
        ),
      },
    },
    {
      orderIndex: 9,
      label: "Mutation tool blocked",
      status: "BLOCKED",
      summary: `${input.finalSummary.blockedMutationToolCallCount} mutation tool call was policy-blocked before execution.`,
      details: {
        toolCallResults: input.toolCallResults.filter(
          (result) => result.status === "BLOCKED",
        ),
      },
    },
    {
      orderIndex: 10,
      label: "Human review surfaced",
      status:
        input.reviewQueueItemsCreated.length > 0 ? "NEEDS_REVIEW" : "SUCCEEDED",
      summary:
        input.reviewQueueItemsCreated.length > 0
          ? `${input.reviewQueueItemsCreated.length} review queue item(s) created for low-confidence or incomplete parses.`
          : "No parsed records required human review.",
      details: {
        reviewQueueItemsCreated: input.reviewQueueItemsCreated,
      },
    },
    {
      orderIndex: 11,
      label: "Prior review evidence checked",
      status:
        input.finalSummary.priorReviewSuggestionCount > 0
          ? "SUCCEEDED"
          : "INFO",
      summary:
        input.finalSummary.priorReviewSuggestionCount > 0
          ? `${input.finalSummary.priorReviewSuggestionCount} prior review suggestion(s) surfaced from resolved corrections.`
          : "No prior review suggestions matched this run.",
      details: {
        priorReviewLearningEvidenceByItem:
          input.priorReviewLearningEvidenceByItem,
        priorReviewLearningSuggestionsByItem:
          input.priorReviewLearningSuggestionsByItem,
      },
    },
    {
      orderIndex: 12,
      label: "Final demo summary",
      status: "INFO",
      summary: input.finalSummary.productStory,
      details: input.finalSummary,
    },
  ];
}
