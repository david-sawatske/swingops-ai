import type { ToolCallLog } from "@prisma/client";

import {
  executeReadOnlyToolInvocation,
  type ReadOnlyToolInvocationResult,
} from "../tools/read-only-tool-invocation.js";
import type {
  AgenticTradeInToolCallingPlan,
  AgenticTradeInToolCallResult,
} from "./end-to-end-agentic-trade-in-demo.types.js";
import type { ParsedTradeInDemoItem } from "./trade-in-demo-parser.js";
import {
  buildTradeInInventoryLookupInput,
  type TradeInDemoEvidenceBundle,
} from "./trade-in-demo-evidence.js";

export type TradeInDemoToolExecutionResult = {
  plannedCalls: AgenticTradeInToolCallingPlan["plannedCalls"];
  toolCallResults: AgenticTradeInToolCallResult[];
  toolCallLogs: ToolCallLog[];
};

function toToolResult(
  result: ReadOnlyToolInvocationResult,
): AgenticTradeInToolCallResult {
  return {
    toolName: result.invocation.toolName,
    status: result.invocation.status,
    policyDecision: result.policyEvaluation.decision,
    policyReason: result.policyEvaluation.reason,
    executionAttempted: result.invocation.executionAttempted,
    toolCallLogId: result.invocation.toolCallLogId,
    outputPreview: result.connectorResult?.data ?? null,
    errorMessage: result.toolCallLog.errorMessage,
  };
}

function buildTradeInDemoToolPlan(input: {
  workflowRunId: string;
  rawInput: string;
  parsedItems: ParsedTradeInDemoItem[];
  evidence: TradeInDemoEvidenceBundle;
  usingDefaultProductReferenceProvider: boolean;
}): AgenticTradeInToolCallingPlan["plannedCalls"] {
  const firstParsedItem = input.parsedItems[0]!;
  const canExecuteDemoInventoryTools =
    input.usingDefaultProductReferenceProvider &&
    firstParsedItem.productResolution.status === "MATCHED";

  return [
    {
      orderIndex: 1,
      toolName: "swingops.workflowRuns.get",
      reason:
        "Inspect the persisted workflow run context before the agent explains the audit trail.",
      inputJson: {
        id: input.workflowRunId,
      },
      expectedRiskLevel: "LOW",
      expectedMutatesData: false,
      expectedRequiresHumanApproval: false,
    },
    {
      orderIndex: 2,
      toolName: "swingops.knowledgeBase.search",
      reason:
        "Run a read-only grounded search using the first parsed trade-in record.",
      inputJson: {
        query:
          input.evidence.knowledgeMatchesByItem[0]?.query ?? input.rawInput,
        maxResults: 5,
      },
      expectedRiskLevel: "LOW",
      expectedMutatesData: false,
      expectedRequiresHumanApproval: false,
    },
    ...(canExecuteDemoInventoryTools
      ? [
          {
            orderIndex: 3,
            toolName: "swingops.inventory.lookupProduct",
            reason:
              "Use a read-only internal inventory lookup to corroborate the default reference-provider match for the first parsed record.",
            inputJson: buildTradeInInventoryLookupInput(firstParsedItem),
            expectedRiskLevel: "LOW" as const,
            expectedMutatesData: false,
            expectedRequiresHumanApproval: false,
          },
          {
            orderIndex: 4,
            toolName: "swingops.tradeInValuation.estimate",
            reason:
              "Use a read-only valuation lookup after the default reference provider authoritatively identified the first parsed record.",
            inputJson: {
              ...buildTradeInInventoryLookupInput(firstParsedItem),
              conditionNotes: firstParsedItem.conditionNotes.join("|"),
              accessoriesNotes: firstParsedItem.accessoriesNotes.join("|"),
            },
            expectedRiskLevel: "LOW" as const,
            expectedMutatesData: false,
            expectedRequiresHumanApproval: false,
          },
        ]
      : []),
    {
      orderIndex: 5,
      toolName: "swingops.reviewQueueItems.list",
      reason:
        "Inspect open human-review work created by low-confidence parsing or valuation uncertainty.",
      inputJson: {
        status: "OPEN",
      },
      expectedRiskLevel: "LOW",
      expectedMutatesData: false,
      expectedRequiresHumanApproval: false,
    },
    {
      orderIndex: 6,
      toolName: "swingops.inventory.createSku",
      reason:
        "Demonstrate that the agent can see a mutation-style inventory tool but cannot create SKUs without approval.",
      inputJson: {
        productId:
          input.evidence.inventoryMatchesByItem[0]?.lookup.productId ??
          "blocked-demo-product",
      },
      expectedRiskLevel: "HIGH",
      expectedMutatesData: true,
      expectedRequiresHumanApproval: true,
    },
  ];
}

export async function executeTradeInDemoTools(input: {
  workflowRunId: string;
  workflowStepId: string;
  rawInput: string;
  parsedItems: ParsedTradeInDemoItem[];
  evidence: TradeInDemoEvidenceBundle;
  usingDefaultProductReferenceProvider: boolean;
}): Promise<TradeInDemoToolExecutionResult> {
  const plannedCalls = buildTradeInDemoToolPlan(input);
  const toolCallResults: AgenticTradeInToolCallResult[] = [];
  const toolCallLogs: ToolCallLog[] = [];

  for (const plannedCall of plannedCalls) {
    const invocationResult = await executeReadOnlyToolInvocation({
      toolName: plannedCall.toolName,
      inputJson: plannedCall.inputJson,
      requestedBy: "agent.end-to-end-trade-in-demo",
      workflowRunId: input.workflowRunId,
      workflowStepId: input.workflowStepId,
      executionMode: "AGENT_AUTONOMOUS",
      humanApprovalGranted: false,
    });

    toolCallResults.push(toToolResult(invocationResult));
    toolCallLogs.push(invocationResult.toolCallLog);
  }

  return {
    plannedCalls,
    toolCallResults,
    toolCallLogs,
  };
}

export function buildTradeInDemoToolExecutionStepOutput(
  result: TradeInDemoToolExecutionResult,
) {
  return {
    plannedCallCount: result.plannedCalls.length,
    toolCallLogIds: result.toolCallLogs.map((log) => log.id),
    succeededCount: result.toolCallResults.filter(
      (item) => item.status === "SUCCEEDED",
    ).length,
    blockedCount: result.toolCallResults.filter(
      (item) => item.status === "BLOCKED",
    ).length,
    failedCount: result.toolCallResults.filter(
      (item) => item.status === "FAILED",
    ).length,
  };
}
