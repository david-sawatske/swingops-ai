import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

describe("GET /health", () => {
  it("returns API health status", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.status).toBe("ok");
    expect(body.service).toBe("swingops-api");

    await app.close();
  });
});
