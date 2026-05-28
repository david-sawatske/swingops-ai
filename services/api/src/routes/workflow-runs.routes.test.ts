import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { createMockModelCallLogForWorkflowRun } from "../workflows/workflow-model-logging.js";

describe("workflow run routes", () => {
  describe("GET /workflow-runs", () => {
    it("returns a workflow run list response", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/workflow-runs"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(Array.isArray(body.workflowRuns)).toBe(true);

      await app.close();
    });

    it("returns workflow runs with intake context", async () => {
      const app = buildApp();

      const intakeBatch = await prisma.intakeBatch.create({
        data: {
          name: "Workflow Runs Dashboard Batch",
          sourceType: "FREEFORM_NOTES",
          itemCount: 1,
          items: {
            create: [
              {
                rawText: "Callaway Rogue ST Max driver, stiff, RH"
              }
            ]
          }
        },
        include: {
          items: true
        }
      });

      const intakeItem = intakeBatch.items[0];

      expect(intakeItem).toBeDefined();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          intakeBatchId: intakeBatch.id,
          intakeItemId: intakeItem!.id,
          workflowName: "workflow-runs-dashboard-list",
          status: "QUEUED"
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/workflow-runs"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      const listedRun = body.workflowRuns.find(
        (run: { id: string }) => run.id === workflowRun.id
      );

      expect(listedRun).toMatchObject({
        id: workflowRun.id,
        intakeBatchId: intakeBatch.id,
        intakeItemId: intakeItem!.id,
        workflowName: "workflow-runs-dashboard-list",
        status: "QUEUED",
        intakeBatch: {
          id: intakeBatch.id,
          name: "Workflow Runs Dashboard Batch"
        },
        intakeItem: {
          id: intakeItem!.id,
          rawText: "Callaway Rogue ST Max driver, stiff, RH"
        },
        latestModelCallLog: null,
        totalReviewQueueItemCount: 0,
        openReviewQueueItemCount: 0
      });

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });
      await prisma.intakeBatch.delete({
        where: {
          id: intakeBatch.id
        }
      });

      await app.close();
    });

    it("includes the latest model call log for each workflow run", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "workflow-runs-dashboard-model-log"
        }
      });

      await prisma.modelCallLog.create({
        data: {
          workflowRunId: workflowRun.id,
          provider: "MOCK",
          model: "older-model-route",
          status: "SUCCEEDED",
          latencyMs: 42,
          estimatedCostUsd: 0,
          requestJson: {
            routingGoal: "LOW_COST"
          },
          responseJson: {
            routingDecision: {
              provider: "MOCK",
              model: "older-model-route"
            }
          },
          startedAt: new Date("2026-01-01T00:00:00.000Z"),
          completedAt: new Date("2026-01-01T00:00:01.000Z"),
          createdAt: new Date("2026-01-01T00:00:01.000Z")
        }
      });

      await prisma.modelCallLog.create({
        data: {
          workflowRunId: workflowRun.id,
          provider: "MOCK",
          model: "latest-model-route",
          status: "SUCCEEDED",
          latencyMs: 24,
          estimatedCostUsd: 0,
          requestJson: {
            routingGoal: "QUALITY"
          },
          responseJson: {
            routingDecision: {
              provider: "MOCK",
              model: "latest-model-route",
              estimatedCostTier: "FREE",
              expectedLatencyTier: "LOW",
              qualityTier: "LOW"
            }
          },
          startedAt: new Date("2026-01-02T00:00:00.000Z"),
          completedAt: new Date("2026-01-02T00:00:01.000Z"),
          createdAt: new Date("2026-01-02T00:00:01.000Z")
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/workflow-runs"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      const listedRun = body.workflowRuns.find(
        (run: { id: string }) => run.id === workflowRun.id
      );

      expect(listedRun.latestModelCallLog).toMatchObject({
        workflowRunId: workflowRun.id,
        provider: "MOCK",
        model: "latest-model-route",
        status: "SUCCEEDED",
        latencyMs: 24,
        estimatedCostUsd: 0,
        requestJson: {
          routingGoal: "QUALITY"
        }
      });

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });

    it("includes review queue counts for each workflow run", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "workflow-runs-dashboard-review-counts",
          reviewQueueItems: {
            create: [
              {
                reason: "LOW_CONFIDENCE",
                status: "OPEN",
                originalText: "TM driver, shaft unknown"
              },
              {
                reason: "AMBIGUOUS_INPUT",
                status: "IN_REVIEW",
                originalText: "Ping irons maybe 5-PW"
              },
              {
                reason: "MISSING_REQUIRED_FIELDS",
                status: "RESOLVED",
                originalText: "Odyssey putter"
              }
            ]
          }
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/workflow-runs"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      const listedRun = body.workflowRuns.find(
        (run: { id: string }) => run.id === workflowRun.id
      );

      expect(listedRun.totalReviewQueueItemCount).toBe(3);
      expect(listedRun.openReviewQueueItemCount).toBe(2);

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });
  });

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

  describe("POST /workflow-runs/:id/execute", () => {
    it("executes a queued workflow run simulation and returns completed steps", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "test-workflow-run-execute-route",
          status: "QUEUED",
          steps: {
            create: [
              {
                stepName: "Parse intake input",
                stepType: "PARSE_INPUT",
                orderIndex: 1,
                status: "PENDING",
                inputJson: {
                  intakeBatchId: "route-test-batch",
                  intakeBatchName: "Route Execution Test Batch",
                  sourceType: "FREEFORM_NOTES",
                  itemCount: 1
                }
              },
              {
                stepName: "Normalize trade-in data",
                stepType: "NORMALIZE_DATA",
                orderIndex: 2,
                status: "PENDING",
                inputJson: {
                  intakeBatchId: "route-test-batch",
                  intakeBatchName: "Route Execution Test Batch",
                  sourceType: "FREEFORM_NOTES",
                  itemCount: 1
                }
              }
            ]
          }
        }
      });

      const response = await app.inject({
        method: "POST",
        url: `/workflow-runs/${workflowRun.id}/execute`
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.workflowRun.id).toBe(workflowRun.id);
      expect(body.workflowRun.status).toBe("COMPLETED");
      expect(body.workflowRun.startedAt).not.toBeNull();
      expect(body.workflowRun.completedAt).not.toBeNull();

      expect(body.steps).toHaveLength(2);
      expect(body.steps.map((step: { status: string }) => step.status)).toEqual([
        "COMPLETED",
        "COMPLETED"
      ]);
      expect(body.steps[0].outputJson).toMatchObject({
        simulated: true,
        stepType: "PARSE_INPUT",
        parsedItemCount: 1
      });

      expect(body.toolCallLogs).toHaveLength(2);
      expect(
        body.toolCallLogs.map((log: { toolName: string }) => log.toolName)
      ).toEqual(["simulate.parseInput", "simulate.normalizeData"]);
      expect(body.reviewQueueItems).toEqual([]);

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });

    it("executes a review-needed simulation and returns review queue items", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "test-workflow-run-review-route",
          status: "QUEUED",
          steps: {
            create: [
              {
                stepName: "Parse intake input",
                stepType: "PARSE_INPUT",
                orderIndex: 1,
                status: "PENDING",
                inputJson: {
                  intakeBatchId: "route-review-batch",
                  intakeBatchName: "Route Review Simulation Batch",
                  sourceType: "FREEFORM_NOTES",
                  itemCount: 1,
                  originalText:
                    "TM driver maybe 10.5, shaft unknown, condition unclear"
                }
              },
              {
                stepName: "Validate structured output",
                stepType: "VALIDATE_STRUCTURED_OUTPUT",
                orderIndex: 2,
                status: "PENDING",
                inputJson: {
                  intakeBatchId: "route-review-batch",
                  intakeBatchName: "Route Review Simulation Batch",
                  sourceType: "FREEFORM_NOTES",
                  itemCount: 1,
                  originalText:
                    "TM driver maybe 10.5, shaft unknown, condition unclear"
                }
              },
              {
                stepName: "Create review item when needed",
                stepType: "CREATE_REVIEW_ITEM",
                orderIndex: 3,
                status: "PENDING",
                inputJson: {
                  intakeBatchId: "route-review-batch",
                  intakeBatchName: "Route Review Simulation Batch",
                  sourceType: "FREEFORM_NOTES",
                  itemCount: 1,
                  originalText:
                    "TM driver maybe 10.5, shaft unknown, condition unclear"
                }
              }
            ]
          }
        }
      });

      const response = await app.inject({
        method: "POST",
        url: `/workflow-runs/${workflowRun.id}/execute`,
        payload: {
          scenario: "NEEDS_REVIEW"
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.workflowRun.id).toBe(workflowRun.id);
      expect(body.workflowRun.status).toBe("NEEDS_REVIEW");

      expect(body.steps).toHaveLength(3);
      expect(body.steps.map((step: { status: string }) => step.status)).toEqual([
        "COMPLETED",
        "COMPLETED",
        "COMPLETED"
      ]);
      expect(body.steps[1].outputJson).toMatchObject({
        simulated: true,
        stepType: "VALIDATE_STRUCTURED_OUTPUT",
        validationStatus: "NEEDS_REVIEW",
        needsReview: true,
        reviewReason: "LOW_CONFIDENCE"
      });
      expect(body.steps[2].outputJson).toMatchObject({
        simulated: true,
        stepType: "CREATE_REVIEW_ITEM",
        reviewItemCreated: true,
        reviewReason: "LOW_CONFIDENCE"
      });

      expect(body.reviewQueueItems).toHaveLength(1);
      expect(body.reviewQueueItems[0]).toMatchObject({
        workflowRunId: workflowRun.id,
        reason: "LOW_CONFIDENCE",
        status: "OPEN",
        originalText: "TM driver maybe 10.5, shaft unknown, condition unclear"
      });
      expect(body.reviewQueueItems[0].proposedGolfClubJson).toMatchObject({
        brand: "TaylorMade",
        model: "Unknown Driver",
        confidenceScore: 0.58,
        missingFields: ["shaftFlex", "condition"]
      });

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });

    it("returns 404 when executing a missing workflow run", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/workflow-runs/not-real/execute"
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();

      expect(body.error).toBe("Workflow run not found");

      await app.close();
    });
  });
});
