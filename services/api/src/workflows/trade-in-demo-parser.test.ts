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

});
