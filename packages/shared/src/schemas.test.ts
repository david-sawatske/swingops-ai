import { describe, expect, it } from "vitest";

import { golfClubSchema } from "./schemas";

describe("golfClubSchema", () => {
  it("validates a structured golf club record", () => {
    const result = golfClubSchema.safeParse({
      brand: "TaylorMade",
      model: "Stealth 2",
      category: "Driver",
      loft: "10.5°",
      shaftBrand: "Fujikura Ventus",
      shaftFlex: "Stiff",
      dexterity: "Right",
      condition: "Very Good",
      gripCondition: "Good",
      length: "Standard",
      notes: "Minor crown wear. No sky marks.",
      confidenceScore: 0.91,
      missingFields: []
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid confidence scores", () => {
    const result = golfClubSchema.safeParse({
      brand: "Ping",
      model: "G425",
      category: "Driver",
      condition: "Good",
      confidenceScore: 1.5,
      missingFields: []
    });

    expect(result.success).toBe(false);
  });
});
