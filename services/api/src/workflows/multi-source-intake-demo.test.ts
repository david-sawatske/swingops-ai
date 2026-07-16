import { describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import {
  createInMemoryProductReferenceProvider
} from "../product-reference/product-reference-provider.js";
import { executeMultiSourceIntakeDemo } from "./multi-source-intake-demo.js";

describe("executeMultiSourceIntakeDemo", () => {
  it("processes all four source types into AI-ready asset summaries", async () => {
    const result = await executeMultiSourceIntakeDemo();

    expect(result.sourcesProcessed).toBe(4);
    expect(result.sourceResults.map((source) => source.sourceType)).toEqual([
      "FREE_TEXT",
      "POORLY_FORMED_CSV",
      "EMAIL",
      "LOG"
    ]);
    expect(result.recordsExtracted).toBeGreaterThanOrEqual(8);
    expect(result.assetsCreated).toBe(6);
    expect(result.inferredDatasetSchema.map((field) => field.fieldName)).toContain(
      "reviewNeeded"
    );
    expect(result.cleanedDatasetPreview.length).toBe(result.recordsExtracted);
    expect(result.ragReadinessSummary.embeddingReady).toBe(true);
    expect(result.ragReadinessSummary.ragIndexReady).toBe(true);
    expect(result.auditTrail.map((event) => event.label)).toEqual([
      "Raw multi-source input loaded",
      "Source text cleaned",
      "Structured records extracted",
      "Schema and metadata inferred",
      "Quality review signals calculated",
      "AI-ready assets summarized",
      "Final demo summary"
    ]);

    await prisma.intakeBatch.delete({
      where: {
        id: result.persistedIds.intakeBatchId
      }
    });
    await prisma.workflowRun.delete({
      where: {
        id: result.persistedIds.workflowRunId
      }
    });
  });

  it("extracts records from malformed CSV input", async () => {
    const result = await executeMultiSourceIntakeDemo({
      sourceTypes: ["POORLY_FORMED_CSV"]
    });

    expect(result.sourcesProcessed).toBe(1);
    expect(result.recordsExtracted).toBeGreaterThanOrEqual(3);
    expect(result.sourceResults[0]?.metadata.operationalTags).toContain(
      "delimiter-normalization"
    );
    expect(result.cleanedDatasetPreview.some((record) => record.brand === "Callaway")).toBe(true);

    await prisma.intakeBatch.delete({
      where: {
        id: result.persistedIds.intakeBatchId
      }
    });
    await prisma.workflowRun.delete({
      where: {
        id: result.persistedIds.workflowRunId
      }
    });
  });

  it("processes user-provided pasted sources instead of default samples", async () => {
    const result = await executeMultiSourceIntakeDemo({
      sources: [
        {
          sourceType: "FREE_TEXT",
          sourceName: "Uploaded counter note",
          rawContent:
            "Customer Alex brought Callaway Rogue ST Max driver with HZRDUS X. Paint chip. Store 207. Value 190."
        }
      ]
    });

    expect(result.sourcesProcessed).toBe(1);
    expect(result.sourceResults[0]).toMatchObject({
      sourceType: "FREE_TEXT",
      sourceName: "Uploaded counter note"
    });
    expect(result.sourceResults[0]?.rawContent).toContain("Customer Alex");
    expect(result.cleanedDatasetPreview.some((record) => record.brand === "Callaway")).toBe(true);
    expect(result.metadataSummary.detectedStoreIds).toContain("207");

    await prisma.intakeBatch.delete({
      where: {
        id: result.persistedIds.intakeBatchId
      }
    });
    await prisma.workflowRun.delete({
      where: {
        id: result.persistedIds.workflowRunId
      }
    });
  });

  it("extracts email metadata and attachment names", async () => {
    const result = await executeMultiSourceIntakeDemo({
      sourceTypes: ["EMAIL"]
    });

    expect(result.metadataSummary.customerEmails).toContain("hannah.lee@example.com");
    expect(result.metadataSummary.attachmentNames).toEqual([
      "trade_sheet_8821.pdf",
      "driver_photos.zip"
    ]);
    expect(result.metadataSummary.detectedStoreIds).toContain("207");

    await prisma.intakeBatch.delete({
      where: {
        id: result.persistedIds.intakeBatchId
      }
    });
    await prisma.workflowRun.delete({
      where: {
        id: result.persistedIds.workflowRunId
      }
    });
  });

  it("maps numbered wood phrases in emails to fairway wood", async () => {
    const result = await executeMultiSourceIntakeDemo({
      sources: [
        {
          sourceType: "EMAIL",
          sourceName: "Customer 3 wood email",
          rawContent:
            "From: Morgan Price <morgan.price@example.com>\nSubject: Trade-in value request\nI want to trade in a Titleist TSR2 3 wood with a Tensei stiff shaft. It has normal face wear and can be brought to store 104."
        }
      ]
    });

    const titleistRecord = result.cleanedDatasetPreview.find(
      (record) => record.brand === "Titleist"
    );

    expect(titleistRecord?.category).toBe("FAIRWAY_WOOD");
    expect(result.metadataSummary.detectedCategories).toContain("FAIRWAY_WOOD");

    await prisma.intakeBatch.delete({
      where: {
        id: result.persistedIds.intakeBatchId
      }
    });
    await prisma.workflowRun.delete({
      where: {
        id: result.persistedIds.workflowRunId
      }
    });
  });

  it("extracts log timestamps and operational events", async () => {
    const result = await executeMultiSourceIntakeDemo({
      sourceTypes: ["LOG"]
    });

    expect(result.metadataSummary.eventTimestamps).toContain(
      "2026-05-18T14:33:04Z"
    );
    expect(result.metadataSummary.operationalTags).toContain("import-observability");
    expect(result.cleanedDatasetPreview.some((record) => record.eventTimestamp)).toBe(true);

    await prisma.intakeBatch.delete({
      where: {
        id: result.persistedIds.intakeBatchId
      }
    });
    await prisma.workflowRun.delete({
      where: {
        id: result.persistedIds.workflowRunId
      }
    });
  });



  it("keeps condition grades tied to each source record fragment", async () => {
    const result = await executeMultiSourceIntakeDemo();

    const pingRecord = result.cleanedDatasetPreview.find((record) =>
      record.brand === "PING" &&
      record.productLine?.includes("G425") &&
      record.normalizedText.toLowerCase().includes("below average")
    );

    expect(pingRecord).toBeDefined();
    expect(pingRecord?.conditionGrade).toBe("7.0 Below Average");

    const persistedRecords = await prisma.aiReadyIntakeRecord.findMany({
      where: {
        workflowRunId: result.persistedIds.workflowRunId
      }
    });

    const persistedPingRecord = persistedRecords.find((record) => {
      const normalizedJson = record.normalizedJson as {
        brand?: string | null;
        productLine?: string | null;
        conditionGrade?: string | null;
      };

      return (
        normalizedJson.brand === "PING" &&
        normalizedJson.productLine?.includes("G425") &&
        normalizedJson.conditionGrade === "7.0 Below Average"
      );
    });

    expect(persistedPingRecord).toBeDefined();

    await prisma.intakeBatch.delete({
      where: {
        id: result.persistedIds.intakeBatchId
      }
    });
    await prisma.workflowRun.delete({
      where: {
        id: result.persistedIds.workflowRunId
      }
    });
  });

  it("flags incomplete or low-confidence records for review", async () => {
    const result = await executeMultiSourceIntakeDemo();

    expect(result.reviewNeeded).toBeGreaterThanOrEqual(1);
    expect(result.cleanedDatasetPreview.some((record) => record.reviewNeeded)).toBe(true);
    expect(result.persistedIds.reviewQueueItemIds.length).toBe(result.reviewNeeded);
    expect(result.persistedIds.aiReadyIntakeRecordIds.length).toBe(result.recordsExtracted);

    const persistedRecords = await prisma.aiReadyIntakeRecord.findMany({
      where: {
        workflowRunId: result.persistedIds.workflowRunId
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    expect(persistedRecords).toHaveLength(result.recordsExtracted);
    expect(persistedRecords[0]).toMatchObject({
      intakeBatchId: result.persistedIds.intakeBatchId,
      workflowRunId: result.persistedIds.workflowRunId,
      sourceType: expect.any(String),
      reviewNeeded: expect.any(Boolean)
    });
    expect(persistedRecords[0]?.normalizedJson).toEqual(
      expect.objectContaining({
        conditionGrade: expect.anything()
      })
    );

    await prisma.intakeBatch.delete({
      where: {
        id: result.persistedIds.intakeBatchId
      }
    });
    await prisma.workflowRun.delete({
      where: {
        id: result.persistedIds.workflowRunId
      }
    });
  });
  it("normalizes equivalent QA fixture records across source formats", async () => {
    const result = await executeMultiSourceIntakeDemo({
      sources: [
        {
          sourceType: "FREE_TEXT",
          sourceName: "QA free text fixture",
          rawContent:
            "Counter note: Cleveland RTX 6 ZipCore wedge Senior flex condition 9.0 Above Average value $72 store 104 serial CLV-001 worn grip note only."
        },
        {
          sourceType: "POORLY_FORMED_CSV",
          sourceName: "QA CSV fixture",
          rawContent:
            "brand|model|cat|shaft|condition_grade|value|store|serial\nOdyssey|White Hot OG putter|putter||8.0 Average|$95|104|ODS-002"
        },
        {
          sourceType: "EMAIL",
          sourceName: "QA email fixture",
          rawContent:
            "From: Casey Park <casey.park@example.com>\nSubject: Trade value\nI have a Mizuno JPX 923 Hot Metal iron set with Tour X-Stiff shaft, condition 9.0 Above Average, estimated value 390, store 104, serial MIZ-003."
        },
        {
          sourceType: "LOG",
          sourceName: "QA log fixture",
          rawContent:
            "2026-06-24T10:12:44Z INFO normalized payload brand=PING model=G430 Max cat=driver shaft='Tour X-Stiff' condition='9.5 Mint' value=240 store=207 serial=PNG-004"
        }
      ]
    });

    expect(result.sourcesProcessed).toBe(4);
    expect(result.cleanedDatasetPreview).toHaveLength(4);

    const expectedRecords = [
      {
        sourceType: "FREE_TEXT",
        brand: "Cleveland",
        productLine: "RTX 6 ZipCore",
        category: "WEDGE",
        shaftFlex: "SENIOR",
        conditionGrade: "9.0 Above Average",
        tradeInValue: 72
      },
      {
        sourceType: "POORLY_FORMED_CSV",
        brand: "Odyssey",
        productLine: "White Hot OG",
        category: "PUTTER",
        shaftFlex: null,
        conditionGrade: "8.0 Average",
        tradeInValue: 95
      },
      {
        sourceType: "EMAIL",
        brand: "Mizuno",
        productLine: "JPX 923 Hot Metal",
        category: "IRON_SET",
        shaftFlex: "TOUR_X_STIFF",
        conditionGrade: "9.0 Above Average",
        tradeInValue: 390
      },
      {
        sourceType: "LOG",
        brand: "PING",
        productLine: "G430 Max",
        category: "DRIVER",
        shaftFlex: "TOUR_X_STIFF",
        conditionGrade: "9.5 Mint",
        tradeInValue: 240
      }
    ];

    for (const expectedRecord of expectedRecords) {
      expect(result.cleanedDatasetPreview).toContainEqual(
        expect.objectContaining({
          ...expectedRecord,
          reviewNeeded: false,
          missingFields: []
        })
      );
    }

    expect(result.cleanedDatasetPreview.map((record) => record.normalizedText).join(" ")).not.toMatch(
      /CLV-001|ODS-002|MIZ-003|PNG-004|serial/i
    );
    expect(result.cleanedDatasetPreview.map((record) => record.conditionGrade)).not.toContain(
      "worn grip"
    );

    await prisma.intakeBatch.delete({
      where: {
        id: result.persistedIds.intakeBatchId
      }
    });
    await prisma.workflowRun.delete({
      where: {
        id: result.persistedIds.workflowRunId
      }
    });
  });


  it("resolves an injected reference product through the multi-source workflow", async () => {
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

    const result =
      await executeMultiSourceIntakeDemo({
        sources: [
          {
            sourceType: "FREE_TEXT",
            sourceName:
              "Injected reference fixture",
            rawContent:
              "Test Golf nx prototype driver shaft stiff condition 9.0 Above Average value $225 store 104"
          }
        ],
        productReferenceProvider: provider
      });

    try {
      expect(result.sourcesProcessed).toBe(1);
      expect(result.recordsExtracted).toBe(1);
      expect(result.cleanedDatasetPreview).toHaveLength(1);

      expect(
        result.cleanedDatasetPreview[0]
      ).toMatchObject({
        brand: "Test Golf",
        productLine: "Nova X",
        category: "DRIVER",
        shaftFlex: "STIFF",
        conditionGrade:
          "9.0 Above Average",
        tradeInValue: 225,
        storeId: "104",
        reviewNeeded: false,
        missingFields: [],
        productResolution: {
          status: "MATCHED",
          providerRecordCount: 1,
          match: {
            productId:
              "prod_test_nova_x_driver_2026",
            sku: "TEST-NOVAX-DRV-2026"
          }
        }
      });

      expect(result.reviewNeeded).toBe(0);
      expect(
        result.persistedIds
          .reviewQueueItemIds
      ).toHaveLength(0);
      expect(
        result.persistedIds
          .aiReadyIntakeRecordIds
      ).toHaveLength(1);
    } finally {
      await prisma.intakeBatch.delete({
        where: {
          id:
            result.persistedIds
              .intakeBatchId
        }
      });

      await prisma.workflowRun.delete({
        where: {
          id:
            result.persistedIds
              .workflowRunId
        }
      });
    }
  });

});
