import { LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE } from "../intake/legacy-intake-source-types.js";
import { describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import {
  createInMemoryProductReferenceProvider
} from "../product-reference/product-reference-provider.js";
import {
  executeEndToEndAgenticTradeInDemo,
  type EndToEndAgenticTradeInDemoResult
} from "./end-to-end-agentic-trade-in-demo.js";

async function cleanupResult(result: EndToEndAgenticTradeInDemoResult): Promise<void> {
  await prisma.reviewQueueItem.deleteMany({
    where: {
      workflowRunId: result.persisted.workflowRunId
    }
  });

  await prisma.toolCallLog.deleteMany({
    where: {
      workflowRunId: result.persisted.workflowRunId
    }
  });

  await prisma.modelCallLog.deleteMany({
    where: {
      workflowRunId: result.persisted.workflowRunId
    }
  });

  await prisma.workflowRun.deleteMany({
    where: {
      id: result.persisted.workflowRunId
    }
  });

  await prisma.intakeBatch.deleteMany({
    where: {
      id: result.persisted.intakeBatchId
    }
  });
}

function expectNoIndependentInventoryOrValuationToolCalls(
  result: EndToEndAgenticTradeInDemoResult
): void {
  const plannedToolNames =
    result.toolCallingPlan.plannedCalls.map(
      (call) => call.toolName
    );
  const executedToolNames =
    result.toolCallResults.map(
      (toolResult) => toolResult.toolName
    );

  expect(plannedToolNames).not.toContain(
    "swingops.inventory.lookupProduct"
  );
  expect(plannedToolNames).not.toContain(
    "swingops.tradeInValuation.estimate"
  );
  expect(executedToolNames).not.toContain(
    "swingops.inventory.lookupProduct"
  );
  expect(executedToolNames).not.toContain(
    "swingops.tradeInValuation.estimate"
  );
}

describe("executeEndToEndAgenticTradeInDemo", () => {
  it("does not send present shaft, condition, or trade value fields to review", async () => {
    const result = await executeEndToEndAgenticTradeInDemo({
      rawInput:
        "TaylorMade Stealth 2 driver shaft stiff cond avg trade value $150"
    });

    try {
      expect(result.parsedItems).toHaveLength(1);

      const parsedItem = result.parsedItems[0];

      expect(parsedItem).toMatchObject({
        brand: "TaylorMade",
        productLine: "Stealth 2",
        category: "DRIVER",
        shaftFlex: "STIFF",
        conditionGrade: "8.0 Average",
        tradeInValue: 150,
        conditionNotes: ["8.0 Average"],
        missingFields: []
      });
      expect(parsedItem?.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.finalSummary.lowConfidenceItemCount).toBe(0);

      const warningFields = result.validationChecks
        .filter((check) => check.recordId === parsedItem?.id && check.status !== "PASS")
        .map((check) => check.field);

      expect(warningFields).not.toEqual(
        expect.arrayContaining(["shaftFlex", "conditionGrade", "tradeInValue"])
      );

      for (const reviewItem of result.reviewQueueItemsCreated) {
        const proposedRecord = reviewItem.proposedGolfClubJson as {
          shaftFlex?: string | null;
          conditionGrade?: string | null;
          tradeInValue?: number | null;
          missingFields?: string[];
        };

        expect(proposedRecord).toMatchObject({
          shaftFlex: "STIFF",
          conditionGrade: "8.0 Average",
          tradeInValue: 150
        });
        expect(proposedRecord.missingFields ?? []).not.toEqual(
          expect.arrayContaining(["shaftFlex", "conditionGrade", "tradeInValue", "conditionNotes"])
        );
      }
    } finally {
      await cleanupResult(result);
    }
  });
  it("keeps deterministically resolved records out of model review assistance", async () => {
    const rawInput = [
      "Titleist TSR fairway wood, Stiff, 8.0 Average, trade value $135, store 104, generation unclear.",
      "PING G425 4-PW, shaft marked TX, condition 8.0 Average, trade value $210, store 207.",
      "Callaway mystery driver, shaft unknown, condition 7.0 Below Average, trade value pending, store 104.",
      "Odyssey White Hot OG #7 putter, 8.0 Average, trade value $85, store 207.",
      "Callaway Rogue ST Max driver, Regular, 9.0 Above Average, trade value $190, store 104."
    ].join("\n");

    const result =
      await executeEndToEndAgenticTradeInDemo({
        rawInput
      });

    try {
      expect(result.parsedItems).toHaveLength(5);

      const ambiguousItem = result.parsedItems.find(
        (item) =>
          item.rawLine.includes(
            "Titleist TSR fairway wood"
          )
      );
      const deterministicPingItem =
        result.parsedItems.find((item) =>
          item.rawLine.includes(
            "PING G425 4-PW"
          )
        );
      const unresolvedItem = result.parsedItems.find(
        (item) =>
          item.rawLine.includes(
            "Callaway mystery driver"
          )
      );

      expect(ambiguousItem).toMatchObject({
        missingFields: [],
        productResolution: {
          status: "AMBIGUOUS"
        }
      });

      expect(deterministicPingItem).toMatchObject({
        shaftFlex: "TOUR_X_STIFF",
        missingFields: [],
        confidence: 0.93,
        uncertaintyNotes: [],
        productResolution: {
          status: "MATCHED"
        },
        parserEvidence: {
          shaftFlex: {
            value: "TOUR_X_STIFF",
            sourceText: "shaft marked TX"
          }
        }
      });

      expect(unresolvedItem).toMatchObject({
        productLine: null,
        shaftFlex: null,
        missingFields: expect.arrayContaining([
          "productLine",
          "shaftFlex"
        ]),
        productResolution: {
          status: "UNRESOLVED"
        }
      });

      const modelCallLog =
        await prisma.modelCallLog.findUniqueOrThrow({
          where: {
            id:
              result.fieldRepairExecution
                .modelCallLogId
          }
        });
      const requestJson =
        modelCallLog.requestJson as {
          inputJson?: {
            records?: Array<{
              recordId?: string;
              currentFields?: {
                shaftFlex?: string | null;
              };
            }>;
          };
        };
      const selectedRecords =
        requestJson.inputJson?.records ?? [];
      const selectedRecordIds =
        selectedRecords.map(
          (record) => record.recordId
        );

      expect(selectedRecords).toHaveLength(2);
      expect(selectedRecordIds).toEqual([
        ambiguousItem?.id,
        unresolvedItem?.id
      ]);
      expect(selectedRecordIds).not.toContain(
        deterministicPingItem?.id
      );

      expect(
        result.fieldRepairExecution.recordOutcomes
      ).toHaveLength(2);
      expect(
        result.fieldRepairExecution.recordOutcomes
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            recordId: ambiguousItem?.id,
            outcomeType:
              "CANDIDATE_COMPARISON"
          }),
          expect.objectContaining({
            recordId: unresolvedItem?.id,
            outcomeType: "NO_SAFE_REPAIR"
          })
        ])
      );
      expect(
        result.fieldRepairExecution.recordOutcomes.map(
          (outcome) => outcome.recordId
        )
      ).not.toContain(deterministicPingItem?.id);
      expect(
        result.fieldRepairExecution.suggestions
      ).toEqual([]);
      expect(
        result.fieldRepairExecution.validationPassed
      ).toBe(true);
    } finally {
      await cleanupResult(result);
    }
  });

  it("surfaces an approved prior correction as model review assistance without applying it", async () => {
    const priorWorkflowRun =
      await prisma.workflowRun.create({
        data: {
          workflowName:
            "prior-review-advisory-candidate-source",
          status: "COMPLETED"
        }
      });

    const priorReviewQueueItem =
      await prisma.reviewQueueItem.create({
        data: {
          workflowRunId: priorWorkflowRun.id,
          reason: "MISSING_REQUIRED_FIELDS",
          status: "RESOLVED",
          originalText:
            "Prior reviewed PING record with shaft firm",
          proposedGolfClubJson: {
            brand: "PING",
            productLine: "G425",
            category: "IRON_SET",
            shaftFlex: null,
            missingFields: ["shaftFlex"]
          }
        }
      });

    const reviewedTradeInRecord =
      await prisma.reviewedTradeInRecord.create({
        data: {
          reviewQueueItemId:
            priorReviewQueueItem.id,
          workflowRunId: priorWorkflowRun.id,
          originalText:
            "Prior reviewed PING record with shaft firm",
          correctedBrand: "PING",
          correctedProductLine: "G425",
          correctedCategory: "IRON_SET",
          correctedShaftFlex: "STIFF",
          reviewerNotes:
            "Reviewer confirmed shaft firm means STIFF."
        }
      });

    const learningEvent =
      await prisma.humanReviewLearningEvent.create({
        data: {
          reviewedTradeInRecordId:
            reviewedTradeInRecord.id,
          reviewQueueItemId:
            priorReviewQueueItem.id,
          workflowRunId: priorWorkflowRun.id,
          fieldName: "shaftFlex",
          rawTextMatch: "shaft firm",
          proposedValue: "Missing",
          correctedValue: "STIFF",
          evidenceText:
            "Reviewer corrected shaft firm to STIFF.",
          confidenceImpact:
            "Require reviewer confirmation before applying."
        }
      });

    let result:
      EndToEndAgenticTradeInDemoResult | null =
      null;

    try {
      const sourceText =
        "PING G425 4-PW shaft firm condition 8.0 Average trade value $210";

      result =
        await executeEndToEndAgenticTradeInDemo({
          rawInput: sourceText
        });

      expect(result.parsedItems).toHaveLength(1);

      const parsedItem = result.parsedItems[0]!;

      expect(parsedItem).toMatchObject({
        rawLine: sourceText,
        brand: "PING",
        productLine: "G425",
        category: "IRON_SET",
        shaftFlex: null,
        missingFields:
          expect.arrayContaining([
            "shaftFlex"
          ]),
        productResolution: {
          status: "MATCHED"
        }
      });

      const priorSuggestions =
        result
          .priorReviewLearningSuggestionsByItem
          .find(
            (item) =>
              item.parsedItemId === parsedItem.id
          )?.suggestions ?? [];

      expect(priorSuggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldName: "shaftFlex",
            rawTextMatch: "shaft firm",
            suggestedValue: "STIFF",
            strength: "STRONG",
            sourceLearningEventId:
              learningEvent.id,
            status: "SUGGESTED"
          })
        ])
      );

      const modelCallLog =
        await prisma.modelCallLog.findUniqueOrThrow({
          where: {
            id:
              result.fieldRepairExecution
                .modelCallLogId
          }
        });
      const requestJson =
        modelCallLog.requestJson as {
          inputJson?: {
            records?: Array<{
              recordId?: string;
              currentFields?: {
                shaftFlex?: string | null;
              };
              advisoryCandidates?: Array<{
                candidateId?: string;
                sourceType?: string;
                sourceEvidenceId?: string;
                sourceReferenceId?: string;
                suggestion?: {
                  recordId?: string;
                  fieldName?: string;
                  sourcePhrase?: string;
                  candidateValue?:
                    string | number;
                  confidence?: number;
                  reviewRequired?: boolean;
                };
              }>;
            }>;
          };
        };

      const selectedRecord =
        requestJson.inputJson?.records?.find(
          (record) =>
            record.recordId === parsedItem.id
        );

      expect(selectedRecord).toMatchObject({
        currentFields: {
          shaftFlex: null
        },
        advisoryCandidates: [
          {
            candidateId:
              `prior-review:${learningEvent.id}:shaftFlex`,
            sourceType: "PRIOR_REVIEW",
            sourceEvidenceId:
              `${parsedItem.id}:prior-review`,
            sourceReferenceId:
              learningEvent.id,
            suggestion: {
              recordId: parsedItem.id,
              fieldName: "shaftFlex",
              sourcePhrase: "shaft firm",
              candidateValue: "STIFF",
              reviewRequired: true
            }
          }
        ]
      });

      expect(
        result.fieldRepairExecution
          .validationPassed
      ).toBe(true);
      expect(
        result.fieldRepairExecution.recordOutcomes
      ).toEqual([
        expect.objectContaining({
          outcomeType: "REPAIR_SUGGESTED",
          recordId: parsedItem.id,
          evidenceIds:
            expect.arrayContaining([
              `${parsedItem.id}:prior-review`
            ]),
          suggestions: [
            expect.objectContaining({
              recordId: parsedItem.id,
              fieldName: "shaftFlex",
              sourcePhrase: "shaft firm",
              candidateValue: "STIFF",
              reviewRequired: true
            })
          ]
        })
      ]);
      expect(
        result.fieldRepairExecution.suggestions
      ).toEqual([
        expect.objectContaining({
          recordId: parsedItem.id,
          fieldName: "shaftFlex",
          sourcePhrase: "shaft firm",
          candidateValue: "STIFF",
          reviewRequired: true
        })
      ]);

      expect(parsedItem.shaftFlex).toBeNull();
      expect(parsedItem.missingFields).toContain(
        "shaftFlex"
      );
    } finally {
      if (result) {
        await cleanupResult(result);
      }

      await prisma.workflowRun.deleteMany({
        where: {
          id: priorWorkflowRun.id
        }
      });
    }
  });

  it("resolves matching upstream intake review markers when the guarded workflow owns the review", async () => {
    const sourceText =
      "PING G425 4-PW shaft unknown condition unclear value pending review store 207";

    const upstreamBatch = await prisma.intakeBatch.create({
      data: {
        name: "Upstream intake review marker test",
        description: "Test batch with a Step 2 review marker.",
        sourceType: LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE,
        status: "NEEDS_REVIEW",
        itemCount: 1,
        items: {
          create: [
            {
              rawText: `1) ${sourceText}`,
              sourceRowNumber: 1,
              status: "NEEDS_REVIEW"
            }
          ]
        }
      },
      include: {
        items: true
      }
    });

    const upstreamWorkflowRun = await prisma.workflowRun.create({
      data: {
        intakeBatchId: upstreamBatch.id,
        workflowName: "multi-source-intake-demo",
        status: "NEEDS_REVIEW",
        startedAt: new Date()
      }
    });

    const upstreamReviewItem = await prisma.reviewQueueItem.create({
      data: {
        workflowRunId: upstreamWorkflowRun.id,
        intakeItemId: upstreamBatch.items[0]!.id,
        reason: "MISSING_REQUIRED_FIELDS",
        status: "OPEN",
        originalText: `1) ${sourceText}`,
        proposedGolfClubJson: {
          brand: "PING",
          productLine: "G425",
          category: "IRON_SET",
          shaftFlex: null,
          conditionGrade: null,
          tradeInValue: null,
          missingFields: ["shaftFlex", "conditionGrade", "tradeInValue"]
        }
      }
    });

    const result = await executeEndToEndAgenticTradeInDemo({
      rawInput: sourceText
    });

    expect(result.reviewQueueItemsCreated).toHaveLength(1);

    const supersededReviewItem = await prisma.reviewQueueItem.findUniqueOrThrow({
      where: {
        id: upstreamReviewItem.id
      }
    });

    expect(supersededReviewItem.status).toBe("SUPERSEDED");
    expect(supersededReviewItem.resolvedAt).toBeNull();
    expect(supersededReviewItem.supersededAt).not.toBeNull();
    expect(supersededReviewItem.supersededByReviewQueueItemId).toBe(
      result.reviewQueueItemsCreated[0]!.id,
    );
    expect(supersededReviewItem.supersededReason).toContain(
      result.reviewQueueItemsCreated[0]!.id,
    );

    const completedUpstreamWorkflowRun = await prisma.workflowRun.findUniqueOrThrow({
      where: {
        id: upstreamWorkflowRun.id
      }
    });

    expect(completedUpstreamWorkflowRun.status).toBe("COMPLETED");

    const listedSupersededReviewItem = await prisma.reviewQueueItem.findUniqueOrThrow({
      where: {
        id: upstreamReviewItem.id
      }
    });

    expect(listedSupersededReviewItem.supersededByReviewQueueItemId).toBe(
      result.reviewQueueItemsCreated[0]!.id,
    );
  });



  it("does not assign inventory identity or valuation to an ambiguous product family", async () => {
    const result = await executeEndToEndAgenticTradeInDemo({
      rawInput:
        "Titleist TSR fairway wood generation unclear shaft stiff condition 8.0 Average trade value $145"
    });

    try {
      expect(result.parsedItems).toHaveLength(1);
      expect(
        result.parsedItems[0]?.productResolution.status
      ).toBe("AMBIGUOUS");

      expect(
        result.inventoryMatchesByItem[0]?.lookup
      ).toMatchObject({
        productId: null,
        sku: null,
        brand: "Titleist",
        productLine: "TSR",
        category: "FAIRWAY_WOOD"
      });

      expect(
        result.inventoryMatchesByItem[0]
          ?.lookup.similarProducts.length
      ).toBeGreaterThanOrEqual(2);

      expect(
        result.valuationEvidenceByItem[0]?.estimate
      ).toMatchObject({
        lowValue: 0,
        highValue: 0,
        confidence: "LOW",
        reviewRequired: true
      });

      expect(
        result.reviewQueueItemsCreated
      ).toHaveLength(1);
      expect(
        result.finalSummary.inventoryMatchCount
      ).toBe(0);
      expect(
        result.finalSummary.valuationRangeCount
      ).toBe(0);

      expectNoIndependentInventoryOrValuationToolCalls(
        result
      );
    } finally {
      await cleanupResult(result);
    }
  });


  it("does not invent inventory identity or valuation for an unresolved product", async () => {
    const sourceText =
      "Titleist ZX Prototype 11 driver shaft stiff condition 8.0 Average trade value $125";

    const result =
      await executeEndToEndAgenticTradeInDemo({
        rawInput: sourceText
      });

    try {
      expect(result.parsedItems).toHaveLength(1);
      expect(result.parsedItems[0]).toMatchObject({
        rawLine: sourceText,
        brand: "Titleist",
        productLine: null,
        category: "DRIVER",
        productResolution: {
          status: "UNRESOLVED"
        }
      });

      expect(
        result.inventoryMatchesByItem[0]?.lookup
      ).toMatchObject({
        productId: null,
        sku: null,
        brand: "Titleist",
        productLine: null,
        category: "DRIVER",
        confidence: 0,
        similarProducts: []
      });

      expect(
        result.valuationEvidenceByItem[0]?.estimate
      ).toMatchObject({
        lowValue: 0,
        highValue: 0,
        confidence: "LOW",
        reviewRequired: true
      });

      expect(
        result.reviewQueueItemsCreated
      ).toHaveLength(1);
      expect(
        result.finalSummary.inventoryMatchCount
      ).toBe(0);
      expect(
        result.finalSummary.valuationRangeCount
      ).toBe(0);

      const proposedRecord =
        result.reviewQueueItemsCreated[0]
          ?.proposedGolfClubJson as {
            rawLine?: string;
            productResolution?: {
              status?: string;
            };
            inventoryMatch?: {
              productId?: string | null;
              sku?: string | null;
            };
            demoValuationRange?: {
              highValue?: number;
            };
          };

      expect(proposedRecord).toMatchObject({
        rawLine: sourceText,
        productResolution: {
          status: "UNRESOLVED"
        },
        inventoryMatch: {
          productId: null,
          sku: null
        },
        demoValuationRange: {
          highValue: 0
        }
      });

      expectNoIndependentInventoryOrValuationToolCalls(
        result
      );
    } finally {
      await cleanupResult(result);
    }
  });


  it("resolves an injected reference product through the guarded workflow", async () => {
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
      await executeEndToEndAgenticTradeInDemo({
        rawInput:
          "Test Golf nx prototype driver shaft stiff condition 9.0 Above Average trade value $225",
        productReferenceProvider: provider
      });

    try {
      expect(result.parsedItems).toHaveLength(1);
      expect(result.parsedItems[0]).toMatchObject({
        brand: "Test Golf",
        productLine: "Nova X",
        category: "DRIVER",
        productResolution: {
          status: "MATCHED",
          match: {
            productId:
              "prod_test_nova_x_driver_2026",
            sku: "TEST-NOVAX-DRV-2026"
          }
        }
      });

      expect(
        result.inventoryMatchesByItem[0]?.lookup
      ).toMatchObject({
        productId:
          "prod_test_nova_x_driver_2026",
        sku: "TEST-NOVAX-DRV-2026",
        brand: "Test Golf",
        productLine: "Nova X",
        category: "DRIVER"
      });

      expect(
        result.finalSummary.inventoryMatchCount
      ).toBe(1);

      expectNoIndependentInventoryOrValuationToolCalls(
        result
      );
    } finally {
      await cleanupResult(result);
    }
  });

});
