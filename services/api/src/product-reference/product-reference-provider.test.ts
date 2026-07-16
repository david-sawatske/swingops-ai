import {
  describe,
  expect,
  it
} from "vitest";

import {
  createInMemoryProductReferenceProvider
} from "./product-reference-provider.js";
import type {
  ProductReferenceRecord
} from "./product-reference-types.js";

const product: ProductReferenceRecord = {
  productId: "prod_test_driver",
  sku: "TEST-DRIVER-2026",
  brand: "Test Golf",
  productLine: "Test Driver",
  category: "DRIVER",
  year: 2026,
  aliases: ["test drv"],
  shaftFamilies: []
};

describe("product-reference-provider", () => {
  it("looks up stable product IDs and SKUs", () => {
    const provider =
      createInMemoryProductReferenceProvider([
        product
      ]);

    expect(
      provider.findByProductId(
        "prod_test_driver"
      )
    ).toMatchObject({
      productId: "prod_test_driver",
      sku: "TEST-DRIVER-2026"
    });

    expect(
      provider.findBySku(
        "TEST-DRIVER-2026"
      )
    ).toMatchObject({
      productId: "prod_test_driver",
      sku: "TEST-DRIVER-2026"
    });
  });

  it("returns defensive record copies", () => {
    const provider =
      createInMemoryProductReferenceProvider([
        product
      ]);

    const firstList = provider.listProducts();
    const secondList = provider.listProducts();
    const firstById =
      provider.findByProductId(
        "prod_test_driver"
      );
    const secondById =
      provider.findByProductId(
        "prod_test_driver"
      );

    expect(firstList).not.toBe(secondList);
    expect(firstList[0]).not.toBe(
      secondList[0]
    );
    expect(firstList[0]?.aliases).not.toBe(
      secondList[0]?.aliases
    );
    expect(firstById).not.toBe(secondById);
  });

  it("rejects duplicate stable product IDs", () => {
    expect(() =>
      createInMemoryProductReferenceProvider([
        product,
        {
          ...product,
          sku: "TEST-DRIVER-SECOND-2026"
        }
      ])
    ).toThrow(
      "Duplicate product reference ID: prod_test_driver"
    );
  });

  it("rejects duplicate stable SKUs", () => {
    expect(() =>
      createInMemoryProductReferenceProvider([
        product,
        {
          ...product,
          productId:
            "prod_test_driver_second"
        }
      ])
    ).toThrow(
      "Duplicate product reference SKU: TEST-DRIVER-2026"
    );
  });
});
