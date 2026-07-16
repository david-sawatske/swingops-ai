import {
  describe,
  expect,
  it
} from "vitest";

import {
  resolveProductReference
} from "../product-reference/product-reference-resolver.js";
import {
  buildInventoryLookupFromProductResolution
} from "./product-resolution-inventory-adapter.js";

describe(
  "buildInventoryLookupFromProductResolution",
  () => {
    it(
      "uses the resolver stable product ID and SKU for an authoritative match",
      () => {
        const resolution =
          resolveProductReference({
            brand: "TM",
            category: "drv",
            rawText:
              "TM stealth2 drv 10.5 Ventus stiff"
          });

        const lookup =
          buildInventoryLookupFromProductResolution({
            resolution,
            fallback: {
              brand: "TaylorMade",
              productLine: "Stealth 2",
              category: "DRIVER"
            }
          });

        expect(lookup).toMatchObject({
          productId:
            "prod_taylormade_stealth2_driver_2023",
          sku: "TM-STEALTH2-DRV-2023",
          brand: "TaylorMade",
          productLine: "Stealth 2",
          category: "DRIVER",
          confidence: expect.any(Number),
          matchReasons:
            expect.arrayContaining([
              "Brand matched TaylorMade.",
              "Product line matched Stealth 2."
            ])
        });
      }
    );

    it(
      "keeps ambiguous candidates visible without assigning an authoritative SKU",
      () => {
        const resolution =
          resolveProductReference({
            brand: "Titleist",
            category: "fairway wood",
            productText: "TSR",
            rawText:
              "Titleist TSR fairway wood generation unclear"
          });

        const lookup =
          buildInventoryLookupFromProductResolution({
            resolution,
            fallback: {
              brand: "Titleist",
              productLine: "TSR",
              category: "FAIRWAY_WOOD"
            }
          });

        expect(resolution.status).toBe(
          "AMBIGUOUS"
        );
        expect(lookup).toMatchObject({
          productId: null,
          sku: null,
          brand: "Titleist",
          productLine: "TSR",
          category: "FAIRWAY_WOOD"
        });
        expect(
          lookup.similarProducts.length
        ).toBeGreaterThanOrEqual(2);
        expect(
          lookup.matchReasons
        ).toContain(
          "Product reference candidates require human confirmation before inventory or valuation use."
        );
      }
    );

    it(
      "does not invent identity for an unresolved product",
      () => {
        const resolution =
          resolveProductReference({
            brand: "Titleist",
            category: "driver",
            rawText:
              "Titleist ZX Prototype 11 driver"
          });

        const lookup =
          buildInventoryLookupFromProductResolution({
            resolution,
            fallback: {
              brand: "Titleist",
              productLine: null,
              category: "DRIVER"
            }
          });

        expect(resolution.status).toBe(
          "UNRESOLVED"
        );
        expect(lookup).toMatchObject({
          productId: null,
          sku: null,
          brand: "Titleist",
          productLine: null,
          category: "DRIVER",
          confidence: 0,
          similarProducts: []
        });
        expect(
          lookup.matchReasons
        ).toContain(
          "No stable product ID or SKU was assigned."
        );
      }
    );
  }
);
