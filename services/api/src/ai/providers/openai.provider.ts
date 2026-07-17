import type {
  ModelProviderAdapter,
  ModelProviderExecuteInput
} from "../model-provider.types.js";
import {
  assertConfiguredString,
  assertRealModelCallsEnabled,
  assertSuccessfulResponse,
  buildProviderPrompt,
  buildUsage,
  getFetch,
  getModelProviderRuntimeConfig,
  normalizeTextModelOutput,
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
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          store: false,
          instructions:
            "You are a SwingOps AI provider adapter. Return JSON matching the requested output format.",
          input: buildProviderPrompt({
            ...input,
            model
          }),
          text: {
            format: buildOpenAiTextFormat(input)
          }
        })
      }
    );

    await assertSuccessfulResponse({
      provider: "OPENAI",
      response
    });

    const body = readObject(await response.json(), "OPENAI");
    const text = readOpenAiResponseText(body);
    const usage =
      body.usage && typeof body.usage === "object" && !Array.isArray(body.usage)
        ? (body.usage as {
            input_tokens?: number;
            output_tokens?: number;
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
              promptTokens: usage.input_tokens,
              completionTokens: usage.output_tokens,
              totalTokens: usage.total_tokens
            })
          }
        : {})
    });
  }
};

function buildOpenAiTextFormat(
  input: ModelProviderExecuteInput
): Record<string, unknown> {
  if (!input.outputSchema) {
    return {
      type: "json_object"
    };
  }

  return {
    type: "json_schema",
    name: input.outputSchema.name,
    schema: input.outputSchema.schema,
    strict: input.outputSchema.strict
  };
}

function readOpenAiResponseText(
  body: Record<string, unknown>
): string {
  if (typeof body.output_text === "string") {
    return body.output_text;
  }

  const outputItems = Array.isArray(body.output) ? body.output : [];

  for (const outputItem of outputItems) {
    if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (
        isRecord(contentItem) &&
        contentItem.type === "output_text" &&
        typeof contentItem.text === "string"
      ) {
        return contentItem.text;
      }
    }
  }

  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
