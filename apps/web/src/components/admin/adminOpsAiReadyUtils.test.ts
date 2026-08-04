import { describe, expect, it } from "vitest";

import {
  formatAiReadyFieldLabel,
  formatAiReadySourceTypeLabel,
  getAiReadyExplorerSort,
} from "./adminOpsAiReadyUtils";

describe("AI-ready record labels", () => {
  it("turns normalized field keys into reviewer-friendly labels", () => {
    expect(formatAiReadyFieldLabel("conditionGrade")).toBe("Condition grade");
    expect(formatAiReadyFieldLabel("tradeInValue")).toBe("Trade-in value");
    expect(formatAiReadyFieldLabel("shaftFlex")).toBe("Shaft flex");
  });

  it("uses operational source names instead of storage enum values", () => {
    expect(formatAiReadySourceTypeLabel("POORLY_FORMED_CSV")).toBe(
      "Malformed CSV",
    );
    expect(formatAiReadySourceTypeLabel("FREE_TEXT")).toBe("Free text");
    expect(formatAiReadySourceTypeLabel("LOG")).toBe("Operations log");
  });

  it("supports chronological history sorting", () => {
    expect(getAiReadyExplorerSort("NEWEST")).toBe("createdAt_desc");
    expect(getAiReadyExplorerSort("OLDEST")).toBe("createdAt_asc");
  });
});
