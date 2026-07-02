import type {
  AgentToolCategory,
  AgentToolDefinition,
  AgentToolRiskLevel
} from "./tool-registry.types.js";
import {
  customerCommunicationAgentTools
} from "./tool-definitions/customer-communication-tools.js";
import {
  inventoryMutationAgentTools,
  inventoryReadOnlyAgentTools
} from "./tool-definitions/inventory-tools.js";
import {
  reviewQueueAgentTools
} from "./tool-definitions/review-queue-tools.js";
import {
  valuationMutationAgentTools,
  valuationReadOnlyAgentTools
} from "./tool-definitions/valuation-tools.js";
import {
  workflowGroundingAgentTools,
  workflowRunAgentTools
} from "./tool-definitions/workflow-tools.js";

export type AgentToolRegistryFilter = {
  category?: AgentToolCategory;
  riskLevel?: AgentToolRiskLevel;
  enabled?: boolean;
  mutatesData?: boolean;
  requiresHumanApproval?: boolean;
};

const registeredAgentTools: AgentToolDefinition[] = [
  ...workflowGroundingAgentTools,
  ...inventoryReadOnlyAgentTools,
  ...valuationReadOnlyAgentTools,
  ...inventoryMutationAgentTools,
  ...valuationMutationAgentTools,
  ...customerCommunicationAgentTools,
  ...workflowRunAgentTools,
  ...reviewQueueAgentTools
];

function cloneTool(tool: AgentToolDefinition): AgentToolDefinition {
  const clonedTool: AgentToolDefinition = {
    ...tool,
    inputShape: {
      ...tool.inputShape,
      fields: tool.inputShape.fields.map((field) => ({ ...field }))
    }
  };

  if (tool.existingHttpRoute) {
    clonedTool.existingHttpRoute = { ...tool.existingHttpRoute };
  }

  return clonedTool;
}

export function listAgentTools(
  filter: AgentToolRegistryFilter = {}
): AgentToolDefinition[] {
  return registeredAgentTools
    .filter((tool) => {
      if (filter.category && tool.category !== filter.category) {
        return false;
      }

      if (filter.riskLevel && tool.riskLevel !== filter.riskLevel) {
        return false;
      }

      if (filter.enabled !== undefined && tool.enabled !== filter.enabled) {
        return false;
      }

      if (
        filter.mutatesData !== undefined &&
        tool.mutatesData !== filter.mutatesData
      ) {
        return false;
      }

      if (
        filter.requiresHumanApproval !== undefined &&
        tool.requiresHumanApproval !== filter.requiresHumanApproval
      ) {
        return false;
      }

      return true;
    })
    .map(cloneTool);
}

export function getAgentTool(name: string): AgentToolDefinition | null {
  const tool = registeredAgentTools.find((candidate) => candidate.name === name);

  return tool ? cloneTool(tool) : null;
}
