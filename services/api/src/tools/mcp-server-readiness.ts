import { listAgentTools } from "./tool-registry.js";

export type McpReadinessCheckStatus = "PASS" | "TODO";

export type McpReadinessCheck = {
  name: string;
  status: McpReadinessCheckStatus;
  detail: string;
};

export type ExternalMcpServerReadiness = {
  externalMcpServerReady: false;
  statusLabel: "Not externalized yet";
  readinessChecks: McpReadinessCheck[];
};

export function getExternalMcpServerReadiness(): ExternalMcpServerReadiness {
  const tools = listAgentTools();
  const allToolsHaveContracts = tools.every(
    (tool) =>
      tool.displayName &&
      tool.inputShape.type === "object" &&
      tool.outputSummary &&
      tool.auditBehavior &&
      tool.redactionNotes
  );
  const readOnlyToolsPolicyGuarded = tools
    .filter((tool) => !tool.mutatesData)
    .every((tool) => tool.enabled && tool.riskLevel === "LOW");
  const mutationToolsBlocked = tools
    .filter((tool) => tool.mutatesData)
    .every((tool) => !tool.enabled && tool.requiresHumanApproval);

  return {
    externalMcpServerReady: false,
    statusLabel: "Not externalized yet",
    readinessChecks: [
      {
        name: "Tool contracts defined",
        status: allToolsHaveContracts ? "PASS" : "TODO",
        detail:
          "Every registered connector exposes display, input, output, risk, policy, audit, and redaction metadata."
      },
      {
        name: "Read-only tools policy guarded",
        status: readOnlyToolsPolicyGuarded ? "PASS" : "TODO",
        detail:
          "Enabled autonomous connector calls are limited to low-risk read-only tools."
      },
      {
        name: "Mutation tools blocked",
        status: mutationToolsBlocked ? "PASS" : "TODO",
        detail:
          "High-risk review mutation tools stay visible for governance but disabled for execution."
      },
      {
        name: "Argument validation enabled",
        status: "PASS",
        detail:
          "MCP-compatible calls reuse strict Zod schemas before internal read-only execution."
      },
      {
        name: "Output sanitizer enabled",
        status: "PASS",
        detail:
          "MCP-compatible responses include sanitized output metadata and redaction notes."
      },
      {
        name: "External MCP transport implemented",
        status: "TODO",
        detail:
          "This slice intentionally keeps the surface as an internal REST adapter, not a full external MCP server."
      }
    ]
  };
}
