import type { ModelProviderAdapter } from "../model-provider.types.js";
import {
  assertConfiguredString,
  assertRealModelCallsEnabled,
  assertSuccessfulResponse,
  buildProviderPrompt,
  getFetch,
  getModelProviderRuntimeConfig,
  normalizeTextModelOutput,
  readObject
} from "../model-provider-runtime-config.js";

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
  async execute(input) {
    const config = input.runtimeConfig ?? getModelProviderRuntimeConfig();

    assertRealModelCallsEnabled({
      provider: "OLLAMA",
      config,
      missingConfigHint: "Required env: OLLAMA_BASE_URL."
    });

    const baseUrl = assertConfiguredString({
      provider: "OLLAMA",
      value: config.ollamaBaseUrl,
      envName: "OLLAMA_BASE_URL"
    }).replace(/\/$/, "");
    const model = config.ollamaModel ?? input.model;

    const response = await getFetch(input.fetchFn)(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt: buildProviderPrompt({
          ...input,
          model
        }),
        stream: false,
        format: "json"
      })
    });

    await assertSuccessfulResponse({
      provider: "OLLAMA",
      response
    });

    const body = readObject(await response.json(), "OLLAMA");
    const text = typeof body.response === "string" ? body.response : "";

    return normalizeTextModelOutput({
      provider: "OLLAMA",
      model,
      taskType: input.taskType,
      text
    });
  }
};
