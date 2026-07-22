import { describe, expect, it } from "vitest";

import { parseTradeInDemoText } from "./trade-in-demo-parser.js";
import {
  buildSkippedTargetedFieldRetry,
  completeTargetedFieldRetry,
  findTargetedFieldRetryCandidate,
} from "./targeted-field-retry.js";

function requireParsedItem(sourceText: string) {
  const item = parseTradeInDemoText(sourceText)[0];

  if (!item) {
    throw new Error("Expected the fixture to produce one parsed item.");
  }

  return item;
}

describe("targeted-field-retry", () => {
  it("skips the retry when shaft flex is not applicable", () => {
    const item = requireParsedItem(
      "Odyssey White Hot OG putter condition 8.0 Average trade value $95",
    );

    expect(findTargetedFieldRetryCandidate([item])).toBeNull();
    expect(buildSkippedTargetedFieldRetry([item]).retryEvent).toMatchObject({
      id: "retry-shaft-flex-not-needed",
      status: "SKIPPED",
      attemptCount: 0,
      maxAttempts: 1,
      modelCallLogId: null,
    });
  });

  it("records one unresolved attempt when no safe retry value is available", () => {
    const item = requireParsedItem(
      "PING G425 irons 5-PW shaft unknown condition 8.0 Average trade value $175",
    );
    const result = completeTargetedFieldRetry({
      parsedItems: [item],
      recordId: item.id,
      modelCallLogId: "retry-model-call-1",
      validationPassed: true,
      validationErrors: [],
      suggestions: [],
    });

    expect(result.retryEvent).toMatchObject({
      status: "UNRESOLVED",
      attemptCount: 1,
      maxAttempts: 1,
      modelCallLogId: "retry-model-call-1",
    });
    expect(result.parsedItems[0]?.shaftFlex).toBeNull();
    expect(result.parsedItems[0]?.missingFields).toContain("shaftFlex");
  });

  it("applies one validated non-review suggestion before human review", () => {
    const parsedItem = requireParsedItem(
      "PING G425 irons 5-PW condition 8.0 Average trade value $175",
    );
    const item = {
      ...parsedItem,
      rawLine: `${parsedItem.rawLine} shaft marked S`,
    };
    const result = completeTargetedFieldRetry({
      parsedItems: [item],
      recordId: item.id,
      modelCallLogId: "retry-model-call-2",
      validationPassed: true,
      validationErrors: [],
      suggestions: [
        {
          recordId: item.id,
          fieldName: "shaftFlex",
          sourcePhrase: "shaft marked S",
          candidateValue: "STIFF",
          confidence: 0.9,
          reason: "The retry found an explicit shaft-flex marking.",
          reviewRequired: false,
        },
      ],
    });

    expect(result.retryEvent).toMatchObject({
      status: "RESOLVED",
      attemptCount: 1,
      maxAttempts: 1,
      modelCallLogId: "retry-model-call-2",
    });
    expect(result.parsedItems[0]).toMatchObject({
      shaftFlex: "STIFF",
      parserEvidence: {
        shaftFlex: {
          value: "STIFF",
          sourceText: "shaft marked S",
        },
      },
    });
    expect(result.parsedItems[0]?.missingFields).not.toContain("shaftFlex");
  });
});
