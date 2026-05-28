import { describe, expect, it } from "vitest";

import {
  getModelConfig,
  getModelProvider,
  listModelConfigs,
  listModelProviders
} from "./model-provider-registry.js";

describe("model provider registry", () => {
  it("registers the expected provider adapters", () => {
    const providers = listModelProviders();

    expect(providers.map((provider) => provider.provider)).toEqual([
      "MOCK",
      "OPENAI",
      "ANTHROPIC",
      "AZURE_OPENAI",
      "OLLAMA"
    ]);
  });

  it("looks up provider metadata by provider name", () => {
    const provider = getModelProvider("OPENAI");

    expect(provider?.displayName).toBe("OpenAI");
    expect(provider?.kind).toBe("HOSTED_API");
    expect(provider?.models[0]?.supportsJson).toBe(true);
  });

  it("looks up a specific model config", () => {
    const config = getModelConfig({
      provider: "ANTHROPIC",
      model: "claude-3-5-sonnet"
    });

    expect(config?.qualityTier).toBe("HIGH");
    expect(config?.supportedTaskTypes).toContain("INTAKE_PARSING");
  });

  it("filters model configs by supported task type", () => {
    const validationModels = listModelConfigs({
      taskType: "VALIDATION"
    });

    expect(validationModels.map((model) => model.provider)).toEqual([
      "MOCK",
      "OPENAI",
      "ANTHROPIC",
      "AZURE_OPENAI"
    ]);
    expect(validationModels.some((model) => model.provider === "OLLAMA")).toBe(
      false
    );
  });

  it("filters model configs by cost, latency, quality, and JSON support", () => {
    const configs = listModelConfigs({
      supportsJson: true,
      costTier: "FREE",
      latencyTier: "LOW",
      qualityTier: "LOW"
    });

    expect(configs).toHaveLength(1);
    expect(configs[0]?.provider).toBe("MOCK");
  });

  it("filters enabled configs using both provider and model enabled flags", () => {
    const enabledConfigs = listModelConfigs({
      enabled: true
    });

    expect(enabledConfigs.map((config) => config.provider)).toEqual(["MOCK"]);
  });
});
