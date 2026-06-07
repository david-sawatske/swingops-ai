import {
  callMcpCompatibleTool,
  listMcpCompatibleTools,
  type McpCompatibleToolCallResponse,
  type McpCompatibleToolDefinition
} from "../tools/mcp-compatible-tool-surface.js";

export type ExternalMcpTextContent = {
  type: "text";
  text: string;
};

export type ExternalMcpToolListResponse = {
  tools: McpCompatibleToolDefinition[];
  transportMetadata: {
    name: "swingops.external-mcp-server";
    transport: "STDIO";
    externalMcpServer: true;
    localOnly: true;
    productionAuthImplemented: false;
    reusedInternalContracts: true;
    reusedInternalPolicyAndExecutor: true;
    auditLogPersistence: "TOOL_CALL_LOG";
    mutationExecutionEnabled: false;
    summary: string;
  };
};

export type ExternalMcpToolCallInput = {
  name: string;
  arguments?: unknown;
};

export type ExternalMcpToolCallResponse = {
  content: ExternalMcpTextContent[];
  isError: boolean;
  structuredContent: {
    toolId: string;
    status: McpCompatibleToolCallResponse["status"];
    executionAttempted: boolean;
    policyDecision: McpCompatibleToolCallResponse["policyDecision"];
    resultJson: unknown | null;
    outputSafety: McpCompatibleToolCallResponse["outputSafety"];
    errorMessage: string | null;
    toolCallLogId: string;
    startedAt: string;
    completedAt: string;
    transportMetadata: {
      transport: "STDIO";
      externalMcpServer: true;
      localOnly: true;
      productionAuthImplemented: false;
      reusedInternalPolicyAndExecutor: true;
      auditLogPersistence: "TOOL_CALL_LOG";
      mutationExecutionEnabled: false;
    };
  };
};

function summarizeToolCall(response: McpCompatibleToolCallResponse): string {
  if (response.status === "SUCCEEDED") {
    return `${response.toolId} succeeded. ToolCallLog ${response.toolCallLogId} persisted.`;
  }

  return `${response.toolId} ${response.status.toLowerCase()}: ${response.errorMessage ?? response.policyDecision.reason}`;
}

export function listExternalMcpTools(): ExternalMcpToolListResponse {
  const tools = listMcpCompatibleTools().tools;

  return {
    tools,
    transportMetadata: {
      name: "swingops.external-mcp-server",
      transport: "STDIO",
      externalMcpServer: true,
      localOnly: true,
      productionAuthImplemented: false,
      reusedInternalContracts: true,
      reusedInternalPolicyAndExecutor: true,
      auditLogPersistence: "TOOL_CALL_LOG",
      mutationExecutionEnabled: false,
      summary:
        "Local stdio MCP server transport that wraps the existing SwingOps connector contracts, policy evaluator, read-only executor, ToolCallLog persistence, and output sanitizer."
    }
  };
}

export async function callExternalMcpTool(
  input: ExternalMcpToolCallInput
): Promise<ExternalMcpToolCallResponse> {
  const response = await callMcpCompatibleTool({
    toolId: input.name,
    ...(input.arguments === undefined ? {} : { arguments: input.arguments }),
    requestedBy: "agent.external-mcp-stdio",
    invocationMode: "AGENT_AUTONOMOUS",
    humanApprovalGranted: false
  });

  const isError = response.status !== "SUCCEEDED";

  return {
    content: [
      {
        type: "text",
        text: summarizeToolCall(response)
      }
    ],
    isError,
    structuredContent: {
      toolId: response.toolId,
      status: response.status,
      executionAttempted: response.executionAttempted,
      policyDecision: response.policyDecision,
      resultJson: response.resultJson,
      outputSafety: response.outputSafety,
      errorMessage: response.errorMessage,
      toolCallLogId: response.toolCallLogId,
      startedAt: response.startedAt,
      completedAt: response.completedAt,
      transportMetadata: {
        transport: "STDIO",
        externalMcpServer: true,
        localOnly: true,
        productionAuthImplemented: false,
        reusedInternalPolicyAndExecutor: true,
        auditLogPersistence: "TOOL_CALL_LOG",
        mutationExecutionEnabled: false
      }
    }
  };
}
