import { describe, expect, it } from "vitest";

import type {
  ExecuteEndToEndAgenticTradeInDemoResponse,
} from "../../../types/workflow";
import {
  getProviderFallbackNotice,
} from "./GuidedGuardedAgentExecutionStep";

type ProviderFallbackTrace =
  ExecuteEndToEndAgenticTradeInDemoResponse["providerFallbackTrace"];
type FieldRepairExecution =
  ExecuteEndToEndAgenticTradeInDemoResponse["fieldRepairExecution"];

const validatedExecution: FieldRepairExecution = {
  modelCallLogId: "model-call-1",
  recordOutcomes: [],
  suggestions: [],
  jsonValid: true,
  validationPassed: true,
  validationErrors: [],
};

describe("getProviderFallbackNotice", () => {
  it("returns no notice when fallback was not used", () => {
    const trace: ProviderFallbackTrace = {
      routingGoal: "HIGH_QUALITY",
      selectedProvider: "OPENAI",
      selectedModel: "gpt-4.1-mini",
      finalProvider: "OPENAI",
      finalModel: "gpt-4.1-mini",
      fallbackUsed: false,
      attempts: [
        {
          provider: "OPENAI",
          model: "gpt-4.1-mini",
          attemptOrder: 1,
          status: "SUCCESS",
          reason: "Provider succeeded.",
          errorMessage: null,
          latencyMs: 850,
          estimatedCostUsd: 0.002,
        },
      ],
      summary: "Preferred provider completed successfully.",
    };

    expect(
      getProviderFallbackNotice(trace, validatedExecution),
    ).toBeNull();
  });

  it("explains the failed preferred attempt and successful fallback", () => {
    const trace: ProviderFallbackTrace = {
      routingGoal: "HIGH_QUALITY",
      selectedProvider: "OPENAI",
      selectedModel: "gpt-4.1-mini",
      finalProvider: "MOCK",
      finalModel: "mock-golf-workflow-model",
      fallbackUsed: true,
      attempts: [
        {
          provider: "OPENAI",
          model: "gpt-4.1-mini",
          attemptOrder: 1,
          status: "FAILED",
          reason:
            "Provider OPENAI / gpt-4.1-mini did not complete successfully.",
          errorMessage:
            "OPENAI adapter request failed with 400 Bad Request.",
          latencyMs: 1628,
          estimatedCostUsd: 0.0012,
        },
        {
          provider: "MOCK",
          model: "mock-golf-workflow-model",
          attemptOrder: 2,
          status: "SUCCESS",
          reason:
            "Provider MOCK / mock-golf-workflow-model succeeded.",
          errorMessage: null,
          latencyMs: 2,
          estimatedCostUsd: 0,
        },
      ],
      summary: "Fallback provider completed the request.",
    };

    expect(
      getProviderFallbackNotice(trace, validatedExecution),
    ).toEqual({
      title: "Provider fallback completed this run",
      summary:
        "OPENAI · gpt-4.1-mini did not complete successfully. MOCK · mock-golf-workflow-model completed the model review assistance.",
      preferredProvider: "OPENAI · gpt-4.1-mini",
      preferredStatus: "failed",
      reason:
        "OPENAI adapter request failed with 400 Bad Request.",
      preferredLatencyMs: 1628,
      finalProvider: "MOCK · mock-golf-workflow-model",
      finalStatus: "success",
      validationLabel: "Validation passed",
    });
  });
});
