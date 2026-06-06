import {
  executeReadOnlyToolInvocation,
  type ReadOnlyToolInvocationResult
} from "./read-only-tool-invocation.js";
import {
  evaluateToolExecutionPolicy,
  type ToolExecutionMode,
  type ToolExecutionPolicyEvaluation
} from "./tool-execution-policy.js";
import { listAgentTools } from "./tool-registry.js";
import type {
  AgentToolDefinition,
  AgentToolInputField
} from "./tool-registry.types.js";

export type McpCompatibleToolCallInput = {
  toolId: string;
  arguments?: unknown;
  requestedBy?: string;
  workflowRunId?: string;
  workflowStepId?: string;
  invocationMode?: ToolExecutionMode;
  humanApprovalGranted?: boolean;
};

export type McpCompatibleToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
  annotations: {
    title: string;
    riskLevel: AgentToolDefinition["riskLevel"];
    mutatesData: boolean;
    requiresApproval: boolean;
    enabled: boolean;
    allowedMode: "AGENT_AUTONOMOUS" | "HUMAN_APPROVED" | "DISABLED";
    implementationStatus: AgentToolDefinition["implementationStatus"];
    existingHttpRoute: AgentToolDefinition["existingHttpRoute"] | null;
    policyPreview: {
      decision: ToolExecutionPolicyEvaluation["decision"];
      reasonCodes: ToolExecutionPolicyEvaluation["reasonCodes"];
      reason: string;
      executionEnabled: boolean;
    };
  };
};

export type McpCompatibleToolListResponse = {
  tools: McpCompatibleToolDefinition[];
  mcpSurface: {
    name: "swingops.internal.mcp-compatible-tools";
    protocolShape: "MCP_TOOLS_LIST_COMPATIBLE";
    transport: "REST_ADAPTER";
    externalMcpServer: false;
    summary: string;
  };
};

export type McpCompatibleToolCallResponse = {
  toolId: string;
  policyDecision: {
    decision: ToolExecutionPolicyEvaluation["decision"];
    reasonCodes: ToolExecutionPolicyEvaluation["reasonCodes"];
    reason: string;
    executionMode: ToolExecutionMode;
    executionEnabled: boolean;
    humanApprovalGranted: boolean;
  };
  executionAttempted: boolean;
  status: ReadOnlyToolInvocationResult["invocation"]["status"];
  resultJson: unknown | null;
  errorMessage: string | null;
  toolCallLogId: string;
  startedAt: string;
  completedAt: string;
  mcpSurface: {
    protocolShape: "MCP_TOOLS_CALL_COMPATIBLE";
    transport: "REST_ADAPTER";
    externalMcpServer: false;
    reusedInternalPolicyAndExecutor: true;
    auditLogPersistence: "TOOL_CALL_LOG";
  };
};

