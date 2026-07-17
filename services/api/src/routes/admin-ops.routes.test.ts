import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import {
  getAdminOpsModelAssistanceTelemetry,
  getAdminOpsProviderAttemptTelemetry
} from "./admin-ops.routes.js";

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
          executionSuccessRate: expect.any(Number),
          validationTrackedCalls: expect.any(Number),
          validationPassedCalls: expect.any(Number),
          validationFailedCalls: expect.any(Number),
          validationPassRate: expect.any(Number),
          assistance: expect.objectContaining({
            totalCalls: expect.any(Number),
            validationTrackedCalls: expect.any(Number),
            validationPassedCalls: expect.any(Number),
            validationFailedCalls: expect.any(Number),
            validationPassRate: expect.any(Number),
            selectedRecords: expect.any(Number),
            recordOutcomes: expect.any(Number),
            outcomeCoverageRate: expect.any(Number),
            repairSuggested: expect.any(Number),
            candidateComparison: expect.any(Number),
            noSafeRepair: expect.any(Number)
          }),
          attempts: expect.objectContaining({
            totalAttempts: expect.any(Number),
            successfulAttempts: expect.any(Number),
            nonSuccessfulAttempts: expect.any(Number),
            attemptSuccessRate: expect.any(Number),
            byProviderModel: expect.any(Array)
          }),
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

  it("extracts validated assistance outcomes from persisted model logs", () => {
    const telemetry = getAdminOpsModelAssistanceTelemetry(
      {
        policyKey: "MAIN_RUN_FIELD_REPAIR",
        outputSchema: {
          name: "main_run_field_repair"
        },
        inputJson: {
          records: [
            { recordId: "record-1" },
            { recordId: "record-2" },
            { recordId: "record-3" }
          ]
        }
      },
      {
        validation: {
          validationPassed: true
        },
        providerExecution: {
          outputJson: {
            parsedJson: {
              recordOutcomes: [
                {
                  outcomeType: "REPAIR_SUGGESTED"
                },
                {
                  outcomeType: "CANDIDATE_COMPARISON"
                },
                {
                  outcomeType: "NO_SAFE_REPAIR"
                }
              ]
            }
          }
        }
      }
    );

    expect(telemetry).toEqual({
      isAssistanceCall: true,
      validationPassed: true,
      selectedRecordCount: 3,
      recordOutcomeCount: 3,
      repairSuggestedCount: 1,
      candidateComparisonCount: 1,
      noSafeRepairCount: 1
    });
  });

  it("does not count invalid provider outcomes as accepted assistance", () => {
    const telemetry = getAdminOpsModelAssistanceTelemetry(
      {
        agentName: "main-run-field-repair-agent",
        inputJson: {
          records: [{ recordId: "record-1" }]
        }
      },
      {
        validation: {
          validationPassed: false
        },
        providerExecution: {
          outputJson: {
            recordOutcomes: [
              {
                outcomeType: "REPAIR_SUGGESTED"
              }
            ]
          }
        }
      }
    );

    expect(telemetry).toMatchObject({
      isAssistanceCall: true,
      validationPassed: false,
      selectedRecordCount: 1,
      recordOutcomeCount: 0,
      repairSuggestedCount: 0,
      candidateComparisonCount: 0,
      noSafeRepairCount: 0
    });
  });

  it("separates provider attempt failures from successful fallback attempts", () => {
    const telemetry = getAdminOpsProviderAttemptTelemetry([
      {
        provider: "OPENAI",
        model: "gpt-4.1-mini",
        status: "FAILED",
        reason: "The preferred provider failed.",
        errorMessage:
          "OPENAI adapter request failed with 400 Bad Request.",
        latencyMs: 1628,
        estimatedCostUsd: 0.0012
      },
      {
        provider: "MOCK",
        model: "mock-golf-workflow-model",
        status: "SUCCESS",
        reason: "Fallback provider completed the request.",
        errorMessage: null,
        latencyMs: 2,
        estimatedCostUsd: 0
      },
      {
        provider: "OPENAI",
        model: "gpt-4.1-mini",
        status: "SUCCESS",
        reason: "Preferred provider completed the request.",
        errorMessage: null,
        latencyMs: 900,
        estimatedCostUsd: 0.002
      }
    ]);

    expect(telemetry).toEqual({
      totalAttempts: 3,
      successfulAttempts: 2,
      nonSuccessfulAttempts: 1,
      attemptSuccessRate: 66.7,
      byProviderModel: [
        {
          provider: "MOCK",
          model: "mock-golf-workflow-model",
          attemptCount: 1,
          successfulAttemptCount: 1,
          nonSuccessfulAttemptCount: 0,
          averageLatencyMs: 2,
          estimatedCostTotal: 0,
          latestFailureMessage: null
        },
        {
          provider: "OPENAI",
          model: "gpt-4.1-mini",
          attemptCount: 2,
          successfulAttemptCount: 1,
          nonSuccessfulAttemptCount: 1,
          averageLatencyMs: 1264,
          estimatedCostTotal: 0.0032,
          latestFailureMessage:
            "OPENAI adapter request failed with 400 Bad Request."
        }
      ]
    });
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
