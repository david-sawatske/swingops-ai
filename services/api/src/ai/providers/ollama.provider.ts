import type { ModelProviderAdapter } from "../model-provider.types.js";

export const ollamaProvider: ModelProviderAdapter = {
  provider: "OLLAMA",
  displayName: "Ollama",
  kind: "SELF_HOSTED",
  enabled: false,
  models: [
    {
      provider: "OLLAMA",
      model: "llama3.1",
      reason:
        "Local/self-hosted model option for privacy-sensitive or offline workflow execution.",
      supportedTaskTypes: [
        "INTAKE_PARSING",
        "FIELD_NORMALIZATION",
        "REVIEW_SUMMARY"
      ],
      supportsJson: true,
      costTier: "FREE",
      latencyTier: "HIGH",
      qualityTier: "MEDIUM",
      enabled: true
    }
  ],
  async execute() {
    throw new Error("Ollama provider adapter is registered but not implemented.");
  }
};
