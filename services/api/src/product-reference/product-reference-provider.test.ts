import { describe, expect, it } from "vitest";

import { createInMemoryProductReferenceProvider } from "./product-reference-provider.js";
import type { ProductReferenceRecord } from "./product-reference-types.js";

const product: ProductReferenceRecord = {
  productId: "prod_test_driver",
  sku: "TEST-DRIVER-2026",
  brand: "Test Golf",
  productLine: "Test Driver",
  category: "DRIVER",
  year: 2026,
  aliases: ["test drv"],
  shaftFamilies: [],
};

describe("product-reference-provider", () => {
  it("looks up stable product IDs and SKUs", () => {
    const provider = createInMemoryProductReferenceProvider([product]);

    expect(provider.findByProductId("prod_test_driver")).toMatchObject({
      productId: "prod_test_driver",
      sku: "TEST-DRIVER-2026",
    });

    expect(provider.findBySku("TEST-DRIVER-2026")).toMatchObject({
      productId: "prod_test_driver",
      sku: "TEST-DRIVER-2026",
    });
  });

  it("returns defensive record copies", () => {
    const provider = createInMemoryProductReferenceProvider([product]);

    const firstSearch = provider.searchCandidates({
      rawText: "Test Golf Test Driver driver",
    });
    const secondSearch = provider.searchCandidates({
      rawText: "Test Golf Test Driver driver",
    });
    const firstById = provider.findByProductId("prod_test_driver");
    const secondById = provider.findByProductId("prod_test_driver");

    expect(firstSearch).not.toBe(secondSearch);
    expect(firstSearch.candidates[0]).not.toBe(secondSearch.candidates[0]);
    expect(firstSearch.candidates[0]?.aliases).not.toBe(
      secondSearch.candidates[0]?.aliases,
    );
    expect(firstById).not.toBe(secondById);
  });

  it("returns structured alias evidence managed by the provider", () => {
    const provider = createInMemoryProductReferenceProvider([product], {
      brandAliases: [{ value: "Test Golf", alias: "TG", confidence: 0.88 }],
      categoryAliases: [
        { value: "DRIVER", alias: "big stick", confidence: 0.82 },
      ],
    });

    expect(provider.detectBrand("TG prototype")).toEqual({
      value: "Test Golf",
      matchedText: "TG",
      confidence: 0.88,
    });
    expect(provider.detectCategory("TG big stick")).toEqual({
      value: "DRIVER",
      matchedText: "big stick",
      confidence: 0.82,
    });
  });

  it("searches a bounded candidate set instead of returning the catalog", () => {
    const provider = createInMemoryProductReferenceProvider([
      product,
      {
        ...product,
        productId: "prod_test_second_driver",
        sku: "TEST-SECOND-DRIVER-2026",
        productLine: "Second Driver",
        aliases: ["second prototype driver"],
      },
      {
        ...product,
        productId: "prod_test_third_driver",
        sku: "TEST-THIRD-DRIVER-2026",
        productLine: "Third Driver",
        aliases: ["third prototype driver"],
      },
      {
        ...product,
        productId: "prod_other_putter",
        sku: "OTHER-PUTTER-2026",
        brand: "Other Golf",
        productLine: "Other Putter",
        category: "PUTTER",
        aliases: ["other flat stick"],
      },
    ]);

    const result = provider.searchCandidates({
      rawText: "Test Golf Test Driver driver",
      brand: "Test Golf",
      category: "driver",
      limit: 1,
    });

    expect(result).toMatchObject({
      totalMatches: 3,
      candidates: [{ productId: "prod_test_driver" }],
    });
    expect(result.candidates).toHaveLength(1);
  });

  it("rejects duplicate stable product IDs", () => {
    expect(() =>
      createInMemoryProductReferenceProvider([
        product,
        {
          ...product,
          sku: "TEST-DRIVER-SECOND-2026",
        },
      ]),
    ).toThrow("Duplicate product reference ID: prod_test_driver");
  });

  it("rejects duplicate stable SKUs", () => {
    expect(() =>
      createInMemoryProductReferenceProvider([
        product,
        {
          ...product,
          productId: "prod_test_driver_second",
        },
      ]),
    ).toThrow("Duplicate product reference SKU: TEST-DRIVER-2026");
  });
});
