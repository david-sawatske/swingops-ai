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

export type ModelProviderHealthStatus =
  | "HEALTHY"
  | "DEGRADED"
  | "UNAVAILABLE";

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
  healthStatus: ModelProviderHealthStatus;
  healthReason: string;
  estimatedLatencyMs: number;
  inputCostPer1MTokensUsd: number;
  outputCostPer1MTokensUsd: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  selected: boolean;
  reasonCodes: string[];
};

export type ModelRouteRejectedCandidate = ModelRouteCandidateSummary & {
  rejectedReasons: string[];
};

export type ModelRouteDecision = {
  provider: ModelProviderName;
  model: string;
  selectedProvider: ModelProviderName;
  selectedModel: string;
  reason: string;
  selectedReason: string;
  estimatedCostTier: ModelCostTier;
  expectedLatencyTier: ModelLatencyTier;
  qualityTier: ModelQualityTier;
  healthStatus: ModelProviderHealthStatus;
  estimatedLatencyMs: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  routingFactors: string[];
  selectedModelMetadata: ModelRouteCandidateSummary;
  candidatesConsidered: ModelRouteCandidateSummary[];
  providerCandidates: ModelRouteCandidateSummary[];
  rejectedCandidates: ModelRouteRejectedCandidate[];
  fallbackProvider: ModelProviderName | null;
  fallbackModel: string | null;
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
