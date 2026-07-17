import { describe, expect, it } from "vitest";

import { anthropicProvider } from "./providers/anthropic.provider.js";
import { azureOpenAiProvider } from "./providers/azure-openai.provider.js";
import { mockProvider } from "./providers/mock.provider.js";
import { ollamaProvider } from "./providers/ollama.provider.js";
import { openAiProvider } from "./providers/openai.provider.js";
import type {
  ModelProviderExecuteInput,
  ModelProviderName
} from "./model-provider.types.js";
import type {
  ModelProviderFetch,
  ModelProviderRuntimeConfig
} from "./model-provider-runtime-config.js";

const baseInput = {
  taskType: "INTAKE_PARSING",
  inputJson: {
    originalText: "TaylorMade Stealth 2 driver 10.5 stiff right handed"
  }
} satisfies Omit<ModelProviderExecuteInput, "model">;

function disabledConfig(): ModelProviderRuntimeConfig {
  return {
    enableRealModelCalls: false
  };
}

function enabledConfig(
  overrides: Partial<ModelProviderRuntimeConfig>
): ModelProviderRuntimeConfig {
  return {
    enableRealModelCalls: true,
    ...overrides
  };
}

function jsonFetch(body: unknown): ModelProviderFetch {
  return async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    async json() {
      return body;
    }
  });
}

function failingFetch(provider: ModelProviderName): ModelProviderFetch {
  return async () => {
    throw new Error(`${provider} fetch should not have been called`);
  };
}

