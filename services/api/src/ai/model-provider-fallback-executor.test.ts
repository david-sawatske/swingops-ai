import { describe, expect, it } from "vitest";

import { executeModelWithProviderFallback } from "./model-provider-fallback-executor.js";
import type {
  ModelProviderFetch,
  ModelProviderRuntimeConfig,
} from "./model-provider-runtime-config.js";

const inputJson = {
  originalText: "TaylorMade Stealth 2 driver 10.5 stiff right handed",
};

function disabledConfig(): ModelProviderRuntimeConfig {
  return {
    enableRealModelCalls: false,
  };
}

function enabledOpenAiConfig(): ModelProviderRuntimeConfig {
  return {
    enableRealModelCalls: true,
    openAiApiKey: "test-openai-key",
  };
}

function fetchShouldNotBeCalled(): ModelProviderFetch {
  return async () => {
    throw new Error("Fetch should not have been called.");
  };
}

function rateLimitedFetch(): ModelProviderFetch {
  return async () => ({
    ok: false,
    status: 429,
    statusText: "Too Many Requests",
    async json() {
      return {
        error: "rate limited",
      };
    },
  });
}

function openAiJsonFetch(content: string): ModelProviderFetch {
  return async () => ({
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
                text: content,
              },
            ],
            role: "assistant",
          },
        ],
        usage: {
          input_tokens: 12,
          output_tokens: 8,
          total_tokens: 20,
        },
      };
    },
  });
}

function validateFieldRepairOutput(outputJson: Record<string, unknown> | null) {
  const parsedJson =
    outputJson &&
    typeof outputJson.parsedJson === "object" &&
    outputJson.parsedJson
      ? (outputJson.parsedJson as Record<string, unknown>)
      : outputJson;

  const suggestions = parsedJson?.suggestions;

  return {
    jsonValid: Boolean(parsedJson),
    validationPassed: Array.isArray(suggestions),
    validationErrors: Array.isArray(suggestions)
      ? []
      : ["suggestions must be an array"],
  };
}

