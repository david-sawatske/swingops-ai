import { describe, expect, it } from "vitest";

import { formatEnumLabel } from "./formatting";

describe("formatEnumLabel", () => {
  it("handles empty values safely", () => {
    expect(formatEnumLabel(null)).toBe("—");
    expect(formatEnumLabel(undefined)).toBe("—");
    expect(formatEnumLabel("")).toBe("—");
    expect(formatEnumLabel("   ")).toBe("—");
  });

  it("formats enum-like values as readable labels", () => {
    expect(formatEnumLabel("AI_READY_RECORDS")).toBe("AI Ready Records");
    expect(formatEnumLabel("READY_FOR_REVIEW")).toBe("Ready for review");
    expect(formatEnumLabel("READY_FOR_RAG")).toBe("Ready for RAG");
    expect(formatEnumLabel("NEEDS_REVIEW")).toBe("Needs review");
    expect(formatEnumLabel("FAIRWAY_WOOD")).toBe("Fairway Wood");
  });

  it("preserves normalized display values", () => {
    expect(formatEnumLabel("9.5 Mint")).toBe("9.5 Mint");
    expect(formatEnumLabel("9.0 Above Average")).toBe("9.0 Above Average");
    expect(formatEnumLabel("8.0 Average")).toBe("8.0 Average");
    expect(formatEnumLabel("7.0 Below Average")).toBe("7.0 Below Average");
    expect(formatEnumLabel("6.0 Poor")).toBe("6.0 Poor");
    expect(formatEnumLabel("X-Stiff")).toBe("X-Stiff");
    expect(formatEnumLabel("Tour X-Stiff")).toBe("Tour X-Stiff");
  });

  it("uses known golf display labels for enum values", () => {
    expect(formatEnumLabel("X_STIFF")).toBe("X-Stiff");
    expect(formatEnumLabel("TOUR_X_STIFF")).toBe("Tour X-Stiff");
    expect(formatEnumLabel("IRON_SET")).toBe("Iron Set");
  });
});
