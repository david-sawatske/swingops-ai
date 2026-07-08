import { describe, expect, it } from "vitest";

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
      uncertaintyNotes: ["shaft uncertain", "condition uncertain"]
    });
    expect(thirdItem!.missingFields).toEqual(
      expect.arrayContaining(["brand", "productLine", "shaftFlex", "conditionNotes"])
    );
    expect(thirdItem!.confidence).toBeLessThan(0.72);
  });
  it("parses expanded QA fixture families and fixed condition grades", () => {
    const parsedItems = parseTradeInDemoText([
      "Cleveland RTX 6 ZipCore wedge Senior flex condition 9.0 Above Average",
      "Odyssey White Hot OG putter Ladies flex condition 8.0 Average",
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
      shaftFlex: "LADIES",
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
        raw: "Odyssey White Hot OG putter ladies flex condition 8.0 Average value $95",
        expected: {
          brand: "Odyssey",
          productLine: "White Hot OG",
          category: "PUTTER",
          shaftFlex: "LADIES",
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
      productLine: "TSR",
      category: "FAIRWAY_WOOD",
      shaftFlex: "STIFF",
      conditionGrade: "8.0 Average",
      tradeInValue: 150,
      parserEvidence: {
        brand: { value: "Titleist", sourceText: "Titleist" },
        productLine: { value: "TSR", sourceText: "TSR2" },
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

});
