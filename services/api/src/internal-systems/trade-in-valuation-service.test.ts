import { describe, expect, it } from "vitest";

import { lookupInventoryProduct } from "./inventory-service.js";
import {
  estimateTradeInValuation,
  explainTradeInValuationAdjustments
} from "./trade-in-valuation-service.js";

describe("trade-in-valuation-service", () => {
  it("estimates a demo valuation range for a known record", () => {
    const inventoryMatch = lookupInventoryProduct({
      brand: "Callaway",
      productLine: "Rogue ST Max",
      category: "driver",
      shaftBrand: "Project X HZRDUS",
      rawText: "Cally Rogue ST Max driver 9 Project X HZRDUS x-stiff, paint wear, no wrench"
    });

    const estimate = estimateTradeInValuation({
      inventoryMatch,
      conditionNotes: ["paint wear"],
      accessoriesNotes: ["no wrench"]
    });

    expect(estimate.lowValue).toBe(107);
    expect(estimate.highValue).toBe(145);
    expect(estimate.confidence).toBe("MEDIUM");
    expect(estimate.reviewRequired).toBe(false);
  });

  it("adjusts the demo range for condition and accessory notes", () => {
    const inventoryMatch = lookupInventoryProduct({
      brand: "TM",
      productLine: "stealth2",
      category: "drv",
      rawText: "TM stealth2 drv 10.5 Ventus stiff, no hc, sky mark on crown"
    });

    const estimate = estimateTradeInValuation({
      inventoryMatch,
      conditionNotes: ["sky mark on crown"],
      accessoriesNotes: ["no hc"]
    });

    expect(estimate.lowValue).toBe(109);
    expect(estimate.highValue).toBe(149);
    expect(estimate.adjustments.map((adjustment) => adjustment.reason)).toEqual(
      expect.arrayContaining([
        "Crown sky mark reduces the demo range.",
        "Missing headcover reduces the demo range."
      ])
    );
  });

  it("requires review when condition is missing or unclear", () => {
    const inventoryMatch = lookupInventoryProduct({
      brand: "PING",
      productLine: "G425",
      category: "irons",
      rawText: "PING G425 irons 5-PW reg, worn grips, condition unclear"
    });

    const estimate = estimateTradeInValuation({
      inventoryMatch,
      conditionNotes: ["condition unclear"],
      accessoriesNotes: []
    });

    expect(estimate.reviewRequired).toBe(true);
    expect(estimate.confidence).toBe("LOW");
    expect(estimate.reviewReasons).toContain("Condition notes are missing or unclear.");
  });

  it("explains valuation adjustments without changing the estimate path", () => {
    const inventoryMatch = lookupInventoryProduct({
      brand: "Titleist",
      productLine: "TSR2",
      category: "fairway wood",
      rawText: "Titleist TSR2 3w face wear hc included"
    });

    const explanation = explainTradeInValuationAdjustments({
      inventoryMatch,
      conditionNotes: ["face wear"],
      accessoriesNotes: ["hc included"]
    });

    expect(explanation.adjustments.map((adjustment) => adjustment.reason)).toEqual(
      expect.arrayContaining([
        "Face wear reduces the demo range.",
        "Included headcover supports the unadjusted accessory range."
      ])
    );
    expect(explanation.valueFactors.length).toBeGreaterThan(0);
  });
});
