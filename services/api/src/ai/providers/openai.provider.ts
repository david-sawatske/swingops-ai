import type { ModelProviderAdapter } from "../model-provider.types.js";

export const openAiProvider: ModelProviderAdapter = {
  provider: "OPENAI",
  displayName: "OpenAI",
  kind: "HOSTED_API",
  enabled: false,
  models: [
    {
      provider: "OPENAI",
      model: "gpt-4.1-mini",
      reason:
        "Low-cost hosted model option for structured extraction and validation tasks.",
      supportedTaskTypes: [
        "INTAKE_PARSING",
        "FIELD_NORMALIZATION",
        "VALIDATION",
        "REVIEW_SUMMARY"
      ],
      supportsJson: true,
      costTier: "LOW",
      latencyTier: "MEDIUM",
      qualityTier: "MEDIUM",
      enabled: true
    }
  ],
  async execute() {
    throw new Error("OpenAI provider adapter is registered but not implemented.");
  }
};
