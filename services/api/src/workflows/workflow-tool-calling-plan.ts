import type { ToolCallLog } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import {
  executeReadOnlyToolInvocation,
  type ReadOnlyToolInvocationResult
} from "../tools/read-only-tool-invocation.js";
import type {
  ToolExecutionPolicyDecision,
  ToolExecutionPolicyReasonCode
} from "../tools/tool-execution-policy.js";
import type { AgentToolRiskLevel } from "../tools/tool-registry.types.js";

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
  expectedRiskLevel: AgentToolRiskLevel | "UNKNOWN";
  expectedMutatesData: boolean;
  expectedRequiresHumanApproval: boolean;
};

export type WorkflowToolCallingPlanCallResult = WorkflowToolCallingPlannedCall & {
  status: "SUCCEEDED" | "FAILED" | "BLOCKED";
  policyDecision: ToolExecutionPolicyDecision;
  policyReasonCodes: ToolExecutionPolicyReasonCode[];
  policyReason: string;
  executionAttempted: boolean;
  toolCallLogId: string;
  connectorResultPreview: unknown | null;
  failurePreview: string | null;
};

export type WorkflowToolCallingPlanExecution = {
  plan: {
    planId: string;
    workflowRunId: string;
    status: WorkflowToolCallingPlanStatus;
    plannedCalls: WorkflowToolCallingPlannedCall[];
  };
  results: WorkflowToolCallingPlanCallResult[];
  toolCallLogs: ToolCallLog[];
  executionMetadata: {
    planner: "deterministic.swingops.workflow-tool-calling-plan.v1";
    requestedBy: "agent.workflow-tool-calling-plan";
    readOnlyConnectorSurface: true;
    mutationToolsEnabled: false;
    policyCheckedBeforeEachExecution: true;
  };
};

type WorkflowRunForPlanning = {
  id: string;
  workflowName: string;
  status: string;
  intakeItem: {
    rawText: string;
  } | null;
  reviewQueueItems: {
    id: string;
    status: string;
    originalText: string | null;
  }[];
};

export class WorkflowToolCallingPlanWorkflowRunNotFoundError extends Error {
  constructor() {
    super("Workflow run not found");
    this.name = "WorkflowToolCallingPlanWorkflowRunNotFoundError";
  }
}

function buildPlanId(workflowRunId: string): string {
  return `plan_${workflowRunId}_deterministic_v1`;
}

function buildClubReferenceQuery(workflowRun: WorkflowRunForPlanning): string {
  const reviewSource = workflowRun.reviewQueueItems.find(
    (item) => item.originalText
  )?.originalText;

  return (
    reviewSource ??
    workflowRun.intakeItem?.rawText ??
    "Titleist TSR maybe TS2 fairway wood"
  );
}

function buildWorkflowToolCallingPlan(
  workflowRun: WorkflowRunForPlanning
): WorkflowToolCallingPlannedCall[] {
  return [
    {
      planCallId: `${workflowRun.id}:1`,
      orderIndex: 1,
      toolName: "swingops.workflowRuns.get",
      reason:
        "Load the selected workflow run with steps, model call logs, tool call logs, and review queue context before planning follow-up actions.",
      inputJson: {
        id: workflowRun.id
      },
      expectedRiskLevel: "LOW",
      expectedMutatesData: false,
      expectedRequiresHumanApproval: false
    },
    {
      planCallId: `${workflowRun.id}:2`,
      orderIndex: 2,
      toolName: "swingops.reviewQueueItems.list",
      reason:
        "Inspect open human-review work so the agent can understand whether the workflow needs reviewer action.",
      inputJson: {
        status: "OPEN"
      },
      expectedRiskLevel: "LOW",
      expectedMutatesData: false,
      expectedRequiresHumanApproval: false
    },
    {
      planCallId: `${workflowRun.id}:3`,
      orderIndex: 3,
      toolName: "swingops.clubReference.search",
      reason:
        "Ground ambiguous golf-club text against a local read-only reference dataset before recommending a review outcome.",
      inputJson: {
        query: buildClubReferenceQuery(workflowRun)
      },
      expectedRiskLevel: "LOW",
      expectedMutatesData: false,
      expectedRequiresHumanApproval: false
    },
    {
      planCallId: `${workflowRun.id}:4`,
      orderIndex: 4,
      toolName: "swingops.reviewQueueItems.resolve",
      reason:
        "Demonstrate that a planned mutation is policy checked and blocked on the read-only connector surface instead of being executed.",
      inputJson: {
        id: workflowRun.reviewQueueItems[0]?.id ?? "blocked-demo-review-item",
        reviewerNotes:
          "Blocked demo only. Mutating review queue actions require a separate human-approved execution path."
      },
      expectedRiskLevel: "HIGH",
      expectedMutatesData: true,
      expectedRequiresHumanApproval: true
    }
  ];
}

