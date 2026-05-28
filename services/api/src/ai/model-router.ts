export type ModelProvider =
  | "MOCK"
  | "OPENAI"
  | "ANTHROPIC"
  | "AZURE_OPENAI"
  | "OLLAMA";

export type ModelRoutingGoal =
  | "LOW_COST"
  | "LOW_LATENCY"
  | "HIGH_QUALITY"
  | "LOCAL_ONLY";

export type ModelRouteRequest = {
  goal: ModelRoutingGoal;
  taskType:
    | "INTAKE_PARSING"
    | "FIELD_NORMALIZATION"
    | "VALIDATION"
    | "REVIEW_SUMMARY";
};

export type ModelRouteDecision = {
  provider: ModelProvider;
  model: string;
  reason: string;
  estimatedCostTier: "FREE" | "LOW" | "MEDIUM" | "HIGH";
  expectedLatencyTier: "LOW" | "MEDIUM" | "HIGH";
  qualityTier: "LOW" | "MEDIUM" | "HIGH";
};

type ModelOption = ModelRouteDecision & {
  supportedTaskTypes: ModelRouteRequest["taskType"][];
};

const mockFallbackDecision: ModelRouteDecision = {
  provider: "MOCK",
  model: "mock-golf-workflow-model",
  reason: "Fallback mock model for local workflow development.",
  estimatedCostTier: "FREE",
  expectedLatencyTier: "LOW",
  qualityTier: "LOW",
};

const modelOptions: ModelOption[] = [
  {
    provider: "MOCK",
    model: "mock-golf-workflow-model",
    reason:
      "Default mock model for local workflow development without external AI calls.",
    estimatedCostTier: "FREE",
    expectedLatencyTier: "LOW",
    qualityTier: "LOW",
    supportedTaskTypes: [
      "INTAKE_PARSING",
      "FIELD_NORMALIZATION",
      "VALIDATION",
      "REVIEW_SUMMARY",
    ],
  },
  {
    provider: "OPENAI",
    model: "gpt-4.1-mini",
    reason:
      "Low-cost hosted model option for structured extraction and validation tasks.",
    estimatedCostTier: "LOW",
    expectedLatencyTier: "MEDIUM",
    qualityTier: "MEDIUM",
    supportedTaskTypes: [
      "INTAKE_PARSING",
      "FIELD_NORMALIZATION",
      "VALIDATION",
      "REVIEW_SUMMARY",
    ],
  },
  {
    provider: "ANTHROPIC",
    model: "claude-3-5-sonnet",
    reason:
      "Higher-quality hosted model option for ambiguous messy trade-in interpretation.",
    estimatedCostTier: "HIGH",
    expectedLatencyTier: "MEDIUM",
    qualityTier: "HIGH",
    supportedTaskTypes: [
      "INTAKE_PARSING",
      "FIELD_NORMALIZATION",
      "VALIDATION",
      "REVIEW_SUMMARY",
    ],
  },
  {
    provider: "AZURE_OPENAI",
    model: "azure-gpt-4.1-mini",
    reason:
      "Enterprise-hosted model option for organizations standardized on Azure OpenAI.",
    estimatedCostTier: "MEDIUM",
    expectedLatencyTier: "MEDIUM",
    qualityTier: "MEDIUM",
    supportedTaskTypes: [
      "INTAKE_PARSING",
      "FIELD_NORMALIZATION",
      "VALIDATION",
      "REVIEW_SUMMARY",
    ],
  },
  {
    provider: "OLLAMA",
    model: "llama3.1",
    reason:
      "Local/self-hosted model option for privacy-sensitive or offline workflow execution.",
    estimatedCostTier: "FREE",
    expectedLatencyTier: "HIGH",
    qualityTier: "MEDIUM",
    supportedTaskTypes: [
      "INTAKE_PARSING",
      "FIELD_NORMALIZATION",
      "REVIEW_SUMMARY",
    ],
  },
];

export function routeModel(request: ModelRouteRequest): ModelRouteDecision {
  const candidates = modelOptions.filter((option) =>
    option.supportedTaskTypes.includes(request.taskType),
  );

  if (candidates.length === 0) {
    return {
      ...mockFallbackDecision,
      reason: `Fallback mock model because no configured model supports ${request.taskType}.`,
    };
  }

  if (request.goal === "LOW_COST") {
    return selectFirstByPreference(
      candidates,
      ["FREE", "LOW", "MEDIUM", "HIGH"],
      "estimatedCostTier",
    );
  }

  if (request.goal === "LOW_LATENCY") {
    return selectFirstByPreference(
      candidates,
      ["LOW", "MEDIUM", "HIGH"],
      "expectedLatencyTier",
    );
  }

  if (request.goal === "HIGH_QUALITY") {
    return selectFirstByPreference(
      candidates,
      ["HIGH", "MEDIUM", "LOW"],
      "qualityTier",
    );
  }

  if (request.goal === "LOCAL_ONLY") {
    const localModel = candidates.find(
      (candidate) => candidate.provider === "OLLAMA",
    );

    if (localModel) {
      return localModel;
    }

    return {
      ...mockFallbackDecision,
      reason: `Fallback mock model because no local model supports ${request.taskType}.`,
    };
  }

  return firstCandidateOrFallback(candidates);
}

function selectFirstByPreference<TValue extends string>(
  candidates: ModelOption[],
  preferenceOrder: TValue[],
  field: keyof Pick<
    ModelOption,
    "estimatedCostTier" | "expectedLatencyTier" | "qualityTier"
  >,
): ModelRouteDecision {
  for (const preferredValue of preferenceOrder) {
    const match = candidates.find(
      (candidate) => candidate[field] === preferredValue,
    );

    if (match) {
      return match;
    }
  }

  return firstCandidateOrFallback(candidates);
}

function firstCandidateOrFallback(
  candidates: ModelOption[],
): ModelRouteDecision {
  return candidates[0] ?? mockFallbackDecision;
}
