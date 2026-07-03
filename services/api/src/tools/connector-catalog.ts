import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { listAgentTools } from "./tool-registry.js";
import { toAgentToolContract } from "./tool-contracts.js";
import { getExternalMcpServerReadiness } from "./mcp-server-readiness.js";
import type { AgentToolDefinition } from "./tool-registry.types.js";

type ConnectorPolicyDecision = "ALLOW" | "BLOCK";

type ConnectorInvocationSummary = {
  toolName: string;
  lastInvokedAt: string | null;
  totalCount: number;
  succeededCount: number;
  failedCount: number;
  blockedCount: number;
};

export type ConnectorCatalogItem = AgentToolDefinition & {
  contract: ReturnType<typeof toAgentToolContract>;
  displayName: string;
  allowedExecutionMode: "AGENT_AUTONOMOUS" | "HUMAN_APPROVED" | "DISABLED";
  policyDecision: ConnectorPolicyDecision;
  policyReasonCodes: string[];
  policyReason: string;
  lastInvokedAt: string | null;
  invocationCounts: {
    total: number;
    succeeded: number;
    failed: number;
    blocked: number;
  };
};

export type ConnectorCatalogResponse = {
  connectors: ConnectorCatalogItem[];
  catalogMetadata: {
    surface: "INTERNAL_MCP_STYLE_CONNECTOR_SURFACE";
    externalMcpTransportEnabled: true;
    readOnlyExecutionEnabled: true;
    mutationExecutionEnabled: false;
    auditLogPersistence: "TOOL_CALL_LOG";
    summary: string;
  };
  externalMcpReadiness: ReturnType<typeof getExternalMcpServerReadiness>;
};

export type ConnectorInvocationHistoryItem = {
  id: string;
  toolName: string;
  displayName: string;
  policyDecision: ConnectorPolicyDecision;
  policyReasonCodes: string[];
  policyReason: string | null;
  executionAttempted: boolean;
  status: string;
  riskLevel: string | null;
  requestedBy: string | null;
  workflowRunId: string | null;
  workflowStepId: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  resultPreview: string | null;
  failureReason: string | null;
};

