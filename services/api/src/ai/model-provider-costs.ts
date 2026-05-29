import type {
  ModelProviderModelConfig,
  ModelProviderName
} from "./model-provider.types.js";

export type ModelProviderCostMetadata = {
  provider: ModelProviderName;
  model: string;
  inputCostPer1MTokensUsd: number;
  outputCostPer1MTokensUsd: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
};

const defaultTokenEstimate = {
  estimatedInputTokens: 1200,
  estimatedOutputTokens: 450
};

const costByProviderAndModel: Record<
  string,
  Pick<
    ModelProviderCostMetadata,
    "inputCostPer1MTokensUsd" | "outputCostPer1MTokensUsd"
  >
> = {
  "MOCK:mock-golf-workflow-model": {
    inputCostPer1MTokensUsd: 0,
    outputCostPer1MTokensUsd: 0
  },
  "OPENAI:gpt-4.1-mini": {
    inputCostPer1MTokensUsd: 0.4,
    outputCostPer1MTokensUsd: 1.6
  },
  "ANTHROPIC:claude-3-5-sonnet": {
    inputCostPer1MTokensUsd: 3,
    outputCostPer1MTokensUsd: 15
  },
  "AZURE_OPENAI:azure-gpt-4.1-mini": {
    inputCostPer1MTokensUsd: 0.45,
    outputCostPer1MTokensUsd: 1.8
  },
  "OLLAMA:llama3.1": {
    inputCostPer1MTokensUsd: 0,
    outputCostPer1MTokensUsd: 0
  }
};

export function estimateModelProviderCost(
  modelConfig: ModelProviderModelConfig
): ModelProviderCostMetadata {
  const costKey = `${modelConfig.provider}:${modelConfig.model}`;
  const unitCosts = costByProviderAndModel[costKey] ?? {
    inputCostPer1MTokensUsd: 1,
    outputCostPer1MTokensUsd: 3
  };

  const estimatedInputTokens = defaultTokenEstimate.estimatedInputTokens;
  const estimatedOutputTokens = defaultTokenEstimate.estimatedOutputTokens;
  const estimatedCostUsd =
    (estimatedInputTokens / 1_000_000) * unitCosts.inputCostPer1MTokensUsd +
    (estimatedOutputTokens / 1_000_000) * unitCosts.outputCostPer1MTokensUsd;

  return {
    provider: modelConfig.provider,
    model: modelConfig.model,
    ...unitCosts,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6))
  };
}
