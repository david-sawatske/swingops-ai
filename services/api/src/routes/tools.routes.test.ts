import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

describe("tool routes", () => {
  describe("GET /mcp/tools", () => {
    it("returns the MCP-style internal tool registry preview", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/mcp/tools"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.registryMetadata).toEqual({
        transport: "INTERNAL_PREVIEW",
        executionEnabled: false,
        status:
          "Tool registry preview only. MCP transport and tool execution are intentionally not enabled in this slice."
      });

      expect(body.tools.map((tool: { name: string }) => tool.name)).toEqual([
        "swingops.intakeBatches.list",
        "swingops.intakeBatches.get",
        "swingops.workflowRuns.list",
        "swingops.workflowRuns.get",
        "swingops.reviewQueueItems.list",
        "swingops.reviewQueueItems.get",
        "swingops.reviewQueueItems.resolve",
        "swingops.reviewQueueItems.dismiss"
      ]);

      await app.close();
    });

    it("filters the registry by category and enabled status", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/mcp/tools?category=REVIEW_QUEUE&enabled=true"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.tools.map((tool: { name: string }) => tool.name)).toEqual([
        "swingops.reviewQueueItems.list",
        "swingops.reviewQueueItems.get"
      ]);

      await app.close();
    });

    it("returns disabled high-risk approval-required mutation tools when requested", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url:
          "/mcp/tools?mutatesData=true&requiresHumanApproval=true&enabled=false"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.tools.map((tool: { name: string }) => tool.name)).toEqual([
        "swingops.reviewQueueItems.resolve",
        "swingops.reviewQueueItems.dismiss"
      ]);

      expect(body.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "swingops.reviewQueueItems.resolve",
            riskLevel: "HIGH",
            requiresHumanApproval: true,
            mutatesData: true,
            enabled: false
          })
        ])
      );

      await app.close();
    });

    it("returns 400 for invalid registry query filters", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/mcp/tools?category=NOT_REAL"
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("Invalid agent tool registry query");

      await app.close();
    });
  });

  describe("GET /mcp/tools/:name", () => {
    it("returns one registered tool by name", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/mcp/tools/swingops.workflowRuns.get"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.tool).toMatchObject({
        name: "swingops.workflowRuns.get",
        category: "WORKFLOW",
        riskLevel: "LOW",
        requiresHumanApproval: false,
        mutatesData: false,
        enabled: true,
        existingHttpRoute: {
          method: "GET",
          path: "/workflow-runs/:id"
        }
      });

      expect(body.tool.inputShape.fields).toEqual([
        {
          name: "id",
          type: "string",
          required: true,
          description: "The workflow run ID to retrieve."
        }
      ]);

      await app.close();
    });

    it("returns 404 when the registered tool does not exist", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/mcp/tools/swingops.notReal"
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe("Agent tool not found");

      await app.close();
    });
  });
});
