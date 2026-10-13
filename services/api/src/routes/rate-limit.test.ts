import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

const INVALID_WORKFLOW_BODY = { unexpectedField: true };

describe("API rate limiting", () => {
  it("limits each client across all routes", async () => {
    const app = buildApp({
      rateLimitMaxPerMinute: 3,
      workflowRateLimitMaxPerMinute: 0,
    });

    const statusCodes: number[] = [];

    for (let request = 0; request < 4; request += 1) {
      const response = await app.inject({ method: "GET", url: "/health" });
      statusCodes.push(response.statusCode);
    }

    expect(statusCodes).toEqual([200, 200, 200, 429]);

    await app.close();
  });

  it("applies a tighter limit to workflow routes without affecting other routes", async () => {
    const app = buildApp({
      rateLimitMaxPerMinute: 100,
      workflowRateLimitMaxPerMinute: 2,
    });

    const statusCodes: number[] = [];

    for (let request = 0; request < 3; request += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/workflow-runs/agentic-trade-in-demo",
        payload: INVALID_WORKFLOW_BODY,
      });
      statusCodes.push(response.statusCode);
    }

    const healthResponse = await app.inject({ method: "GET", url: "/health" });

    expect(statusCodes).toEqual([400, 400, 429]);
    expect(healthResponse.statusCode).toBe(200);

    await app.close();
  });

  it("keys limits by the client address added by one trusted proxy hop", async () => {
    const app = buildApp({
      trustProxyHops: 1,
      rateLimitMaxPerMinute: 100,
      workflowRateLimitMaxPerMinute: 1,
    });

    function postFrom(forwardedFor: string) {
      return app.inject({
        method: "POST",
        url: "/workflow-runs/agentic-trade-in-demo",
        payload: INVALID_WORKFLOW_BODY,
        headers: { "x-forwarded-for": forwardedFor },
      });
    }

    const firstClient = await postFrom("203.0.113.10");
    const secondClient = await postFrom("203.0.113.20");
    // A client-supplied entry to the left of the proxy-added address is ignored.
    const spoofedRetry = await postFrom("198.51.100.99, 203.0.113.10");

    expect(firstClient.statusCode).toBe(400);
    expect(secondClient.statusCode).toBe(400);
    expect(spoofedRetry.statusCode).toBe(429);

    await app.close();
  });

  it("does not register the knowledge ingest route when it is disabled", async () => {
    const app = buildApp({ knowledgeIngestRouteEnabled: false });

    const response = await app.inject({
      method: "POST",
      url: "/knowledge/ingest-demo",
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });
});
