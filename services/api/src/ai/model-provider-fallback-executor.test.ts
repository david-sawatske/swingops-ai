import { describe, expect, it } from "vitest";

import { executeModelWithProviderFallback } from "./model-provider-fallback-executor.js";
import type {
  ModelProviderFetch,
  ModelProviderRuntimeConfig
} from "./model-provider-runtime-config.js";

const inputJson = {
  originalText: "TaylorMade Stealth 2 driver 10.5 stiff right handed"
};

function disabledConfig(): ModelProviderRuntimeConfig {
  return {
    enableRealModelCalls: false
  };
}

function enabledOpenAiConfig(): ModelProviderRuntimeConfig {
  return {
    enableRealModelCalls: true,
    openAiApiKey: "test-openai-key"
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
        error: "rate limited"
      };
    }
  });
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
      fetchFn: fetchShouldNotBeCalled()
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.provider).toBe("MOCK");
    expect(result.model).toBe("mock-golf-workflow-model");
    expect(result.outputJson).toMatchObject({
      mock: true,
      provider: "MOCK",
      model: "mock-golf-workflow-model",
      taskType: "INTAKE_PARSING"
    });

    expect(result.attempts.map((attempt) => attempt.provider)).toEqual([
      "OPENAI",
      "AZURE_OPENAI",
      "MOCK"
    ]);
    expect(result.attempts[0]).toMatchObject({
      provider: "OPENAI",
      model: "gpt-4.1-mini",
      attemptOrder: 1,
      status: "SKIPPED"
    });
    expect(result.attempts[0]?.errorMessage).toContain(
      "OPENAI real model calls are disabled"
    );
    expect(result.attempts[1]).toMatchObject({
      provider: "AZURE_OPENAI",
      model: "azure-gpt-4.1-mini",
      attemptOrder: 2,
      status: "SKIPPED"
    });
    expect(result.attempts[2]).toMatchObject({
      provider: "MOCK",
      model: "mock-golf-workflow-model",
      attemptOrder: 3,
      status: "SUCCESS",
      errorMessage: null
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
      fetchFn: rateLimitedFetch()
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.provider).toBe("MOCK");
    expect(result.attempts[0]).toMatchObject({
      provider: "OPENAI",
      model: "gpt-4.1-mini",
      attemptOrder: 1,
      status: "RATE_LIMITED"
    });
    expect(result.attempts[0]?.errorMessage).toContain("429 Too Many Requests");
    expect(result.attempts.at(-1)).toMatchObject({
      provider: "MOCK",
      status: "SUCCESS"
    });
  });
});