describe("model provider adapters", () => {
  it("keeps the mock provider deterministic", async () => {
    const result = await mockProvider.execute({
      ...baseInput,
      model: "mock-golf-workflow-model"
    });

    expect(result.outputJson).toEqual({
      mock: true,
      provider: "MOCK",
      model: "mock-golf-workflow-model",
      taskType: "INTAKE_PARSING"
    });
  });

  it("does not call OpenAI when real model calls are disabled", async () => {
    await expect(
      openAiProvider.execute({
        ...baseInput,
        model: "gpt-4.1-mini",
        runtimeConfig: disabledConfig(),
        fetchFn: failingFetch("OPENAI")
      })
    ).rejects.toMatchObject({
      code: "MODEL_PROVIDER_NOT_CONFIGURED",
      provider: "OPENAI"
    });
  });

  it("does not call Anthropic when real model calls are disabled", async () => {
    await expect(
      anthropicProvider.execute({
        ...baseInput,
        model: "claude-3-5-sonnet",
        runtimeConfig: disabledConfig(),
        fetchFn: failingFetch("ANTHROPIC")
      })
    ).rejects.toMatchObject({
      code: "MODEL_PROVIDER_NOT_CONFIGURED",
      provider: "ANTHROPIC"
    });
  });

  it("does not call Azure OpenAI when real model calls are disabled", async () => {
    await expect(
      azureOpenAiProvider.execute({
        ...baseInput,
        model: "azure-gpt-4.1-mini",
        runtimeConfig: disabledConfig(),
        fetchFn: failingFetch("AZURE_OPENAI")
      })
    ).rejects.toMatchObject({
      code: "MODEL_PROVIDER_NOT_CONFIGURED",
      provider: "AZURE_OPENAI"
    });
  });

  it("does not call Ollama when real model calls are disabled", async () => {
    await expect(
      ollamaProvider.execute({
        ...baseInput,
        model: "llama3.1",
        runtimeConfig: disabledConfig(),
        fetchFn: failingFetch("OLLAMA")
      })
    ).rejects.toMatchObject({
      code: "MODEL_PROVIDER_NOT_CONFIGURED",
      provider: "OLLAMA"
    });
  });

  it("uses Responses with strict structured output and normalizes typed output items", async () => {
    const requests: {
      url: string;
      body: Record<string, unknown>;
    }[] = [];
    const result = await openAiProvider.execute({
      ...baseInput,
      model: "gpt-4.1-mini",
      outputSchema: {
        name: "inventory_record",
        version: "1.0.0",
        strict: true,
        schema: {
          type: "object",
          properties: {
            brand: { type: "string" },
            model: { type: "string" }
          },
          required: ["brand", "model"],
          additionalProperties: false
        }
      },
      runtimeConfig: enabledConfig({
        openAiApiKey: "test-openai-key"
      }),
      fetchFn: async (url, init) => {
        requests.push({
          url,
          body: JSON.parse(init.body) as Record<string, unknown>
        });

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          async json() {
            return {
              output: [
                {
                  type: "message",
                  status: "completed",
                  content: [
                    {
                      type: "output_text",
                      text:
                        "{\"brand\":\"TaylorMade\",\"model\":\"Stealth 2\"}"
                    }
                  ],
                  role: "assistant"
                }
              ],
              usage: {
                input_tokens: 20,
                output_tokens: 8,
                total_tokens: 28
              }
            };
          }
        };
      }
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      url: "https://api.openai.com/v1/responses",
      body: {
        model: "gpt-4.1-mini",
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "inventory_record",
            strict: true,
            schema: {
              type: "object",
              required: ["brand", "model"],
              additionalProperties: false
            }
          }
        }
      }
    });
    expect(requests[0]?.body.input).toEqual(
      expect.stringContaining("Task type: INTAKE_PARSING")
    );
    expect(result.outputJson).toMatchObject({
      provider: "OPENAI",
      model: "gpt-4.1-mini",
      taskType: "INTAKE_PARSING",
      parsedJson: {
        brand: "TaylorMade",
        model: "Stealth 2"
      }
    });
    expect(result.usage).toEqual({
      promptTokens: 20,
      completionTokens: 8,
      totalTokens: 28
    });
  });

  it("normalizes an injected Anthropic response without external network access", async () => {
    const result = await anthropicProvider.execute({
      ...baseInput,
      model: "claude-3-5-sonnet",
      runtimeConfig: enabledConfig({
        anthropicApiKey: "test-anthropic-key"
      }),
      fetchFn: jsonFetch({
        content: [
          {
            type: "text",
            text: "{\"category\":\"DRIVER\"}"
          }
        ],
        usage: {
          input_tokens: 15,
          output_tokens: 5
        }
      })
    });

    expect(result.outputJson).toMatchObject({
      provider: "ANTHROPIC",
      model: "claude-3-5-sonnet",
      parsedJson: {
        category: "DRIVER"
      }
    });
    expect(result.usage).toEqual({
      promptTokens: 15,
      completionTokens: 5,
      totalTokens: 20
    });
  });

  it("normalizes an injected Azure OpenAI response without external network access", async () => {
    const result = await azureOpenAiProvider.execute({
      ...baseInput,
      model: "azure-gpt-4.1-mini",
      runtimeConfig: enabledConfig({
        azureOpenAiApiKey: "test-azure-key",
        azureOpenAiEndpoint: "https://example-resource.openai.azure.com",
        azureOpenAiDeployment: "test-deployment"
      }),
      fetchFn: jsonFetch({
        choices: [
          {
            message: {
              content: "{\"dexterity\":\"RIGHT_HANDED\"}"
            }
          }
        ],
        usage: {
          prompt_tokens: 30,
          completion_tokens: 6,
          total_tokens: 36
        }
      })
    });

    expect(result.outputJson).toMatchObject({
      provider: "AZURE_OPENAI",
      model: "test-deployment",
      parsedJson: {
        dexterity: "RIGHT_HANDED"
      }
    });
    expect(result.usage).toEqual({
      promptTokens: 30,
      completionTokens: 6,
      totalTokens: 36
    });
  });

  it("normalizes an injected Ollama response without external network access", async () => {
    const result = await ollamaProvider.execute({
      ...baseInput,
      model: "llama3.1",
      runtimeConfig: enabledConfig({
        ollamaBaseUrl: "http://localhost:11434"
      }),
      fetchFn: jsonFetch({
        response: "{\"shaftFlex\":\"STIFF\"}"
      })
    });

    expect(result.outputJson).toMatchObject({
      provider: "OLLAMA",
      model: "llama3.1",
      parsedJson: {
        shaftFlex: "STIFF"
      }
    });
  });
});
