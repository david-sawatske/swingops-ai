import { describe, expect, it } from "vitest";

import {
  createInMemoryProductReferenceProvider
} from "../product-reference/product-reference-provider.js";
import { parseTradeInDemoText } from "./trade-in-demo-parser.js";

describe("parseTradeInDemoText", () => {
  it("parses messy golf trade-in shorthand into structured records with uncertainty", () => {
    const parsedItems = parseTradeInDemoText([
      "TM stealth2 drv 10.5 Ventus stiff, no hc, sky mark on crown",
      "Titleist TSR maybe TS2 3w 15 deg Tensei s flex, face wear, hc included",
      "unknown 5w shaft unknown condition unclear"
    ].join("\n"));

    expect(parsedItems).toHaveLength(3);

    const firstItem = parsedItems[0];
    const secondItem = parsedItems[1];
    const thirdItem = parsedItems[2];

    expect(firstItem).toBeDefined();
    expect(secondItem).toBeDefined();
    expect(thirdItem).toBeDefined();

    expect(firstItem!).toMatchObject({
      brand: "TaylorMade",
      productLine: "Stealth 2",
      model: "Stealth 2",
      category: "DRIVER",
      loft: "10.5",
      shaftBrand: "Fujikura",
      shaftModel: "Ventus",
      shaftFlex: "STIFF",
      conditionNotes: ["sky mark"],
      accessoriesNotes: ["missing headcover"],
      missingFields: []
    });
    expect(firstItem!.confidence).toBeGreaterThanOrEqual(0.9);

    expect(secondItem!).toMatchObject({
      brand: "Titleist",
      productLine: "TSR",
      category: "FAIRWAY_WOOD",
      loft: "15",
      clubNumber: "3",
      shaftBrand: "Mitsubishi",
      shaftModel: "Tensei",
      shaftFlex: "STIFF",
      conditionNotes: ["face wear"],
      accessoriesNotes: ["headcover included"],
      uncertaintyNotes: ["model uncertain"]
    });
    expect(secondItem!.confidence).toBeLessThan(firstItem!.confidence);

    expect(thirdItem!).toMatchObject({
      brand: null,
      category: "FAIRWAY_WOOD",
      clubNumber: "5",
      shaftFlex: null,
      uncertaintyNotes: [
        "shaft uncertain",
        "condition uncertain",
        "product reference unresolved"
      ]
    });
    expect(thirdItem!.missingFields).toEqual(
      expect.arrayContaining(["brand", "productLine", "shaftFlex", "conditionNotes"])
    );
    expect(thirdItem!.confidence).toBeLessThan(0.72);
  });
  it("parses expanded QA fixture families and fixed condition grades", () => {
    const parsedItems = parseTradeInDemoText([
      "Cleveland RTX 6 ZipCore wedge Senior flex condition 9.0 Above Average",
      "Odyssey White Hot OG putter condition 8.0 Average",
      "Mizuno JPX 923 Hot Metal irons Tour X-Stiff condition 9.0 Above Average",
      "PING G430 Max driver Tour X-Stiff condition 9.5 Mint"
    ].join("\n"));

    expect(parsedItems).toHaveLength(4);

    expect(parsedItems[0]).toMatchObject({
      brand: "Cleveland",
      productLine: "RTX 6 ZipCore",
      category: "WEDGE",
      shaftFlex: "SENIOR",
      conditionNotes: ["9.0 Above Average"],
      missingFields: []
    });

    expect(parsedItems[1]).toMatchObject({
      brand: "Odyssey",
      productLine: "White Hot OG",
      category: "PUTTER",
      shaftFlex: null,
      conditionNotes: ["8.0 Average"],
      missingFields: []
    });

    expect(parsedItems[2]).toMatchObject({
      brand: "Mizuno",
      productLine: "JPX 923 Hot Metal",
      category: "IRON_SET",
      shaftFlex: "TOUR_X_STIFF",
      conditionNotes: ["9.0 Above Average"],
      missingFields: []
    });

    expect(parsedItems[3]).toMatchObject({
      brand: "PING",
      productLine: "G430 Max",
      category: "DRIVER",
      shaftFlex: "TOUR_X_STIFF",
      conditionNotes: ["9.5 Mint"],
      missingFields: []
    });
  });

  it("preserves canonical AI-ready category and shaft flex values from generated handoff text", () => {
    const parsedItems = parseTradeInDemoText([
      "1. PING G425 IRON_SET — shaft flex REGULAR; condition 7.0 Below Average; store 104; review needed; missing tradeInValue",
      "2. Titleist TSR FAIRWAY_WOOD — shaft flex STIFF; condition 8.0 Average; trade value $145; store 104; review clear",
      "3. PING G430 Max DRIVER — shaft flex TOUR_X_STIFF; condition 9.5 Mint; trade value $240; store 207; review clear"
    ].join("\n"));

    expect(parsedItems).toHaveLength(3);

    expect(parsedItems[0]).toMatchObject({
      brand: "PING",
      productLine: "G425",
      category: "IRON_SET",
      shaftFlex: "REGULAR"
    });
    expect(parsedItems[0]?.missingFields).not.toContain("category");
    expect(parsedItems[0]?.missingFields).not.toContain("shaftFlex");

    expect(parsedItems[1]).toMatchObject({
      brand: "Titleist",
      productLine: "TSR",
      category: "FAIRWAY_WOOD",
      shaftFlex: "STIFF"
    });
    expect(parsedItems[1]?.missingFields).not.toContain("category");

    expect(parsedItems[2]).toMatchObject({
      brand: "PING",
      productLine: "G430 Max",
      category: "DRIVER",
      shaftFlex: "TOUR_X_STIFF"
    });
    expect(parsedItems[2]?.missingFields).not.toContain("shaftFlex");
  });

  it("preserves source-supported product text when normalized handoff reference resolution is unresolved", () => {
    const parsedItems =
      parseTradeInDemoText(
        [
          "1. PING G430 DRIVER — shaft flex REGULAR; condition 8.0 Average; trade value $180; store 207; review needed; source evidence: PING,G430,driver,R,8.0 Average,$180,207",
          "2. Titleist ZX Prototype 11 DRIVER — shaft flex STIFF; condition 9.0 Above Average; trade value $140; store 114; review needed; source evidence: Titleist,ZX Prototype 11,driver,stiff,9.0 Above Average,$140,114",
          "3. Callaway — condition 7.0 Below Average; trade value $80; store 301; review needed; missing productLine, category, shaftFlex; source evidence: Callaway,mystery club,,unknown,7.0 Below Average,$80,301"
        ].join("\n")
      );

    expect(parsedItems).toHaveLength(3);

    expect(parsedItems[0]).toMatchObject({
      id: "parsed_item_1",
      brand: "PING",
      productLine: "G430",
      category: "DRIVER",
      shaftFlex: "REGULAR",
      conditionGrade: "8.0 Average",
      tradeInValue: 180,
      storeId: "207",
      productResolution: {
        status: "UNRESOLVED"
      },
      parserEvidence: {
        productLine: {
          value: "G430",
          sourceText: "G430"
        }
      }
    });
    expect(
      parsedItems[0]?.missingFields
    ).not.toEqual(
      expect.arrayContaining([
        "productLine",
        "shaftFlex"
      ])
    );

    expect(parsedItems[1]).toMatchObject({
      id: "parsed_item_2",
      brand: "Titleist",
      productLine: "ZX Prototype 11",
      category: "DRIVER",
      shaftFlex: "STIFF",
      conditionGrade: "9.0 Above Average",
      tradeInValue: 140,
      storeId: "114",
      productResolution: {
        status: "UNRESOLVED"
      },
      parserEvidence: {
        productLine: {
          value: "ZX Prototype 11",
          sourceText: "ZX Prototype 11"
        }
      }
    });
    expect(
      parsedItems[1]?.missingFields
    ).not.toEqual(
      expect.arrayContaining([
        "productLine",
        "shaftFlex"
      ])
    );

    expect(parsedItems[2]).toMatchObject({
      id: "parsed_item_3",
      brand: "Callaway",
      productLine: null,
      category: null,
      shaftFlex: null,
      conditionGrade: "7.0 Below Average",
      tradeInValue: 80,
      storeId: "301",
      productResolution: {
        status: "UNRESOLVED"
      }
    });
    expect(
      parsedItems[2]?.missingFields
    ).toEqual(
      expect.arrayContaining([
        "productLine",
        "category",
        "shaftFlex"
      ])
    );
  });


  it("does not treat a category-only normalized identity as product text", () => {
    const parsedItems =
      parseTradeInDemoText(
        "1. PING DRIVER — shaft flex REGULAR; condition 8.0 Average; trade value $180; store 207; review needed; missing productLine; source evidence: PING mystery club driver, Regular shaft, condition 8.0 Average, trade value $180, store 207."
      );

    expect(parsedItems).toHaveLength(1);
    expect(parsedItems[0]).toMatchObject({
      id: "parsed_item_1",
      brand: "PING",
      productLine: null,
      category: "DRIVER",
      shaftFlex: "REGULAR",
      conditionGrade: "8.0 Average",
      tradeInValue: 180,
      storeId: "207",
      productResolution: {
        status: "UNRESOLVED"
      }
    });
    expect(
      parsedItems[0]?.missingFields
    ).toContain("productLine");
    expect(
      parsedItems[0]?.parserEvidence
        ?.productLine
    ).toBeUndefined();
  });


  it("preserves normalized-intake records and record-local stores through the guarded parser", () => {
    const sourceLines = [
      "PING G425 4-PW, shaft firm, condition 8.0 Average, trade value $210, store 207.",
      "Titleist TSR fairway wood, maybe TSR2 or TSR3, stiff shaft, condition 9.0 Above Average, trade value $185, store 114.",
      "Callaway mystery club, shaft unknown, condition 7.0 Below Average, trade value $80, store 301.",
      "Odyssey White Hot putter, condition 8.0 Average, trade value $65, store 207."
    ];

    const parsedItems =
      parseTradeInDemoText(
        sourceLines.join("\n")
      );

    expect(parsedItems).toHaveLength(4);
    expect(
      parsedItems.map(
        (item) => item.rawLine
      )
    ).toEqual(sourceLines);

    expect(parsedItems[0]).toMatchObject({
      id: "parsed_item_1",
      brand: "PING",
      productLine: "G425",
      category: "IRON_SET",
      shaftFlex: null,
      conditionGrade: "8.0 Average",
      tradeInValue: 210,
      storeId: "207"
    });

    const ambiguousTitleist =
      parsedItems[1];

    expect(ambiguousTitleist).toMatchObject({
      id: "parsed_item_2",
      brand: "Titleist",
      category: "FAIRWAY_WOOD",
      shaftFlex: "STIFF",
      conditionGrade: "9.0 Above Average",
      tradeInValue: 185,
      storeId: "114",
      productResolution: {
        status: "AMBIGUOUS"
      }
    });

    if (
      !ambiguousTitleist ||
      ambiguousTitleist.productResolution
        .status !== "AMBIGUOUS"
    ) {
      throw new Error(
        "Expected the Titleist record to remain ambiguous."
      );
    }

    const candidateProductLines =
      ambiguousTitleist
        .productResolution
        .candidates
        .map(
          (candidate) =>
            candidate.productLine
        );

    expect(
      candidateProductLines
    ).toEqual(
      expect.arrayContaining([
        "TSR2",
        "TSR3"
      ])
    );
    expect(
      candidateProductLines
    ).toContain(
      ambiguousTitleist.productLine
    );
    expect(
      ambiguousTitleist
        .uncertaintyNotes
    ).toContain(
      "model uncertain"
    );

    expect(parsedItems[2]).toMatchObject({
      id: "parsed_item_3",
      brand: "Callaway",
      productLine: null,
      category: null,
      shaftFlex: null,
      conditionGrade: "7.0 Below Average",
      tradeInValue: 80,
      storeId: "301",
      productResolution: {
        status: "UNRESOLVED"
      }
    });
    expect(
      parsedItems[2]?.missingFields
    ).toEqual(
      expect.arrayContaining([
        "productLine",
        "category",
        "shaftFlex"
      ])
    );

    expect(parsedItems[3]).toMatchObject({
      id: "parsed_item_4",
      brand: "Odyssey",
      category: "PUTTER",
      shaftFlex: null,
      conditionGrade: "8.0 Average",
      tradeInValue: 65,
      storeId: "207"
    });
    expect(
      parsedItems[3]?.missingFields
    ).not.toContain("shaftFlex");
  });



  it("parses guarded workflow source values before review validation", () => {
    const parsedItems = parseTradeInDemoText([
      "TaylorMade Stealth 2 driver shaft stiff condition 8.0 Average trade value $150",
      "TaylorMade Stealth 2 driver shaft stiff cond avg trade value $150"
    ].join("\n"));

    expect(parsedItems).toHaveLength(2);

    for (const item of parsedItems) {
      expect(item).toMatchObject({
        brand: "TaylorMade",
        productLine: "Stealth 2",
        category: "DRIVER",
        shaftFlex: "STIFF",
        conditionGrade: "8.0 Average",
        tradeInValue: 150
      });
      expect(item?.conditionNotes).toContain("8.0 Average");
      expect(item?.missingFields).not.toEqual(
        expect.arrayContaining(["shaftFlex", "conditionGrade", "tradeInValue", "conditionNotes"])
      );
    }
  });

  it("normalizes guarded workflow value, flex, and condition shorthand variants", () => {
    const cases = [
      {
        raw: "Titleist TSR 7w shaft stf condition 8.0 Average value $145",
        expected: {
          brand: "Titleist",
          productLine: "TSR",
          category: "FAIRWAY_WOOD",
          shaftFlex: "STIFF",
          conditionGrade: "8.0 Average",
          tradeInValue: 145
        }
      },
      {
        raw: "Titleist TSR 7w shaft stiff condition 8.0 Average trade value $145",
        expected: {
          brand: "Titleist",
          productLine: "TSR",
          category: "FAIRWAY_WOOD",
          shaftFlex: "STIFF",
          conditionGrade: "8.0 Average",
          tradeInValue: 145
        }
      },
      {
        raw: "Titleist TSR 7w shaft stiff condition 8.0 Average estimated value 145",
        expected: {
          brand: "Titleist",
          productLine: "TSR",
          category: "FAIRWAY_WOOD",
          shaftFlex: "STIFF",
          conditionGrade: "8.0 Average",
          tradeInValue: 145
        }
      },
      {
        raw: "Titleist TSR 7w shaft stiff condition 8.0 Average value=145",
        expected: {
          brand: "Titleist",
          productLine: "TSR",
          category: "FAIRWAY_WOOD",
          shaftFlex: "STIFF",
          conditionGrade: "8.0 Average",
          tradeInValue: 145
        }
      },
      {
        raw: "PING G425 4-PW shaft reg condition 6.0 Poor value $210",
        expected: {
          brand: "PING",
          productLine: "G425",
          category: "IRON_SET",
          shaftFlex: "REGULAR",
          conditionGrade: "6.0 Poor",
          tradeInValue: 210
        }
      },
      {
        raw: "Callaway Rogue ST Max driver shaft x-stiff condition 7.0 Below Average value $130",
        expected: {
          brand: "Callaway",
          productLine: "Rogue ST Max",
          category: "DRIVER",
          shaftFlex: "X_STIFF",
          conditionGrade: "7.0 Below Average",
          tradeInValue: 130
        }
      },
      {
        raw: "Mizuno JPX 923 Hot Metal irons shaft Tour X-Stiff condition 9.0 Above Average value $390",
        expected: {
          brand: "Mizuno",
          productLine: "JPX 923 Hot Metal",
          category: "IRON_SET",
          shaftFlex: "TOUR_X_STIFF",
          conditionGrade: "9.0 Above Average",
          tradeInValue: 390
        }
      },
      {
        raw: "Odyssey White Hot OG putter condition 8.0 Average value $95",
        expected: {
          brand: "Odyssey",
          productLine: "White Hot OG",
          category: "PUTTER",
          shaftFlex: null,
          conditionGrade: "8.0 Average",
          tradeInValue: 95
        }
      },
      {
        raw: "TaylorMade Stealth 2 driver shaft stiff condition below avg value $150",
        expected: {
          brand: "TaylorMade",
          productLine: "Stealth 2",
          category: "DRIVER",
          shaftFlex: "STIFF",
          conditionGrade: "7.0 Below Average",
          tradeInValue: 150
        }
      },
      {
        raw: "TaylorMade Stealth 2 driver shaft stiff cond aa value $150",
        expected: {
          brand: "TaylorMade",
          productLine: "Stealth 2",
          category: "DRIVER",
          shaftFlex: "STIFF",
          conditionGrade: "9.0 Above Average",
          tradeInValue: 150
        }
      },
      {
        raw: "TaylorMade Stealth 2 driver shaft stiff condition mint value $150",
        expected: {
          brand: "TaylorMade",
          productLine: "Stealth 2",
          category: "DRIVER",
          shaftFlex: "STIFF",
          conditionGrade: "9.5 Mint",
          tradeInValue: 150
        }
      }
    ];

    const parsedItems = parseTradeInDemoText(cases.map((testCase) => testCase.raw).join("\n"));

    expect(parsedItems).toHaveLength(cases.length);

    cases.forEach((testCase, index) => {
      expect(parsedItems[index]).toMatchObject(testCase.expected);
      expect(parsedItems[index]?.missingFields).not.toEqual(
        expect.arrayContaining(["shaftFlex", "conditionGrade", "tradeInValue", "conditionNotes"])
      );
    });
  });


  it("captures field-level parser evidence for guarded workflow records", () => {
    const parsedItems = parseTradeInDemoText(
      "Titleist TSR2 3w shaft stiff cond avg trade value $150"
    );

    expect(parsedItems[0]).toMatchObject({
      brand: "Titleist",
      productLine: "TSR2",
      category: "FAIRWAY_WOOD",
      shaftFlex: "STIFF",
      conditionGrade: "8.0 Average",
      tradeInValue: 150,
      parserEvidence: {
        brand: { value: "Titleist", sourceText: "Titleist" },
        productLine: { value: "TSR2", sourceText: "TSR2" },
        category: { value: "FAIRWAY_WOOD", sourceText: "3w" },
        shaftFlex: { value: "STIFF", sourceText: "shaft stiff" },
        conditionGrade: { value: "8.0 Average", sourceText: "cond avg" },
        tradeInValue: { value: 150, sourceText: "trade value $150" }
      }
    });
  });

  it("does not create parser evidence for unknown guarded workflow fields", () => {
    const parsedItems = parseTradeInDemoText(
      "PING G425 4-PW shaft unknown condition unclear value pending review"
    );

    expect(parsedItems[0]).toMatchObject({
      brand: "PING",
      productLine: "G425",
      category: "IRON_SET",
      shaftFlex: null,
      conditionGrade: null,
      tradeInValue: null,
      parserEvidence: {
        brand: { value: "PING", sourceText: "PING" },
        productLine: { value: "G425", sourceText: "G425" },
        category: { value: "IRON_SET", sourceText: "4-PW" }
      }
    });

    expect(parsedItems[0]?.parserEvidence?.shaftFlex).toBeUndefined();
    expect(parsedItems[0]?.parserEvidence?.conditionGrade).toBeUndefined();
    expect(parsedItems[0]?.parserEvidence?.tradeInValue).toBeUndefined();
    expect(parsedItems[0]?.missingFields).toEqual(
      expect.arrayContaining(["shaftFlex", "conditionNotes"])
    );
  });

  it("does not map utility wood loft evidence to Wedge", () => {
    const parsedItems = parseTradeInDemoText(
      "Callaway Apex UW 19 degree shaft stiff condition 8.0 Average"
    );

    expect(parsedItems).toHaveLength(1);
    expect(parsedItems[0]).toMatchObject({
      brand: "Callaway",
      shaftFlex: "STIFF",
      conditionGrade: "8.0 Average",
      category: null
    });
    expect(parsedItems[0]?.missingFields).toContain("category");
  });


  it("does not require shaft flex for putter records", () => {
    const parsedItems = parseTradeInDemoText(
      "Odyssey White Hot OG putter condition 8.0 Average trade value $95"
    );

    expect(parsedItems).toHaveLength(1);
    expect(parsedItems[0]).toMatchObject({
      brand: "Odyssey",
      productLine: "White Hot OG",
      category: "PUTTER",
      shaftFlex: null,
      conditionGrade: "8.0 Average",
      tradeInValue: 95
    });
    expect(parsedItems[0]?.missingFields).not.toContain("shaftFlex");
  });


  it("preserves the specific product families exposed by the Step 2 UI matrix", () => {
    const parsedItems = parseTradeInDemoText([
      "TaylorMade Stealth driver, Regular, 8.0 Average.",
      "TM Stealth2 rescue, Stiff, 8.0 Average.",
      "PING G425 hy, Regular, 8.0 Average.",
      "Titleist TS2 fairway wood, Regular, 7.0 Below Average.",
      "Cleveland RTX ZipCore wedge, Regular, 7.0 Below Average.",
      "Cleveland RTX 6 ZipCore wedge, Tour X-Stiff, 7.0 Below Average.",
      "Odyssey White Hot Versa putter, 9.0 Above Average.",
      "Mizuno Hot Metal iron set, Regular, 8.0 Average, generation not listed."
    ].join("\n"));

    expect(parsedItems).toHaveLength(8);

    expect(parsedItems[0]).toMatchObject({
      brand: "TaylorMade",
      productLine: "Stealth",
      category: "DRIVER",
      shaftFlex: "REGULAR"
    });

    expect(parsedItems[1]).toMatchObject({
      brand: "TaylorMade",
      productLine: "Stealth 2 Rescue",
      category: "HYBRID",
      shaftFlex: "STIFF"
    });

    expect(parsedItems[2]).toMatchObject({
      brand: "PING",
      productLine: "G425 Hybrid",
      category: "HYBRID",
      shaftFlex: "REGULAR"
    });

    expect(parsedItems[3]).toMatchObject({
      brand: "Titleist",
      productLine: "TS2",
      category: "FAIRWAY_WOOD",
      shaftFlex: "REGULAR"
    });

    expect(parsedItems[4]).toMatchObject({
      brand: "Cleveland",
      productLine: "RTX ZipCore",
      category: "WEDGE"
    });

    expect(parsedItems[5]).toMatchObject({
      brand: "Cleveland",
      productLine: "RTX 6 ZipCore",
      category: "WEDGE"
    });

    expect(parsedItems[6]).toMatchObject({
      brand: "Odyssey",
      productLine: "White Hot Versa",
      category: "PUTTER",
      shaftFlex: null
    });
    expect(parsedItems[6]?.missingFields).not.toContain("shaftFlex");

    expect(parsedItems[7]).toMatchObject({
      brand: "Mizuno",
      productLine: "Hot Metal",
      category: "IRON_SET",
      uncertaintyNotes: expect.arrayContaining(["model uncertain"])
    });
  });

  it("attaches authoritative and ambiguous product resolution evidence", () => {
    const parsedItems =
      parseTradeInDemoText([
        "Titleist TSR2 3w shaft stiff condition 8.0 Average",
        "Titleist TSR fairway wood generation unclear shaft stiff condition 8.0 Average",
        "Titleist ZX Prototype 11 driver shaft stiff condition 8.0 Average"
      ].join("\n"));

    expect(parsedItems[0]).toMatchObject({
      brand: "Titleist",
      productLine: "TSR2",
      category: "FAIRWAY_WOOD",
      productResolution: {
        status: "MATCHED",
        match: {
          productId:
            "prod_titleist_tsr2_fairway_2023",
          sku:
            "TITLEIST-TSR2-FWY-2023"
        }
      }
    });

    expect(parsedItems[1]).toMatchObject({
      brand: "Titleist",
      productLine: "TSR",
      category: "FAIRWAY_WOOD",
      productResolution: {
        status: "AMBIGUOUS"
      }
    });
    expect(
      parsedItems[1]?.uncertaintyNotes
    ).toContain("model uncertain");

    expect(parsedItems[2]).toMatchObject({
      brand: "Titleist",
      productLine: null,
      category: "DRIVER",
      productResolution: {
        status: "UNRESOLVED",
        rawText:
          "Titleist ZX Prototype 11 driver shaft stiff condition 8.0 Average"
      }
    });
    expect(
      parsedItems[2]?.missingFields
    ).toContain("productLine");
  });

  it("recognizes an injected product without adding parser product rules", () => {
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

    const parsedItems =
      parseTradeInDemoText(
        "Test Golf nx prototype driver shaft stiff condition 9.0 Above Average",
        provider
      );

    expect(parsedItems).toHaveLength(1);
    expect(parsedItems[0]).toMatchObject({
      brand: "Test Golf",
      productLine: "Nova X",
      model: "Nova X",
      category: "DRIVER",
      missingFields: [],
      productResolution: {
        status: "MATCHED",
        providerRecordCount: 1,
        match: {
          productId:
            "prod_test_nova_x_driver_2026",
          sku: "TEST-NOVAX-DRV-2026"
        }
      },
      parserEvidence: {
        productLine: {
          value: "Nova X",
          sourceText:
            "nx prototype driver"
        }
      }
    });
  });

  it("keeps putter shaft flex not applicable after reference resolution", () => {
    const parsedItems =
      parseTradeInDemoText(
        "Odyssey White Hot Versa putter condition 9.0 Above Average trade value $110 serial=UNKNOWN"
      );

    expect(parsedItems[0]).toMatchObject({
      brand: "Odyssey",
      productLine: "White Hot Versa",
      category: "PUTTER",
      shaftFlex: null,
      productResolution: {
        status: "MATCHED",
        match: {
          productId:
            "prod_odyssey_white_hot_versa_putter_2023"
        }
      }
    });
    expect(
      parsedItems[0]?.missingFields
    ).not.toContain("shaftFlex");
    expect(
      parsedItems[0]?.uncertaintyNotes
    ).not.toContain(
      "product reference unresolved"
    );
  });

  it("preserves canonical shaft and condition when quoted LOG evidence only marks generation unclear", () => {
    const parsedItems =
      parseTradeInDemoText(
        "1. Titleist TSR FAIRWAY_WOOD — shaft flex STIFF; condition 8.0 Average; trade value $135; store 104; review needed; source evidence: 2026-07-20T02:14:15Z WARN trade_record brand=Titleist model=TSR cat='fairway wood' generation='unclear' shaft=Stiff condition='8.0 Average' value=135 store=104"
      );

    expect(parsedItems).toHaveLength(1);
    expect(parsedItems[0]).toMatchObject({
      brand: "Titleist",
      productLine: "TSR",
      category: "FAIRWAY_WOOD",
      shaftFlex: "STIFF",
      conditionGrade: "8.0 Average",
      tradeInValue: 135,
      storeId: "104",
      uncertaintyNotes: [
        "model uncertain"
      ],
      productResolution: {
        status: "AMBIGUOUS"
      },
      parserEvidence: {
        shaftFlex: {
          value: "STIFF",
          sourceText: "shaft flex STIFF"
        },
        conditionGrade: {
          value: "8.0 Average",
          sourceText: "8.0 Average"
        }
      }
    });

    expect(
      parsedItems[0]?.missingFields
    ).not.toContain("shaftFlex");
    expect(
      parsedItems[0]?.missingFields
    ).not.toContain("conditionNotes");
  });

});
