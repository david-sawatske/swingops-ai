import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

describe("admin ops routes", () => {
  it("returns a read-only admin ops summary", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/admin/ops/summary"
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body).toEqual(
      expect.objectContaining({
        aiReadyRecords: expect.objectContaining({
          total: expect.any(Number),
          active: expect.any(Number),
          superseded: expect.any(Number),
          byStatus: expect.any(Object),
          bySourceType: expect.any(Object),
          reviewNeeded: expect.any(Number),
          ragReady: expect.any(Number),
          missingFieldCounts: expect.any(Object),
          missingFieldHotspots: expect.any(Array),
          categoryMix: expect.any(Array),
          sourceQuality: expect.any(Array),
          freshness: expect.objectContaining({
            last24Hours: expect.any(Number),
            last7Days: expect.any(Number),
            last30Days: expect.any(Number)
          })
        }),
        workflowRuns: expect.objectContaining({
          total: expect.any(Number),
          byStatus: expect.any(Object)
        }),
        modelExecutions: expect.objectContaining({
          totalCalls: expect.any(Number),
          succeededCalls: expect.any(Number),
          failedCalls: expect.any(Number),
          fallbackCount: expect.any(Number),
          fallbackRate: expect.any(Number),
          validationPassRate: expect.any(Number),
          estimatedCostTotal: expect.any(Number),
          totalTokens: expect.any(Number),
          byProviderModel: expect.any(Array)
        })
      })
    );

    const newestCreatedAt =
      body.aiReadyRecords.freshness.newestCreatedAt;
    const averageLatencyMs =
      body.modelExecutions.averageLatencyMs;

    expect(
      newestCreatedAt === null || typeof newestCreatedAt === "string"
    ).toBe(true);
    expect(
      averageLatencyMs === null || typeof averageLatencyMs === "number"
    ).toBe(true);

    await app.close();
  });

  it("returns the guarded workflow config snapshot", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/admin/ops/workflow-config"
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body).toEqual(
      expect.objectContaining({
        confidenceThresholds: expect.arrayContaining([
          expect.objectContaining({
            name: "modelAuthority",
            value: "secondary"
          })
        ]),
        reviewRoutingRules: expect.arrayContaining([
          expect.objectContaining({
            ruleId: "negative-evidence",
            effect: "BLOCK_REPAIR"
          })
        ]),
        providerRoutingPolicy: expect.arrayContaining([
          expect.objectContaining({
            taskType: "MAIN_RUN_FIELD_REPAIR",
            fallbackProvider: "MOCK",
            validationRequired: true
          })
        ]),
        mutationPolicy: expect.objectContaining({
          readOnlyToolsOnly: true,
          blockedMutationsVisible: true
        })
      })
    );

    await app.close();
  });
  it("returns the structured golf normalization matrix", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/admin/ops/normalization-matrix"
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "negative-evidence",
          action: "BLOCK_REPAIR"
        }),
        expect.objectContaining({
          id: "category-utility-wood",
          action: "ROUTE_TO_REVIEW"
        }),
        expect.objectContaining({
          id: "shaft-regular",
          canonicalValue: "REGULAR",
          requiresContext: true
        })
      ])
    );

    await app.close();
  });

});
