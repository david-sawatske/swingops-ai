import {
  getModelProvider,
  listModelConfigs
} from "./model-provider-registry.js";
import type {
  ModelCostTier,
  ModelLatencyTier,
  ModelProviderModelConfig,
  ModelProviderName,
  ModelQualityTier,
  ModelTaskType
} from "./model-provider.types.js";

export type ModelProvider = ModelProviderName;

export type ModelRoutingGoal =
  | "LOW_COST"
  | "LOW_LATENCY"
  | "HIGH_QUALITY"
  | "LOCAL_ONLY";

export type ModelRouteRequest = {
  goal?: ModelRoutingGoal;
  preferredGoal?: ModelRoutingGoal;
  taskType: ModelTaskType;
  requireJson?: boolean;
  allowDisabledProvidersForSimulation?: boolean;
};

export type ModelRouteCandidateSummary = {
  provider: ModelProvider;
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
  provider: ModelProvider;
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

type ModelRouteOptions = {
  modelConfigs?: ModelProviderModelConfig[];
  providerEnabledByName?: Partial<Record<ModelProviderName, boolean>>;
};

type ScoredCandidate = {
  modelConfig: ModelProviderModelConfig;
  summary: ModelRouteCandidateSummary;
};

const mockFallbackModelMetadata: ModelRouteCandidateSummary = {
  provider: "MOCK",
  model: "mock-golf-workflow-model",
  supportedTaskTypes: [
    "INTAKE_PARSING",
    "FIELD_NORMALIZATION",
    "VALIDATION",
    "REVIEW_SUMMARY"
  ],
  supportsJson: true,
  costTier: "FREE",
  latencyTier: "LOW",
  qualityTier: "LOW",
  providerEnabled: true,
  modelEnabled: true,
  enabledForExecution: true
};

const mockFallbackDecisionBase = {
  provider: "MOCK" as const,
  model: "mock-golf-workflow-model",
  estimatedCostTier: "FREE" as const,
  expectedLatencyTier: "LOW" as const,
  qualityTier: "LOW" as const,
  selectedModelMetadata: mockFallbackModelMetadata
};

export function routeModel(
  request: ModelRouteRequest,
  options: ModelRouteOptions = {}
): ModelRouteDecision {
  const preferredGoal = request.preferredGoal ?? request.goal ?? "LOW_COST";
  const modelConfigs = options.modelConfigs ?? listModelConfigs();

  const candidatesConsidered = modelConfigs.map((modelConfig) =>
    toCandidateSummary(modelConfig, options.providerEnabledByName)
  );

  const rejectedCandidates: ModelRouteRejectedCandidate[] = [];
  const eligibleCandidates: ScoredCandidate[] = [];

  for (const modelConfig of modelConfigs) {
    const summary = toCandidateSummary(modelConfig, options.providerEnabledByName);
    const rejectedReasons = getRejectedReasons({
      request,
      preferredGoal,
      summary
    });

    if (rejectedReasons.length > 0) {
      rejectedCandidates.push({
        ...summary,
        rejectedReasons
      });
      continue;
    }

    eligibleCandidates.push({
      modelConfig,
      summary
    });
  }

  const selectedCandidate = selectCandidate(eligibleCandidates, preferredGoal);

  if (selectedCandidate) {
    return toRouteDecision({
      modelConfig: selectedCandidate.modelConfig,
      summary: selectedCandidate.summary,
      candidatesConsidered,
      rejectedCandidates,
      fallbackReason: null
    });
  }

  const fallbackReason = getFallbackReason(request.taskType, preferredGoal);

  return {
    ...mockFallbackDecisionBase,
    reason: fallbackReason,
    candidatesConsidered,
    rejectedCandidates,
    fallbackReason
  };
}

function getRejectedReasons(input: {
  request: ModelRouteRequest;
  preferredGoal: ModelRoutingGoal;
  summary: ModelRouteCandidateSummary;
}): string[] {
  const rejectedReasons: string[] = [];

  if (!input.summary.supportedTaskTypes.includes(input.request.taskType)) {
    rejectedReasons.push(`Does not support task type ${input.request.taskType}.`);
  }

  if (input.request.requireJson === true && !input.summary.supportsJson) {
    rejectedReasons.push("Does not support required JSON output.");
  }

  if (
    input.preferredGoal === "LOCAL_ONLY" &&
    input.summary.provider !== "OLLAMA"
  ) {
    rejectedReasons.push("Rejected because LOCAL_ONLY requires a local provider.");
  }

  if (
    !input.request.allowDisabledProvidersForSimulation &&
    !input.summary.enabledForExecution
  ) {
    rejectedReasons.push(
      "Provider/model is disabled for execution. Enable simulation preview to consider it."
    );
  }

  return rejectedReasons;
}

function selectCandidate(
  candidates: ScoredCandidate[],
  preferredGoal: ModelRoutingGoal
): ScoredCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    if (preferredGoal === "LOW_COST" || preferredGoal === "LOCAL_ONLY") {
      return (
        getCostRank(left.summary.costTier) - getCostRank(right.summary.costTier) ||
        getLatencyRank(left.summary.latencyTier) -
          getLatencyRank(right.summary.latencyTier) ||
        getQualityRank(right.summary.qualityTier) -
          getQualityRank(left.summary.qualityTier)
      );
    }

    if (preferredGoal === "LOW_LATENCY") {
      return (
        getLatencyRank(left.summary.latencyTier) -
          getLatencyRank(right.summary.latencyTier) ||
        getCostRank(left.summary.costTier) - getCostRank(right.summary.costTier) ||
        getQualityRank(right.summary.qualityTier) -
          getQualityRank(left.summary.qualityTier)
      );
    }

    return (
      getQualityRank(right.summary.qualityTier) -
        getQualityRank(left.summary.qualityTier) ||
      getCostRank(left.summary.costTier) - getCostRank(right.summary.costTier) ||
      getLatencyRank(left.summary.latencyTier) -
        getLatencyRank(right.summary.latencyTier)
    );
  })[0] ?? null;
}

