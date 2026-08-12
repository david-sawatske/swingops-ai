import { describe, expect, it } from "vitest";

import { buildAdminOpsBaselineFixtures } from "./admin-ops-baseline-fixtures.js";
import { validateAdminOpsBaselineFixtures } from "./admin-ops-baseline-validation.js";

const ANCHOR = new Date("2026-08-12T17:00:00.000Z");

describe("Admin Ops operational baseline fixtures", () => {
  it("reconciles every fixture total from individual records", () => {
    const fixtures = buildAdminOpsBaselineFixtures(ANCHOR);

    expect(validateAdminOpsBaselineFixtures(fixtures)).toEqual({
      aiReadyRecords: {
        total: 56,
        active: 48,
        superseded: 8,
        readyForRag: 31,
        needsReview: 17,
        last24Hours: 9,
      },
      workflowRuns: {
        total: 14,
        completed: 8,
        needsReview: 5,
        failed: 1,
      },
      reviewQueueItems: {
        total: 34,
        open: 10,
        inReview: 7,
        resolved: 9,
        superseded: 8,
      },
      modelTelemetry: {
        logicalCalls: 20,
        providerAttempts: 22,
        successfulAttempts: 20,
        nonSuccessfulAttempts: 2,
        fallbackCalls: 2,
        selectedRecords: 58,
        recordOutcomes: 58,
        repairSuggestions: 32,
        candidateComparisons: 14,
        noSafeRepairOutcomes: 12,
        totalTokens: 28_600,
        estimatedCostUsd: 0.0614,
        averageLatencyMs: 7_886,
      },
    });
  });

  it("is deterministic for the same anchor and moves only the reporting window", () => {
    const first = buildAdminOpsBaselineFixtures(ANCHOR);
    const second = buildAdminOpsBaselineFixtures(ANCHOR);
    const moved = buildAdminOpsBaselineFixtures(
      new Date(ANCHOR.getTime() + 24 * 60 * 60 * 1_000),
    );

    expect(second).toEqual(first);
    expect(moved.aiReadyRecords.map((record) => record.id)).toEqual(
      first.aiReadyRecords.map((record) => record.id),
    );
    expect(moved.workflowRuns.map((run) => run.id)).toEqual(
      first.workflowRuns.map((run) => run.id),
    );
    const firstCreatedAt = first.aiReadyRecords[0]?.createdAt;
    const movedCreatedAt = moved.aiReadyRecords[0]?.createdAt;

    expect(firstCreatedAt).toBeDefined();
    expect(movedCreatedAt).toBeDefined();
    expect(
      (movedCreatedAt?.getTime() ?? 0) - (firstCreatedAt?.getTime() ?? 0),
    ).toBe(24 * 60 * 60 * 1_000);
  });

  it("contains named evidence for each intentionally unusual scenario", () => {
    const fixtures = buildAdminOpsBaselineFixtures(ANCHOR);
    const recordScenarios = new Set(
      fixtures.aiReadyRecords.map((record) => record.metadataJson.scenario),
    );
    const modelScenarios = new Set(
      fixtures.modelCalls.map((call) => call.requestJson.baselineScenario),
    );

    expect([...recordScenarios]).toEqual(
      expect.arrayContaining([
        "CLEAN_COUNTER_NOTE",
        "RECOGNIZED_SHORTHAND",
        "MALFORMED_CSV_ROW",
        "DEGRADED_LOG_PAYLOAD",
        "AMBIGUOUS_CATALOG_IDENTITY",
        "UNKNOWN_PRODUCT_LINE",
        "NEGATIVE_EVIDENCE",
        "STORE_INSPECTION",
        "HUMAN_CORRECTION",
      ]),
    );
    expect([...modelScenarios]).toEqual(
      expect.arrayContaining(["PROVIDER_TIMEOUT", "PROVIDER_RATE_LIMIT"]),
    );
    expect(
      fixtures.toolCalls.filter(
        (call) =>
          call.status === "FAILED" &&
          call.outputJson.policyDecision === "BLOCKED",
      ),
    ).toHaveLength(2);
    expect(
      fixtures.workflowRuns.find((run) => run.status === "FAILED"),
    ).toMatchObject({
      errorMessage:
        "Store 207 CSV header did not contain a recoverable record boundary.",
      failureJson: {
        classification: "SOURCE_PROCESSING_FAILURE",
        retryable: true,
      },
    });
  });

  it("rejects a fixture whose aggregate no longer reconciles", () => {
    const fixtures = buildAdminOpsBaselineFixtures(ANCHOR);
    fixtures.aiReadyRecords[0]!.status = "NEEDS_REVIEW";

    expect(() => validateAdminOpsBaselineFixtures(fixtures)).toThrow(
      /READY_FOR_RAG: expected 31, received 30/,
    );
  });
});
