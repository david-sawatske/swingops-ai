import type {
  ModelProviderExecuteInput,
  ModelProviderExecuteResult,
  ModelProviderName
} from "./model-provider.types.js";
import { ModelProviderAdapterError } from "./model-provider-errors.js";

export type ModelProviderRuntimeConfig = {
  enableRealModelCalls: boolean;
  openAiApiKey?: string;
  openAiModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  azureOpenAiApiKey?: string;
  azureOpenAiEndpoint?: string;
  azureOpenAiDeployment?: string;
  azureOpenAiApiVersion?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
};

export type ModelProviderFetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
};

export type ModelProviderFetch = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  }
) => Promise<ModelProviderFetchResponse>;

type RuntimeEnv = Partial<Record<string, string | undefined>>;

export function getModelProviderRuntimeConfig(
  env: RuntimeEnv = process.env
): ModelProviderRuntimeConfig {
  const config: ModelProviderRuntimeConfig = {
    enableRealModelCalls: env.ENABLE_REAL_MODEL_CALLS === "true"
  };

  if (env.OPENAI_API_KEY !== undefined) {
    config.openAiApiKey = env.OPENAI_API_KEY;
  }

  if (env.OPENAI_MODEL !== undefined) {
    config.openAiModel = env.OPENAI_MODEL;
  }

  if (env.ANTHROPIC_API_KEY !== undefined) {
    config.anthropicApiKey = env.ANTHROPIC_API_KEY;
  }

  if (env.ANTHROPIC_MODEL !== undefined) {
    config.anthropicModel = env.ANTHROPIC_MODEL;
  }

  if (env.AZURE_OPENAI_API_KEY !== undefined) {
    config.azureOpenAiApiKey = env.AZURE_OPENAI_API_KEY;
  }

  if (env.AZURE_OPENAI_ENDPOINT !== undefined) {
    config.azureOpenAiEndpoint = env.AZURE_OPENAI_ENDPOINT;
  }

  if (env.AZURE_OPENAI_DEPLOYMENT !== undefined) {
    config.azureOpenAiDeployment = env.AZURE_OPENAI_DEPLOYMENT;
  }

  if (env.AZURE_OPENAI_API_VERSION !== undefined) {
    config.azureOpenAiApiVersion = env.AZURE_OPENAI_API_VERSION;
  }

  if (env.OLLAMA_BASE_URL !== undefined) {
    config.ollamaBaseUrl = env.OLLAMA_BASE_URL;
  }

  if (env.OLLAMA_MODEL !== undefined) {
    config.ollamaModel = env.OLLAMA_MODEL;
  }

  return config;
}

export function assertRealModelCallsEnabled(input: {
  provider: ModelProviderName;
  config: ModelProviderRuntimeConfig;
  missingConfigHint: string;
}): void {
  if (!input.config.enableRealModelCalls) {
    throw new ModelProviderAdapterError({
      code: "MODEL_PROVIDER_NOT_CONFIGURED",
      provider: input.provider,
      message:
        `${input.provider} real model calls are disabled. ` +
        "Set ENABLE_REAL_MODEL_CALLS=true and configure provider credentials. " +
        input.missingConfigHint
    });
  }
}

export function assertConfiguredString(input: {
  provider: ModelProviderName;
  value: string | undefined;
  envName: string;
}): string {
  if (!input.value) {
    throw new ModelProviderAdapterError({
      code: "MODEL_PROVIDER_NOT_CONFIGURED",
      provider: input.provider,
      message: `${input.provider} adapter is not configured. Missing ${input.envName}.`
    });
  }

  return input.value;
}

export function getFetch(fetchFn?: ModelProviderFetch): ModelProviderFetch {
  if (fetchFn) {
    return fetchFn;
  }

  return fetch as unknown as ModelProviderFetch;
}

export function buildProviderPrompt(input: ModelProviderExecuteInput): string {
  return [
    `Task type: ${input.taskType}`,
    `Model: ${input.model}`,
    "Return a compact JSON object only.",
    "Input JSON:",
    JSON.stringify(input.inputJson, null, 2)
  ].join("\n");
}

export function buildUsage(input: {
  promptTokens?: number | undefined;
  completionTokens?: number | undefined;
  totalTokens?: number | undefined;
}): ModelProviderExecuteResult["usage"] | undefined {
  const usage: ModelProviderExecuteResult["usage"] = {};

  if (input.promptTokens !== undefined) {
    usage.promptTokens = input.promptTokens;
  }

  if (input.completionTokens !== undefined) {
    usage.completionTokens = input.completionTokens;
  }

  if (input.totalTokens !== undefined) {
    usage.totalTokens = input.totalTokens;
  }

  return Object.keys(usage).length > 0 ? usage : undefined;
}

export function normalizeTextModelOutput(input: {
  provider: ModelProviderName;
  model: string;
  taskType: string;
  text: string;
  usage?: ModelProviderExecuteResult["usage"];
}): ModelProviderExecuteResult {
  return {
    outputJson: {
      provider: input.provider,
      model: input.model,
      taskType: input.taskType,
      text: input.text,
      parsedJson: parseJsonObject(input.text)
    },
    ...(input.usage ? { usage: input.usage } : {})
  };
}

export async function assertSuccessfulResponse(input: {
  provider: ModelProviderName;
  response: ModelProviderFetchResponse;
}): Promise<void> {
  if (input.response.ok) {
    return;
  }

  throw new ModelProviderAdapterError({
    code: "MODEL_PROVIDER_REQUEST_FAILED",
    provider: input.provider,
    statusCode: input.response.status,
    message:
      `${input.provider} adapter request failed with ` +
      `${input.response.status} ${input.response.statusText}.`
  });
}

export function readObject(value: unknown, provider: ModelProviderName): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ModelProviderAdapterError({
      code: "MODEL_PROVIDER_INVALID_RESPONSE",
      provider,
      message: `${provider} provider returned a non-object JSON response.`
    });
  }

  return value as Record<string, unknown>;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return null;
  } catch {
    return null;
  }
}

