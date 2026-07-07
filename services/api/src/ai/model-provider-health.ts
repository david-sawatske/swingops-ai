import type { ModelProviderName } from "./model-provider.types.js";

export type ModelProviderHealthStatus =
  | "HEALTHY"
  | "DEGRADED"
  | "UNAVAILABLE";

export type ModelProviderHealthMetadata = {
  provider: ModelProviderName;
  status: ModelProviderHealthStatus;
  estimatedLatencyMs: number;
  reason: string;
};

const providerHealthByName: Record<
  ModelProviderName,
  ModelProviderHealthMetadata
> = {
  MOCK: {
    provider: "MOCK",
    status: "HEALTHY",
    estimatedLatencyMs: 75,
    reason: "Local deterministic mock provider is available for development."
  },
  OPENAI: {
    provider: "OPENAI",
    status: "HEALTHY",
    estimatedLatencyMs: 650,
    reason: "Hosted OpenAI route is healthy in the local simulation."
  },
  ANTHROPIC: {
    provider: "ANTHROPIC",
    status: "DEGRADED",
    estimatedLatencyMs: 1250,
    reason: "Anthropic is intentionally marked degraded to demonstrate fallback routing."
  },
  AZURE_OPENAI: {
    provider: "AZURE_OPENAI",
    status: "HEALTHY",
    estimatedLatencyMs: 800,
    reason: "Azure OpenAI route is healthy and available as an enterprise fallback."
  },
  OLLAMA: {
    provider: "OLLAMA",
    status: "HEALTHY",
    estimatedLatencyMs: 450,
    reason: "Local/self-hosted Ollama route is healthy for privacy-sensitive tasks."
  }
};

export function getModelProviderHealth(
  provider: ModelProviderName
): ModelProviderHealthMetadata {
  return { ...providerHealthByName[provider] };
}
