import { LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE } from "../intake/legacy-intake-source-types.js";
import type { ModelCallLog, Prisma, ReviewQueueItem, ToolCallLog } from "@prisma/client";

import type { ModelRouteDecision } from "../ai/model-router.js";
import {
  lookupInventoryProduct,
  type InventoryProductLookupResult
} from "../internal-systems/inventory-service.js";
import {
  estimateTradeInValuation,
  type TradeInValuationResult
} from "../internal-systems/trade-in-valuation-service.js";
import { ensureDemoKnowledgeBaseReady } from "../knowledge/knowledge-ingestion.js";
import {
  searchKnowledgeBase,
  type KnowledgeSearchResult
} from "../knowledge/knowledge-search.js";
import { prisma } from "../lib/prisma.js";
import {
  buildPriorReviewLearningSuggestionsFromEvidence,
  findPriorReviewLearningEvidence,
  type PriorReviewLearningEvidence,
  type PriorReviewLearningSuggestion
} from "../review-learning/review-learning-evidence.js";
import {
  executeReadOnlyToolInvocation,
  type ReadOnlyToolInvocationResult
} from "../tools/read-only-tool-invocation.js";
import {
  createModelExecutionLogForWorkflowRun
} from "./workflow-model-logging.js";
import {
  MAIN_RUN_FIELD_REPAIR_AGENT_NAME,
  MAIN_RUN_FIELD_REPAIR_POLICY_KEY,
  MAIN_RUN_FIELD_REPAIR_TASK_TYPE,
  buildMainRunFieldRepairExecutionInput,
  validateMainRunFieldRepairModelOutput,
  type FieldRepairSuggestion
} from "./main-run-field-repair.js";
import {
  buildWorkflowQualityBundle,
  type WorkflowQualityBundle
} from "./workflow-quality.js";
import {
  parseTradeInDemoText,
  type ParsedTradeInDemoItem
} from "./trade-in-demo-parser.js";

export type EndToEndAgenticTradeInDemoAuditEvent = {
  orderIndex: number;
  label: string;
  status: "SUCCEEDED" | "NEEDS_REVIEW" | "BLOCKED" | "INFO";
  summary: string;
  details: unknown;
};

export type EndToEndAgenticTradeInDemoResult = {
  rawInput: string;
  parsedItems: ParsedTradeInDemoItem[];
  knowledgeMatchesByItem: {
    parsedItemId: string;
    query: string;
    search: KnowledgeSearchResult;
  }[];
  inventoryMatchesByItem: {
    parsedItemId: string;
    lookup: InventoryProductLookupResult;
  }[];
  valuationEvidenceByItem: {
    parsedItemId: string;
    estimate: TradeInValuationResult;
  }[];
  priorReviewLearningEvidenceByItem: {
    parsedItemId: string;
    evidence: PriorReviewLearningEvidence[];
  }[];
  priorReviewLearningSuggestionsByItem: {
    parsedItemId: string;
    suggestions: PriorReviewLearningSuggestion[];
  }[];
  modelRoutingDecision: ModelRouteDecision;
  modelCallLog: ModelCallLog;
  fieldRepairExecution: {
    modelCallLogId: string;
    suggestions: FieldRepairSuggestion[];
    jsonValid: boolean;
    validationPassed: boolean;
    validationErrors: string[];
  };
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
  toolCallResults: {
    toolName: string;
    status: "SUCCEEDED" | "FAILED" | "BLOCKED";
    policyDecision: string;
    policyReason: string;
    executionAttempted: boolean;
    toolCallLogId: string;
    outputPreview: unknown | null;
    errorMessage: string | null;
  }[];
  blockedToolCallResult: {
    toolName: string;
    status: "SUCCEEDED" | "FAILED" | "BLOCKED";
    policyDecision: string;
    policyReason: string;
    executionAttempted: boolean;
    toolCallLogId: string;
    outputPreview: unknown | null;
    errorMessage: string | null;
  } | null;
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
  agentPlan: WorkflowQualityBundle["agentPlan"];
  validationChecks: WorkflowQualityBundle["validationChecks"];
  retryEvents: WorkflowQualityBundle["retryEvents"];
  providerFallbackTrace: WorkflowQualityBundle["providerFallbackTrace"];
  toolSelectionRationales: WorkflowQualityBundle["toolSelectionRationales"];
  reviewOutcomes: WorkflowQualityBundle["reviewOutcomes"];
  workflowQualitySummary: WorkflowQualityBundle["workflowQualitySummary"];
  auditTrail: EndToEndAgenticTradeInDemoAuditEvent[];
};

