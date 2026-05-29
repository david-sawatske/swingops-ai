import {
  getModelProvider,
  listModelConfigs
} from "./model-provider-registry.js";
import { estimateModelProviderCost } from "./model-provider-costs.js";
import type { ModelProviderCostMetadata } from "./model-provider-costs.js";
import { getModelProviderHealth } from "./model-provider-health.js";
import type {
  ModelProviderHealthMetadata,
  ModelProviderHealthStatus
} from "./model-provider-health.js";
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
  provider: ModelProvider;
  model: string;
  selectedProvider: ModelProvider;
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
  fallbackProvider: ModelProvider | null;
  fallbackModel: string | null;
  fallbackReason: string | null;
};

type ModelRouteOptions = {
  modelConfigs?: ModelProviderModelConfig[];
  providerEnabledByName?: Partial<Record<ModelProviderName, boolean>>;
  providerHealthByName?: Partial<Record<ModelProviderName, ModelProviderHealthMetadata>>;
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
  enabledForExecution: true,
  healthStatus: "HEALTHY",
  healthReason: "Local deterministic mock provider is available for development.",
  estimatedLatencyMs: 75,
  inputCostPer1MTokensUsd: 0,
  outputCostPer1MTokensUsd: 0,
  estimatedInputTokens: 1200,
  estimatedOutputTokens: 450,
  estimatedCostUsd: 0,
  selected: true,
  reasonCodes: [
    "PROVIDER_HEALTHY",
    "COST_WITHIN_BUDGET",
    "LOW_COST_ROUTE"
  ]
};

const mockFallbackDecisionBase = {
  provider: "MOCK" as const,
  model: "mock-golf-workflow-model",
  selectedProvider: "MOCK" as const,
  selectedModel: "mock-golf-workflow-model",
  estimatedCostTier: "FREE" as const,
  expectedLatencyTier: "LOW" as const,
  qualityTier: "LOW" as const,
  healthStatus: "HEALTHY" as const,
  estimatedLatencyMs: 75,
  estimatedInputTokens: 1200,
  estimatedOutputTokens: 450,
  estimatedCostUsd: 0,
  selectedModelMetadata: mockFallbackModelMetadata
};

export function routeModel(
  request: ModelRouteRequest,
  options: ModelRouteOptions = {}
): ModelRouteDecision {
  const preferredGoal = request.preferredGoal ?? request.goal ?? "LOW_COST";
  const modelConfigs = options.modelConfigs ?? listModelConfigs();

  const candidateSummaries = modelConfigs.map((modelConfig) =>
    toCandidateSummary(modelConfig, options)
  );
  const rejectedCandidates: ModelRouteRejectedCandidate[] = [];
  const eligibleCandidates: ScoredCandidate[] = [];

  for (const modelConfig of modelConfigs) {
    const summary = toCandidateSummary(modelConfig, options);
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
    const fallbackCandidate = selectFallbackCandidate(
      eligibleCandidates,
      selectedCandidate.summary
    );

    return toRouteDecision({
      modelConfig: selectedCandidate.modelConfig,
      summary: selectedCandidate.summary,
      candidatesConsidered: markSelectedCandidate(
        candidateSummaries,
        selectedCandidate.summary
      ),
      rejectedCandidates,
      fallbackCandidate,
      fallbackReason: null,
      preferredGoal
    });
  }

  const fallbackReason = getFallbackReason(request.taskType, preferredGoal);

  return {
    ...mockFallbackDecisionBase,
    reason: fallbackReason,
    selectedReason: fallbackReason,
    routingFactors: [
      "No eligible configured provider/model matched the request.",
      "Fallback mock route keeps workflow execution deterministic for local development."
    ],
    candidatesConsidered: candidateSummaries,
    providerCandidates: candidateSummaries,
    rejectedCandidates,
    fallbackProvider: null,
    fallbackModel: null,
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

  if (input.summary.healthStatus === "UNAVAILABLE") {
    rejectedReasons.push("Provider health is UNAVAILABLE.");
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
    const healthComparison =
      getHealthRank(left.summary.healthStatus) -
      getHealthRank(right.summary.healthStatus);

    if (healthComparison !== 0) {
      return healthComparison;
    }

    if (preferredGoal === "LOW_COST" || preferredGoal === "LOCAL_ONLY") {
      return (
        left.summary.estimatedCostUsd - right.summary.estimatedCostUsd ||
        getCostRank(left.summary.costTier) - getCostRank(right.summary.costTier) ||
        left.summary.estimatedLatencyMs - right.summary.estimatedLatencyMs ||
        getQualityRank(right.summary.qualityTier) -
          getQualityRank(left.summary.qualityTier)
      );
    }

    if (preferredGoal === "LOW_LATENCY") {
      return (
        left.summary.estimatedLatencyMs - right.summary.estimatedLatencyMs ||
        getLatencyRank(left.summary.latencyTier) -
          getLatencyRank(right.summary.latencyTier) ||
        left.summary.estimatedCostUsd - right.summary.estimatedCostUsd ||
        getQualityRank(right.summary.qualityTier) -
          getQualityRank(left.summary.qualityTier)
      );
    }

    return (
      getQualityRank(right.summary.qualityTier) -
        getQualityRank(left.summary.qualityTier) ||
      getHighQualityProviderRank(left.summary.provider) -
        getHighQualityProviderRank(right.summary.provider) ||
      left.summary.estimatedCostUsd - right.summary.estimatedCostUsd ||
      left.summary.estimatedLatencyMs - right.summary.estimatedLatencyMs
    );
  })[0] ?? null;
}

