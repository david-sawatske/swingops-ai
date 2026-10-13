import { describe, expect, it } from "vitest";

import { demoInventoryProducts } from "../internal-systems/inventory-demo-data.js";
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
          call.status === "BLOCKED" &&
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

  it("uses varied catalog-backed records instead of repeated placeholder values", () => {
    const fixtures = buildAdminOpsBaselineFixtures(ANCHOR);
    const activeRecords = fixtures.aiReadyRecords.filter(
      (record) => record.status !== "SUPERSEDED",
    );
    const valuesFor = (field: string) =>
      new Set(
        activeRecords
          .map((record) => record.normalizedJson[field])
          .filter((value) => value !== null && value !== undefined),
      );
    const knownProducts = new Set(
      demoInventoryProducts.map(
        (product) =>
          `${product.brand}|${product.productLine}|${product.category}`,
      ),
    );

    expect(new Set(activeRecords.map((record) => record.rawText))).toHaveLength(
      48,
    );
    expect(valuesFor("productLine").size).toBeGreaterThanOrEqual(25);
    expect(valuesFor("tradeInValue").size).toBeGreaterThanOrEqual(20);
    expect(valuesFor("shaftFlex")).toEqual(
      new Set([
        "REGULAR",
        "STIFF",
        "SENIOR",
        "X_STIFF",
        "LADIES",
        "TOUR_X_STIFF",
      ]),
    );
    expect(valuesFor("conditionGrade")).toEqual(
      new Set([
        "9.5 Mint",
        "9.0 Above Average",
        "8.0 Average",
        "7.0 Below Average",
        "6.0 Poor",
      ]),
    );

    for (const sourceType of [
      "FREE_TEXT",
      "POORLY_FORMED_CSV",
      "EMAIL",
      "LOG",
    ] as const) {
      expect(
        new Set(
          activeRecords
            .filter((record) => record.sourceType === sourceType)
            .map((record) => record.normalizedJson.category),
        ).size,
      ).toBeGreaterThanOrEqual(4);
    }

    for (const record of activeRecords) {
      const brand = record.normalizedJson.brand;
      const productLine = record.normalizedJson.productLine;
      const category = record.normalizedJson.category;

      if (
        typeof brand === "string" &&
        typeof productLine === "string" &&
        typeof category === "string"
      ) {
        expect(knownProducts).toContain(`${brand}|${productLine}|${category}`);
      }

      const missingFields = Array.isArray(record.normalizedJson.missingFields)
        ? record.normalizedJson.missingFields
        : [];
      const fieldAuthority = record.metadataJson.fieldAuthority;

      expect(fieldAuthority).toBeTypeOf("object");

      for (const missingField of missingFields) {
        expect(fieldAuthority).toMatchObject({
          [String(missingField)]: "REQUIRES_VERIFICATION",
        });

        if (missingField !== "category") {
          expect(record.normalizedJson[String(missingField)]).toBeNull();
        }
      }

      if (record.metadataJson.scenario === "DEGRADED_LOG_PAYLOAD") {
        expect(record.rawText).toContain("parser_version=2.4.1");
        expect(record.rawText).toContain(
          missingFields.includes("shaftFlex") ? "flex=?" : "flex=",
        );
        expect(record.rawText).toContain(
          missingFields.includes("tradeInValue")
            ? "valuation=pending"
            : "valuation=",
        );
      }
    }
  });

  it("keeps each batch aligned with one believable source channel", () => {
    const fixtures = buildAdminOpsBaselineFixtures(ANCHOR);
    const batches = new Map(
      fixtures.intakeBatches.map((batch) => [batch.id, batch]),
    );
    const expectedBatchSource = {
      FREE_TEXT: "FREEFORM_NOTES",
      POORLY_FORMED_CSV: "BAD_CSV",
      EMAIL: "EMAIL",
      LOG: "MANUAL_ENTRY",
    } as const;

    for (const record of fixtures.aiReadyRecords.filter(
      (candidate) => candidate.status !== "SUPERSEDED",
    )) {
      expect(batches.get(record.intakeBatchId)?.sourceType).toBe(
        expectedBatchSource[record.sourceType],
      );
    }

    expect(
      fixtures.aiReadyRecords.find((record) => record.sourceType === "EMAIL")
        ?.rawText,
    ).toContain("Subject: Trade-in intake");
    expect(
      fixtures.aiReadyRecords.find((record) => record.sourceType === "LOG")
        ?.rawText,
    ).toMatch(/\d{4}-\d{2}-\d{2}T.* trade_record/);
  });

  it("rejects a fixture whose aggregate no longer reconciles", () => {
    const fixtures = buildAdminOpsBaselineFixtures(ANCHOR);
    fixtures.aiReadyRecords[0]!.status = "NEEDS_REVIEW";

    expect(() => validateAdminOpsBaselineFixtures(fixtures)).toThrow(
      /READY_FOR_RAG: expected 31, received 30/,
    );
  });
});
