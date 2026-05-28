import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { createMockModelCallLogForWorkflowRun } from "../workflows/workflow-model-logging.js";

describe("workflow run routes", () => {
  describe("GET /workflow-runs/:id", () => {
    it("returns a workflow run with persisted model call logs", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "test-workflow-run-detail"
        }
      });

      await createMockModelCallLogForWorkflowRun({
        workflowRunId: workflowRun.id,
        taskType: "INTAKE_PARSING",
        goal: "LOW_COST"
      });

      const response = await app.inject({
        method: "GET",
        url: `/workflow-runs/${workflowRun.id}`
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.workflowRun.id).toBe(workflowRun.id);
      expect(body.workflowRun.workflowName).toBe("test-workflow-run-detail");

      expect(body.modelCallLogs).toHaveLength(1);
      expect(body.modelCallLogs[0].workflowRunId).toBe(workflowRun.id);
      expect(body.modelCallLogs[0].provider).toBe("MOCK");
      expect(body.modelCallLogs[0].model).toBe("mock-golf-workflow-model");
      expect(body.modelCallLogs[0].status).toBe("SUCCEEDED");
      expect(body.modelCallLogs[0].requestJson).toMatchObject({
        workflowRunId: workflowRun.id,
        taskType: "INTAKE_PARSING",
        routingGoal: "LOW_COST",
        mock: true
      });
      expect(body.modelCallLogs[0].responseJson).toMatchObject({
        mock: true,
        routingDecision: {
          provider: "MOCK",
          model: "mock-golf-workflow-model",
          estimatedCostTier: "FREE",
          expectedLatencyTier: "LOW",
          qualityTier: "LOW"
        }
      });

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });

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