describe("model provider fallback executor", () => {
  it("falls back from unconfigured hosted providers to the deterministic mock provider", async () => {
    const result = await executeModelWithProviderFallback({
      goal: "HIGH_QUALITY",
      taskType: "INTAKE_PARSING",
      requireJson: true,
      allowDisabledProvidersForSimulation: true,
      inputJson,
      runtimeConfig: disabledConfig(),
      fetchFn: fetchShouldNotBeCalled(),
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.provider).toBe("MOCK");
    expect(result.model).toBe("mock-golf-workflow-model");
    expect(result.outputJson).toMatchObject({
      mock: true,
      provider: "MOCK",
      model: "mock-golf-workflow-model",
      taskType: "INTAKE_PARSING",
    });

    expect(result.attempts.map((attempt) => attempt.provider)).toEqual([
      "OPENAI",
      "AZURE_OPENAI",
      "MOCK",
    ]);
    expect(result.attempts[0]).toMatchObject({
      provider: "OPENAI",
      model: "gpt-4.1-mini",
      attemptOrder: 1,
      status: "SKIPPED",
      failureClass: "CONFIGURATION",
      retryable: false,
    });
    expect(result.attempts[0]?.errorMessage).toContain(
      "OPENAI real model calls are disabled",
    );
    expect(result.attempts[1]).toMatchObject({
      provider: "AZURE_OPENAI",
      model: "azure-gpt-4.1-mini",
      attemptOrder: 2,
      status: "SKIPPED",
    });
    expect(result.attempts[2]).toMatchObject({
      provider: "MOCK",
      model: "mock-golf-workflow-model",
      attemptOrder: 3,
      status: "SUCCESS",
      errorMessage: null,
    });
  });

  it("records rate-limited provider attempts before falling back", async () => {
    const result = await executeModelWithProviderFallback({
      goal: "HIGH_QUALITY",
      taskType: "INTAKE_PARSING",
      requireJson: true,
      allowDisabledProvidersForSimulation: true,
      inputJson,
      runtimeConfig: enabledOpenAiConfig(),
      fetchFn: rateLimitedFetch(),
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.provider).toBe("MOCK");
    expect(result.attempts[0]).toMatchObject({
      provider: "OPENAI",
      model: "gpt-4.1-mini",
      attemptOrder: 1,
      status: "RATE_LIMITED",
      failureClass: "RATE_LIMIT",
      retryable: true,
    });
    expect(result.attempts[0]?.errorMessage).toContain("429 Too Many Requests");
    expect(result.attempts.at(-1)).toMatchObject({
      provider: "MOCK",
      status: "SUCCESS",
    });
  });

  it("uses OpenAI first when real calls and credentials are configured", async () => {
    const result = await executeModelWithProviderFallback({
      goal: "HIGH_QUALITY",
      taskType: "FIELD_NORMALIZATION",
      requireJson: true,
      inputJson: {
        policyKey: "MAIN_RUN_FIELD_REPAIR",
        records: [],
      },
      runtimeConfig: enabledOpenAiConfig(),
      fetchFn: openAiJsonFetch(
        JSON.stringify({
          suggestions: [],
        }),
      ),
      validateOutput: validateFieldRepairOutput,
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.provider).toBe("OPENAI");
    expect(result.model).toBe("gpt-4.1-mini");
    expect(result.usage).toMatchObject({
      promptTokens: 12,
      completionTokens: 8,
      totalTokens: 20,
    });
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({
      provider: "OPENAI",
      status: "SUCCESS",
      failureClass: "NONE",
      retryable: false,
    });
    expect(result.outputJson).toMatchObject({
      provider: "OPENAI",
      parsedJson: {
        suggestions: [],
      },
    });
  });

  it("falls back when OpenAI returns JSON that fails output validation", async () => {
    const result = await executeModelWithProviderFallback({
      goal: "HIGH_QUALITY",
      taskType: "FIELD_NORMALIZATION",
      requireJson: true,
      inputJson: {
        policyKey: "MAIN_RUN_FIELD_REPAIR",
        records: [
          {
            recordId: "record-1",
            sourceText: "Titleist TSR 3w Tensei s flex",
            missingFields: ["shaftFlex"],
          },
        ],
      },
      runtimeConfig: enabledOpenAiConfig(),
      fetchFn: openAiJsonFetch(
        JSON.stringify({
          notSuggestions: [],
        }),
      ),
      validateOutput: validateFieldRepairOutput,
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.provider).toBe("MOCK");
    expect(result.model).toBe("mock-golf-workflow-model");
    expect(result.attempts.map((attempt) => attempt.provider)).toEqual([
      "OPENAI",
      "MOCK",
    ]);
    expect(result.attempts[0]).toMatchObject({
      provider: "OPENAI",
      status: "FAILED",
      failureClass: "OUTPUT_VALIDATION",
      retryable: false,
    });
    expect(result.attempts[0]?.errorMessage).toContain(
      "Model output validation failed",
    );
    expect(result.attempts[0]?.errorMessage).toContain(
      "suggestions must be an array",
    );
    expect(result.attempts[1]).toMatchObject({
      provider: "MOCK",
      status: "SUCCESS",
    });
    expect(result.outputJson).toMatchObject({
      suggestions: [
        expect.objectContaining({
          fieldName: "shaftFlex",
          sourcePhrase: "s flex",
          candidateValue: "STIFF",
        }),
      ],
    });
  });

  it("aborts a timed-out provider attempt and continues with the fallback provider", async () => {
    let providerSignal: AbortSignal | undefined;
    const result = await executeModelWithProviderFallback({
      goal: "HIGH_QUALITY",
      taskType: "FIELD_NORMALIZATION",
      requireJson: true,
      inputJson: {
        policyKey: "MAIN_RUN_FIELD_REPAIR",
        records: [],
      },
      runtimeConfig: enabledOpenAiConfig(),
      attemptTimeoutMs: 10,
      workflowTimeoutMs: 100,
      fetchFn: async (_url, init) => {
        providerSignal = init.signal;

        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        });
      },
      validateOutput: validateFieldRepairOutput,
    });

    expect(providerSignal?.aborted).toBe(true);
    expect(result.status).toBe("SUCCEEDED");
    expect(result.provider).toBe("MOCK");
    expect(result.attempts[0]).toMatchObject({
      provider: "OPENAI",
      status: "TIMEOUT",
      failureClass: "TIMEOUT",
      retryable: true,
      timeoutMs: 10,
    });
    expect(result.attempts.at(-1)).toMatchObject({
      provider: "MOCK",
      status: "SUCCESS",
    });
    expect(result.deadline).toMatchObject({
      attemptTimeoutMs: 10,
      workflowTimeoutMs: 100,
      workflowDeadlineReached: false,
      cancelled: false,
    });
  });

  it("stops fallback execution when the provider workflow deadline is reached", async () => {
    const result = await executeModelWithProviderFallback({
      goal: "HIGH_QUALITY",
      taskType: "FIELD_NORMALIZATION",
      requireJson: true,
      inputJson: {
        policyKey: "MAIN_RUN_FIELD_REPAIR",
        records: [],
      },
      runtimeConfig: enabledOpenAiConfig(),
      attemptTimeoutMs: 100,
      workflowTimeoutMs: 10,
      fetchFn: async (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
      validateOutput: validateFieldRepairOutput,
    });

    expect(result.status).toBe("FAILED");
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({
      provider: "OPENAI",
      status: "TIMEOUT",
      failureClass: "TIMEOUT",
      retryable: true,
    });
    expect(result.deadline).toMatchObject({
      attemptTimeoutMs: 100,
      workflowTimeoutMs: 10,
      workflowDeadlineReached: true,
      cancelled: false,
    });
    expect(result.errorMessage).toContain(
      "Provider fallback workflow timed out",
    );
  });

  it("propagates caller cancellation and does not start another provider", async () => {
    const controller = new AbortController();
    const result = await executeModelWithProviderFallback({
      goal: "HIGH_QUALITY",
      taskType: "FIELD_NORMALIZATION",
      requireJson: true,
      inputJson: {
        policyKey: "MAIN_RUN_FIELD_REPAIR",
        records: [],
      },
      runtimeConfig: enabledOpenAiConfig(),
      signal: controller.signal,
      attemptTimeoutMs: 100,
      workflowTimeoutMs: 200,
      fetchFn: async (_url, init) => {
        queueMicrotask(() => controller.abort());

        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        });
      },
      validateOutput: validateFieldRepairOutput,
    });

    expect(result.status).toBe("FAILED");
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({
      provider: "OPENAI",
      failureClass: "CANCELLED",
      retryable: false,
    });
    expect(result.deadline.cancelled).toBe(true);
    expect(result.errorMessage).toBe(
      "Provider execution was cancelled by the caller.",
    );
  });
});
