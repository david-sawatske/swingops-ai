import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { executeMultiSourceIntakeDemo } from "../workflows/multi-source-intake-demo.js";

describe("AI-ready intake record routes", () => {
  it("lists persisted AI-ready intake records", async () => {
    const app = buildApp();
    const result = await executeMultiSourceIntakeDemo({
      sourceTypes: ["EMAIL"]
    });

    const response = await app.inject({
      method: "GET",
      url: `/ai-ready-intake-records?workflowRunId=${result.persistedIds.workflowRunId}`
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.count).toBe(result.recordsExtracted);
    expect(body.records).toHaveLength(result.recordsExtracted);
    expect(body.records[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        intakeBatchId: result.persistedIds.intakeBatchId,
        workflowRunId: result.persistedIds.workflowRunId,
        sourceType: "EMAIL",
        sourceName: "Customer trade-in email",
        normalizedJson: expect.objectContaining({
          conditionGrade: expect.any(String)
        }),
        status: expect.any(String),
        reviewNeeded: expect.any(Boolean),
        embeddingReady: expect.any(Boolean),
        ragReady: expect.any(Boolean)
      })
    );

    await prisma.intakeBatch.delete({
      where: {
        id: result.persistedIds.intakeBatchId
      }
    });
    await prisma.workflowRun.delete({
      where: {
        id: result.persistedIds.workflowRunId
      }
    });
    await app.close();
  });

  it("gets a persisted AI-ready intake record by id", async () => {
    const app = buildApp();
    const result = await executeMultiSourceIntakeDemo({
      sourceTypes: ["POORLY_FORMED_CSV"]
    });
    const recordId = result.persistedIds.aiReadyIntakeRecordIds[0];

    const response = await app.inject({
      method: "GET",
      url: `/ai-ready-intake-records/${recordId}`
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.record).toEqual(
      expect.objectContaining({
        id: recordId,
        intakeBatchId: result.persistedIds.intakeBatchId,
        workflowRunId: result.persistedIds.workflowRunId,
        sourceType: "POORLY_FORMED_CSV",
        cleanedText: expect.any(String),
        inferredSchemaJson: expect.any(Array),
        metadataJson: expect.any(Object),
        qualitySignalsJson: expect.any(Array)
      })
    );

    await prisma.intakeBatch.delete({
      where: {
        id: result.persistedIds.intakeBatchId
      }
    });
    await prisma.workflowRun.delete({
      where: {
        id: result.persistedIds.workflowRunId
      }
    });
    await app.close();
  });

  it("filters by intake batch, source type, status and limit", async () => {
    const app = buildApp();
    const result = await executeMultiSourceIntakeDemo();

    const response = await app.inject({
      method: "GET",
      url: `/ai-ready-intake-records?intakeBatchId=${result.persistedIds.intakeBatchId}&sourceType=LOG&status=NEEDS_REVIEW&limit=2`
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.count).toBeLessThanOrEqual(2);
    expect(body.records.every((record: { sourceType: string; status: string }) =>
      record.sourceType === "LOG" && record.status === "NEEDS_REVIEW"
    )).toBe(true);

    await prisma.intakeBatch.delete({
      where: {
        id: result.persistedIds.intakeBatchId
      }
    });
    await prisma.workflowRun.delete({
      where: {
        id: result.persistedIds.workflowRunId
      }
    });
    await app.close();
  });

  it("returns 400 for invalid filters", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/ai-ready-intake-records?sourceType=PDF_TEXT&limit=500"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("Invalid AI-ready intake record filters");

    await app.close();
  });

  it("returns 404 for missing record detail", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/ai-ready-intake-records/missing-record-id"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe("AI-ready intake record not found");

    await app.close();
  });
});
