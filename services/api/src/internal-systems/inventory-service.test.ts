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
          rawText: "Odyssey White Hot OG putter condition 8.0 Average"
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


  it("does not select an arbitrary product for a broad shared family", () => {
    const result = lookupInventoryProduct({
      brand: "Titleist",
      productLine: "TSR",
      category: "fairway wood",
      rawText: "Titleist TSR fairway wood"
    });

    expect(result.productId).toBeNull();
    expect(result.sku).toBeNull();
    expect(result.matchReasons).toContain(
      "Multiple internal products had similar evidence and require generation confirmation."
    );
    expect(result.similarProducts.map((product) => product.productId)).toEqual(
      expect.arrayContaining([
        "prod_titleist_tsr2_fairway_2023",
        "prod_titleist_tsr3_fairway_2023"
      ])
    );
  });

  it("still automatically matches explicitly identified similar products", () => {
    const cases = [
      {
        productLine: "TSR2",
        rawText: "Titleist TSR2 3w",
        expectedProductId: "prod_titleist_tsr2_fairway_2023"
      },
      {
        productLine: "TSR3",
        rawText: "Titleist TSR3 fairway wood",
        expectedProductId: "prod_titleist_tsr3_fairway_2023"
      },
      {
        productLine: "TS2",
        rawText: "Titleist TS2 3w",
        expectedProductId: "prod_titleist_ts2_fairway_2019"
      }
    ];

    for (const testCase of cases) {
      const result = lookupInventoryProduct({
        brand: "Titleist",
        productLine: testCase.productLine,
        category: "fairway wood",
        rawText: testCase.rawText
      });

      expect(result.productId).toBe(testCase.expectedProductId);
      expect(result.confidence).toBeGreaterThanOrEqual(0.86);
    }
  });


  it("matches a curated hybrid alias to the correct internal product", () => {
    const result = lookupInventoryProduct({
      brand: "PING",
      productLine: "G430 Hybrid",
      category: "hy",
      shaftBrand: "PING Alta",
      rawText: "PING G430 hybrid Senior flex condition 8.0 Average"
    });

    expect(result).toMatchObject({
      productId: "prod_ping_g430_hybrid_2023",
      sku: "PING-G430-HYB-2023",
      category: "HYBRID"
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0.86);
  });

  it("keeps a broad multi-category G430 family query ambiguous", () => {
    const result = lookupInventoryProduct({
      brand: "PING",
      productLine: "G430",
      rawText: "PING G430 condition 8.0 Average"
    });

    expect(result.productId).toBeNull();
    expect(result.similarProducts.length).toBeGreaterThanOrEqual(2);
  });


  it("keeps an exact product match when only condition is unclear", () => {
    const result = lookupInventoryProduct({
      brand: "PING",
      productLine: "G425",
      category: "irons",
      rawText:
        "PING G425 irons 5-PW regular flex condition unclear"
    });

    expect(result).toMatchObject({
      productId: "prod_ping_g425_iron_set_2021",
      sku: "PING-G425-IRONSET-2021",
      category: "IRON_SET"
    });
  });


  it("prefers an explicit parsed Stealth 2 model over the shorter Stealth family", () => {
    const result = lookupInventoryProduct({
      brand: "TaylorMade",
      productLine: "Stealth 2",
      category: "DRIVER",
      shaftBrand: "Fujikura",
      shaftModel: "Ventus",
      rawText:
        "TM stealth2 drv 10.5 Ventus stiff, no hc, sky mark on crown"
    });

    expect(result).toMatchObject({
      productId: "prod_taylormade_stealth2_driver_2023",
      sku: "TM-STEALTH2-DRV-2023",
      category: "DRIVER"
    });
    expect(result.matchReasons).toContain(
      "Product line matched Stealth 2."
    );
  });

});
