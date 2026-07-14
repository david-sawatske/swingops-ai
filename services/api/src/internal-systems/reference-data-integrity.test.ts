import { describe, expect, it } from "vitest";

import {
  demoInventoryProducts,
  type InventoryProductCategory
} from "./inventory-demo-data.js";
import { demoValuationRanges } from "./trade-in-valuation-demo-data.js";

const expectedCategoryCounts: Record<InventoryProductCategory, number> = {
  DRIVER: 7,
  FAIRWAY_WOOD: 7,
  HYBRID: 5,
  IRON_SET: 6,
  WEDGE: 5,
  PUTTER: 5
};

function duplicateValues(values: string[]): string[] {
  return [
    ...new Set(
      values.filter(
        (value, index) => values.indexOf(value) !== index
      )
    )
  ];
}

describe("reference data integrity", () => {
  it("contains the approved 35-product category distribution", () => {
    expect(demoInventoryProducts).toHaveLength(35);

    for (const [category, expectedCount] of Object.entries(
      expectedCategoryCounts
    )) {
      expect(
        demoInventoryProducts.filter(
          (product) => product.category === category
        )
      ).toHaveLength(expectedCount);
    }
  });

  it("uses unique product IDs, SKUs and match identities", () => {
    const productIds = demoInventoryProducts.map(
      (product) => product.productId
    );
    const skus = demoInventoryProducts.map((product) => product.sku);
    const identities = demoInventoryProducts.map(
      (product) =>
        [
          product.brand.toLowerCase(),
          product.productLine.toLowerCase(),
          product.category,
          product.year
        ].join("|")
    );

    expect(duplicateValues(productIds)).toEqual([]);
    expect(duplicateValues(skus)).toEqual([]);
    expect(duplicateValues(identities)).toEqual([]);
  });

  it("keeps putter shaft-flex applicability out of inventory fixtures", () => {
    const putters = demoInventoryProducts.filter(
      (product) => product.category === "PUTTER"
    );

    expect(putters).toHaveLength(5);

    for (const putter of putters) {
      expect(putter.shaftFamilies).toEqual([]);
    }
  });

  it("provides exactly one valid valuation range for every product", () => {
    const inventoryIds = new Set(
      demoInventoryProducts.map((product) => product.productId)
    );
    const valuationIds = demoValuationRanges.map(
      (range) => range.productId
    );

    expect(demoValuationRanges).toHaveLength(
      demoInventoryProducts.length
    );
    expect(duplicateValues(valuationIds)).toEqual([]);

    for (const range of demoValuationRanges) {
      expect(inventoryIds.has(range.productId)).toBe(true);
      expect(range.lowValue).toBeGreaterThanOrEqual(0);
      expect(range.highValue).toBeGreaterThanOrEqual(0);
      expect(range.lowValue).toBeLessThanOrEqual(range.highValue);
      expect(range.evidence.length).toBeGreaterThanOrEqual(2);
    }

    for (const productId of inventoryIds) {
      expect(valuationIds).toContain(productId);
    }
  });

  it("provides valuation coverage for every supported category", () => {
    const categoryByProductId = new Map(
      demoInventoryProducts.map((product) => [
        product.productId,
        product.category
      ])
    );

    const valuedCategories = new Set(
      demoValuationRanges.map((range) =>
        categoryByProductId.get(range.productId)
      )
    );

    expect(valuedCategories).toEqual(
      new Set(Object.keys(expectedCategoryCounts))
    );
  });
});