function selectFallbackCandidate(
  candidates: ScoredCandidate[],
  selectedSummary: ModelRouteCandidateSummary
): ModelRouteCandidateSummary | null {
  return (
    candidates
      .map((candidate) => candidate.summary)
      .filter(
        (candidate) =>
          candidate.provider !== selectedSummary.provider ||
          candidate.model !== selectedSummary.model
      )
      .sort((left, right) => {
        return (
          getHealthRank(left.healthStatus) - getHealthRank(right.healthStatus) ||
          getHighQualityProviderRank(left.provider) -
            getHighQualityProviderRank(right.provider) ||
          getQualityRank(right.qualityTier) - getQualityRank(left.qualityTier) ||
          left.estimatedCostUsd - right.estimatedCostUsd ||
          left.estimatedLatencyMs - right.estimatedLatencyMs
        );
      })[0] ?? null
  );
}

function toRouteDecision(input: {
  modelConfig: ModelProviderModelConfig;
  summary: ModelRouteCandidateSummary;
  candidatesConsidered: ModelRouteCandidateSummary[];
  rejectedCandidates: ModelRouteRejectedCandidate[];
  fallbackCandidate: ModelRouteCandidateSummary | null;
  fallbackReason: string | null;
  preferredGoal: ModelRoutingGoal;
}): ModelRouteDecision {
  const selectedReason = buildSelectedReason(input.summary, input.preferredGoal);
  const routingFactors = buildRoutingFactors(input.summary, input.preferredGoal);

  return {
    provider: input.modelConfig.provider,
    model: input.modelConfig.model,
    selectedProvider: input.modelConfig.provider,
    selectedModel: input.modelConfig.model,
    reason: selectedReason,
    selectedReason,
    estimatedCostTier: input.modelConfig.costTier,
    expectedLatencyTier: input.modelConfig.latencyTier,
    qualityTier: input.modelConfig.qualityTier,
    healthStatus: input.summary.healthStatus,
    estimatedLatencyMs: input.summary.estimatedLatencyMs,
    estimatedInputTokens: input.summary.estimatedInputTokens,
    estimatedOutputTokens: input.summary.estimatedOutputTokens,
    estimatedCostUsd: input.summary.estimatedCostUsd,
    routingFactors,
    selectedModelMetadata: {
      ...input.summary,
      selected: true
    },
    candidatesConsidered: input.candidatesConsidered,
    providerCandidates: input.candidatesConsidered,
    rejectedCandidates: input.rejectedCandidates,
    fallbackProvider: input.fallbackCandidate?.provider ?? null,
    fallbackModel: input.fallbackCandidate?.model ?? null,
    fallbackReason: input.fallbackReason
  };
}

