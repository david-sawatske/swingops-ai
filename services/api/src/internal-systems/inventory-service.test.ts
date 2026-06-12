import { describe, expect, it } from "vitest";

import {
  findSimilarInventoryProducts,
  lookupInventoryProduct
} from "./inventory-service.js";

describe("inventory-service", () => {
  it("matches a known TaylorMade record to an internal SKU", () => {
    const result = lookupInventoryProduct({
      brand: "TM",
      productLine: "stealth2",
      category: "drv",
      shaftBrand: "Ventus",
      rawText: "TM stealth2 drv 10.5 Ventus stiff, no hc, sky mark on crown"
    });

    expect(result.productId).toBe("prod_taylormade_stealth2_driver_2023");
    expect(result.sku).toBe("TM-STEALTH2-DRV-2023");
    expect(result.confidence).toBeGreaterThanOrEqual(0.86);
    expect(result.matchReasons).toContain("Brand matched TaylorMade.");
    expect(result.matchReasons).toContain("Product line matched Stealth 2.");
  });

  it("returns similar products when the parsed product is ambiguous", () => {
    const result = lookupInventoryProduct({
      brand: "Titleist",
      productLine: "TSR maybe TS2",
      category: "3w",
      shaftBrand: "Tensei",
      rawText: "Titleist TSR maybe TS2 3w 15 deg Tensei s flex, face wear, hc included"
    });

    expect(result.brand).toBe("Titleist");
    expect(result.confidence).toBeLessThan(0.9);
    expect(result.similarProducts.length).toBeGreaterThanOrEqual(1);
    expect(result.similarProducts.map((product) => product.sku)).toContain(
      "TITLEIST-TSR2-FWY-2023"
    );
  });

  it("finds similar internal products for a broad family query", () => {
    const result = findSimilarInventoryProducts({
      brand: "PING",
      productLine: "G425",
      category: "irons",
      rawText: "PING G425 irons 5-PW reg, worn grips, condition unclear"
    });

    expect(result.similarProducts[0]?.sku).toBe("PING-G425-IRONSET-2021");
    expect(result.similarProducts.some((product) => product.sku === "PING-G430-IRONSET-2023")).toBe(
      true
    );
  });
});
