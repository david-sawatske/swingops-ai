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
  displayName: string;
  description: string;
  category: "INTAKE" | "WORKFLOW" | "REVIEW_QUEUE";
  riskLevel: AgentToolRiskLevel;
  enabled: boolean;
  mutatesData: boolean;
  requiresHumanApproval: boolean;
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