function getFailurePreview(result: ReadOnlyToolInvocationResult): string | null {
  if (result.invocation.status === "SUCCEEDED") {
    return null;
  }

  return result.toolCallLog.errorMessage ?? result.policyEvaluation.reason;
}

function getConnectorResultPreview(result: ReadOnlyToolInvocationResult): unknown | null {
  if (!result.connectorResult) {
    return null;
  }

  return result.connectorResult.data;
}

function getPlanStatus(
  results: WorkflowToolCallingPlanCallResult[]
): WorkflowToolCallingPlanStatus {
  if (results.length === 0) {
    return "PLANNED";
  }

  const succeededCount = results.filter((result) => result.status === "SUCCEEDED").length;
  const blockedCount = results.filter((result) => result.status === "BLOCKED").length;
  const failedCount = results.filter((result) => result.status === "FAILED").length;

  if (succeededCount === results.length) {
    return "EXECUTED";
  }

  if (blockedCount === results.length) {
    return "BLOCKED";
  }

  if (failedCount > 0) {
    return "FAILED";
  }

  return "PARTIALLY_EXECUTED";
}

export async function executeWorkflowToolCallingPlan(input: {
  workflowRunId: string;
}): Promise<WorkflowToolCallingPlanExecution> {
  const workflowRun = await prisma.workflowRun.findUnique({
    where: {
      id: input.workflowRunId
    },
    include: {
      intakeItem: true,
      reviewQueueItems: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (!workflowRun) {
    throw new WorkflowToolCallingPlanWorkflowRunNotFoundError();
  }

  const plannedCalls = buildWorkflowToolCallingPlan(workflowRun);
  const results: WorkflowToolCallingPlanCallResult[] = [];
  const toolCallLogs: ToolCallLog[] = [];

  for (const plannedCall of plannedCalls) {
    const invocationResult = await executeReadOnlyToolInvocation({
      toolName: plannedCall.toolName,
      inputJson: plannedCall.inputJson,
      requestedBy: "agent.workflow-tool-calling-plan",
      workflowRunId: workflowRun.id,
      executionMode: "AGENT_AUTONOMOUS",
      humanApprovalGranted: false
    });

    toolCallLogs.push(invocationResult.toolCallLog);
    results.push({
      ...plannedCall,
      status: invocationResult.invocation.status,
      policyDecision: invocationResult.policyEvaluation.decision,
      policyReasonCodes: invocationResult.policyEvaluation.reasonCodes,
      policyReason: invocationResult.policyEvaluation.reason,
      executionAttempted: invocationResult.invocation.executionAttempted,
      toolCallLogId: invocationResult.invocation.toolCallLogId,
      connectorResultPreview: getConnectorResultPreview(invocationResult),
      failurePreview: getFailurePreview(invocationResult)
    });
  }

  return {
    plan: {
      planId: buildPlanId(workflowRun.id),
      workflowRunId: workflowRun.id,
      status: getPlanStatus(results),
      plannedCalls
    },
    results,
    toolCallLogs,
    executionMetadata: {
      planner: "deterministic.swingops.workflow-tool-calling-plan.v1",
      requestedBy: "agent.workflow-tool-calling-plan",
      readOnlyConnectorSurface: true,
      mutationToolsEnabled: false,
      policyCheckedBeforeEachExecution: true
    }
  };
}
