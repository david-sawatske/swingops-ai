import {
  executeReadOnlyToolInvocation,
  type ReadOnlyToolInvocationResult
} from "./read-only-tool-invocation.js";
import type {
  ToolExecutionMode,
  ToolExecutionPolicyEvaluation
} from "./tool-execution-policy.js";
import { listAgentTools } from "./tool-registry.js";
import {
  toAgentToolContract,
  toMcpInputSchema,
  type McpCompatibleInputSchema
} from "./tool-contracts.js";
import { sanitizeMcpToolOutput } from "./mcp-output-sanitizer.js";
import { getExternalMcpServerReadiness } from "./mcp-server-readiness.js";
import type {
  AgentToolContract,
  AgentToolDefinition
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
  inputSchema: McpCompatibleInputSchema;
  annotations: {
    title: string;
    contract: AgentToolContract;
    riskLevel: AgentToolDefinition["riskLevel"];
    mutatesData: boolean;
    requiresApproval: boolean;
    enabled: boolean;
    allowedMode: AgentToolContract["allowedMode"];
    implementationStatus: AgentToolDefinition["implementationStatus"];
    existingHttpRoute: AgentToolDefinition["existingHttpRoute"] | null;
    auditBehavior: AgentToolDefinition["auditBehavior"];
    redactionNotes: string;
    outputSchema: AgentToolContract["outputSchema"];
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
  externalMcpReadiness: ReturnType<typeof getExternalMcpServerReadiness>;
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
  outputSafety: {
    sanitized: boolean;
    sanitizerVersion: string | null;
    redactionNotes: string | null;
    intentionallyExposedFieldsOnly: boolean;
  };
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

function toMcpCompatibleToolDefinition(
  tool: AgentToolDefinition
): McpCompatibleToolDefinition {
  const contract = toAgentToolContract(tool);
  const policyPreview = contract.allowedMode === "DISABLED"
    ? {
        decision: "BLOCK" as const,
        reasonCodes: tool.enabled ? ["TOOL_ALLOWED" as const] : ["TOOL_DISABLED" as const],
        reason: tool.enabled
          ? "Tool is visible but not executable through this connector mode."
          : "Tool is disabled and cannot be executed.",
        executionEnabled: false
      }
    : {
        decision: "ALLOW" as const,
        reasonCodes: ["TOOL_ALLOWED" as const],
        reason:
          "Tool is enabled and policy allows execution in the requested mode.",
        executionEnabled: true
      };

  return {
    name: tool.name,
    description: tool.description,
    inputSchema: toMcpInputSchema(tool),
    annotations: {
      title: tool.displayName,
      contract,
      riskLevel: tool.riskLevel,
      mutatesData: tool.mutatesData,
      requiresApproval: tool.requiresHumanApproval,
      enabled: tool.enabled,
      allowedMode: contract.allowedMode,
      implementationStatus: tool.implementationStatus,
      existingHttpRoute: tool.existingHttpRoute ?? null,
      auditBehavior: tool.auditBehavior,
      redactionNotes: tool.redactionNotes,
      outputSchema: contract.outputSchema,
      policyPreview
    }
  };
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
    },
    externalMcpReadiness: getExternalMcpServerReadiness()
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
  const sanitizedOutput =
    invocationResult.connectorResult === null
      ? null
      : sanitizeMcpToolOutput({
          data: invocationResult.connectorResult.data,
          tool: invocationResult.policyEvaluation.tool
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
    resultJson: sanitizedOutput?.data ?? null,
    outputSafety: {
      sanitized: sanitizedOutput?.metadata.sanitized ?? false,
      sanitizerVersion: sanitizedOutput?.metadata.sanitizerVersion ?? null,
      redactionNotes: sanitizedOutput?.metadata.redactionNotes ?? null,
      intentionallyExposedFieldsOnly:
        sanitizedOutput?.metadata.intentionallyExposedFieldsOnly ?? false
    },
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