function toRouteDecision(input: {
  modelConfig: ModelProviderModelConfig;
  summary: ModelRouteCandidateSummary;
  candidatesConsidered: ModelRouteCandidateSummary[];
  rejectedCandidates: ModelRouteRejectedCandidate[];
  fallbackReason: string | null;
}): ModelRouteDecision {
  return {
    provider: input.modelConfig.provider,
    model: input.modelConfig.model,
    reason: input.modelConfig.reason,
    estimatedCostTier: input.modelConfig.costTier,
    expectedLatencyTier: input.modelConfig.latencyTier,
    qualityTier: input.modelConfig.qualityTier,
    selectedModelMetadata: input.summary,
    candidatesConsidered: input.candidatesConsidered,
    rejectedCandidates: input.rejectedCandidates,
    fallbackReason: input.fallbackReason
  };
}

function toCandidateSummary(
  modelConfig: ModelProviderModelConfig,
  providerEnabledByName?: Partial<Record<ModelProviderName, boolean>>
): ModelRouteCandidateSummary {
  const providerEnabled =
    providerEnabledByName?.[modelConfig.provider] ??
    getModelProvider(modelConfig.provider)?.enabled ??
    false;

  return {
    provider: modelConfig.provider,
    model: modelConfig.model,
    supportedTaskTypes: [...modelConfig.supportedTaskTypes],
    supportsJson: modelConfig.supportsJson,
    costTier: modelConfig.costTier,
    latencyTier: modelConfig.latencyTier,
    qualityTier: modelConfig.qualityTier,
    providerEnabled,
    modelEnabled: modelConfig.enabled,
    enabledForExecution: providerEnabled && modelConfig.enabled
  };
}

function getFallbackReason(
  taskType: ModelTaskType,
  preferredGoal: ModelRoutingGoal
): string {
  if (preferredGoal === "LOCAL_ONLY") {
    return `Fallback mock model because no eligible local model supports ${taskType}.`;
  }

  return `Fallback mock model because no eligible configured model supports ${taskType}.`;
}

function getCostRank(costTier: ModelCostTier): number {
  const ranks: Record<ModelCostTier, number> = {
    FREE: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3
  };

  return ranks[costTier];
}

function getLatencyRank(latencyTier: ModelLatencyTier): number {
  const ranks: Record<ModelLatencyTier, number> = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2
  };

  return ranks[latencyTier];
}

function getQualityRank(qualityTier: ModelQualityTier): number {
  const ranks: Record<ModelQualityTier, number> = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2
  };

  return ranks[qualityTier];
}
