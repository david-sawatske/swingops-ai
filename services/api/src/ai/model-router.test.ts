import { describe, expect, it } from "vitest";

import { routeModel } from "./model-router.js";
import type { ModelProviderModelConfig } from "./model-provider.types.js";

describe("model router", () => {
  it("routes high-quality simulation previews to healthy OpenAI when Anthropic is degraded", () => {
    const decision = routeModel({
      preferredGoal: "HIGH_QUALITY",
      taskType: "INTAKE_PARSING",
      allowDisabledProvidersForSimulation: true
    });

    expect(decision.provider).toBe("OPENAI");
    expect(decision.model).toBe("gpt-4.1-mini");
    expect(decision.selectedProvider).toBe("OPENAI");
    expect(decision.healthStatus).toBe("HEALTHY");
    expect(decision.estimatedLatencyMs).toBe(650);
    expect(decision.estimatedCostUsd).toBeGreaterThan(0);
    expect(decision.routingFactors).toEqual(
      expect.arrayContaining([
        "OPENAI health is HEALTHY.",
        "Preferred routing goal is HIGH_QUALITY."
      ])
    );
    expect(decision.selectedModelMetadata).toMatchObject({
      provider: "OPENAI",
      model: "gpt-4.1-mini",
      providerEnabled: false,
      modelEnabled: true,
      enabledForExecution: false,
      selected: true,
      healthStatus: "HEALTHY"
    });
    expect(decision.fallbackProvider).toBe("AZURE_OPENAI");
    expect(decision.fallbackModel).toBe("azure-gpt-4.1-mini");
    expect(decision.fallbackReason).toBeNull();
    expect(decision.providerCandidates.map((candidate) => candidate.provider)).toEqual([
      "MOCK",
      "OPENAI",
      "ANTHROPIC",
      "AZURE_OPENAI",
      "OLLAMA"
    ]);
  });

  it("routes low-cost execution requests to the currently enabled mock provider", () => {
    const decision = routeModel({
      preferredGoal: "LOW_COST",
      taskType: "INTAKE_PARSING"
    });

    expect(decision.provider).toBe("MOCK");
    expect(decision.estimatedCostTier).toBe("FREE");
    expect(decision.estimatedCostUsd).toBe(0);
    expect(decision.selectedModelMetadata.enabledForExecution).toBe(true);
    expect(decision.rejectedCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "OPENAI",
          rejectedReasons: expect.arrayContaining([
            "Provider/model is disabled for execution. Enable simulation preview to consider it."
          ])
        })
      ])
    );
  });

  it("skips unavailable providers", () => {
    const decision = routeModel(
      {
        preferredGoal: "HIGH_QUALITY",
        taskType: "INTAKE_PARSING",
        allowDisabledProvidersForSimulation: true
      },
      {
        providerHealthByName: {
          OPENAI: {
            provider: "OPENAI",
            status: "UNAVAILABLE",
            estimatedLatencyMs: 9999,
            reason: "OpenAI is unavailable in this routing test."
          },
          ANTHROPIC: {
            provider: "ANTHROPIC",
            status: "HEALTHY",
            estimatedLatencyMs: 900,
            reason: "Anthropic is healthy in this routing test."
          }
        }
      }
    );

    expect(decision.provider).toBe("ANTHROPIC");
    expect(decision.rejectedCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "OPENAI",
          rejectedReasons: expect.arrayContaining([
            "Provider health is UNAVAILABLE."
          ])
        })
      ])
    );
  });

  it("prioritizes healthy providers over degraded providers", () => {
    const decision = routeModel({
      preferredGoal: "HIGH_QUALITY",
      taskType: "VALIDATION",
      allowDisabledProvidersForSimulation: true
    });

    expect(decision.provider).toBe("OPENAI");
    expect(decision.providerCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "ANTHROPIC",
          healthStatus: "DEGRADED",
          reasonCodes: expect.arrayContaining(["PROVIDER_DEGRADED"])
        })
      ])
    );
  });

  it("routes local-only simulation previews to Ollama when the task is supported", () => {
    const decision = routeModel({
      preferredGoal: "LOCAL_ONLY",
      taskType: "FIELD_NORMALIZATION",
      allowDisabledProvidersForSimulation: true
    });

    expect(decision.provider).toBe("OLLAMA");
    expect(decision.model).toBe("llama3.1");
    expect(decision.selectedModelMetadata).toMatchObject({
      provider: "OLLAMA",
      providerEnabled: false,
      enabledForExecution: false,
      healthStatus: "HEALTHY"
    });
    expect(decision.rejectedCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "MOCK",
          rejectedReasons: expect.arrayContaining([
            "Rejected because LOCAL_ONLY requires a local provider."
          ])
        })
      ])
    );
  });

  it("falls back to mock when local-only is requested for an unsupported local task", () => {
    const decision = routeModel({
      preferredGoal: "LOCAL_ONLY",
      taskType: "VALIDATION",
      allowDisabledProvidersForSimulation: true
    });

    expect(decision.provider).toBe("MOCK");
    expect(decision.model).toBe("mock-golf-workflow-model");
    expect(decision.fallbackReason).toBe(
      "Fallback mock model because no eligible local model supports VALIDATION."
    );
    expect(decision.reason).toBe(decision.fallbackReason);
    expect(decision.rejectedCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "OLLAMA",
          rejectedReasons: expect.arrayContaining([
            "Does not support task type VALIDATION."
          ])
        })
      ])
    );
  });

  it("keeps disabled providers visible to simulation but unavailable for execution by default", () => {
    const executionDecision = routeModel({
      preferredGoal: "HIGH_QUALITY",
      taskType: "INTAKE_PARSING"
    });

    const simulationDecision = routeModel({
      preferredGoal: "HIGH_QUALITY",
      taskType: "INTAKE_PARSING",
      allowDisabledProvidersForSimulation: true
    });

    expect(executionDecision.provider).toBe("MOCK");
    expect(executionDecision.rejectedCandidates.map((candidate) => candidate.provider)).toContain(
      "OPENAI"
    );
    expect(simulationDecision.provider).toBe("OPENAI");
  });

  it("filters out non-JSON-capable models when JSON output is required", () => {
    const nonJsonModel: ModelProviderModelConfig = {
      provider: "MOCK",
      model: "mock-text-only-model",
      reason: "Text-only mock model for routing policy tests.",
      supportedTaskTypes: ["REVIEW_SUMMARY"],
      supportsJson: false,
      costTier: "FREE",
      latencyTier: "LOW",
      qualityTier: "HIGH",
      enabled: true
    };

    const jsonModel: ModelProviderModelConfig = {
      provider: "MOCK",
      model: "mock-json-model",
      reason: "JSON-capable mock model for routing policy tests.",
      supportedTaskTypes: ["REVIEW_SUMMARY"],
      supportsJson: true,
      costTier: "LOW",
      latencyTier: "LOW",
      qualityTier: "MEDIUM",
      enabled: true
    };

    const decision = routeModel(
      {
        preferredGoal: "HIGH_QUALITY",
        taskType: "REVIEW_SUMMARY",
        requireJson: true
      },
      {
        modelConfigs: [nonJsonModel, jsonModel],
        providerEnabledByName: {
          MOCK: true
        }
      }
    );

    expect(decision.provider).toBe("MOCK");
    expect(decision.model).toBe("mock-json-model");
    expect(decision.rejectedCandidates).toEqual([
      expect.objectContaining({
        model: "mock-text-only-model",
        rejectedReasons: ["Does not support required JSON output."]
      })
    ]);
  });

  it("keeps the existing goal field compatible with existing routeModel callers", () => {
    const decision = routeModel({
      goal: "LOW_LATENCY",
      taskType: "REVIEW_SUMMARY"
    });

    expect(decision.provider).toBe("MOCK");
    expect(decision.expectedLatencyTier).toBe("LOW");
  });
});
