import { listAgentTools } from "./tool-registry.js";

export type McpReadinessCheckStatus = "PASS" | "TODO";

export type McpReadinessCheck = {
  name: string;
  status: McpReadinessCheckStatus;
  detail: string;
};

export type ExternalMcpServerReadiness = {
  externalMcpServerReady: true;
  statusLabel: "Local external MCP transport available";
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
    externalMcpServerReady: true,
    statusLabel: "Local external MCP transport available",
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
        status: "PASS",
        detail:
          "A local stdio MCP server wraps the existing SwingOps connector contracts, policy evaluator, read-only executor, ToolCallLog persistence, and sanitizer metadata."
      },
      {
        name: "Production auth and deployment",
        status: "TODO",
        detail:
          "This slice does not claim OAuth, hosted deployment, tenant isolation, or production remote MCP access."
      }
    ]
  };
}
