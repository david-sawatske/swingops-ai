import {
  evaluateToolExecutionPolicy,
  type ToolExecutionPolicyEvaluation
} from "./tool-execution-policy.js";
import type {
  AgentToolContract,
  AgentToolDefinition,
  AgentToolInputField
} from "./tool-registry.types.js";

export type McpCompatibleInputSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
};

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

export function toMcpInputSchema(
  tool: AgentToolDefinition
): McpCompatibleInputSchema {
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

export function getAllowedMode(input: {
  tool: AgentToolDefinition;
  policyEvaluation: ToolExecutionPolicyEvaluation;
}): AgentToolContract["allowedMode"] {
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

export function toAgentToolContract(tool: AgentToolDefinition): AgentToolContract {
  const policyEvaluation = evaluateToolExecutionPolicy({
    toolName: tool.name,
    executionMode: "AGENT_AUTONOMOUS",
    humanApprovalGranted: false
  });

  return {
    toolId: tool.name,
    displayName: tool.displayName,
    description: tool.description,
    inputSchema: tool.inputShape,
    outputSchema: {
      type: "object",
      summary: tool.outputSummary
    },
    riskLevel: tool.riskLevel,
    mutatesData: tool.mutatesData,
    requiresHumanApproval: tool.requiresHumanApproval,
    enabled: tool.enabled,
    allowedMode: getAllowedMode({
      tool,
      policyEvaluation
    }),
    auditBehavior: tool.auditBehavior,
    redactionNotes: tool.redactionNotes
  };
}
