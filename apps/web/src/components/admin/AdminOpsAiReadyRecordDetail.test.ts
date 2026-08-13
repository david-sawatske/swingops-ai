import { describe, expect, it } from "vitest";

import { getReviewAttentionMessage } from "./adminOpsReviewAttention";

describe("AdminOpsAiReadyRecordDetail", () => {
  it("describes records held only for source-quality review accurately", () => {
    expect(
      getReviewAttentionMessage({
        missingFieldCount: 0,
        qualitySignalCount: 1,
      }),
    ).toBe(
      "Review the source-quality signals before this otherwise complete record moves downstream.",
    );
  });

  it("distinguishes missing-field holds from combined review holds", () => {
    expect(
      getReviewAttentionMessage({
        missingFieldCount: 2,
        qualitySignalCount: 0,
      }),
    ).toContain("unresolved fields");
    expect(
      getReviewAttentionMessage({
        missingFieldCount: 2,
        qualitySignalCount: 1,
      }),
    ).toContain("fields and quality signals");
  });
});