function toCandidateSummary(
  modelConfig: ModelProviderModelConfig,
  options: ModelRouteOptions
): ModelRouteCandidateSummary {
  const providerEnabled =
    options.providerEnabledByName?.[modelConfig.provider] ??
    getModelProvider(modelConfig.provider)?.enabled ??
    false;
  const health =
    options.providerHealthByName?.[modelConfig.provider] ??
    getModelProviderHealth(modelConfig.provider);
  const cost = estimateModelProviderCost(modelConfig);

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
    enabledForExecution: providerEnabled && modelConfig.enabled,
    healthStatus: health.status,
    healthReason: health.reason,
    estimatedLatencyMs: health.estimatedLatencyMs,
    ...toCostSummary(cost),
    selected: false,
    reasonCodes: buildReasonCodes({
      modelConfig,
      health,
      cost
    })
  };
}

function toCostSummary(cost: ModelProviderCostMetadata) {
  return {
    inputCostPer1MTokensUsd: cost.inputCostPer1MTokensUsd,
    outputCostPer1MTokensUsd: cost.outputCostPer1MTokensUsd,
    estimatedInputTokens: cost.estimatedInputTokens,
    estimatedOutputTokens: cost.estimatedOutputTokens,
    estimatedCostUsd: cost.estimatedCostUsd
  };
}

function buildReasonCodes(input: {
  modelConfig: ModelProviderModelConfig;
  health: ModelProviderHealthMetadata;
  cost: ModelProviderCostMetadata;
}): string[] {
  const reasonCodes: string[] = [];

  if (input.health.status === "HEALTHY") {
    reasonCodes.push("PROVIDER_HEALTHY");
  }

  if (input.health.status === "DEGRADED") {
    reasonCodes.push("PROVIDER_DEGRADED");
  }

  if (input.health.status === "UNAVAILABLE") {
    reasonCodes.push("PROVIDER_UNAVAILABLE");
  }

  if (input.modelConfig.qualityTier === "HIGH") {
    reasonCodes.push("QUALITY_TARGET_HIGH");
  }

  if (input.modelConfig.costTier === "FREE" || input.modelConfig.costTier === "LOW") {
    reasonCodes.push("COST_EFFICIENT");
  }

  if (input.cost.estimatedCostUsd <= 0.005) {
    reasonCodes.push("COST_WITHIN_BUDGET");
  }

  if (input.health.estimatedLatencyMs <= 1000) {
    reasonCodes.push("LATENCY_WITHIN_TARGET");
  }

  return reasonCodes;
}

function buildSelectedReason(
  summary: ModelRouteCandidateSummary,
  preferredGoal: ModelRoutingGoal
): string {
  const goalPhrase =
    preferredGoal === "HIGH_QUALITY"
      ? "met the quality target"
      : preferredGoal === "LOW_LATENCY"
        ? "had the best latency profile"
        : preferredGoal === "LOCAL_ONLY"
          ? "matched the local-only routing constraint"
          : "kept estimated cost low";

  return `Selected ${summary.provider} / ${summary.model} because it ${goalPhrase} while considering provider health, estimated latency, estimated cost, and quality.`;
}

function buildRoutingFactors(
  summary: ModelRouteCandidateSummary,
  preferredGoal: ModelRoutingGoal
): string[] {
  return [
    `${summary.provider} health is ${summary.healthStatus}.`,
    `Estimated latency is ${summary.estimatedLatencyMs}ms.`,
    `Estimated request cost is $${summary.estimatedCostUsd.toFixed(6)}.`,
    `Quality tier is ${summary.qualityTier}.`,
    `Preferred routing goal is ${preferredGoal}.`
  ];
}

function markSelectedCandidate(
  candidates: ModelRouteCandidateSummary[],
  selectedCandidate: ModelRouteCandidateSummary
): ModelRouteCandidateSummary[] {
  return candidates.map((candidate) => ({
    ...candidate,
    selected:
      candidate.provider === selectedCandidate.provider &&
      candidate.model === selectedCandidate.model
  }));
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

function getHighQualityProviderRank(provider: ModelProviderName): number {
  const ranks: Record<ModelProviderName, number> = {
    ANTHROPIC: 0,
    OPENAI: 1,
    AZURE_OPENAI: 2,
    OLLAMA: 3,
    MOCK: 4
  };

  return ranks[provider];
}

function getHealthRank(healthStatus: ModelProviderHealthStatus): number {
  const ranks: Record<ModelProviderHealthStatus, number> = {
    HEALTHY: 0,
    DEGRADED: 1,
    UNAVAILABLE: 2
  };

  return ranks[healthStatus];
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
