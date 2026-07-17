import type {
  ModelProviderFetch,
  ModelProviderRuntimeConfig
} from "./model-provider-runtime-config.js";

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

export type ModelCostTier = "FREE" | "LOW" | "MEDIUM" | "HIGH";

export type ModelLatencyTier = "LOW" | "MEDIUM" | "HIGH";

export type ModelQualityTier = "LOW" | "MEDIUM" | "HIGH";

export type ModelProviderKind = "MOCK" | "HOSTED_API" | "SELF_HOSTED";

export type ModelProviderModelConfig = {
  provider: ModelProviderName;
  model: string;
  supportedTaskTypes: ModelTaskType[];
  supportsJson: boolean;
  costTier: ModelCostTier;
  latencyTier: ModelLatencyTier;
  qualityTier: ModelQualityTier;
  enabled: boolean;
  reason: string;
};

export type ModelProviderOutputSchema = {
  name: string;
  version: string;
  strict: boolean;
  schema: Record<string, unknown>;
};

export type ModelProviderAdapter = {
  provider: ModelProviderName;
  displayName: string;
  kind: ModelProviderKind;
  enabled: boolean;
  models: ModelProviderModelConfig[];
  execute: (input: ModelProviderExecuteInput) => Promise<ModelProviderExecuteResult>;
};

export type ModelProviderExecuteInput = {
  model: string;
  taskType: ModelTaskType;
  inputJson: Record<string, unknown>;
  outputSchema?: ModelProviderOutputSchema;
  runtimeConfig?: ModelProviderRuntimeConfig;
  fetchFn?: ModelProviderFetch;
};

export type ModelProviderExecuteResult = {
  outputJson: Record<string, unknown>;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};
