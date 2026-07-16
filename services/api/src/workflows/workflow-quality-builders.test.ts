import { describe, expect, it } from "vitest";

import { parseTradeInDemoText } from "./trade-in-demo-parser.js";
import {
  buildRetryEvents,
  buildValidationChecks
} from "./workflow-quality-builders.js";

function parseCompletePutterRecord() {
  const item = parseTradeInDemoText(
    "Odyssey White Hot OG putter condition 8.0 Average trade value $95"
  )[0];

  if (!item) {
    throw new Error("Expected the putter fixture to produce one parsed item.");
  }

  return item;
}

describe("workflow-quality-builders", () => {
  it("marks shaft flex as not applicable for putter validation", () => {
    const item = parseCompletePutterRecord();

    const checks = buildValidationChecks({
      parsedItems: [item],
      knowledgeMatchesByItem: [],
      inventoryMatchesByItem: [],
      valuationEvidenceByItem: [],
      blockedMutationCount: 1
    });

    const shaftFlexCheck = checks.find(
      (check) =>
        check.recordId === item.id &&
        check.field === "shaftFlex"
    );

    expect(shaftFlexCheck).toMatchObject({
      status: "PASS",
      severity: "INFO",
      message: "Shaft flex is not applicable to putters.",
      reviewRequired: false
    });
  });

  it("does not select a putter for the shaft-flex retry path", () => {
    const item = parseCompletePutterRecord();
    const retryEvents = buildRetryEvents([item]);

    expect(retryEvents).toHaveLength(1);
    expect(retryEvents[0]).toMatchObject({
      id: "retry-shaft-flex-not-needed",
      targetField: "shaftFlex",
      recordId: null,
      status: "SKIPPED"
    });
  });
});
