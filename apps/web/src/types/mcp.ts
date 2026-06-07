import type { ToolCallLog } from "./workflow";

export type AgentToolRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ToolExecutionMode =
  | "PREVIEW_ONLY"
  | "AGENT_AUTONOMOUS"
  | "HUMAN_APPROVED";

export type ToolExecutionPolicyDecision = "ALLOW" | "REQUIRE_HUMAN_APPROVAL" | "BLOCK";

export type ReadOnlyToolInvocationStatus =
  | "SUCCEEDED"
  | "FAILED"
  | "BLOCKED";

export type McpReadinessCheck = {
  name: string;
  status: "PASS" | "TODO";
  detail: string;
};

export type ExternalMcpServerReadiness = {
  externalMcpServerReady: boolean;
  statusLabel: string;
  readinessChecks: McpReadinessCheck[];
};

export type AgentToolContract = {
  toolId: string;
  displayName: string;
  description: string;
  inputSchema: {
    type: "object";
    fields: {
      name: string;
      type: string;
      required: boolean;
      description: string;
      enumValues?: string[];
    }[];
  };
  outputSchema: {
    type: "object";
    summary: string;
  };
  riskLevel: AgentToolRiskLevel;
  mutatesData: boolean;
  requiresHumanApproval: boolean;
  enabled: boolean;
  allowedMode: "AGENT_AUTONOMOUS" | "HUMAN_APPROVED" | "DISABLED";
  auditBehavior: "PERSIST_TOOL_CALL_LOG" | "PREVIEW_ONLY_NO_PERSISTENCE";
  redactionNotes: string;
};

export type AgentToolSummary = {
  name: string;
  description: string;
  category: "INTAKE" | "WORKFLOW" | "REVIEW_QUEUE";
  riskLevel: AgentToolRiskLevel;
  enabled: boolean;
  mutatesData: boolean;
  requiresHumanApproval: boolean;
  displayName: string;
  outputSummary: string;
  auditBehavior: "PERSIST_TOOL_CALL_LOG" | "PREVIEW_ONLY_NO_PERSISTENCE";
  redactionNotes: string;
};

export type ConnectorCatalogItem = AgentToolSummary & {
  contract: AgentToolContract;
  inputShape: {
    type: "object";
    fields: {
      name: string;
      type: string;
      required: boolean;
      description: string;
      enumValues?: string[];
    }[];
  };
  implementationStatus: string;
  statusReason: string;
  existingHttpRoute?: {
    method: string;
    path: string;
  };
  allowedExecutionMode: "AGENT_AUTONOMOUS" | "HUMAN_APPROVED" | "DISABLED";
  policyDecision: ToolExecutionPolicyDecision;
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
    externalMcpTransportEnabled: boolean;
    readOnlyExecutionEnabled: boolean;
    mutationExecutionEnabled: boolean;
    auditLogPersistence: "TOOL_CALL_LOG";
    summary: string;
  };
  externalMcpReadiness: ExternalMcpServerReadiness;
};

export type ConnectorInvocationHistoryItem = {
  id: string;
  toolName: string;
  displayName: string;
  policyDecision: ToolExecutionPolicyDecision;
  policyReasonCodes: string[];
  policyReason: string | null;
  executionAttempted: boolean;
  status: string;
  riskLevel: AgentToolRiskLevel | null;
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

export type ToolExecutionPolicyEvaluation = {
  toolName: string;
  decision: ToolExecutionPolicyDecision;
  reasonCodes: string[];
  reason: string;
  executionMode: ToolExecutionMode;
  executionEnabled: boolean;
  humanApprovalGranted: boolean;
  tool: AgentToolSummary | null;
};

export type ConnectorResult = {
  contentType: "application/json";
  data: unknown;
  metadata: {
    source: "swingops.internal-db";
    readOnly: true;
    mutatesData: false;
    externalTransport: false;
  };
};

export type ExecuteReadOnlyToolInvocationRequest = {
  toolName: string;
  inputJson?: unknown;
  requestedBy?: string;
  workflowRunId?: string;
  workflowStepId?: string;
  executionMode?: ToolExecutionMode;
  humanApprovalGranted?: boolean;
};

export type ExecuteReadOnlyToolInvocationResponse = {
  invocation: {
    toolName: string;
    status: ReadOnlyToolInvocationStatus;
    requestedBy: string;
    workflowRunId: string | null;
    workflowStepId: string | null;
    inputJson: unknown | null;
    outputJson: unknown | null;
    executionAttempted: boolean;
    startedAt: string;
    completedAt: string;
    toolCallLogId: string;
  };
  policyEvaluation: ToolExecutionPolicyEvaluation;
  connectorResult: ConnectorResult | null;
  toolCallLog: ToolCallLog;
  executionMetadata: {
    route: "POST /mcp/tools/invocations/execute-readonly";
    externalTransport: false;
    readOnlyOnly: true;
    mutationToolsEnabled: false;
    policyCheckedBeforeExecution: true;
  };
};

export type McpCompatibleToolCallRequest = {
  arguments?: unknown;
  requestedBy?: string;
  workflowRunId?: string;
  workflowStepId?: string;
  invocationMode?: ToolExecutionMode;
  humanApprovalGranted?: boolean;
};

export type McpCompatibleToolCallResponse = {
  toolId: string;
  policyDecision: {
    decision: ToolExecutionPolicyDecision;
    reasonCodes: string[];
    reason: string;
    executionMode: ToolExecutionMode;
    executionEnabled: boolean;
    humanApprovalGranted: boolean;
  };
  executionAttempted: boolean;
  status: ReadOnlyToolInvocationStatus;
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
