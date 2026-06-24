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
  it("matches expanded QA fixture products to seeded internal SKUs", () => {
    const cases = [
      {
        input: {
          brand: "PING",
          productLine: "G430 Max",
          category: "driver",
          shaftBrand: "PING Alta",
          rawText: "PING G430 Max driver Tour X-Stiff condition 9.5 Mint"
        },
        productId: "prod_ping_g430_max_driver_2023",
        sku: "PING-G430MAX-DRV-2023"
      },
      {
        input: {
          brand: "Cleveland",
          productLine: "RTX 6 ZipCore",
          category: "wedge",
          shaftBrand: "True Temper",
          rawText: "Cleveland RTX 6 ZipCore wedge Senior flex condition 9.0 Above Average"
        },
        productId: "prod_cleveland_rtx6_zipcore_wedge_2023",
        sku: "CLEVELAND-RTX6ZIPCORE-WEDGE-2023"
      },
      {
        input: {
          brand: "Odyssey",
          productLine: "White Hot OG",
          category: "putter",
          shaftBrand: "Odyssey Stroke Lab",
          rawText: "Odyssey White Hot OG putter Ladies flex condition 8.0 Average"
        },
        productId: "prod_odyssey_white_hot_og_putter_2021",
        sku: "ODYSSEY-WHITEHOTOG-PUTTER-2021"
      },
      {
        input: {
          brand: "Mizuno",
          productLine: "JPX 923 Hot Metal",
          category: "irons",
          shaftBrand: "Nippon",
          rawText: "Mizuno JPX 923 Hot Metal irons Tour X-Stiff condition 9.0 Above Average"
        },
        productId: "prod_mizuno_jpx923_hot_metal_iron_set_2023",
        sku: "MIZUNO-JPX923HOTMETAL-IRONSET-2023"
      }
    ];

    for (const testCase of cases) {
      const result = lookupInventoryProduct(testCase.input);

      expect(result.productId).toBe(testCase.productId);
      expect(result.sku).toBe(testCase.sku);
      expect(result.confidence).toBeGreaterThanOrEqual(0.86);
    }
  });

});
