import type { AgentToolDefinition } from "./tool-registry.types.js";
import { getAgentTool } from "./tool-registry.js";

export type ToolExecutionMode =
  | "PREVIEW_ONLY"
  | "AGENT_AUTONOMOUS"
  | "HUMAN_APPROVED";

export type ToolExecutionPolicyDecision =
  | "ALLOW"
  | "REQUIRE_HUMAN_APPROVAL"
  | "BLOCK";

export type ToolExecutionPolicyReasonCode =
  | "TOOL_NOT_FOUND"
  | "TOOL_DISABLED"
  | "PREVIEW_ONLY_MODE"
  | "MISSING_HUMAN_APPROVAL"
  | "MUTATION_REQUIRES_HUMAN_APPROVAL"
  | "HIGH_RISK_REQUIRES_HUMAN_APPROVAL"
  | "CRITICAL_RISK_BLOCKED"
  | "TOOL_ALLOWED";

export type EvaluateToolExecutionPolicyInput = {
  toolName: string;
  executionMode?: ToolExecutionMode;
  humanApprovalGranted?: boolean;
};

export type ToolExecutionPolicyEvaluation = {
  toolName: string;
  decision: ToolExecutionPolicyDecision;
  reasonCodes: ToolExecutionPolicyReasonCode[];
  reason: string;
  executionMode: ToolExecutionMode;
  executionEnabled: boolean;
  humanApprovalGranted: boolean;
  tool: AgentToolDefinition | null;
};

export type ToolExecutionPolicyPreview = {
  requestedToolName: string;
  evaluation: ToolExecutionPolicyEvaluation;
  policyMetadata: {
    status: "PREVIEW_ONLY";
    executionAttempted: false;
    message: string;
  };
};

export function evaluateToolExecutionPolicy(
  input: EvaluateToolExecutionPolicyInput
): ToolExecutionPolicyEvaluation {
  const executionMode = input.executionMode ?? "PREVIEW_ONLY";
  const humanApprovalGranted = input.humanApprovalGranted ?? false;
  const tool = getAgentTool(input.toolName);

  if (!tool) {
    return {
      toolName: input.toolName,
      decision: "BLOCK",
      reasonCodes: ["TOOL_NOT_FOUND"],
      reason: "Tool is not registered and cannot be exposed to an agent.",
      executionMode,
      executionEnabled: false,
      humanApprovalGranted,
      tool: null
    };
  }

  const blockingReasonCodes: ToolExecutionPolicyReasonCode[] = [];

  if (!tool.enabled) {
    blockingReasonCodes.push("TOOL_DISABLED");
  }

  if (executionMode === "PREVIEW_ONLY") {
    blockingReasonCodes.push("PREVIEW_ONLY_MODE");
  }

  if (tool.riskLevel === "CRITICAL") {
    blockingReasonCodes.push("CRITICAL_RISK_BLOCKED");
  }

  if (blockingReasonCodes.length > 0) {
    return {
      toolName: tool.name,
      decision: "BLOCK",
      reasonCodes: blockingReasonCodes,
      reason: buildReason(blockingReasonCodes),
      executionMode,
      executionEnabled: false,
      humanApprovalGranted,
      tool
    };
  }

  const approvalReasonCodes = getApprovalReasonCodes({
    tool,
    humanApprovalGranted
  });

  if (approvalReasonCodes.length > 0) {
    return {
      toolName: tool.name,
      decision: "REQUIRE_HUMAN_APPROVAL",
      reasonCodes: approvalReasonCodes,
      reason: buildReason(approvalReasonCodes),
      executionMode,
      executionEnabled: false,
      humanApprovalGranted,
      tool
    };
  }

  return {
    toolName: tool.name,
    decision: "ALLOW",
    reasonCodes: ["TOOL_ALLOWED"],
    reason: "Tool is enabled and policy allows execution in the requested mode.",
    executionMode,
    executionEnabled: true,
    humanApprovalGranted,
    tool
  };
}

export function previewToolExecutionPolicy(
  input: EvaluateToolExecutionPolicyInput
): ToolExecutionPolicyPreview {
  return {
    requestedToolName: input.toolName,
    evaluation: evaluateToolExecutionPolicy(input),
    policyMetadata: {
      status: "PREVIEW_ONLY",
      executionAttempted: false,
      message:
        "Policy preview only. No tool execution was attempted by this endpoint."
    }
  };
}

function getApprovalReasonCodes(input: {
  tool: AgentToolDefinition;
  humanApprovalGranted: boolean;
}): ToolExecutionPolicyReasonCode[] {
  if (input.humanApprovalGranted) {
    return [];
  }

  const reasonCodes: ToolExecutionPolicyReasonCode[] = [];

  if (input.tool.requiresHumanApproval) {
    reasonCodes.push("MISSING_HUMAN_APPROVAL");
  }

  if (input.tool.mutatesData) {
    reasonCodes.push("MUTATION_REQUIRES_HUMAN_APPROVAL");
  }

  if (input.tool.riskLevel === "HIGH") {
    reasonCodes.push("HIGH_RISK_REQUIRES_HUMAN_APPROVAL");
  }

  return reasonCodes;
}

function buildReason(reasonCodes: ToolExecutionPolicyReasonCode[]): string {
  if (reasonCodes.includes("TOOL_NOT_FOUND")) {
    return "Tool is not registered and cannot be exposed to an agent.";
  }

  if (reasonCodes.includes("TOOL_DISABLED")) {
    return "Tool is disabled and cannot be executed.";
  }

  if (reasonCodes.includes("PREVIEW_ONLY_MODE")) {
    return "Execution mode is preview-only, so policy evaluation blocks execution.";
  }

  if (reasonCodes.includes("CRITICAL_RISK_BLOCKED")) {
    return "Critical-risk tools are blocked by policy.";
  }

  if (reasonCodes.includes("MISSING_HUMAN_APPROVAL")) {
    return "Tool requires human approval before execution.";
  }

  if (reasonCodes.includes("MUTATION_REQUIRES_HUMAN_APPROVAL")) {
    return "Data-mutating tools require human approval before execution.";
  }

  if (reasonCodes.includes("HIGH_RISK_REQUIRES_HUMAN_APPROVAL")) {
    return "High-risk tools require human approval before execution.";
  }

  return "Tool execution is not allowed by policy.";
}
