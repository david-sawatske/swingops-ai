import type { Prisma, ReviewQueueItem, ToolCallLog } from "@prisma/client";

import { routeModel } from "../ai/model-router.js";
import { searchKnowledgeBase, type KnowledgeSearchResult } from "../knowledge/knowledge-search.js";
import { prisma } from "../lib/prisma.js";
import {
  executeReadOnlyToolInvocation,
  type ReadOnlyToolInvocationResult
} from "../tools/read-only-tool-invocation.js";
import { createMockModelCallLogForWorkflowRun } from "./workflow-model-logging.js";
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
  modelRoutingDecision: ReturnType<typeof routeModel>;
  modelCallLog: Awaited<ReturnType<typeof createMockModelCallLogForWorkflowRun>>;
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

function getReviewReason(item: ParsedTradeInDemoItem): "LOW_CONFIDENCE" | "MISSING_REQUIRED_FIELDS" | "AMBIGUOUS_INPUT" {
  if (item.missingFields.length > 0) {
    return "MISSING_REQUIRED_FIELDS";
  }

  if (item.uncertaintyNotes.length > 0) {
    return "AMBIGUOUS_INPUT";
  }

  return "LOW_CONFIDENCE";
}

function summarizeReviewReason(item: ParsedTradeInDemoItem): string {
  const reasons = [
    item.confidence < 0.72 ? `confidence ${item.confidence}` : null,
    item.missingFields.length > 0
      ? `missing ${item.missingFields.join(", ")}`
      : null,
    item.uncertaintyNotes.length > 0
      ? `uncertainty: ${item.uncertaintyNotes.join(", ")}`
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
  modelRoutingDecision: ReturnType<typeof routeModel>;
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
      label: "Model route selected",
      status: "SUCCEEDED",
      summary: `${input.modelRoutingDecision.selectedProvider} / ${input.modelRoutingDecision.selectedModel} selected for intake parsing with cost, latency, quality, and health rationale.`,
      details: input.modelRoutingDecision
    },
    {
      orderIndex: 5,
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
      orderIndex: 6,
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
      orderIndex: 7,
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
      orderIndex: 8,
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
  const parsedItems = parseTradeInDemoText(rawInput);

  const intakeBatch = await prisma.intakeBatch.create({
    data: {
      name: "Agentic Trade-In Demo",
      description:
        "End-to-end demo intake batch created from messy golf trade-in text.",
      sourceType: "FREEFORM_NOTES",
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

  const modelRoutingDecision = routeModel({
    taskType: "INTAKE_PARSING",
    preferredGoal: "HIGH_QUALITY",
    requireJson: true,
    allowDisabledProvidersForSimulation: true
  });

  const modelCallLog = await createMockModelCallLogForWorkflowRun({
    workflowRunId: workflowRun.id,
    taskType: "INTAKE_PARSING",
    goal: "HIGH_QUALITY"
  });

  const reviewQueueItemsCreated: ReviewQueueItem[] = [];

  for (const [index, item] of parsedItems.entries()) {
    if (!needsReview(item)) {
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
          reviewReasonSummary: summarizeReviewReason(item),
          knowledgeMatches:
            knowledgeMatchesByItem.find((match) => match.parsedItemId === item.id)
              ?.search.results.slice(0, 2) ?? []
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
      toolName: "swingops.reviewQueueItems.list",
      reason:
        "Inspect open human-review work created by low-confidence parsing.",
      inputJson: {
        status: "OPEN"
      },
      expectedRiskLevel: "LOW" as const,
      expectedMutatesData: false,
      expectedRequiresHumanApproval: false
    },
    {
      orderIndex: 4,
      toolName: "swingops.reviewQueueItems.resolve",
      reason:
        "Demonstrate that the agent can see a mutation tool but cannot execute it without human approval.",
      inputJson: {
        id: reviewQueueItemsCreated[0]?.id ?? "blocked-demo-review-item",
        reviewerNotes:
          "Blocked by demo policy. Human approval is required before review queue mutation."
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
  const finalSummary = {
    parsedItemCount: parsedItems.length,
    knowledgeMatchCount,
    lowConfidenceItemCount: parsedItems.filter(needsReview).length,
    reviewQueueItemCount: reviewQueueItemsCreated.length,
    successfulReadOnlyToolCallCount,
    blockedMutationToolCallCount,
    selectedProvider: modelRoutingDecision.selectedProvider,
    selectedModel: modelRoutingDecision.selectedModel,
    productStory:
      "Messy golf trade-in intake became structured, grounded with weighted RAG matches, routed through provider/cost/quality logic, tool-executed through safe read-only MCP-compatible connectors, policy-guarded against mutation, logged, and reviewable."
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
    modelCallLog,
    toolCallingPlan,
    toolCallResults,
    reviewQueueItemsCreated
  });

  const resultWithoutAuditTrail = {
    rawInput,
    parsedItems,
    knowledgeMatchesByItem,
    modelRoutingDecision,
    modelCallLog,
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
