import {
  listModelConfigs,
  type ModelProviderRegistryFilter
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
  goal: ModelRoutingGoal;
  taskType: ModelTaskType;
};

export type ModelRouteDecision = {
  provider: ModelProvider;
  model: string;
  reason: string;
  estimatedCostTier: ModelCostTier;
  expectedLatencyTier: ModelLatencyTier;
  qualityTier: ModelQualityTier;
};

type ModelOption = ModelProviderModelConfig;

const mockFallbackDecision: ModelRouteDecision = {
  provider: "MOCK",
  model: "mock-golf-workflow-model",
  reason: "Fallback mock model for local workflow development.",
  estimatedCostTier: "FREE",
  expectedLatencyTier: "LOW",
  qualityTier: "LOW"
};

export function routeModel(request: ModelRouteRequest): ModelRouteDecision {
  const candidates = listModelOptions({
    taskType: request.taskType
  });

  if (candidates.length === 0) {
    return {
      ...mockFallbackDecision,
      reason: `Fallback mock model because no configured model supports ${request.taskType}.`
    };
  }

  if (request.goal === "LOW_COST") {
    return selectFirstByPreference(
      candidates,
      ["FREE", "LOW", "MEDIUM", "HIGH"],
      "costTier"
    );
  }

  if (request.goal === "LOW_LATENCY") {
    return selectFirstByPreference(
      candidates,
      ["LOW", "MEDIUM", "HIGH"],
      "latencyTier"
    );
  }

  if (request.goal === "HIGH_QUALITY") {
    return selectFirstByPreference(
      candidates,
      ["HIGH", "MEDIUM", "LOW"],
      "qualityTier"
    );
  }

  if (request.goal === "LOCAL_ONLY") {
    const localModel = candidates.find(
      (candidate) => candidate.provider === "OLLAMA"
    );

    if (localModel) {
      return toRouteDecision(localModel);
    }

    return {
      ...mockFallbackDecision,
      reason: `Fallback mock model because no local model supports ${request.taskType}.`
    };
  }

  return firstCandidateOrFallback(candidates);
}

function listModelOptions(
  filter: Pick<ModelProviderRegistryFilter, "taskType">
): ModelOption[] {
  return listModelConfigs(filter);
}

function selectFirstByPreference<TValue extends string>(
  candidates: ModelOption[],
  preferenceOrder: TValue[],
  field: keyof Pick<ModelOption, "costTier" | "latencyTier" | "qualityTier">
): ModelRouteDecision {
  for (const preferredValue of preferenceOrder) {
    const match = candidates.find(
      (candidate) => candidate[field] === preferredValue
    );

    if (match) {
      return toRouteDecision(match);
    }
  }

  return firstCandidateOrFallback(candidates);
}

function firstCandidateOrFallback(
  candidates: ModelOption[]
): ModelRouteDecision {
  const firstCandidate = candidates[0];

  if (!firstCandidate) {
    return mockFallbackDecision;
  }

  return toRouteDecision(firstCandidate);
}

function toRouteDecision(modelOption: ModelOption): ModelRouteDecision {
  return {
    provider: modelOption.provider,
    model: modelOption.model,
    reason: modelOption.reason,
    estimatedCostTier: modelOption.costTier,
    expectedLatencyTier: modelOption.latencyTier,
    qualityTier: modelOption.qualityTier
  };
}
