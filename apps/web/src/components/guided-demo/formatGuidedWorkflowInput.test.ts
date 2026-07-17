import { describe, expect, it } from "vitest";

import {
  formatGuidedWorkflowInputFromRecords,
} from "./formatGuidedWorkflowInput";

type WorkflowInputRecord =
  Parameters<
    typeof formatGuidedWorkflowInputFromRecords
  >[0][number];

function buildRecord(
  overrides: Partial<WorkflowInputRecord> = {},
): WorkflowInputRecord {
  return {
    id: "record-1",
    sourceId: "source-1",
    sourceType: "POORLY_FORMED_CSV",
    brand: "PING",
    productLine: "G430",
    category: "DRIVER",
    shaftFlex: "REGULAR",
    conditionGrade: "8.0 Average",
    tradeInValue: 180,
    customerName: null,
    customerEmail: null,
    storeId: "207",
    eventTimestamp: null,
    attachmentsMentioned: [],
    missingFields: [],
    confidence: 0.88,
    reviewNeeded: true,
    sourceText:
      "PING,G430,driver,R,8.0 Average,$180,207",
    normalizedText:
      "PING G430 DRIVER shaft flex REGULAR condition 8.0 Average trade value $180 store 207",
    ...overrides,
  };
}

describe("formatGuidedWorkflowInputFromRecords", () => {
  it("hands canonical fields to Step 3 while preserving original source evidence", () => {
    const csvSourceText =
      "PING,G430,driver,R,8.0 Average,$180,207";
    const priorReviewSourceText =
      "PING G425 4-PW, shaft firm, condition 8.0 Average, trade value $210, store 207.";

    const output =
      formatGuidedWorkflowInputFromRecords(
        [
          buildRecord({
            sourceText: csvSourceText,
          }),
          buildRecord({
            id: "record-2",
            productLine: "G425",
            category: "IRON_SET",
            shaftFlex: null,
            tradeInValue: 210,
            missingFields: ["shaftFlex"],
            confidence: 0.72,
            sourceText:
              priorReviewSourceText,
            normalizedText:
              "PING G425 IRON_SET condition 8.0 Average trade value $210 store 207 missing shaftFlex",
          }),
        ],
        {
          includeMissingFields: true,
        },
      );

    expect(output.split("\n")).toEqual([
      "1. PING G430 DRIVER — shaft flex REGULAR; condition 8.0 Average; trade value $180; store 207; review needed; source evidence: PING,G430,driver,R,8.0 Average,$180,207",
      "2. PING G425 IRON_SET — condition 8.0 Average; trade value $210; store 207; review needed; missing shaftFlex; source evidence: PING G425 4-PW, shaft firm, condition 8.0 Average, trade value $210, store 207.",
    ]);

    expect(output).toContain(
      "shaft flex REGULAR",
    );
    expect(output).toContain(
      "source evidence: " +
        priorReviewSourceText,
    );
    expect(output).not.toBe(
      [
        csvSourceText,
        priorReviewSourceText,
      ].join("\n"),
    );
  });
});
