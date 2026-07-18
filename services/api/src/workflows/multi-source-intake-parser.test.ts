import { describe, expect, it } from "vitest";

import {
  createInMemoryProductReferenceProvider
} from "../product-reference/product-reference-provider.js";
import type {
  ProductReferenceProvider
} from "../product-reference/product-reference-provider.js";
import {
  buildRecord,
  splitSourceIntoRecordFragments
} from "./multi-source-intake-parser.js";

function parseRecord(
  rawContent: string,
  provider?: ProductReferenceProvider
) {
  return buildRecord(
    {
      id: "matrix_source",
      sourceType: "FREE_TEXT",
      sourceName: "Parser matrix source",
      rawContent
    },
    rawContent,
    0,
    provider
  );
}

function parseCsvRecord(
  rawContent: string,
  fragment: string,
  index = 0
) {
  return buildRecord(
    {
      id: "csv_matrix_source",
      sourceType: "POORLY_FORMED_CSV",
      sourceName: "CSV parser matrix source",
      rawContent
    },
    fragment,
    index
  );
}

describe("multi-source intake parser normalization matrix", () => {
  it("parses the exact source record without review-only missing fields", () => {
    const record = parseRecord(
      "TaylorMade Stealth 2 driver shaft stiff cond avg trade value $150"
    );

    expect(record).toMatchObject({
      brand: "TaylorMade",
      productLine: "Stealth 2",
      category: "DRIVER",
      shaftFlex: "STIFF",
      conditionGrade: "8.0 Average",
      tradeInValue: 150,
      reviewNeeded: false
    });
    expect(record.missingFields).not.toEqual(
      expect.arrayContaining(["shaftFlex", "conditionGrade", "tradeInValue"])
    );
    expect(record.parserEvidence).toMatchObject({
      brand: { value: "TaylorMade", sourceText: "TaylorMade" },
      productLine: { value: "Stealth 2", sourceText: "Stealth 2" },
      category: { value: "DRIVER", sourceText: "driver" },
      shaftFlex: { value: "STIFF", sourceText: "shaft stiff" },
      conditionGrade: { value: "8.0 Average", sourceText: "cond avg" },
      tradeInValue: { value: 150, sourceText: "trade value $150" }
    });
  });

  it("normalizes trade value variants", () => {
    const cases = [
      "Titleist TSR 7w shaft stf condition 8.0 Average value $145",
      "Titleist TSR 7w shaft stiff condition 8.0 Average trade value $145",
      "Titleist TSR 7w shaft stiff condition 8.0 Average estimated value 145",
      "Titleist TSR 7w shaft stiff condition 8.0 Average value=145"
    ];

    for (const raw of cases) {
      const record = parseRecord(raw);

      expect(record).toMatchObject({
        brand: "Titleist",
        productLine: "TSR",
        category: "FAIRWAY_WOOD",
        shaftFlex: "STIFF",
        conditionGrade: "8.0 Average",
        tradeInValue: 145
      });
      expect(record.missingFields).not.toEqual(
        expect.arrayContaining(["shaftFlex", "conditionGrade", "tradeInValue"])
      );
    }
  });

  it("normalizes approved shaft flex variants and skips putter flex", () => {
    const cases = [
      {
        raw: "PING G425 4-PW shaft reg condition 6.0 Poor value $210",
        shaftFlex: "REGULAR",
        conditionGrade: "6.0 Poor",
        tradeInValue: 210
      },
      {
        raw: "Callaway Rogue ST Max driver shaft x-stiff condition 7.0 Below Average value $130",
        shaftFlex: "X_STIFF",
        conditionGrade: "7.0 Below Average",
        tradeInValue: 130
      },
      {
        raw: "Mizuno JPX 923 Hot Metal irons shaft Tour X-Stiff condition 9.0 Above Average value $390",
        shaftFlex: "TOUR_X_STIFF",
        conditionGrade: "9.0 Above Average",
        tradeInValue: 390
      },
      {
        raw: "Odyssey White Hot OG putter condition 8.0 Average value $95",
        shaftFlex: null,
        conditionGrade: "8.0 Average",
        tradeInValue: 95
      }
    ];

    for (const testCase of cases) {
      const record = parseRecord(testCase.raw);

      expect(record).toMatchObject({
        shaftFlex: testCase.shaftFlex,
        conditionGrade: testCase.conditionGrade,
        tradeInValue: testCase.tradeInValue
      });
    }
  });

  it("maps condition shorthand only to approved condition grade values", () => {
    const cases = [
      ["condition avg", "8.0 Average"],
      ["cond avg", "8.0 Average"],
      ["cond poor", "6.0 Poor"],
      ["condition poor", "6.0 Poor"],
      ["condition below avg", "7.0 Below Average"],
      ["cond ba", "7.0 Below Average"],
      ["condition above avg", "9.0 Above Average"],
      ["cond aa", "9.0 Above Average"],
      ["condition mint", "9.5 Mint"]
    ] as const;

    for (const [conditionText, expectedConditionGrade] of cases) {
      const record = parseRecord(
        `TaylorMade Stealth 2 driver shaft stiff ${conditionText} value $150`
      );

      expect(record.conditionGrade).toBe(expectedConditionGrade);
      expect([
        "9.5 Mint",
        "9.0 Above Average",
        "8.0 Average",
        "7.0 Below Average",
        "6.0 Poor"
      ]).toContain(record.conditionGrade);
      expect(record.missingFields).not.toContain("conditionGrade");
    }
  });

  it("does not create parser evidence for unknown review fields", () => {
    const record = parseRecord(
      "PING G425 4-PW shaft unknown condition unclear value pending review"
    );

    expect(record).toMatchObject({
      brand: "PING",
      productLine: "G425",
      category: "IRON_SET",
      shaftFlex: null,
      conditionGrade: null,
      tradeInValue: null,
      reviewNeeded: true
    });

    expect(record.parserEvidence).toMatchObject({
      brand: { value: "PING", sourceText: "PING" },
      productLine: { value: "G425", sourceText: "G425" },
      category: { value: "IRON_SET", sourceText: "4-PW" }
    });
    expect(record.parserEvidence?.shaftFlex).toBeUndefined();
    expect(record.parserEvidence?.conditionGrade).toBeUndefined();
    expect(record.parserEvidence?.tradeInValue).toBeUndefined();
  });


  it("preserves meaningful incomplete records while excluding source noise", () => {
    const cases = [
      {
        sourceType: "FREE_TEXT" as const,
        sourceName: "Real-world counter notes",
        lines: [
          "Counter intake notes",
          "PING G425 4-PW, shaft firm, condition 8.0 Average, trade value $210, store 207.",
          "Titleist TSR fairway wood, maybe TSR2 or TSR3, stiff shaft, condition 9.0 Above Average, trade value $185, store 114.",
          "Callaway mystery club, shaft unknown, condition 7.0 Below Average, trade value $80, store 301.",
          "Customer brought an unbranded club, shaft unknown, condition 6.0 Poor, value $20.",
          "TaylorMade equipment, exact model and category pending review, condition 8.0 Average, value $100.",
          "Possible Titleist trade item, model unclear, shaft stiff, condition 7.0 Below Average, value $90.",
          "Odyssey White Hot putter, condition 8.0 Average, trade value $65, store 207.",
          "Store 207",
          "Thanks"
        ],
        expectedFragments: [
          "PING G425 4-PW, shaft firm, condition 8.0 Average, trade value $210, store 207.",
          "Titleist TSR fairway wood, maybe TSR2 or TSR3, stiff shaft, condition 9.0 Above Average, trade value $185, store 114.",
          "Callaway mystery club, shaft unknown, condition 7.0 Below Average, trade value $80, store 301.",
          "Customer brought an unbranded club, shaft unknown, condition 6.0 Poor, value $20.",
          "TaylorMade equipment, exact model and category pending review, condition 8.0 Average, value $100.",
          "Possible Titleist trade item, model unclear, shaft stiff, condition 7.0 Below Average, value $90.",
          "Odyssey White Hot putter, condition 8.0 Average, trade value $65, store 207."
        ]
      },
      {
        sourceType: "EMAIL" as const,
        sourceName: "Customer trade-in email",
        lines: [
          "From: customer@example.com",
          "Subject: Trade-in request",
          "Hi team,",
          "I have a Callaway club but I do not know the model or category. Shaft is unknown, condition 7.0 Below Average and value may be $80.",
          "Also bringing a PING G425 iron set with Regular flex, condition 8.0 Average and value $210.",
          "Please let me know what else you need.",
          "Regards,"
        ],
        expectedFragments: [
          "I have a Callaway club but I do not know the model or category. Shaft is unknown, condition 7.0 Below Average and value may be $80.",
          "Also bringing a PING G425 iron set with Regular flex, condition 8.0 Average and value $210."
        ]
      },
      {
        sourceType: "LOG" as const,
        sourceName: "Import worker log",
        lines: [
          "2026-07-17T10:00:00Z INFO import start store=104 batch=nightly",
          "2026-07-17T10:00:01Z ERROR row=18 payload brand=Callaway model='mystery club' shaft=unknown condition='7.0 Below Average' value=80 store=301",
          "2026-07-17T10:00:02Z WARN candidate equipment record model unknown condition='6.0 Poor' value=25",
          "2026-07-17T10:00:03Z INFO heartbeat healthy"
        ],
        expectedFragments: [
          "2026-07-17T10:00:01Z ERROR row=18 payload brand=Callaway model='mystery club' shaft=unknown condition='7.0 Below Average' value=80 store=301",
          "2026-07-17T10:00:02Z WARN candidate equipment record model unknown condition='6.0 Poor' value=25"
        ]
      },
      {
        sourceType: "POORLY_FORMED_CSV" as const,
        sourceName: "Incomplete CSV export",
        lines: [
          "brand|model|category|shaft|condition|value|store",
          "Callaway|mystery club||unknown|7.0 Below Average|80|301",
          "|unknown item||unknown|6.0 Poor|20|104"
        ],
        expectedFragments: [
          "Callaway|mystery club||unknown|7.0 Below Average|80|301",
          "|unknown item||unknown|6.0 Poor|20|104"
        ]
      }
    ];

    for (const [index, testCase] of cases.entries()) {
      const fragments =
        splitSourceIntoRecordFragments({
          id:
            "segmentation_matrix_" +
            String(index + 1),
          sourceType:
            testCase.sourceType,
          sourceName:
            testCase.sourceName,
          rawContent:
            testCase.lines.join("\n")
        });

      expect(
        fragments,
        testCase.sourceName
      ).toEqual(
        testCase.expectedFragments
      );
    }
  });



  it("scopes store IDs to the current record or one unambiguous source store", () => {
    const multiStoreSource = {
      id: "multi_store_source",
      sourceType: "FREE_TEXT" as const,
      sourceName: "Multiple store intake",
      rawContent: [
        "PING G425 irons shaft Regular condition 8.0 Average value $210 store 207",
        "Callaway mystery club shaft unknown condition 7.0 Below Average value $80 store 301",
        "Unbranded club shaft unknown condition 6.0 Poor value $20"
      ].join("\n")
    };

    const pingRecord = buildRecord(
      multiStoreSource,
      "PING G425 irons shaft Regular condition 8.0 Average value $210 store 207",
      0
    );
    const callawayRecord = buildRecord(
      multiStoreSource,
      "Callaway mystery club shaft unknown condition 7.0 Below Average value $80 store 301",
      1
    );
    const noLocalStoreRecord = buildRecord(
      multiStoreSource,
      "Unbranded club shaft unknown condition 6.0 Poor value $20",
      2
    );

    expect(pingRecord.storeId).toBe("207");
    expect(callawayRecord.storeId).toBe("301");
    expect(noLocalStoreRecord.storeId).toBeNull();

    const sharedStoreSource = {
      id: "shared_store_source",
      sourceType: "EMAIL" as const,
      sourceName: "Shared preferred store",
      rawContent: [
        "From: customer@example.com",
        "Subject: Trade request",
        "PING G425 irons shaft Regular condition 8.0 Average value $210",
        "Odyssey White Hot OG putter condition 8.0 Average value $95",
        "Preferred store: 104"
      ].join("\n")
    };

    const sharedStorePing = buildRecord(
      sharedStoreSource,
      "PING G425 irons shaft Regular condition 8.0 Average value $210",
      0
    );
    const sharedStorePutter = buildRecord(
      sharedStoreSource,
      "Odyssey White Hot OG putter condition 8.0 Average value $95",
      1
    );

    expect(sharedStorePing.storeId).toBe("104");
    expect(sharedStorePutter.storeId).toBe("104");
  });



  it("treats shaft flex as not applicable for putter records", () => {
    const record = parseRecord(
      "Odyssey White Hot OG putter condition 8.0 Average value $95"
    );

    expect(record).toMatchObject({
      brand: "Odyssey",
      productLine: "White Hot OG",
      category: "PUTTER",
      shaftFlex: null,
      conditionGrade: "8.0 Average",
      tradeInValue: 95,
      reviewNeeded: false
    });
    expect(record.missingFields).not.toContain("shaftFlex");
  });


  it("preserves Step 2 product-family specificity without inventing generations", () => {
    const cases = [
      {
        raw: "TaylorMade Stealth driver shaft Regular condition 8.0 Average value $140",
        expected: {
          brand: "TaylorMade",
          productLine: "Stealth",
          category: "DRIVER",
          shaftFlex: "REGULAR"
        }
      },
      {
        raw: "TM Stealth2 rescue shaft Stiff condition 8.0 Average value $115",
        expected: {
          brand: "TaylorMade",
          productLine: "Stealth 2 Rescue",
          category: "HYBRID",
          shaftFlex: "STIFF"
        }
      },
      {
        raw: "PING G425 hy shaft Regular condition 8.0 Average value $120",
        expected: {
          brand: "PING",
          productLine: "G425 Hybrid",
          category: "HYBRID",
          shaftFlex: "REGULAR"
        }
      },
      {
        raw: "Titleist TS2 fairway wood shaft Regular condition 7.0 Below Average value $90",
        expected: {
          brand: "Titleist",
          productLine: "TS2",
          category: "FAIRWAY_WOOD",
          shaftFlex: "REGULAR"
        }
      },
      {
        raw: "Cleveland RTX ZipCore wedge shaft Regular condition 7.0 Below Average value $60",
        expected: {
          brand: "Cleveland",
          productLine: "RTX ZipCore",
          category: "WEDGE"
        }
      },
      {
        raw: "Cleveland RTX 6 ZipCore wedge shaft Tour X-Stiff condition 7.0 Below Average value $72",
        expected: {
          brand: "Cleveland",
          productLine: "RTX 6 ZipCore",
          category: "WEDGE"
        }
      },
      {
        raw: "Odyssey White Hot Versa putter condition 9.0 Above Average value $110",
        expected: {
          brand: "Odyssey",
          productLine: "White Hot Versa",
          category: "PUTTER",
          shaftFlex: null
        }
      }
    ];

    for (const testCase of cases) {
      const record = parseRecord(testCase.raw);

      expect(record).toMatchObject(testCase.expected);
    }

    const ambiguousHotMetal = parseRecord(
      "Mizuno Hot Metal iron set shaft Regular condition 8.0 Average value $350 generation not listed"
    );

    expect(ambiguousHotMetal).toMatchObject({
      brand: "Mizuno",
      productLine: "Hot Metal",
      category: "IRON_SET",
      shaftFlex: "REGULAR",
      reviewNeeded: true
    });
    expect(ambiguousHotMetal.sourceText).toContain("generation not listed");
  });


  it("maps positional CSV value and store columns by header", () => {
    const rawContent = [
      "brand|model|cat|shaft|condition|value|store",
      "Titleist|TSR2|fairway wood|Stiff|8.0 Average|145|104",
      "Odyssey|White Hot Versa|putter||9.0 Above Average|110|207"
    ].join("\n");

    const titleistRecord = parseCsvRecord(
      rawContent,
      "Titleist|TSR2|fairway wood|Stiff|8.0 Average|145|104"
    );
    const odysseyRecord = parseCsvRecord(
      rawContent,
      "Odyssey|White Hot Versa|putter||9.0 Above Average|110|207",
      1
    );

    expect(titleistRecord).toMatchObject({
      brand: "Titleist",
      productLine: "TSR2",
      category: "FAIRWAY_WOOD",
      shaftFlex: "STIFF",
      conditionGrade: "8.0 Average",
      tradeInValue: 145,
      storeId: "104",
      reviewNeeded: false,
      parserEvidence: {
        tradeInValue: {
          value: 145,
          sourceText: "145"
        }
      }
    });
    expect(titleistRecord.missingFields).not.toContain(
      "tradeInValue"
    );

    expect(odysseyRecord).toMatchObject({
      brand: "Odyssey",
      productLine: "White Hot Versa",
      category: "PUTTER",
      shaftFlex: null,
      conditionGrade: "9.0 Above Average",
      tradeInValue: 110,
      storeId: "207",
      reviewNeeded: false,
      parserEvidence: {
        tradeInValue: {
          value: 110,
          sourceText: "110"
        }
      }
    });
    expect(odysseyRecord.missingFields).not.toEqual(
      expect.arrayContaining(["shaftFlex", "tradeInValue"])
    );
  });


  it("uses CSV headers as context for source-supported product and flex values", () => {
    const rawContent = [
      "Brand,Product,Category,Flex,Condition,Trade Value,Store",
      "TaylorMade,Stealth 2,driver,S,9.0 Above Average,$195,104",
      "PING,G430,driver,R,8.0 Average,$180,207",
      "Callaway,mystery club,,unknown,7.0 Below Average,$80,301",
      "Odyssey,White Hot,putter,,6.0 Poor,$45,207",
      "PING,G425,iron set,TX,8.0 Average,$210,104"
    ].join("\n");

    const fragments =
      rawContent
        .split("\n")
        .slice(1);

    const records =
      fragments.map(
        (fragment, index) =>
          parseCsvRecord(
            rawContent,
            fragment,
            index
          )
      );

    const stealth = records[0];
    const g430 = records[1];
    const callaway = records[2];
    const odyssey = records[3];
    const g425 = records[4];

    expect(stealth).toMatchObject({
      brand: "TaylorMade",
      productLine: "Stealth 2",
      category: "DRIVER",
      shaftFlex: "STIFF",
      conditionGrade:
        "9.0 Above Average",
      tradeInValue: 195,
      storeId: "104"
    });
    expect(
      stealth?.parserEvidence
        ?.shaftFlex
    ).toEqual({
      value: "STIFF",
      sourceText: "S"
    });
    expect(
      stealth?.missingFields
    ).not.toContain("shaftFlex");

    expect(g430).toMatchObject({
      brand: "PING",
      productLine: "G430",
      category: "DRIVER",
      shaftFlex: "REGULAR",
      conditionGrade: "8.0 Average",
      tradeInValue: 180,
      storeId: "207"
    });
    expect(
      g430?.parserEvidence
        ?.productLine
    ).toEqual({
      value: "G430",
      sourceText: "G430"
    });
    expect(
      g430?.parserEvidence
        ?.shaftFlex
    ).toEqual({
      value: "REGULAR",
      sourceText: "R"
    });
    expect(
      g430?.missingFields
    ).not.toEqual(
      expect.arrayContaining([
        "productLine",
        "shaftFlex"
      ])
    );

    expect(callaway).toMatchObject({
      brand: "Callaway",
      productLine: null,
      category: null,
      shaftFlex: null,
      conditionGrade:
        "7.0 Below Average",
      tradeInValue: 80,
      storeId: "301"
    });

    expect(odyssey).toMatchObject({
      brand: "Odyssey",
      productLine: "White Hot",
      category: "PUTTER",
      shaftFlex: null,
      conditionGrade: "6.0 Poor",
      tradeInValue: 45,
      storeId: "207"
    });
    expect(
      odyssey?.missingFields
    ).not.toContain("shaftFlex");

    expect(g425).toMatchObject({
      brand: "PING",
      productLine: "G425",
      category: "IRON_SET",
      shaftFlex: "TOUR_X_STIFF",
      conditionGrade: "8.0 Average",
      tradeInValue: 210,
      storeId: "104"
    });
    expect(
      g425?.parserEvidence
        ?.shaftFlex
    ).toEqual({
      value: "TOUR_X_STIFF",
      sourceText: "TX"
    });
    expect(
      g425?.missingFields
    ).not.toContain("shaftFlex");
  });



  it("preserves meaningful unresolved product text for non-CSV records without preserving placeholders", () => {
    const emailSource = {
      id: "email-unresolved-products",
      sourceType: "EMAIL" as const,
      sourceName: "Unresolved product email",
      rawContent: [
        "Subject: Trade-in request",
        "PING G430 driver, Regular shaft, condition 8.0 Average, trade value $180, store 207.",
        "Callaway mystery club, shaft unknown, condition 7.0 Below Average, trade value $80, store 301."
      ].join("\n")
    };
    const freeTextSource = {
      id: "free-text-unresolved-product",
      sourceType: "FREE_TEXT" as const,
      sourceName: "Unresolved product note",
      rawContent:
        "Titleist ZX Prototype 11 driver, Stiff shaft, condition 9.0 Above Average, trade value $140, store 114."
    };

    const g430 = buildRecord(
      emailSource,
      "PING G430 driver, Regular shaft, condition 8.0 Average, trade value $180, store 207.",
      0
    );
    const mysteryClub = buildRecord(
      emailSource,
      "Callaway mystery club, shaft unknown, condition 7.0 Below Average, trade value $80, store 301.",
      1
    );
    const prototype = buildRecord(
      freeTextSource,
      freeTextSource.rawContent,
      0
    );

    expect(g430).toMatchObject({
      brand: "PING",
      productLine: "G430",
      category: "DRIVER",
      shaftFlex: "REGULAR",
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
      g430.missingFields
    ).not.toContain("productLine");

    expect(prototype).toMatchObject({
      brand: "Titleist",
      productLine: "ZX Prototype 11",
      category: "DRIVER",
      shaftFlex: "STIFF",
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
      prototype.missingFields
    ).not.toContain("productLine");

    expect(mysteryClub).toMatchObject({
      brand: "Callaway",
      productLine: null,
      category: null,
      shaftFlex: null,
      productResolution: {
        status: "UNRESOLVED"
      }
    });
    expect(
      mysteryClub.missingFields
    ).toEqual(
      expect.arrayContaining([
        "productLine",
        "category",
        "shaftFlex"
      ])
    );
  });


  it("attaches matched, ambiguous, and unresolved product resolution", () => {
    const matched = parseRecord(
      "Titleist TSR2 3w shaft stiff condition 8.0 Average value $145"
    );
    const ambiguous = parseRecord(
      "Mizuno Hot Metal iron set shaft Regular condition 8.0 Average value $350 generation not listed"
    );
    const unresolved = parseRecord(
      "Titleist ZX Prototype 11 driver shaft stiff condition 8.0 Average value $125"
    );
    const putter = parseRecord(
      "Odyssey White Hot Versa putter condition 9.0 Above Average value $110 serial=UNKNOWN"
    );

    expect(matched.productResolution).toMatchObject({
      status: "MATCHED",
      match: {
        productId:
          "prod_titleist_tsr2_fairway_2023",
        sku:
          "TITLEIST-TSR2-FWY-2023"
      }
    });
    expect(matched.reviewNeeded).toBe(false);

    expect(ambiguous).toMatchObject({
      brand: "Mizuno",
      productLine: "Hot Metal",
      category: "IRON_SET",
      reviewNeeded: true,
      productResolution: {
        status: "AMBIGUOUS"
      }
    });

    expect(unresolved).toMatchObject({
      brand: "Titleist",
      productLine:
        "ZX Prototype 11",
      category: "DRIVER",
      reviewNeeded: true,
      productResolution: {
        status: "UNRESOLVED"
      },
      parserEvidence: {
        productLine: {
          value:
            "ZX Prototype 11",
          sourceText:
            "ZX Prototype 11"
        }
      }
    });
    expect(
      unresolved.missingFields
    ).not.toContain("productLine");

    expect(putter).toMatchObject({
      productLine: "White Hot Versa",
      category: "PUTTER",
      shaftFlex: null,
      reviewNeeded: false,
      productResolution: {
        status: "MATCHED"
      }
    });
    expect(
      putter.missingFields
    ).not.toContain("shaftFlex");
  });

  it("recognizes an injected product across every supported source structure", () => {
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

    const sources = [
      {
        id: "injected_free_text",
        sourceType:
          "FREE_TEXT" as const,
        sourceName:
          "Injected free text",
        rawContent: [
          "Counter intake notes",
          "Test Golf nx prototype driver shaft stiff condition 9.0 Above Average value $225",
          "Store 104"
        ].join("\n")
      },
      {
        id: "injected_email",
        sourceType: "EMAIL" as const,
        sourceName: "Injected email",
        rawContent: [
          "From: customer@example.com",
          "Subject: Trade request",
          "Test Golf nx prototype driver shaft stiff condition 9.0 Above Average value $225",
          "Preferred store: 104"
        ].join("\n")
      },
      {
        id: "injected_log",
        sourceType: "LOG" as const,
        sourceName: "Injected log",
        rawContent: [
          "2026-07-15T10:00:00Z INFO import start store=104",
          "2026-07-15T10:00:01Z INFO normalized payload brand='Test Golf' model='nx prototype driver' cat=driver shaft=stiff condition='9.0 Above Average' value=225"
        ].join("\n")
      },
      {
        id: "injected_csv",
        sourceType:
          "POORLY_FORMED_CSV" as const,
        sourceName: "Injected CSV",
        rawContent: [
          "brand|model|cat|shaft|condition|value|store",
          "Test Golf|nx prototype driver|driver|stiff|9.0 Above Average|225|104"
        ].join("\n")
      }
    ];

    for (const sourceInput of sources) {
      const fragments =
        splitSourceIntoRecordFragments(
          sourceInput,
          provider
        );

      expect(fragments).toHaveLength(1);
      expect(fragments[0]).toContain(
        "nx prototype driver"
      );

      const record = buildRecord(
        sourceInput,
        fragments[0]!,
        0,
        provider
      );

      expect(record).toMatchObject({
        brand: "Test Golf",
        productLine: "Nova X",
        category: "DRIVER",
        shaftFlex: "STIFF",
        conditionGrade:
          "9.0 Above Average",
        tradeInValue: 225,
        reviewNeeded: false,
        missingFields: [],
        productResolution: {
          status: "MATCHED",
          providerRecordCount: 1,
          match: {
            productId:
              "prod_test_nova_x_driver_2026",
            sku:
              "TEST-NOVAX-DRV-2026"
          }
        }
      });
    }
  });

  it("prioritizes explicit LOG identity keys over timestamp and whole-line guesses", () => {
    const rawContent =
      "2026-07-18T16:48:11Z WARN row=27 review payload brand=PING model=G425 cat=irons notes='5-PW regular flex overall avg and cosmetics mint value pending' store=104";
    const record = buildRecord(
      {
        id: "structured_log_identity",
        sourceType: "LOG",
        sourceName:
          "Structured LOG identity",
        rawContent
      },
      rawContent,
      0
    );

    expect(record).toMatchObject({
      brand: "PING",
      productLine: "G425",
      category: "IRON_SET",
      shaftFlex: "REGULAR",
      conditionGrade: null,
      tradeInValue: null,
      storeId: "104",
      reviewNeeded: true
    });

    expect(
      record.missingFields
    ).toEqual(
      expect.arrayContaining([
        "conditionGrade",
        "tradeInValue"
      ])
    );
    expect(
      record.missingFields
    ).not.toEqual(
      expect.arrayContaining([
        "brand",
        "productLine",
        "category",
        "shaftFlex"
      ])
    );
    expect(
      record.parserEvidence
    ).toMatchObject({
      brand: {
        value: "PING",
        sourceText: "PING"
      },
      productLine: {
        value: "G425",
        sourceText: "G425"
      },
      category: {
        value: "IRON_SET",
        sourceText: "irons"
      },
      shaftFlex: {
        value: "REGULAR",
        sourceText:
          expect.stringMatching(
            /regular/i
          )
      }
    });
  });

  it("does not interpret operational timestamp numbers as wedge identity", () => {
    const rawContent =
      "2026-07-18T16:48:11Z ERROR payload brand=Callaway model='mystery club' shaft=unknown condition='7.0 Below Average' value=80 store=301";
    const record = buildRecord(
      {
        id: "timestamp_category_safety",
        sourceType: "LOG",
        sourceName:
          "Timestamp category safety",
        rawContent
      },
      rawContent,
      0
    );

    expect(record).toMatchObject({
      brand: "Callaway",
      productLine: null,
      category: null,
      shaftFlex: null,
      conditionGrade:
        "7.0 Below Average",
      tradeInValue: 80,
      storeId: "301",
      reviewNeeded: true
    });
    expect(record.category).not.toBe(
      "WEDGE"
    );
    expect(
      record.parserEvidence?.category
    ).toBeUndefined();
  });

  it("retains existing free-text wedge recognition outside operational timestamps", () => {
    const namedWedge = buildRecord(
      {
        id: "named_wedge",
        sourceType: "FREE_TEXT",
        sourceName:
          "Named wedge",
        rawContent:
          "Cleveland RTX 6 ZipCore wedge shaft Senior condition 8.0 Average value $70"
      },
      "Cleveland RTX 6 ZipCore wedge shaft Senior condition 8.0 Average value $70",
      0
    );
    const loftWedge = buildRecord(
      {
        id: "loft_wedge",
        sourceType: "FREE_TEXT",
        sourceName:
          "Loft wedge",
        rawContent:
          "Cleveland RTX ZipCore 48 shaft Regular condition 8.0 Average value $65"
      },
      "Cleveland RTX ZipCore 48 shaft Regular condition 8.0 Average value $65",
      0
    );

    expect(namedWedge.category).toBe(
      "WEDGE"
    );
    expect(loftWedge.category).toBe(
      "WEDGE"
    );
  });

});