export const DEFAULT_AGENTIC_TRADE_IN_DEMO_INPUT = [
  "TM stealth2 drv 10.5 Ventus stiff, no hc, sky mark on crown",
  "Titleist TSR maybe TS2 3w 15 deg Tensei s flex, face wear, hc included",
  "Cally Rogue ST Max driver 9 Project X HZRDUS x-stiff, paint wear, no wrench",
  "PING G425 irons 5-PW reg, worn grips, condition unclear"
].join("\n");

const NON_RECORD_DEMO_HEADER_PATTERNS = [
  /^store associate pasted trade-in notes:?$/i,
  /^store associate trade-in notes:?$/i,
  /^pasted trade-in notes:?$/i,
  /^trade-in notes:?$/i
];

function stripNonRecordDemoHeaderLines(rawInput: string): string {
  const recordLines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !NON_RECORD_DEMO_HEADER_PATTERNS.some((pattern) => pattern.test(line))
    );

  return recordLines.join("\n") || rawInput.trim();
}

type DemoToolResult = EndToEndAgenticTradeInDemoResult["toolCallResults"][number];

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function buildKnowledgeQuery(item: ParsedTradeInDemoItem): string {
  return [
    item.brand,
    item.productLine,
    item.category,
    item.loft,
    item.clubNumber,
    item.shaftBrand,
    item.shaftModel,
    item.shaftFlex,
    ...item.conditionNotes,
    ...item.accessoriesNotes,
    item.rawLine
  ]
    .filter(Boolean)
    .join(" ");
}

function needsReview(item: ParsedTradeInDemoItem): boolean {
  return item.confidence < 0.72 || item.missingFields.length > 0;
}

function shouldRunFieldRepair(item: ParsedTradeInDemoItem): boolean {
  return (
    item.confidence < 0.72 ||
    item.missingFields.length > 0 ||
    item.uncertaintyNotes.length > 0
  );
}

function getModelRoutingDecisionFromLog(
  modelCallLog: ModelCallLog
): ModelRouteDecision {
  const responseJson = modelCallLog.responseJson as
    | {
        routingDecision?: ModelRouteDecision;
      }
    | null
    | undefined;

  if (!responseJson?.routingDecision) {
    throw new Error("Model call log is missing routing decision metadata.");
  }

  return responseJson.routingDecision;
}

function getProviderExecutionOutputJson(
  modelCallLog: ModelCallLog
): Record<string, unknown> | null {
  const responseJson = modelCallLog.responseJson as
    | {
        providerExecution?: {
          outputJson?: Record<string, unknown> | null;
        };
      }
    | null
    | undefined;

  return responseJson?.providerExecution?.outputJson ?? null;
}

function buildInventoryLookupInput(item: ParsedTradeInDemoItem): Record<string, string> {
  return {
    ...(item.brand ? { brand: item.brand } : {}),
    ...(item.productLine ? { productLine: item.productLine } : {}),
    ...(item.category ? { category: item.category } : {}),
    ...(item.shaftBrand ? { shaftBrand: item.shaftBrand } : {}),
    ...(item.shaftModel ? { shaftModel: item.shaftModel } : {}),
    rawText: item.rawLine
  };
}

function buildValuationInput(input: {
  item: ParsedTradeInDemoItem;
  inventoryMatch: InventoryProductLookupResult;
}) {
  return {
    ...buildInventoryLookupInput(input.item),
    inventoryMatch: input.inventoryMatch,
    conditionNotes: input.item.conditionNotes,
    accessoriesNotes: input.item.accessoriesNotes
  };
}

function valuationNeedsReview(estimate: TradeInValuationResult): boolean {
  return estimate.reviewRequired || estimate.confidence === "LOW";
}

