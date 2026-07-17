import { describe, expect, it } from "vitest";

import {
  detectApprovedConditionGradeWithEvidence,
  detectShaftFlexWithEvidence,
  detectTradeInValueWithEvidence
} from "./parser-normalizers.js";

describe("shared parser normalizers", () => {
  it("normalizes contextual short codes across every approved shaft-flex family", () => {
    const cases = [
      ["shaft marked TX", "TOUR_X_STIFF"],
      ["flex code X", "X_STIFF"],
      ["shaft label S", "STIFF"],
      ["shaft: R", "REGULAR"],
      ["flex marked SR", "SENIOR"],
      ["shaft code A", "SENIOR"],
      ["shaft marked L", "LADIES"]
    ] as const;

    for (const [sourceText, expectedValue] of cases) {
      expect(
        detectShaftFlexWithEvidence(sourceText)
      ).toEqual({
        value: expectedValue,
        evidence: {
          value: expectedValue,
          sourceText
        }
      });
    }
  });

  it("does not interpret unscoped short codes as shaft-flex evidence", () => {
    const unscopedValues = [
      "PING TX prototype driver",
      "store TX",
      "inventory code S",
      "record status R",
      "customer group A",
      "location L"
    ];

    for (const sourceText of unscopedValues) {
      expect(
        detectShaftFlexWithEvidence(sourceText)
      ).toEqual({
        value: null
      });
    }
  });

  it("keeps negative shaft evidence unresolved", () => {
    expect(
      detectShaftFlexWithEvidence(
        "PING G425 iron set, shaft unknown."
      )
    ).toEqual({
      value: null
    });

    expect(
      detectShaftFlexWithEvidence(
        "Callaway driver, flex not listed."
      )
    ).toEqual({
      value: null
    });
  });

  it("preserves approved condition-grade normalization and evidence", () => {
    expect(
      detectApprovedConditionGradeWithEvidence(
        "condition avg"
      )
    ).toEqual({
      value: "8.0 Average",
      evidence: {
        value: "8.0 Average",
        sourceText: "condition avg"
      }
    });

    expect(
      detectApprovedConditionGradeWithEvidence(
        "condition unclear"
      )
    ).toEqual({
      value: null
    });
  });

  it("preserves explicit trade-value normalization and rejects pending values", () => {
    expect(
      detectTradeInValueWithEvidence(
        "estimated value $145"
      )
    ).toEqual({
      value: 145,
      evidence: {
        value: 145,
        sourceText: "estimated value $145"
      }
    });

    expect(
      detectTradeInValueWithEvidence(
        "trade value pending review"
      )
    ).toEqual({
      value: null
    });
  });

  it("prefers specific overlapping shaft evidence", () => {
    expect(
      detectShaftFlexWithEvidence(
        "shaft Tour X-Stiff"
      )
    ).toEqual({
      value: "TOUR_X_STIFF",
      evidence: {
        value: "TOUR_X_STIFF",
        sourceText: "shaft Tour X-Stiff"
      }
    });

    expect(
      detectShaftFlexWithEvidence(
        "shaft x-stiff"
      )
    ).toEqual({
      value: "X_STIFF",
      evidence: {
        value: "X_STIFF",
        sourceText: "shaft x-stiff"
      }
    });
  });

  it("rejects conflicting normalized shaft-flex values", () => {
    expect(
      detectShaftFlexWithEvidence(
        "shaft code S or flex code R"
      )
    ).toEqual({
      value: null
    });
  });

  it("blocks positive shaft evidence when scoped negative evidence is present", () => {
    expect(
      detectShaftFlexWithEvidence(
        "shaft unknown, possible marking TX"
      )
    ).toEqual({
      value: null
    });

    expect(
      detectShaftFlexWithEvidence(
        "generation unclear, shaft marked TX"
      )
    ).toEqual({
      value: "TOUR_X_STIFF",
      evidence: {
        value: "TOUR_X_STIFF",
        sourceText: "shaft marked TX"
      }
    });
  });

  it("rejects conflicting or uncertain condition grades", () => {
    expect(
      detectApprovedConditionGradeWithEvidence(
        "condition 8.0 Average or condition 7.0 Below Average"
      )
    ).toEqual({
      value: null
    });

    expect(
      detectApprovedConditionGradeWithEvidence(
        "condition unclear, possible 8.0 Average"
      )
    ).toEqual({
      value: null
    });
  });

  it("rejects conflicting explicit trade values", () => {
    expect(
      detectTradeInValueWithEvidence(
        "trade value $145 or estimated value $150"
      )
    ).toEqual({
      value: null
    });

    expect(
      detectTradeInValueWithEvidence(
        "generation pending, trade value $145"
      )
    ).toEqual({
      value: 145,
      evidence: {
        value: 145,
        sourceText: "trade value $145"
      }
    });
  });
});
