import type { ModelProviderAdapter } from "../model-provider.types.js";
import {
  assertConfiguredString,
  assertRealModelCallsEnabled,
  assertSuccessfulResponse,
  buildProviderPrompt,
  getFetch,
  getModelProviderRuntimeConfig,
  normalizeTextModelOutput,
  buildUsage,
  readObject
} from "../model-provider-runtime-config.js";

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
  async execute(input) {
    const config = input.runtimeConfig ?? getModelProviderRuntimeConfig();

    assertRealModelCallsEnabled({
      provider: "ANTHROPIC",
      config,
      missingConfigHint: "Required env: ANTHROPIC_API_KEY."
    });

    const apiKey = assertConfiguredString({
      provider: "ANTHROPIC",
      value: config.anthropicApiKey,
      envName: "ANTHROPIC_API_KEY"
    });

    const model = config.anthropicModel ?? input.model;
    const response = await getFetch(input.fetchFn)("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: "You are a SwingOps AI provider adapter. Return valid JSON only.",
        messages: [
          {
            role: "user",
            content: buildProviderPrompt({
              ...input,
              model
            })
          }
        ]
      })
    });

    await assertSuccessfulResponse({
      provider: "ANTHROPIC",
      response
    });

    const body = readObject(await response.json(), "ANTHROPIC");
    const content = Array.isArray(body.content) ? body.content : [];
    const firstContent = readObject(content[0], "ANTHROPIC");
    const text = typeof firstContent.text === "string" ? firstContent.text : "";
    const usage = body.usage && typeof body.usage === "object"
      ? (body.usage as {
          input_tokens?: number;
          output_tokens?: number;
        })
      : undefined;

    return normalizeTextModelOutput({
      provider: "ANTHROPIC",
      model,
      taskType: input.taskType,
      text,
      ...(usage
        ? {
            usage: buildUsage({
              promptTokens: usage.input_tokens,
              completionTokens: usage.output_tokens,
              totalTokens:
                typeof usage.input_tokens === "number" &&
                typeof usage.output_tokens === "number"
                  ? usage.input_tokens + usage.output_tokens
                  : undefined
            })
          }
        : {})
    });
  }
};
