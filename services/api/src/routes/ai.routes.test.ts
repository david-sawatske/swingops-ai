import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

describe("AI routes", () => {
  describe("POST /ai/model-routing/preview", () => {
    it("returns a high-quality routing preview with candidates and rejected reasons", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/ai/model-routing/preview",
        payload: {
          taskType: "INTAKE_PARSING",
          preferredGoal: "HIGH_QUALITY",
          requireJson: true,
          allowDisabledProvidersForSimulation: true
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.routingRequest).toEqual({
        taskType: "INTAKE_PARSING",
        preferredGoal: "HIGH_QUALITY",
        requireJson: true,
        allowDisabledProvidersForSimulation: true
      });

      expect(body.routingDecision).toMatchObject({
        provider: "ANTHROPIC",
        model: "claude-3-5-sonnet",
        estimatedCostTier: "HIGH",
        expectedLatencyTier: "MEDIUM",
        qualityTier: "HIGH",
        selectedModelMetadata: {
          provider: "ANTHROPIC",
          model: "claude-3-5-sonnet",
          providerEnabled: false,
          modelEnabled: true,
          enabledForExecution: false
        },
        fallbackReason: null
      });

      expect(body.routingDecision.candidatesConsidered).toHaveLength(5);
      expect(body.routingDecision.candidatesConsidered.map(
        (candidate: { provider: string }) => candidate.provider
      )).toEqual([
        "MOCK",
        "OPENAI",
        "ANTHROPIC",
        "AZURE_OPENAI",
        "OLLAMA"
      ]);
      expect(body.routingDecision.rejectedCandidates).toEqual([]);

      await app.close();
    });

    it("defaults to safe preview settings and selects the low-cost mock model", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/ai/model-routing/preview",
        payload: {
          taskType: "REVIEW_SUMMARY"
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.routingRequest).toEqual({
        taskType: "REVIEW_SUMMARY",
        preferredGoal: "LOW_COST",
        requireJson: true,
        allowDisabledProvidersForSimulation: true
      });

      expect(body.routingDecision).toMatchObject({
        provider: "MOCK",
        model: "mock-golf-workflow-model",
        estimatedCostTier: "FREE",
        expectedLatencyTier: "LOW",
        qualityTier: "LOW"
      });

      await app.close();
    });

    it("can preview execution-only routing where disabled providers are rejected", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/ai/model-routing/preview",
        payload: {
          taskType: "INTAKE_PARSING",
          preferredGoal: "HIGH_QUALITY",
          requireJson: true,
          allowDisabledProvidersForSimulation: false
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.routingDecision.provider).toBe("MOCK");
      expect(body.routingDecision.rejectedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: "ANTHROPIC",
            rejectedReasons: expect.arrayContaining([
              "Provider/model is disabled for execution. Enable simulation preview to consider it."
            ])
          })
        ])
      );

      await app.close();
    });

    it("returns fallback metadata for local-only unsupported task previews", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/ai/model-routing/preview",
        payload: {
          taskType: "VALIDATION",
          preferredGoal: "LOCAL_ONLY",
          requireJson: true,
          allowDisabledProvidersForSimulation: true
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.routingDecision).toMatchObject({
        provider: "MOCK",
        model: "mock-golf-workflow-model",
        fallbackReason:
          "Fallback mock model because no eligible local model supports VALIDATION."
      });
      expect(body.routingDecision.rejectedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: "OLLAMA",
            rejectedReasons: expect.arrayContaining([
              "Does not support task type VALIDATION."
            ])
          })
        ])
      );

      await app.close();
    });

    it("returns 400 for invalid model routing preview input", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/ai/model-routing/preview",
        payload: {
          taskType: "NOT_A_TASK",
          preferredGoal: "HIGH_QUALITY"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("Invalid model routing preview request");

      await app.close();
    });
  });
});
