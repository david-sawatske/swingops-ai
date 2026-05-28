import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

describe("intake batch routes", () => {
  describe("GET /intake-batches", () => {
    it("returns a list of intake batches", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/intake-batches"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(Array.isArray(body.intakeBatches)).toBe(true);

      await app.close();
    });
  });

  describe("POST /intake-batches", () => {
    it("creates an intake batch with raw intake items", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/intake-batches",
        payload: {
          name: "Test trade-in batch",
          description: "Created from route test",
          sourceType: "FREEFORM_NOTES",
          items: [
            {
              rawText:
                "Callaway Paradym driver, 10.5, stiff shaft, RH, very good"
            },
            {
              rawText:
                "Odyssey White Hot putter, right handed, good condition"
            }
          ]
        }
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();

      expect(body.intakeBatch.name).toBe("Test trade-in batch");
      expect(body.intakeBatch.sourceType).toBe("FREEFORM_NOTES");
      expect(body.intakeBatch.status).toBe("DRAFT");
      expect(body.intakeBatch.itemCount).toBe(2);

      expect(body.items).toHaveLength(2);
      expect(body.items[0].status).toBe("PENDING");

      await app.close();
    });
  });

  describe("POST /intake-batches/:id/start-workflow", () => {
    it("creates a queued workflow run with planned workflow steps", async () => {
      const app = buildApp();

      const createResponse = await app.inject({
        method: "POST",
        url: "/intake-batches",
        payload: {
          name: "Workflow start batch",
          description: "Created before starting workflow",
          sourceType: "FREEFORM_NOTES",
          items: [
            {
              rawText:
                "TaylorMade Stealth 2 driver, 10.5, stiff shaft, RH"
            }
          ]
        }
      });

      expect(createResponse.statusCode).toBe(201);

      const createdBody = createResponse.json();
      const batchId = createdBody.intakeBatch.id;

      const workflowResponse = await app.inject({
        method: "POST",
        url: `/intake-batches/${batchId}/start-workflow`
      });

      expect(workflowResponse.statusCode).toBe(201);

      const workflowBody = workflowResponse.json();

      expect(workflowBody.workflowRun.intakeBatchId).toBe(batchId);
      expect(workflowBody.workflowRun.intakeItemId).toBeNull();
      expect(workflowBody.workflowRun.workflowName).toBe("trade-in-intake-v1");
      expect(workflowBody.workflowRun.status).toBe("QUEUED");

      expect(workflowBody.steps).toHaveLength(5);
      expect(workflowBody.steps.map((step: { stepType: string }) => step.stepType)).toEqual([
        "PARSE_INPUT",
        "NORMALIZE_DATA",
        "EXTRACT_GOLF_CLUB_FIELDS",
        "VALIDATE_STRUCTURED_OUTPUT",
        "CREATE_REVIEW_ITEM"
      ]);
      expect(workflowBody.steps[0].status).toBe("PENDING");
      expect(workflowBody.steps[0].orderIndex).toBe(1);

      await app.close();
    });

    it("returns 404 when starting a workflow for a missing intake batch", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/intake-batches/not-real/start-workflow"
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();

      expect(body.error).toBe("Intake batch not found");

      await app.close();
    });
  });

  describe("GET /intake-batches/:id", () => {
    it("returns an intake batch with items and workflow runs", async () => {
      const app = buildApp();

      const createResponse = await app.inject({
        method: "POST",
        url: "/intake-batches",
        payload: {
          name: "Detail route batch",
          sourceType: "EMAIL",
          items: [
            {
              rawText:
                "Customer email says: Titleist Vokey SM9 56 degree wedge, RH, good grooves"
            }
          ]
        }
      });

      expect(createResponse.statusCode).toBe(201);

      const createdBody = createResponse.json();
      const batchId = createdBody.intakeBatch.id;

      const detailResponse = await app.inject({
        method: "GET",
        url: `/intake-batches/${batchId}`
      });

      expect(detailResponse.statusCode).toBe(200);

      const detailBody = detailResponse.json();

      expect(detailBody.intakeBatch.id).toBe(batchId);
      expect(detailBody.intakeBatch.name).toBe("Detail route batch");
      expect(detailBody.items).toHaveLength(1);
      expect(detailBody.workflowRuns).toEqual([]);

      await app.close();
    });

    it("returns 404 when the intake batch does not exist", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/intake-batches/not-real"
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();

      expect(body.error).toBe("Intake batch not found");

      await app.close();
    });
  });
});
