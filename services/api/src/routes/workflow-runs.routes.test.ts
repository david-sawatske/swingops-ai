import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

describe("workflow run routes", () => {
  describe("GET /workflow-runs/:id", () => {
    it("returns 404 when the workflow run does not exist", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/workflow-runs/not-real"
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();

      expect(body.error).toBe("Workflow run not found");

      await app.close();
    });
  });
});
