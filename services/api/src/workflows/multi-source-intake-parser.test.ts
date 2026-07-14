import { describe, expect, it } from "vitest";

import { buildRecord } from "./multi-source-intake-parser.js";

function parseRecord(rawContent: string) {
  return buildRecord(
    {
      id: "matrix_source",
      sourceType: "FREE_TEXT",
      sourceName: "Parser matrix source",
      rawContent
    },
    rawContent,
    0
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

});
