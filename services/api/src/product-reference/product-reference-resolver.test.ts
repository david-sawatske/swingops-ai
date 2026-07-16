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
import {
  resolveProductReference
} from "./product-reference-resolver.js";

describe("product-reference-resolver", () => {
  it("matches an exact canonical product identity", () => {
    const result = resolveProductReference({
      brand: "Titleist",
      productText: "TSR2",
      category: "3w",
      rawText:
        "Titleist TSR2 3w shaft stiff condition 8.0 Average"
    });

    expect(result.status).toBe("MATCHED");

    if (result.status !== "MATCHED") {
      throw new Error(
        "Expected an authoritative match."
      );
    }

    expect(result.match).toMatchObject({
      productId:
        "prod_titleist_tsr2_fairway_2023",
      sku: "TITLEIST-TSR2-FWY-2023",
      brand: "Titleist",
      productLine: "TSR2",
      category: "FAIRWAY_WOOD",
      matchKind: "CANONICAL_EXACT"
    });
    expect(result.match.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "productText",
          sourceText: "TSR2"
        }),
        expect.objectContaining({
          field: "brand"
        }),
        expect.objectContaining({
          field: "category"
        })
      ])
    );
  });

  it("matches an approved catalog alias", () => {
    const result = resolveProductReference({
      brand: "TM",
      productText: "tm stealth2 driver",
      category: "drv",
      rawText:
        "TM stealth2 driver Ventus stiff"
    });

    expect(result.status).toBe("MATCHED");

    if (result.status !== "MATCHED") {
      throw new Error(
        "Expected an alias match."
      );
    }

    expect(result.match).toMatchObject({
      productId:
        "prod_taylormade_stealth2_driver_2023",
      sku: "TM-STEALTH2-DRV-2023",
      productLine: "Stealth 2",
      matchKind: "ALIAS_EXACT"
    });
  });

  it("normalizes punctuation, spacing, and case", () => {
    const result = resolveProductReference({
      brand: "TITLEIST",
      productText: "tsr-2",
      category: "FAIRWAY WOOD",
      rawText:
        "TITLEIST TSR-2 FAIRWAY WOOD"
    });

    expect(result.status).toBe("MATCHED");

    if (result.status !== "MATCHED") {
      throw new Error(
        "Expected a normalized canonical match."
      );
    }

    expect(result.match.productId).toBe(
      "prod_titleist_tsr2_fairway_2023"
    );
  });

  it("keeps a shared Titleist family ambiguous", () => {
    const result = resolveProductReference({
      brand: "Titleist",
      productText: "TSR",
      category: "fairway wood",
      rawText:
        "Titleist TSR fairway wood generation unclear"
    });

    expect(result.status).toBe("AMBIGUOUS");

    if (result.status !== "AMBIGUOUS") {
      throw new Error(
        "Expected family ambiguity."
      );
    }

    expect(
      result.candidates.map(
        (candidate) => candidate.productId
      )
    ).toEqual(
      expect.arrayContaining([
        "prod_titleist_tsr2_fairway_2023",
        "prod_titleist_tsr3_fairway_2023"
      ])
    );
    expect(
      result.candidates.map(
        (candidate) => candidate.productId
      )
    ).not.toContain(
      "prod_titleist_ts2_fairway_2019"
    );
    expect(
      result.candidates.every(
        (candidate) =>
          candidate.matchKind === "FAMILY"
      )
    ).toBe(true);
  });

  it("keeps Mizuno Hot Metal generations ambiguous", () => {
    const result = resolveProductReference({
      brand: "Mizuno",
      productText: "Hot Metal",
      category: "iron set",
      rawText:
        "Mizuno Hot Metal iron set generation not listed"
    });

    expect(result.status).toBe("AMBIGUOUS");

    if (result.status !== "AMBIGUOUS") {
      throw new Error(
        "Expected generation ambiguity."
      );
    }

    expect(
      result.candidates.map(
        (candidate) => candidate.productId
      )
    ).toEqual(
      expect.arrayContaining([
        "prod_mizuno_jpx923_hot_metal_iron_set_2023",
        "prod_mizuno_jpx921_hot_metal_iron_set_2021"
      ])
    );
  });

  it("returns ambiguity for deterministic near ties", () => {
    const products: ProductReferenceRecord[] = [
      {
        productId: "prod_test_alpha",
        sku: "TEST-ALPHA-FWY",
        brand: "Test Golf",
        productLine: "Alpha 2",
        category: "FAIRWAY_WOOD",
        year: 2025,
        aliases: ["shared family fairway"],
        shaftFamilies: []
      },
      {
        productId: "prod_test_beta",
        sku: "TEST-BETA-FWY",
        brand: "Test Golf",
        productLine: "Alpha 3",
        category: "FAIRWAY_WOOD",
        year: 2026,
        aliases: ["shared family fairway"],
        shaftFamilies: []
      }
    ];
    const provider =
      createInMemoryProductReferenceProvider(
        products
      );

    const result = resolveProductReference(
      {
        brand: "Test Golf",
        productText: "shared family fairway",
        category: "fairway",
        rawText:
          "Test Golf shared family fairway"
      },
      provider
    );

    expect(result.status).toBe("AMBIGUOUS");

    if (result.status !== "AMBIGUOUS") {
      throw new Error(
        "Expected deterministic tie ambiguity."
      );
    }

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.score).toBe(
      result.candidates[1]?.score
    );
  });

  it("excludes conflicting brand and category references", () => {
    const result = resolveProductReference({
      brand: "Callaway",
      productText: "TSR2",
      category: "wedge",
      rawText:
        "Callaway TSR2 wedge"
    });

    expect(result).toMatchObject({
      status: "UNRESOLVED",
      originalProductText: "TSR2",
      candidates: []
    });
  });

  it("preserves unknown product text without inventing identity", () => {
    const result = resolveProductReference({
      brand: "Titleist",
      productText: "ZX Prototype 11",
      category: "driver",
      rawText:
        "Titleist ZX Prototype 11 driver"
    });

    expect(result).toMatchObject({
      status: "UNRESOLVED",
      originalProductText:
        "ZX Prototype 11",
      rawText:
        "Titleist ZX Prototype 11 driver",
      candidates: []
    });
  });

  it("ignores serial uncertainty for an exact putter identity", () => {
    const result = resolveProductReference({
      brand: "Odyssey",
      productText: "White Hot Versa",
      category: "putter",
      rawText:
        "Odyssey White Hot Versa putter condition 9.0 Above Average serial=UNKNOWN"
    });

    expect(result.status).toBe("MATCHED");

    if (result.status !== "MATCHED") {
      throw new Error(
        "Expected serial noise to be irrelevant."
      );
    }

    expect(result.match).toMatchObject({
      productId:
        "prod_odyssey_white_hot_versa_putter_2023",
      sku:
        "ODYSSEY-WHITEHOTVERSA-PUTTER-2023",
      productLine: "White Hot Versa",
      category: "PUTTER"
    });
  });

  it("recognizes a test-only product added through the provider", () => {
    const provider =
      createInMemoryProductReferenceProvider([
        {
          productId:
            "prod_test_nova_x_driver_2026",
          sku: "TEST-NOVAX-DRV-2026",
          brand: "Test Golf",
          productLine: "Nova X",
          category: "DRIVER",
          year: 2026,
          aliases: [
            "nx prototype driver"
          ],
          shaftFamilies: []
        }
      ]);

    const result = resolveProductReference(
      {
        brand: "Test Golf",
        productText:
          "nx prototype driver",
        category: "driver",
        rawText:
          "Test Golf nx prototype driver"
      },
      provider
    );

    expect(result.status).toBe("MATCHED");

    if (result.status !== "MATCHED") {
      throw new Error(
        "Expected the injected reference product to match."
      );
    }

    expect(result.match).toMatchObject({
      productId:
        "prod_test_nova_x_driver_2026",
      sku: "TEST-NOVAX-DRV-2026",
      productLine: "Nova X",
      matchKind: "ALIAS_EXACT"
    });
    expect(result.providerRecordCount).toBe(1);
  });
  it("matches an exact canonical product from raw text alone", () => {
    const result = resolveProductReference({
      brand: "Titleist",
      category: "3w",
      rawText:
        "Titleist TSR2 3w shaft stiff condition 8.0 Average"
    });

    expect(result.status).toBe("MATCHED");

    if (result.status !== "MATCHED") {
      throw new Error(
        "Expected a raw-text canonical match."
      );
    }

    expect(result.match).toMatchObject({
      productId:
        "prod_titleist_tsr2_fairway_2023",
      sku: "TITLEIST-TSR2-FWY-2023",
      productLine: "TSR2",
      category: "FAIRWAY_WOOD"
    });
  });

  it("derives a shared Titleist family from raw text alone", () => {
    const result = resolveProductReference({
      brand: "Titleist",
      category: "fairway wood",
      rawText:
        "Titleist TSR fairway wood generation unclear"
    });

    expect(result.status).toBe("AMBIGUOUS");

    if (result.status !== "AMBIGUOUS") {
      throw new Error(
        "Expected raw-text family ambiguity."
      );
    }

    expect(
      result.candidates.map(
        (candidate) => candidate.productId
      )
    ).toEqual(
      expect.arrayContaining([
        "prod_titleist_tsr2_fairway_2023",
        "prod_titleist_tsr3_fairway_2023"
      ])
    );
    expect(
      result.candidates[0]?.matchedPhrase
    ).toBe("TSR");
  });

  it("derives Hot Metal generation ambiguity from raw text alone", () => {
    const result = resolveProductReference({
      brand: "Mizuno",
      category: "iron set",
      rawText:
        "Mizuno Hot Metal iron set generation not listed"
    });

    expect(result.status).toBe("AMBIGUOUS");

    if (result.status !== "AMBIGUOUS") {
      throw new Error(
        "Expected raw-text generation ambiguity."
      );
    }

    expect(
      result.candidates.map(
        (candidate) => candidate.productId
      )
    ).toEqual(
      expect.arrayContaining([
        "prod_mizuno_jpx923_hot_metal_iron_set_2023",
        "prod_mizuno_jpx921_hot_metal_iron_set_2021"
      ])
    );
    expect(
      result.candidates[0]?.matchedPhrase
    ).toBe("Hot Metal");
  });

  it("does not select one model when uncertain text contains alternatives", () => {
    const result = resolveProductReference({
      brand: "Titleist",
      category: "3w",
      rawText:
        "Titleist TSR maybe TS2 3w Tensei stiff"
    });

    expect(result.status).toBe("AMBIGUOUS");

    if (result.status !== "AMBIGUOUS") {
      throw new Error(
        "Expected uncertain competing identity evidence."
      );
    }

    expect(
      result.candidates.map(
        (candidate) => candidate.productId
      )
    ).toEqual(
      expect.arrayContaining([
        "prod_titleist_ts2_fairway_2019",
        "prod_titleist_tsr2_fairway_2023",
        "prod_titleist_tsr3_fairway_2023"
      ])
    );
  });

  it("matches an injected alias from raw text without parser changes", () => {
    const provider =
      createInMemoryProductReferenceProvider([
        {
          productId:
            "prod_test_nova_x_driver_2026",
          sku: "TEST-NOVAX-DRV-2026",
          brand: "Test Golf",
          productLine: "Nova X",
          category: "DRIVER",
          year: 2026,
          aliases: [
            "nx prototype driver"
          ],
          shaftFamilies: []
        }
      ]);

    const result = resolveProductReference(
      {
        brand: "Test Golf",
        category: "driver",
        rawText:
          "Test Golf nx prototype driver condition 9.0 Above Average"
      },
      provider
    );

    expect(result.status).toBe("MATCHED");

    if (result.status !== "MATCHED") {
      throw new Error(
        "Expected a raw-text injected alias match."
      );
    }

    expect(result.match).toMatchObject({
      productId:
        "prod_test_nova_x_driver_2026",
      sku: "TEST-NOVAX-DRV-2026",
      productLine: "Nova X"
    });
  });

  it("prefers Stealth 2 over the shorter overlapping Stealth product", () => {
    const result = resolveProductReference({
      brand: "TaylorMade",
      category: "driver",
      rawText:
        "TaylorMade Stealth 2 driver shaft stiff condition 8.0 Average"
    });

    expect(result.status).toBe("MATCHED");

    if (result.status !== "MATCHED") {
      throw new Error(
        "Expected the more specific Stealth 2 match."
      );
    }

    expect(result.match).toMatchObject({
      productId:
        "prod_taylormade_stealth2_driver_2023",
      sku: "TM-STEALTH2-DRV-2023",
      productLine: "Stealth 2"
    });
    expect(
      result.candidates.map(
        (candidate) => candidate.productId
      )
    ).not.toContain(
      "prod_taylormade_stealth_driver_2022"
    );
  });

  it("prefers an injected longer alias over an overlapping shorter identity", () => {
    const provider =
      createInMemoryProductReferenceProvider([
        {
          productId:
            "prod_test_nova_driver_2025",
          sku: "TEST-NOVA-DRV-2025",
          brand: "Test Golf",
          productLine: "Nova",
          category: "DRIVER",
          year: 2025,
          aliases: ["nova driver"],
          shaftFamilies: []
        },
        {
          productId:
            "prod_test_nova_x_driver_2026",
          sku: "TEST-NOVAX-DRV-2026",
          brand: "Test Golf",
          productLine: "Nova X",
          category: "DRIVER",
          year: 2026,
          aliases: ["nova x driver"],
          shaftFamilies: []
        }
      ]);

    const result = resolveProductReference(
      {
        brand: "Test Golf",
        category: "driver",
        rawText:
          "Test Golf Nova X driver condition 9.0 Above Average"
      },
      provider
    );

    expect(result.status).toBe("MATCHED");

    if (result.status !== "MATCHED") {
      throw new Error(
        "Expected the longer injected identity."
      );
    }

    expect(result.match).toMatchObject({
      productId:
        "prod_test_nova_x_driver_2026",
      sku: "TEST-NOVAX-DRV-2026",
      productLine: "Nova X"
    });
    expect(
      result.candidates.map(
        (candidate) => candidate.productId
      )
    ).not.toContain(
      "prod_test_nova_driver_2025"
    );
  });

  it("matches compact letter-number shorthand to the canonical product", () => {
    const result = resolveProductReference({
      brand: "TM",
      category: "drv",
      rawText:
        "TM stealth2 drv 10.5 Ventus stiff"
    });

    expect(result.status).toBe("MATCHED");

    if (result.status !== "MATCHED") {
      throw new Error(
        "Expected compact Stealth 2 shorthand to match."
      );
    }

    expect(result.match).toMatchObject({
      productId:
        "prod_taylormade_stealth2_driver_2023",
      sku: "TM-STEALTH2-DRV-2023",
      brand: "TaylorMade",
      productLine: "Stealth 2",
      category: "DRIVER",
      matchedPhrase: "stealth2"
    });
    expect(
      result.candidates.map(
        (candidate) => candidate.productId
      )
    ).not.toContain(
      "prod_taylormade_stealth_driver_2022"
    );
  });

  it("preserves compact fairway shorthand as a category constraint", () => {
    const result = resolveProductReference({
      brand: "Titleist",
      productText: "TSR2",
      category: "3w",
      rawText:
        "Titleist TSR2 3w shaft stiff condition 8.0 Average"
    });

    expect(result.status).toBe("MATCHED");

    if (result.status !== "MATCHED") {
      throw new Error(
        "Expected 3w to constrain resolution to fairway wood."
      );
    }

    expect(result.normalizedInput.category).toBe(
      "FAIRWAY_WOOD"
    );
    expect(result.match).toMatchObject({
      productId:
        "prod_titleist_tsr2_fairway_2023",
      category: "FAIRWAY_WOOD"
    });
    expect(
      result.candidates.map(
        (candidate) => candidate.productId
      )
    ).not.toContain(
      "prod_titleist_tsr2_driver_2023"
    );
  });

});