function getReviewReason(item: ParsedTradeInDemoItem): "LOW_CONFIDENCE" | "MISSING_REQUIRED_FIELDS" | "AMBIGUOUS_INPUT" {
  if (item.missingFields.length > 0) {
    return "MISSING_REQUIRED_FIELDS";
  }

  if (item.uncertaintyNotes.length > 0) {
    return "AMBIGUOUS_INPUT";
  }

  return "LOW_CONFIDENCE";
}

function summarizeReviewReason(input: {
  item: ParsedTradeInDemoItem;
  valuationEstimate?: TradeInValuationResult;
}): string {
  const reasons = [
    input.item.confidence < 0.72 ? `confidence ${input.item.confidence}` : null,
    input.item.missingFields.length > 0
      ? `missing ${input.item.missingFields.join(", ")}`
      : null,
    input.item.uncertaintyNotes.length > 0
      ? `uncertainty: ${input.item.uncertaintyNotes.join(", ")}`
      : null,
    input.valuationEstimate?.reviewRequired
      ? `valuation review: ${input.valuationEstimate.reviewReasons.join(", ")}`
      : null
  ].filter(Boolean);

  return reasons.join("; ");
}

function toToolResult(result: ReadOnlyToolInvocationResult): DemoToolResult {
  return {
    toolName: result.invocation.toolName,
    status: result.invocation.status,
    policyDecision: result.policyEvaluation.decision,
    policyReason: result.policyEvaluation.reason,
    executionAttempted: result.invocation.executionAttempted,
    toolCallLogId: result.invocation.toolCallLogId,
    outputPreview: result.connectorResult?.data ?? null,
    errorMessage: result.toolCallLog.errorMessage
  };
}

function buildAuditTrail(input: {
  rawInput: string;
  parsedItems: ParsedTradeInDemoItem[];
  knowledgeMatchesByItem: EndToEndAgenticTradeInDemoResult["knowledgeMatchesByItem"];
  inventoryMatchesByItem: EndToEndAgenticTradeInDemoResult["inventoryMatchesByItem"];
  valuationEvidenceByItem: EndToEndAgenticTradeInDemoResult["valuationEvidenceByItem"];
  priorReviewLearningEvidenceByItem: EndToEndAgenticTradeInDemoResult["priorReviewLearningEvidenceByItem"];
  priorReviewLearningSuggestionsByItem: EndToEndAgenticTradeInDemoResult["priorReviewLearningSuggestionsByItem"];
  modelRoutingDecision: ModelRouteDecision;
  fieldRepairExecution: EndToEndAgenticTradeInDemoResult["fieldRepairExecution"];
  toolCallResults: DemoToolResult[];
  reviewQueueItemsCreated: ReviewQueueItem[];
  finalSummary: EndToEndAgenticTradeInDemoResult["finalSummary"];
}): EndToEndAgenticTradeInDemoAuditEvent[] {
  return [
    {
      orderIndex: 1,
      label: "Raw messy intake received",
      status: "INFO",
      summary: "Captured freeform golf trade-in text for deterministic parsing.",
      details: {
        rawInput: input.rawInput
      }
    },
    {
      orderIndex: 2,
      label: "Structured equipment records parsed",
      status: "SUCCEEDED",
      summary: `Parsed ${input.parsedItems.length} equipment records with confidence and missing-field signals.`,
      details: {
        parsedItems: input.parsedItems
      }
    },
    {
      orderIndex: 3,
      label: "RAG knowledge retrieved",
      status: "SUCCEEDED",
      summary: `Retrieved ${input.finalSummary.knowledgeMatchCount} weighted knowledge matches across parsed items.`,
      details: {
        knowledgeMatchesByItem: input.knowledgeMatchesByItem
      }
    },
    {
      orderIndex: 4,
      label: "Inventory product matched",
      status: "SUCCEEDED",
      summary: `${input.finalSummary.inventoryMatchCount}/${input.parsedItems.length} parsed records matched seeded internal products or SKU candidates.`,
      details: {
        inventoryMatchesByItem: input.inventoryMatchesByItem
      }
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
        valuationEvidenceByItem: input.valuationEvidenceByItem
      }
    },
    {
      orderIndex: 6,
      label: "Model route selected",
      status: input.fieldRepairExecution.validationPassed ? "SUCCEEDED" : "NEEDS_REVIEW",
      summary: `${input.modelRoutingDecision.selectedProvider} / ${input.modelRoutingDecision.selectedModel} executed field repair with ${input.fieldRepairExecution.suggestions.length} validated suggestion(s).`,
      details: {
        routingDecision: input.modelRoutingDecision,
        fieldRepairExecution: input.fieldRepairExecution
      }
    },
    {
      orderIndex: 7,
      label: "Read-only tools executed",
      status: "SUCCEEDED",
      summary: `${input.finalSummary.successfulReadOnlyToolCallCount} safe read-only tool calls executed and logged.`,
      details: {
        toolCallResults: input.toolCallResults.filter(
          (result) => result.status === "SUCCEEDED"
        )
      }
    },
    {
      orderIndex: 8,
      label: "Mutation tool blocked",
      status: "BLOCKED",
      summary: `${input.finalSummary.blockedMutationToolCallCount} mutation tool call was policy-blocked before execution.`,
      details: {
        toolCallResults: input.toolCallResults.filter(
          (result) => result.status === "BLOCKED"
        )
      }
    },
    {
      orderIndex: 9,
      label: "Human review surfaced",
      status: input.reviewQueueItemsCreated.length > 0 ? "NEEDS_REVIEW" : "SUCCEEDED",
      summary:
        input.reviewQueueItemsCreated.length > 0
          ? `${input.reviewQueueItemsCreated.length} review queue item(s) created for low-confidence or incomplete parses.`
          : "No parsed records required human review.",
      details: {
        reviewQueueItemsCreated: input.reviewQueueItemsCreated
      }
    },
    {
      orderIndex: 10,
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
        priorReviewLearningEvidenceByItem: input.priorReviewLearningEvidenceByItem,
        priorReviewLearningSuggestionsByItem: input.priorReviewLearningSuggestionsByItem
      }
    },
    {
      orderIndex: 11,
      label: "Final demo summary",
      status: "INFO",
      summary: input.finalSummary.productStory,
      details: input.finalSummary
    }
  ];
}

