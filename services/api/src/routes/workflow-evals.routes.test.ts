import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

describe("workflow eval routes", () => {
  it("lists workflow eval scenarios", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/workflow-evals/scenarios"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().scenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "clean-fully-parsed-record",
          sourceType: "FREE_TEXT",
          executionMode: "MULTI_SOURCE_INTAKE"
        }),
        expect.objectContaining({
          id: "unknown-shaft-and-value-no-defaults",
          sourceType: "FREE_TEXT",
          executionMode: "MULTI_SOURCE_INTAKE"
        }),
        expect.objectContaining({
          id: "parser-variant-field-evidence",
          sourceType: "LOG",
          executionMode: "MULTI_SOURCE_INTAKE"
        }),
        expect.objectContaining({
          id: "prior-review-suggestion-not-auto-applied",
          sourceType: "FREE_TEXT",
          executionMode: "GUARDED_AGENT_WORKFLOW"
        })
      ])
    );

    await app.close();
  });

  it("runs workflow eval scenarios", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/workflow-evals/run"
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.summary).toEqual({
      total: 4,
      passed: 4,
      failed: 0
    });
    expect(body.results).toHaveLength(4);
    expect(body.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scenarioId: "unknown-shaft-and-value-no-defaults",
          status: "PASSED",
          observed: expect.objectContaining({
            reviewItemCount: 1
          }),
          failures: []
        }),
        expect.objectContaining({
          scenarioId: "prior-review-suggestion-not-auto-applied",
          status: "PASSED",
          observed: expect.objectContaining({
            priorReviewSuggestionCount: 1
          }),
          failures: []
        })
      ])
    );

    await app.close();
  });
});
