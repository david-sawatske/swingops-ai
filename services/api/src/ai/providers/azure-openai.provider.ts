import type { ModelProviderAdapter } from "../model-provider.types.js";

export const azureOpenAiProvider: ModelProviderAdapter = {
  provider: "AZURE_OPENAI",
  displayName: "Azure OpenAI",
  kind: "HOSTED_API",
  enabled: false,
  models: [
    {
      provider: "AZURE_OPENAI",
      model: "azure-gpt-4.1-mini",
      reason:
        "Enterprise-hosted model option for organizations standardized on Azure OpenAI.",
      supportedTaskTypes: [
        "INTAKE_PARSING",
        "FIELD_NORMALIZATION",
        "VALIDATION",
        "REVIEW_SUMMARY"
      ],
      supportsJson: true,
      costTier: "MEDIUM",
      latencyTier: "MEDIUM",
      qualityTier: "MEDIUM",
      enabled: true
    }
  ],
  async execute() {
    throw new Error(
      "Azure OpenAI provider adapter is registered but not implemented."
    );
  }
};
