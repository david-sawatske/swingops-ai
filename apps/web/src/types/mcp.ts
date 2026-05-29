import type { ToolCallLog } from "./workflow";

export type AgentToolRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ToolExecutionMode =
  | "PREVIEW_ONLY"
  | "AGENT_AUTONOMOUS"
  | "HUMAN_APPROVED";

export type ToolExecutionPolicyDecision = "ALLOW" | "BLOCK";

export type ReadOnlyToolInvocationStatus =
  | "SUCCEEDED"
  | "FAILED"
  | "BLOCKED";

export type AgentToolSummary = {
  name: string;
  displayName?: string;
  description: string;
  category: "INTAKE" | "WORKFLOW" | "REVIEW_QUEUE";
  riskLevel: AgentToolRiskLevel;
  enabled: boolean;
  mutatesData: boolean;
  requiresHumanApproval: boolean;
};

export type ConnectorCatalogItem = AgentToolSummary & {
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
    externalMcpTransportEnabled: false;
    readOnlyExecutionEnabled: boolean;
    mutationExecutionEnabled: boolean;
    auditLogPersistence: "TOOL_CALL_LOG";
    summary: string;
  };
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
