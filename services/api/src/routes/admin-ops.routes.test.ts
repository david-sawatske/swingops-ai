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
          byStatus: expect.any(Object),
          bySourceType: expect.any(Object),
          reviewNeeded: expect.any(Number),
          ragReady: expect.any(Number),
          missingFieldCounts: expect.any(Object)
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
          averageLatencyMs: expect.anything(),
          estimatedCostTotal: expect.any(Number),
          totalTokens: expect.any(Number),
          byProviderModel: expect.any(Array)
        })
      })
    );

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
