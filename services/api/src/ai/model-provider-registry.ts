import type {
  ModelCostTier,
  ModelLatencyTier,
  ModelProviderAdapter,
  ModelProviderModelConfig,
  ModelProviderName,
  ModelQualityTier,
  ModelTaskType
} from "./model-provider.types.js";
import { anthropicProvider } from "./providers/anthropic.provider.js";
import { azureOpenAiProvider } from "./providers/azure-openai.provider.js";
import { mockProvider } from "./providers/mock.provider.js";
import { ollamaProvider } from "./providers/ollama.provider.js";
import { openAiProvider } from "./providers/openai.provider.js";

export type ModelProviderRegistryFilter = {
  provider?: ModelProviderName;
  taskType?: ModelTaskType;
  supportsJson?: boolean;
  enabled?: boolean;
  costTier?: ModelCostTier;
  latencyTier?: ModelLatencyTier;
  qualityTier?: ModelQualityTier;
};

const registeredProviders: ModelProviderAdapter[] = [
  mockProvider,
  openAiProvider,
  anthropicProvider,
  azureOpenAiProvider,
  ollamaProvider
];

export function listModelProviders(): ModelProviderAdapter[] {
  return registeredProviders.map((provider) => ({
    ...provider,
    models: provider.models.map((model) => ({ ...model }))
  }));
}

export function getModelProvider(
  providerName: ModelProviderName
): ModelProviderAdapter | null {
  const provider = registeredProviders.find(
    (registeredProvider) => registeredProvider.provider === providerName
  );

  if (!provider) {
    return null;
  }

  return {
    ...provider,
    models: provider.models.map((model) => ({ ...model }))
  };
}

export function listModelConfigs(
  filter: ModelProviderRegistryFilter = {}
): ModelProviderModelConfig[] {
  return registeredProviders
    .flatMap((provider) =>
      provider.models.map((model) => ({
        providerEnabled: provider.enabled,
        model
      }))
    )
    .filter(({ providerEnabled, model }) => {
      if (filter.provider && model.provider !== filter.provider) {
        return false;
      }

      if (filter.taskType && !model.supportedTaskTypes.includes(filter.taskType)) {
        return false;
      }

      if (
        filter.supportsJson !== undefined &&
        model.supportsJson !== filter.supportsJson
      ) {
        return false;
      }

      if (filter.enabled !== undefined) {
        const isEnabled = providerEnabled && model.enabled;

        if (isEnabled !== filter.enabled) {
          return false;
        }
      }

      if (filter.costTier && model.costTier !== filter.costTier) {
        return false;
      }

      if (filter.latencyTier && model.latencyTier !== filter.latencyTier) {
        return false;
      }

      if (filter.qualityTier && model.qualityTier !== filter.qualityTier) {
        return false;
      }

      return true;
    })
    .map(({ model }) => ({ ...model }));
}

export function getModelConfig(input: {
  provider: ModelProviderName;
  model: string;
}): ModelProviderModelConfig | null {
  const config = listModelConfigs({
    provider: input.provider
  }).find((modelConfig) => modelConfig.model === input.model);

  return config ?? null;
}
