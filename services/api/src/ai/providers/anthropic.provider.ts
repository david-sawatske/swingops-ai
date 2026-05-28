import type { ModelProviderAdapter } from "../model-provider.types.js";

export const anthropicProvider: ModelProviderAdapter = {
  provider: "ANTHROPIC",
  displayName: "Anthropic",
  kind: "HOSTED_API",
  enabled: false,
  models: [
    {
      provider: "ANTHROPIC",
      model: "claude-3-5-sonnet",
      reason:
        "Higher-quality hosted model option for ambiguous messy trade-in interpretation.",
      supportedTaskTypes: [
        "INTAKE_PARSING",
        "FIELD_NORMALIZATION",
        "VALIDATION",
        "REVIEW_SUMMARY"
      ],
      supportsJson: true,
      costTier: "HIGH",
      latencyTier: "MEDIUM",
      qualityTier: "HIGH",
      enabled: true
    }
  ],
  async execute() {
    throw new Error("Anthropic provider adapter is registered but not implemented.");
  }
};
