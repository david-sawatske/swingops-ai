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
  async execute(input) {
    const config = input.runtimeConfig ?? getModelProviderRuntimeConfig();

    assertRealModelCallsEnabled({
      provider: "AZURE_OPENAI",
      config,
      missingConfigHint:
        "Required env: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT."
    });

    const apiKey = assertConfiguredString({
      provider: "AZURE_OPENAI",
      value: config.azureOpenAiApiKey,
      envName: "AZURE_OPENAI_API_KEY"
    });
    const endpoint = assertConfiguredString({
      provider: "AZURE_OPENAI",
      value: config.azureOpenAiEndpoint,
      envName: "AZURE_OPENAI_ENDPOINT"
    }).replace(/\/$/, "");
    const deployment = assertConfiguredString({
      provider: "AZURE_OPENAI",
      value: config.azureOpenAiDeployment,
      envName: "AZURE_OPENAI_DEPLOYMENT"
    });
    const apiVersion = config.azureOpenAiApiVersion ?? "2024-02-15-preview";
    const model = config.azureOpenAiDeployment ?? input.model;

    const response = await getFetch(input.fetchFn)(
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
      {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
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
      provider: "AZURE_OPENAI",
      response
    });

    const body = readObject(await response.json(), "AZURE_OPENAI");
    const choices = Array.isArray(body.choices) ? body.choices : [];
    const firstChoice = readObject(choices[0], "AZURE_OPENAI");
    const message = readObject(firstChoice.message, "AZURE_OPENAI");
    const text = typeof message.content === "string" ? message.content : "";
    const usage = body.usage && typeof body.usage === "object"
      ? (body.usage as {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        })
      : undefined;

    return normalizeTextModelOutput({
      provider: "AZURE_OPENAI",
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
