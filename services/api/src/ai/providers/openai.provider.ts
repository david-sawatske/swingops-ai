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
  async execute(input) {
    const config = input.runtimeConfig ?? getModelProviderRuntimeConfig();

    assertRealModelCallsEnabled({
      provider: "OPENAI",
      config,
      missingConfigHint: "Required env: OPENAI_API_KEY."
    });

    const apiKey = assertConfiguredString({
      provider: "OPENAI",
      value: config.openAiApiKey,
      envName: "OPENAI_API_KEY"
    });

    const model = config.openAiModel ?? input.model;
    const response = await getFetch(input.fetchFn)(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          response_format: {
            type: "json_object"
          },
          messages: [
            {
              role: "system",
              content:
                "You are a SwingOps AI provider adapter. Return valid JSON only."
            },
            {
              role: "user",
              content: buildProviderPrompt({
                ...input,
                model
              })
            }
          ]
        })
      }
    );

    await assertSuccessfulResponse({
      provider: "OPENAI",
      response
    });

    const body = readObject(await response.json(), "OPENAI");
    const choices = Array.isArray(body.choices) ? body.choices : [];
    const firstChoice = readObject(choices[0], "OPENAI");
    const message = readObject(firstChoice.message, "OPENAI");
    const text = typeof message.content === "string" ? message.content : "";
    const usage = body.usage && typeof body.usage === "object"
      ? (body.usage as {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        })
      : undefined;

    return normalizeTextModelOutput({
      provider: "OPENAI",
      model,
      taskType: input.taskType,
      text,
      ...(usage
        ? {
            usage: buildUsage({
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens
            })
          }
        : {})
    });
  }
};
