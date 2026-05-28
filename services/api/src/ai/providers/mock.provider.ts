import type { ModelProviderAdapter } from "../model-provider.types.js";

export const mockProvider: ModelProviderAdapter = {
  provider: "MOCK",
  displayName: "Mock Provider",
  kind: "MOCK",
  enabled: true,
  models: [
    {
      provider: "MOCK",
      model: "mock-golf-workflow-model",
      reason:
        "Default mock model for local workflow development without external AI calls.",
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
      enabled: true
    }
  ],
  async execute(input) {
    return {
      outputJson: {
        mock: true,
        provider: "MOCK",
        model: input.model,
        taskType: input.taskType
      }
    };
  }
};
