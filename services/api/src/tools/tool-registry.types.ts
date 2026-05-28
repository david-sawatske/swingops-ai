export type AgentToolCategory =
  | "INTAKE"
  | "WORKFLOW"
  | "REVIEW_QUEUE";

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

export type AgentToolDefinition = {
  name: string;
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
};
