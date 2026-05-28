export type ModelProviderName =
  | "MOCK"
  | "OPENAI"
  | "ANTHROPIC"
  | "AZURE_OPENAI"
  | "OLLAMA";

export type ModelTaskType =
  | "INTAKE_PARSING"
  | "FIELD_NORMALIZATION"
  | "VALIDATION"
  | "REVIEW_SUMMARY";

export type ModelRoutingGoal =
  | "LOW_COST"
  | "LOW_LATENCY"
  | "HIGH_QUALITY"
  | "LOCAL_ONLY";

export type ModelCostTier = "FREE" | "LOW" | "MEDIUM" | "HIGH";

export type ModelLatencyTier = "LOW" | "MEDIUM" | "HIGH";

export type ModelQualityTier = "LOW" | "MEDIUM" | "HIGH";

export type ModelRouteCandidateSummary = {
  provider: ModelProviderName;
  model: string;
  supportedTaskTypes: ModelTaskType[];
  supportsJson: boolean;
  costTier: ModelCostTier;
  latencyTier: ModelLatencyTier;
  qualityTier: ModelQualityTier;
  providerEnabled: boolean;
  modelEnabled: boolean;
  enabledForExecution: boolean;
};

export type ModelRouteRejectedCandidate = ModelRouteCandidateSummary & {
  rejectedReasons: string[];
};

export type ModelRouteDecision = {
  provider: ModelProviderName;
  model: string;
  reason: string;
  estimatedCostTier: ModelCostTier;
  expectedLatencyTier: ModelLatencyTier;
  qualityTier: ModelQualityTier;
  selectedModelMetadata: ModelRouteCandidateSummary;
  candidatesConsidered: ModelRouteCandidateSummary[];
  rejectedCandidates: ModelRouteRejectedCandidate[];
  fallbackReason: string | null;
};

export type PreviewModelRoutingRequest = {
  taskType: ModelTaskType;
  preferredGoal: ModelRoutingGoal;
  requireJson: boolean;
  allowDisabledProvidersForSimulation: boolean;
};

export type PreviewModelRoutingResponse = {
  routingRequest: PreviewModelRoutingRequest;
  routingDecision: ModelRouteDecision;
};