function toTitle(name: string): string {
  return name
    .replace(/^swingops\./, "")
    .split(".")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function fieldToJsonSchema(field: AgentToolInputField): unknown {
  if (field.type === "enum") {
    return {
      type: "string",
      enum: field.enumValues ?? [],
      description: field.description
    };
  }

  return {
    type: field.type,
    description: field.description
  };
}

function toInputSchema(tool: AgentToolDefinition): McpCompatibleToolDefinition["inputSchema"] {
  return {
    type: "object",
    properties: Object.fromEntries(
      tool.inputShape.fields.map((field) => [field.name, fieldToJsonSchema(field)])
    ),
    required: tool.inputShape.fields
      .filter((field) => field.required)
      .map((field) => field.name),
    additionalProperties: false
  };
}

function getAllowedMode(input: {
  tool: AgentToolDefinition;
  policyEvaluation: ToolExecutionPolicyEvaluation;
}): McpCompatibleToolDefinition["annotations"]["allowedMode"] {
  if (!input.tool.enabled || input.policyEvaluation.decision === "BLOCK") {
    return "DISABLED";
  }

  if (
    input.tool.requiresHumanApproval ||
    input.tool.mutatesData ||
    input.policyEvaluation.decision === "REQUIRE_HUMAN_APPROVAL"
  ) {
    return "HUMAN_APPROVED";
  }

  return "AGENT_AUTONOMOUS";
}

function toMcpCompatibleToolDefinition(
  tool: AgentToolDefinition
): McpCompatibleToolDefinition {
  const policyEvaluation = evaluateToolExecutionPolicy({
    toolName: tool.name,
    executionMode: "AGENT_AUTONOMOUS",
    humanApprovalGranted: false
  });

  return {
    name: tool.name,
    description: tool.description,
    inputSchema: toInputSchema(tool),
    annotations: {
      title: toTitle(tool.name),
      riskLevel: tool.riskLevel,
      mutatesData: tool.mutatesData,
      requiresApproval: tool.requiresHumanApproval,
      enabled: tool.enabled,
      allowedMode: getAllowedMode({
        tool,
        policyEvaluation
      }),
      implementationStatus: tool.implementationStatus,
      existingHttpRoute: tool.existingHttpRoute ?? null,
      policyPreview: {
        decision: policyEvaluation.decision,
        reasonCodes: policyEvaluation.reasonCodes,
        reason: policyEvaluation.reason,
        executionEnabled: policyEvaluation.executionEnabled
      }
    }
  };
}

function getResultJson(
  invocationResult: ReadOnlyToolInvocationResult
): unknown | null {
  return invocationResult.connectorResult?.data ?? null;
}

function getErrorMessage(
  invocationResult: ReadOnlyToolInvocationResult
): string | null {
  if (invocationResult.invocation.status === "SUCCEEDED") {
    return null;
  }

  return (
    invocationResult.toolCallLog.errorMessage ??
    invocationResult.policyEvaluation.reason
  );
}

export function listMcpCompatibleTools(): McpCompatibleToolListResponse {
  const tools = listAgentTools().map(toMcpCompatibleToolDefinition);

  return {
    tools,
    mcpSurface: {
      name: "swingops.internal.mcp-compatible-tools",
      protocolShape: "MCP_TOOLS_LIST_COMPATIBLE",
      transport: "REST_ADAPTER",
      externalMcpServer: false,
      summary:
        "Internal connector registry exposed through an MCP-compatible REST adapter. External MCP transport is not claimed in this slice."
    }
  };
}

export async function callMcpCompatibleTool(
  input: McpCompatibleToolCallInput
): Promise<McpCompatibleToolCallResponse> {
  const invocationResult = await executeReadOnlyToolInvocation({
    toolName: input.toolId,
    inputJson: input.arguments,
    requestedBy: input.requestedBy ?? "agent.mcp-compatible",
    ...(input.workflowRunId === undefined
      ? {}
      : { workflowRunId: input.workflowRunId }),
    ...(input.workflowStepId === undefined
      ? {}
      : { workflowStepId: input.workflowStepId }),
    executionMode: input.invocationMode ?? "AGENT_AUTONOMOUS",
    humanApprovalGranted: input.humanApprovalGranted ?? false
  });

  return {
    toolId: input.toolId,
    policyDecision: {
      decision: invocationResult.policyEvaluation.decision,
      reasonCodes: invocationResult.policyEvaluation.reasonCodes,
      reason: invocationResult.policyEvaluation.reason,
      executionMode: invocationResult.policyEvaluation.executionMode,
      executionEnabled: invocationResult.policyEvaluation.executionEnabled,
      humanApprovalGranted:
        invocationResult.policyEvaluation.humanApprovalGranted
    },
    executionAttempted: invocationResult.invocation.executionAttempted,
    status: invocationResult.invocation.status,
    resultJson: getResultJson(invocationResult),
    errorMessage: getErrorMessage(invocationResult),
    toolCallLogId: invocationResult.invocation.toolCallLogId,
    startedAt: invocationResult.invocation.startedAt,
    completedAt: invocationResult.invocation.completedAt,
    mcpSurface: {
      protocolShape: "MCP_TOOLS_CALL_COMPATIBLE",
      transport: "REST_ADAPTER",
      externalMcpServer: false,
      reusedInternalPolicyAndExecutor: true,
      auditLogPersistence: "TOOL_CALL_LOG"
    }
  };
}
