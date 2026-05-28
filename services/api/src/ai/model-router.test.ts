import { describe, expect, it } from "vitest";

import { routeModel } from "./model-router.js";

describe("model router", () => {
  it("routes low-cost requests to a free/local development option first", () => {
    const decision = routeModel({
      goal: "LOW_COST",
      taskType: "INTAKE_PARSING"
    });

    expect(decision.provider).toBe("MOCK");
    expect(decision.estimatedCostTier).toBe("FREE");
  });

  it("routes high-quality requests to the highest quality configured model", () => {
    const decision = routeModel({
      goal: "HIGH_QUALITY",
      taskType: "INTAKE_PARSING"
    });

    expect(decision.provider).toBe("ANTHROPIC");
    expect(decision.qualityTier).toBe("HIGH");
  });

  it("routes local-only requests to a self-hosted provider when supported", () => {
    const decision = routeModel({
      goal: "LOCAL_ONLY",
      taskType: "FIELD_NORMALIZATION"
    });

    expect(decision.provider).toBe("OLLAMA");
  });

  it("falls back to the mock provider when local-only is requested for an unsupported local task", () => {
    const decision = routeModel({
      goal: "LOCAL_ONLY",
      taskType: "VALIDATION"
    });

    expect(decision.provider).toBe("MOCK");
    expect(decision.reason).toContain("Fallback mock model");
  });

  it("routes low-latency requests to the lowest latency configured option", () => {
    const decision = routeModel({
      goal: "LOW_LATENCY",
      taskType: "REVIEW_SUMMARY"
    });

    expect(decision.expectedLatencyTier).toBe("LOW");
  });
});