export type ConnectorInvocationHistoryResponse = {
  invocations: ConnectorInvocationHistoryItem[];
  historyMetadata: {
    source: "TOOL_CALL_LOG";
    limit: number;
    auditStory: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function displayNameFromToolName(toolName: string): string {
  const lastSegment = toolName.split(".").slice(-2).join(" ");
  return lastSegment
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function serializeDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function getOutputRecord(outputJson: Prisma.JsonValue): Record<string, unknown> {
  return isRecord(outputJson) ? outputJson : {};
}

function getPolicyDecision(outputJson: Prisma.JsonValue): ConnectorPolicyDecision {
  const output = getOutputRecord(outputJson);
  return output.policyDecision === "ALLOW" ? "ALLOW" : "BLOCK";
}

function getPolicyReasonCodes(outputJson: Prisma.JsonValue): string[] {
  const output = getOutputRecord(outputJson);
  return Array.isArray(output.policyReasonCodes)
    ? output.policyReasonCodes.filter((code): code is string => typeof code === "string")
    : [];
}

function getStringField(
  outputJson: Prisma.JsonValue,
  fieldName: string
): string | null {
  const output = getOutputRecord(outputJson);
  return typeof output[fieldName] === "string" ? output[fieldName] : null;
}

function getExecutionAttempted(outputJson: Prisma.JsonValue): boolean {
  const output = getOutputRecord(outputJson);
  return output.executionAttempted === true;
}

function getRequestedBy(outputJson: Prisma.JsonValue): string | null {
  return getStringField(outputJson, "requestedBy");
}

function getFailureReason(outputJson: Prisma.JsonValue): string | null {
  return getStringField(outputJson, "failureReason");
}

function getResultPreview(log: {
  outputJson: Prisma.JsonValue;
  errorMessage: string | null;
}): string | null {
  const output = getOutputRecord(log.outputJson);

  if (typeof output.failureReason === "string") {
    return output.failureReason;
  }

  if (log.errorMessage) {
    return log.errorMessage;
  }

  const connectorResult = isRecord(output.connectorResult)
    ? output.connectorResult
    : null;
  const data = isRecord(connectorResult?.data) ? connectorResult.data : null;

  if (!data) {
    return null;
  }

  const firstKey = Object.keys(data)[0];

  if (!firstKey) {
    return "Connector returned JSON data.";
  }

  const value = data[firstKey];

  if (Array.isArray(value)) {
    return `${displayNameFromToolName(firstKey)} returned ${value.length} item${
      value.length === 1 ? "" : "s"
    }.`;
  }

  if (isRecord(value)) {
    return `${displayNameFromToolName(firstKey)} returned structured JSON.`;
  }

  return `${displayNameFromToolName(firstKey)} returned a JSON value.`;
}

function policyForTool(tool: AgentToolDefinition): {
  allowedExecutionMode: ConnectorCatalogItem["allowedExecutionMode"];
  policyDecision: ConnectorPolicyDecision;
  policyReasonCodes: string[];
  policyReason: string;
} {
  if (!tool.enabled) {
    return {
      allowedExecutionMode: "DISABLED",
      policyDecision: "BLOCK",
      policyReasonCodes: ["TOOL_DISABLED"],
      policyReason: "Tool is registered for visibility but disabled for execution."
    };
  }

  if (tool.mutatesData) {
    return {
      allowedExecutionMode: "DISABLED",
      policyDecision: "BLOCK",
      policyReasonCodes: ["MUTATION_BLOCKED_IN_READ_ONLY_MODE"],
      policyReason:
        "Mutation tools are blocked on the read-only connector execution surface."
    };
  }

  if (tool.requiresHumanApproval) {
    return {
      allowedExecutionMode: "HUMAN_APPROVED",
      policyDecision: "BLOCK",
      policyReasonCodes: ["HUMAN_APPROVAL_REQUIRED"],
      policyReason:
        "Approval-required tools are not executable through the autonomous read-only demo."
    };
  }

  return {
    allowedExecutionMode: "AGENT_AUTONOMOUS",
    policyDecision: "ALLOW",
    policyReasonCodes: ["TOOL_ALLOWED"],
    policyReason:
      "Tool is enabled, low-risk/read-only, and allowed for autonomous read-only execution."
  };
}

async function getInvocationSummaries(): Promise<Map<string, ConnectorInvocationSummary>> {
  const logs = await prisma.toolCallLog.findMany({
    orderBy: {
      createdAt: "desc"
    },
    select: {
      toolName: true,
      status: true,
      outputJson: false,
      createdAt: true
    }
  });

  const summaries = new Map<string, ConnectorInvocationSummary>();

  for (const log of logs) {
    const existing =
      summaries.get(log.toolName) ??
      {
        toolName: log.toolName,
        lastInvokedAt: null,
        totalCount: 0,
        succeededCount: 0,
        failedCount: 0,
        blockedCount: 0
      };

    existing.totalCount += 1;

    if (!existing.lastInvokedAt) {
      existing.lastInvokedAt = log.createdAt.toISOString();
    }

    if (log.status === "SUCCEEDED") {
      existing.succeededCount += 1;
    }

    if (log.status === "FAILED") {
      existing.failedCount += 1;
    }

    summaries.set(log.toolName, existing);
  }

  return summaries;
}

export async function listConnectorCatalog(): Promise<ConnectorCatalogResponse> {
  const summaries = await getInvocationSummaries();

  const connectors = listAgentTools().map((tool) => {
    const summary = summaries.get(tool.name);
    const policy = policyForTool(tool);

    return {
      ...tool,
      displayName: tool.displayName,
      contract: toAgentToolContract(tool),
      ...policy,
      lastInvokedAt: summary?.lastInvokedAt ?? null,
      invocationCounts: {
        total: summary?.totalCount ?? 0,
        succeeded: summary?.succeededCount ?? 0,
        failed: summary?.failedCount ?? 0,
        blocked: summary?.blockedCount ?? 0
      }
    };
  });

  return {
    connectors,
    catalogMetadata: {
      surface: "INTERNAL_MCP_STYLE_CONNECTOR_SURFACE",
      externalMcpTransportEnabled: true,
      readOnlyExecutionEnabled: true,
      mutationExecutionEnabled: false,
      auditLogPersistence: "TOOL_CALL_LOG",
      summary:
        "Internal MCP-style connector catalog with read-only execution, policy previews, ToolCallLog-backed audit history, and a local stdio external MCP transport."
    },
    externalMcpReadiness: getExternalMcpServerReadiness()
  };
}

export async function listConnectorInvocationHistory(
  limit = 25
): Promise<ConnectorInvocationHistoryResponse> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const toolByName = new Map(listAgentTools().map((tool) => [tool.name, tool]));

  const logs = await prisma.toolCallLog.findMany({
    take: safeLimit,
    orderBy: {
      createdAt: "desc"
    }
  });

  return {
    invocations: logs.map((log) => {
      const tool = toolByName.get(log.toolName);
      const policyDecision = getPolicyDecision(log.outputJson);

      return {
        id: log.id,
        toolName: log.toolName,
        displayName: tool?.name
          ? displayNameFromToolName(tool.name)
          : displayNameFromToolName(log.toolName),
        policyDecision,
        policyReasonCodes: getPolicyReasonCodes(log.outputJson),
        policyReason: getStringField(log.outputJson, "policyReason"),
        executionAttempted: getExecutionAttempted(log.outputJson),
        status: log.status,
        riskLevel: tool?.riskLevel ?? null,
        requestedBy: getRequestedBy(log.outputJson),
        workflowRunId: log.workflowRunId,
        workflowStepId: log.workflowStepId,
        startedAt: log.startedAt.toISOString(),
        completedAt: serializeDate(log.completedAt),
        createdAt: log.createdAt.toISOString(),
        resultPreview: getResultPreview(log),
        failureReason: getFailureReason(log.outputJson) ?? log.errorMessage
      };
    }),
    historyMetadata: {
      source: "TOOL_CALL_LOG",
      limit: safeLimit,
      auditStory:
        "agent/tool request → policy decision → execution or block → persisted ToolCallLog audit record"
    }
  };
}