export async function executeEndToEndAgenticTradeInDemo(input: {
  rawInput: string;
}): Promise<EndToEndAgenticTradeInDemoResult> {
  const rawInput = input.rawInput.trim() || DEFAULT_AGENTIC_TRADE_IN_DEMO_INPUT;
  const parseReadyInput = stripNonRecordDemoHeaderLines(rawInput);

  await ensureDemoKnowledgeBaseReady();

  const parsedItems = parseTradeInDemoText(parseReadyInput);

  const intakeBatch = await prisma.intakeBatch.create({
    data: {
      name: "Agentic Trade-In Demo",
      description:
        "End-to-end demo intake batch created from messy golf trade-in text.",
      sourceType: LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE,
      status: "PROCESSING",
      itemCount: parsedItems.length,
      items: {
        create: parsedItems.map((item, index) => ({
          rawText: item.rawLine,
          sourceRowNumber: index + 1,
          status: needsReview(item) ? "NEEDS_REVIEW" : "STRUCTURED"
        }))
      }
    },
    include: {
      items: {
        orderBy: {
          sourceRowNumber: "asc"
        }
      }
    }
  });

  const workflowRun = await prisma.workflowRun.create({
    data: {
      intakeBatchId: intakeBatch.id,
      workflowName: "end-to-end-agentic-trade-in-demo",
      status: "RUNNING",
      startedAt: new Date()
    }
  });

  const priorReviewLearningEvidenceByItem = [];

  for (const item of parsedItems) {
    const evidence = await findPriorReviewLearningEvidence({
      rawText: item.rawLine,
      sourceType: "FREE_TEXT",
      excludeWorkflowRunId: workflowRun.id,
      parsedFields: {
        brand: item.brand,
        productLine: item.productLine,
        category: item.category,
        shaftFlex: item.shaftFlex
      }
    });

    priorReviewLearningEvidenceByItem.push({
      parsedItemId: item.id,
      evidence
    });
  }

  const priorReviewLearningSuggestionsByItem =
    priorReviewLearningEvidenceByItem.map((item) => ({
      parsedItemId: item.parsedItemId,
      suggestions: buildPriorReviewLearningSuggestionsFromEvidence(item.evidence)
    }));

  const knowledgeMatchesByItem = [];

  for (const item of parsedItems) {
    const query = buildKnowledgeQuery(item);
    const search = await searchKnowledgeBase({
      query,
      ...(item.brand ? { brand: item.brand } : {}),
      ...(item.category ? { category: item.category } : {}),
      maxResults: 3
    });

    knowledgeMatchesByItem.push({
      parsedItemId: item.id,
      query,
      search
    });
  }

  const inventoryMatchesByItem = parsedItems.map((item) => ({
    parsedItemId: item.id,
    lookup: lookupInventoryProduct(buildInventoryLookupInput(item))
  }));

  const valuationEvidenceByItem = parsedItems.map((item) => {
    const inventoryMatch = inventoryMatchesByItem.find(
      (match) => match.parsedItemId === item.id
    );

    return {
      parsedItemId: item.id,
      estimate: estimateTradeInValuation(
        buildValuationInput({
          item,
          inventoryMatch: inventoryMatch!.lookup
        })
      )
    };
  });

  const fieldRepairInputJson = buildMainRunFieldRepairExecutionInput({
    workflowRunId: workflowRun.id,
    records: parsedItems.filter(shouldRunFieldRepair).map((item) => ({
      recordId: item.id,
      sourceText: item.rawLine,
      missingFields: item.missingFields,
      confidence: item.confidence,
      currentFields: {
        brand: item.brand,
        productLine: item.productLine,
        category: item.category,
        shaftFlex: item.shaftFlex,
        conditionGrade: item.conditionGrade,
        tradeInValue: item.tradeInValue
      },
      parserEvidence: item.parserEvidence ?? null
    }))
  });

  const modelCallLog = await createModelExecutionLogForWorkflowRun({
    workflowRunId: workflowRun.id,
    taskType: MAIN_RUN_FIELD_REPAIR_TASK_TYPE,
    goal: "HIGH_QUALITY",
    policyKey: MAIN_RUN_FIELD_REPAIR_POLICY_KEY,
    agentName: MAIN_RUN_FIELD_REPAIR_AGENT_NAME,
    workflowName: "main-run",
    workflowStep: "field-repair",
    requireJson: true,
    allowDisabledProvidersForSimulation: false,
    inputJson: fieldRepairInputJson,
    validateOutput(outputJson) {
      const validation = validateMainRunFieldRepairModelOutput(outputJson);

      return {
        jsonValid: validation.jsonValid,
        validationPassed: validation.validationPassed,
        validationErrors: validation.validationErrors
      };
    }
  });
  const modelRoutingDecision = getModelRoutingDecisionFromLog(modelCallLog);
  const fieldRepairValidation = validateMainRunFieldRepairModelOutput(
    getProviderExecutionOutputJson(modelCallLog)
  );
  const fieldRepairExecution = {
    modelCallLogId: modelCallLog.id,
    suggestions: fieldRepairValidation.output?.suggestions ?? [],
    jsonValid: fieldRepairValidation.jsonValid,
    validationPassed: fieldRepairValidation.validationPassed,
    validationErrors: fieldRepairValidation.validationErrors
  };

  const reviewQueueItemsCreated: ReviewQueueItem[] = [];

  for (const [index, item] of parsedItems.entries()) {
    const valuationEvidence = valuationEvidenceByItem.find(
      (evidence) => evidence.parsedItemId === item.id
    );
    const inventoryEvidence = inventoryMatchesByItem.find(
      (evidence) => evidence.parsedItemId === item.id
    );

    if (!needsReview(item) && !valuationNeedsReview(valuationEvidence!.estimate)) {
      continue;
    }

    const intakeItem = intakeBatch.items[index];

    const reviewQueueItem = await prisma.reviewQueueItem.create({
      data: {
        workflowRunId: workflowRun.id,
        intakeItemId: intakeItem?.id ?? null,
        reason: getReviewReason(item),
        status: "OPEN",
        originalText: item.rawLine,
        proposedGolfClubJson: toInputJson({
          ...item,
          reviewReasonSummary: summarizeReviewReason({
            item,
            valuationEstimate: valuationEvidence!.estimate
          }),
          knowledgeMatches:
            knowledgeMatchesByItem.find((match) => match.parsedItemId === item.id)
              ?.search.results.slice(0, 2) ?? [],
          inventoryMatch: inventoryEvidence?.lookup ?? null,
          demoValuationRange: valuationEvidence?.estimate ?? null
        })
      }
    });

    reviewQueueItemsCreated.push(reviewQueueItem);
  }

  const plannedCalls = [
    {
      orderIndex: 1,
      toolName: "swingops.workflowRuns.get",
      reason:
        "Inspect the persisted workflow run context before the agent explains the audit trail.",
      inputJson: {
        id: workflowRun.id
      },
      expectedRiskLevel: "LOW" as const,
      expectedMutatesData: false,
      expectedRequiresHumanApproval: false
    },
    {
      orderIndex: 2,
      toolName: "swingops.knowledgeBase.search",
      reason:
        "Run a read-only grounded search using the first parsed trade-in record.",
      inputJson: {
        query: knowledgeMatchesByItem[0]?.query ?? rawInput,
        maxResults: 5
      },
      expectedRiskLevel: "LOW" as const,
      expectedMutatesData: false,
      expectedRequiresHumanApproval: false
    },
    {
      orderIndex: 3,
      toolName: "swingops.inventory.lookupProduct",
      reason:
        "Use a read-only internal inventory lookup to match the first parsed record to a product and SKU.",
      inputJson: buildInventoryLookupInput(parsedItems[0]!),
      expectedRiskLevel: "LOW" as const,
      expectedMutatesData: false,
      expectedRequiresHumanApproval: false
    },
    {
      orderIndex: 4,
      toolName: "swingops.tradeInValuation.estimate",
      reason:
        "Use a read-only valuation lookup to estimate a seeded demo trade-in range for the first parsed record.",
      inputJson: {
        ...buildInventoryLookupInput(parsedItems[0]!),
        conditionNotes: parsedItems[0]!.conditionNotes.join("|"),
        accessoriesNotes: parsedItems[0]!.accessoriesNotes.join("|")
      },
      expectedRiskLevel: "LOW" as const,
      expectedMutatesData: false,
      expectedRequiresHumanApproval: false
    },
    {
      orderIndex: 5,
      toolName: "swingops.reviewQueueItems.list",
      reason:
        "Inspect open human-review work created by low-confidence parsing or valuation uncertainty.",
      inputJson: {
        status: "OPEN"
      },
      expectedRiskLevel: "LOW" as const,
      expectedMutatesData: false,
      expectedRequiresHumanApproval: false
    },
    {
      orderIndex: 6,
      toolName: "swingops.inventory.createSku",
      reason:
        "Demonstrate that the agent can see a mutation-style inventory tool but cannot create SKUs without approval.",
      inputJson: {
        productId:
          inventoryMatchesByItem[0]?.lookup.productId ??
          "blocked-demo-product"
      },
      expectedRiskLevel: "HIGH" as const,
      expectedMutatesData: true,
      expectedRequiresHumanApproval: true
    }
  ];

  const toolCallResults: DemoToolResult[] = [];
  const toolCallLogs: ToolCallLog[] = [];

  for (const plannedCall of plannedCalls) {
    const invocationResult = await executeReadOnlyToolInvocation({
      toolName: plannedCall.toolName,
      inputJson: plannedCall.inputJson,
      requestedBy: "agent.end-to-end-trade-in-demo",
      workflowRunId: workflowRun.id,
      executionMode: "AGENT_AUTONOMOUS",
      humanApprovalGranted: false
    });

    toolCallResults.push(toToolResult(invocationResult));
    toolCallLogs.push(invocationResult.toolCallLog);
  }

  const workflowStatus =
    reviewQueueItemsCreated.length > 0 ? "NEEDS_REVIEW" : "COMPLETED";

  await prisma.workflowRun.update({
    where: {
      id: workflowRun.id
    },
    data: {
      status: workflowStatus,
      completedAt: workflowStatus === "COMPLETED" ? new Date() : null
    }
  });

  await prisma.intakeBatch.update({
    where: {
      id: intakeBatch.id
    },
    data: {
      status: workflowStatus === "COMPLETED" ? "COMPLETED" : "NEEDS_REVIEW"
    }
  });

  const successfulReadOnlyToolCallCount = toolCallResults.filter(
    (result) => result.status === "SUCCEEDED"
  ).length;
  const blockedMutationToolCallCount = toolCallResults.filter(
    (result) => result.status === "BLOCKED"
  ).length;
  const knowledgeMatchCount = knowledgeMatchesByItem.reduce(
    (count, item) => count + item.search.results.length,
    0
  );
  const inventoryMatchCount = inventoryMatchesByItem.filter(
    (match) => match.lookup.productId !== null
  ).length;
  const valuationRangeCount = valuationEvidenceByItem.filter(
    (evidence) => evidence.estimate.highValue > 0
  ).length;
  const valuationReviewRequiredCount = valuationEvidenceByItem.filter(
    (evidence) => evidence.estimate.reviewRequired
  ).length;
  const priorReviewEvidenceCount = priorReviewLearningEvidenceByItem.reduce(
    (count, item) => count + item.evidence.length,
    0
  );
  const priorReviewSuggestionCount = priorReviewLearningSuggestionsByItem.reduce(
    (count, item) => count + item.suggestions.length,
    0
  );
  const finalSummary = {
    parsedItemCount: parsedItems.length,
    knowledgeMatchCount,
    lowConfidenceItemCount: parsedItems.filter(needsReview).length,
    reviewQueueItemCount: reviewQueueItemsCreated.length,
    successfulReadOnlyToolCallCount,
    blockedMutationToolCallCount,
    inventoryMatchCount,
    valuationRangeCount,
    valuationReviewRequiredCount,
    priorReviewEvidenceCount,
    priorReviewSuggestionCount,
    selectedProvider: modelRoutingDecision.selectedProvider,
    selectedModel: modelRoutingDecision.selectedModel,
    productStory:
      "Messy golf trade-in intake became structured, grounded with weighted RAG matches, matched to seeded internal inventory products, assigned demo valuation ranges, routed through provider/cost/quality logic, tool-executed through safe read-only MCP-compatible connectors, policy-guarded against mutation, logged, and reviewable."
  };

  const toolCallingPlan = {
    planId: `agentic_demo_${workflowRun.id}`,
    plannedCalls
  };
  const blockedToolCallResult =
    toolCallResults.find((result) => result.status === "BLOCKED") ?? null;

  const workflowQualityBundle = buildWorkflowQualityBundle({
    parsedItems,
    knowledgeMatchesByItem,
    inventoryMatchesByItem,
    valuationEvidenceByItem,
    modelCallLog,
    toolCallingPlan,
    toolCallResults,
    reviewQueueItemsCreated
  });

  const resultWithoutAuditTrail = {
    rawInput,
    parsedItems,
    knowledgeMatchesByItem,
    inventoryMatchesByItem,
    valuationEvidenceByItem,
    priorReviewLearningEvidenceByItem,
    priorReviewLearningSuggestionsByItem,
    modelRoutingDecision,
    modelCallLog,
    fieldRepairExecution,
    toolCallingPlan,
    toolCallResults,
    blockedToolCallResult,
    reviewQueueItemsCreated,
    persisted: {
      intakeBatchId: intakeBatch.id,
      intakeItemIds: intakeBatch.items.map((item) => item.id),
      workflowRunId: workflowRun.id,
      modelCallLogId: modelCallLog.id,
      toolCallLogIds: toolCallLogs.map((log) => log.id),
      reviewQueueItemIds: reviewQueueItemsCreated.map((item) => item.id)
    },
    finalSummary,
    ...workflowQualityBundle
  };

  return {
    ...resultWithoutAuditTrail,
    auditTrail: buildAuditTrail(resultWithoutAuditTrail)
  };
}
