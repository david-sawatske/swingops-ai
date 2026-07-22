import { describe, expect, it } from "vitest";

import { getModelProviderRuntimeConfig } from "./model-provider-runtime-config.js";

describe("model provider runtime config", () => {
  it("reads positive provider deadline values", () => {
    expect(
      getModelProviderRuntimeConfig({
        MODEL_PROVIDER_ATTEMPT_TIMEOUT_MS: "7500",
        MODEL_PROVIDER_WORKFLOW_TIMEOUT_MS: "18000",
      }),
    ).toMatchObject({
      providerAttemptTimeoutMs: 7500,
      providerWorkflowTimeoutMs: 18000,
    });
  });

  it("ignores invalid provider deadline values", () => {
    expect(
      getModelProviderRuntimeConfig({
        MODEL_PROVIDER_ATTEMPT_TIMEOUT_MS: "0",
        MODEL_PROVIDER_WORKFLOW_TIMEOUT_MS: "not-a-number",
      }),
    ).toEqual({
      enableRealModelCalls: false,
    });
  });
});
