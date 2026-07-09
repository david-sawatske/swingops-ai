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
    expect(body.totalCount).toBe(result.recordsExtracted);
    expect(body.limit).toBe(25);
    expect(body.offset).toBe(0);
    expect(body.hasMore).toBe(false);
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

  it("filters by intake batch, source type, status, review state and limit", async () => {
    const app = buildApp();
    const result = await executeMultiSourceIntakeDemo();

    const response = await app.inject({
      method: "GET",
      url: `/ai-ready-intake-records?intakeBatchId=${result.persistedIds.intakeBatchId}&sourceType=LOG&status=NEEDS_REVIEW&reviewNeeded=true&limit=2&offset=0&sort=status_asc`
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.count).toBeLessThanOrEqual(2);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
    expect(body.totalCount).toBeGreaterThanOrEqual(body.count);
    expect(body.records.every((record: { sourceType: string; status: string; reviewNeeded: boolean }) =>
      record.sourceType === "LOG" &&
      record.status === "NEEDS_REVIEW" &&
      record.reviewNeeded === true
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

  it("filters active records without counting superseded history", async () => {
    const app = buildApp();
    const result = await executeMultiSourceIntakeDemo();
    const supersededRecordId = result.persistedIds.aiReadyIntakeRecordIds[0];

    expect(supersededRecordId).toBeDefined();

    await prisma.aiReadyIntakeRecord.update({
      where: {
        id: supersededRecordId!
      },
      data: {
        status: "SUPERSEDED",
        supersededAt: new Date(),
        supersededReason: "Test superseded record should be excluded from active explorer results."
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `/ai-ready-intake-records?intakeBatchId=${result.persistedIds.intakeBatchId}&activeOnly=true&limit=100`
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.totalCount).toBe(result.recordsExtracted - 1);
    expect(body.records.every((record: { status: string }) =>
      record.status !== "SUPERSEDED"
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

  it("filters explicit false boolean query values", async () => {
    const app = buildApp();
    const result = await executeMultiSourceIntakeDemo();

    const response = await app.inject({
      method: "GET",
      url: `/ai-ready-intake-records?intakeBatchId=${result.persistedIds.intakeBatchId}&reviewNeeded=false&limit=100`
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.records.every((record: { reviewNeeded: boolean }) =>
      record.reviewNeeded === false
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

  it("paginates AI-ready intake records", async () => {
    const app = buildApp();
    const result = await executeMultiSourceIntakeDemo();

    const response = await app.inject({
      method: "GET",
      url: `/ai-ready-intake-records?intakeBatchId=${result.persistedIds.intakeBatchId}&limit=1&offset=1`
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.count).toBe(1);
    expect(body.limit).toBe(1);
    expect(body.offset).toBe(1);
    expect(body.totalCount).toBe(result.recordsExtracted);
    expect(body.hasMore).toBe(result.recordsExtracted > 2);

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


  it("searches AI-ready intake records before pagination", async () => {
    const app = buildApp();
    const result = await executeMultiSourceIntakeDemo();

    const firstRecord = await prisma.aiReadyIntakeRecord.findFirstOrThrow({
      where: {
        intakeBatchId: result.persistedIds.intakeBatchId
      }
    });

    const searchTerm = firstRecord.sourceName.split(" ")[0] ?? firstRecord.sourceName;

    const response = await app.inject({
      method: "GET",
      url: `/ai-ready-intake-records?intakeBatchId=${result.persistedIds.intakeBatchId}&search=${encodeURIComponent(searchTerm)}&limit=1&offset=0`
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.count).toBeLessThanOrEqual(1);
    expect(body.totalCount).toBeGreaterThan(0);
    expect(body.records.every((record: { sourceName: string; rawText: string; cleanedText: string }) =>
      [record.sourceName, record.rawText, record.cleanedText]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
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

  it("filters AI-ready intake records by missing field presence", async () => {
    const app = buildApp();
    const result = await executeMultiSourceIntakeDemo({
      sourceTypes: ["POORLY_FORMED_CSV"]
    });

    const response = await app.inject({
      method: "GET",
      url: `/ai-ready-intake-records?intakeBatchId=${result.persistedIds.intakeBatchId}&missingFields=true&limit=100`
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.totalCount).toBeGreaterThan(0);
    expect(body.records.every((record: { normalizedJson: { missingFields?: string[] } }) =>
      (record.normalizedJson.missingFields ?? []).length > 0
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
