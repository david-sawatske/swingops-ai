import { randomUUID } from "node:crypto";

import {
  evaluateToolExecutionPolicy,
  type ToolExecutionMode,
  type ToolExecutionPolicyDecision,
  type ToolExecutionPolicyEvaluation,
  type ToolExecutionPolicyReasonCode
} from "./tool-execution-policy.js";

export type ToolInvocationPreviewStatus =
  | "READY_TO_EXECUTE"
  | "AWAITING_HUMAN_APPROVAL"
  | "BLOCKED";

export type PreviewToolInvocationInput = {
  toolName: string;
  inputJson?: unknown;
  requestedBy?: string;
  workflowRunId?: string;
  workflowStepId?: string;
  executionMode?: ToolExecutionMode;
  humanApprovalGranted?: boolean;
  invocationId?: string;
  createdAt?: string;
};

export type ToolInvocationAuditPreview = {
  invocationId: string;
  toolName: string;
  status: ToolInvocationPreviewStatus;
  requestedBy: string;
  workflowRunId: string | null;
  workflowStepId: string | null;
  inputJson: unknown | null;
  executionAttempted: false;
  persisted: false;
  policyDecision: ToolExecutionPolicyDecision;
  policyReasonCodes: ToolExecutionPolicyReasonCode[];
  createdAt: string;
};

export type ToolInvocationPreview = {
  invocation: ToolInvocationAuditPreview;
  policyEvaluation: ToolExecutionPolicyEvaluation;
  previewMetadata: {
    status: "DRY_RUN_ONLY";
    executionAttempted: false;
    persisted: false;
    message: string;
  };
};

export function previewToolInvocation(
  input: PreviewToolInvocationInput
): ToolInvocationPreview {
  const policyEvaluation = evaluateToolExecutionPolicy({
    toolName: input.toolName,
    ...(input.executionMode === undefined
      ? {}
      : { executionMode: input.executionMode }),
    ...(input.humanApprovalGranted === undefined
      ? {}
      : { humanApprovalGranted: input.humanApprovalGranted })
  });

  const invocation: ToolInvocationAuditPreview = {
    invocationId: input.invocationId ?? randomUUID(),
    toolName: input.toolName,
    status: toInvocationPreviewStatus(policyEvaluation.decision),
    requestedBy: input.requestedBy ?? "agent.preview",
    workflowRunId: input.workflowRunId ?? null,
    workflowStepId: input.workflowStepId ?? null,
    inputJson: input.inputJson ?? null,
    executionAttempted: false,
    persisted: false,
    policyDecision: policyEvaluation.decision,
    policyReasonCodes: [...policyEvaluation.reasonCodes],
    createdAt: input.createdAt ?? new Date().toISOString()
  };

  return {
    invocation,
    policyEvaluation,
    previewMetadata: {
      status: "DRY_RUN_ONLY",
      executionAttempted: false,
      persisted: false,
      message:
        "Tool invocation preview only. No tool execution was attempted and no ToolCallLog row was persisted."
    }
  };
}

function toInvocationPreviewStatus(
  decision: ToolExecutionPolicyDecision
): ToolInvocationPreviewStatus {
  if (decision === "ALLOW") {
    return "READY_TO_EXECUTE";
  }

  if (decision === "REQUIRE_HUMAN_APPROVAL") {
    return "AWAITING_HUMAN_APPROVAL";
  }

  return "BLOCKED";
}
