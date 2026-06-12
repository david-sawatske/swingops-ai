export type AgentToolCategory =
  | "INTAKE"
  | "WORKFLOW"
  | "REVIEW_QUEUE"
  | "INVENTORY"
  | "VALUATION"
  | "CUSTOMER_COMMUNICATION";

export type AgentToolRiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type AgentToolImplementationStatus =
  | "REGISTERED"
  | "ROUTE_BACKED"
  | "DISABLED_PREVIEW_ONLY";

export type AgentToolInputField = {
  name: string;
  type: "string" | "number" | "boolean" | "enum";
  required: boolean;
  description: string;
  enumValues?: string[];
};

export type AgentToolInputShape = {
  type: "object";
  fields: AgentToolInputField[];
};

export type AgentToolContractAuditBehavior = "PERSIST_TOOL_CALL_LOG" | "PREVIEW_ONLY_NO_PERSISTENCE";

export type AgentToolContract = {
  toolId: string;
  displayName: string;
  description: string;
  inputSchema: AgentToolInputShape;
  outputSchema: {
    type: "object";
    summary: string;
  };
  riskLevel: AgentToolRiskLevel;
  mutatesData: boolean;
  requiresHumanApproval: boolean;
  enabled: boolean;
  allowedMode: "AGENT_AUTONOMOUS" | "HUMAN_APPROVED" | "DISABLED";
  auditBehavior: AgentToolContractAuditBehavior;
  redactionNotes: string;
};

export type AgentToolDefinition = {
  name: string;
  displayName: string;
  description: string;
  category: AgentToolCategory;
  inputShape: AgentToolInputShape;
  riskLevel: AgentToolRiskLevel;
  requiresHumanApproval: boolean;
  mutatesData: boolean;
  enabled: boolean;
  implementationStatus: AgentToolImplementationStatus;
  statusReason: string;
  existingHttpRoute?: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    path: string;
  };
  outputSummary: string;
  auditBehavior: AgentToolContractAuditBehavior;
  redactionNotes: string;
};
