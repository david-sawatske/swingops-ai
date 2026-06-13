import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { createMockModelCallLogForWorkflowRun } from "../workflows/workflow-model-logging.js";

describe("workflow run routes", () => {
  describe("GET /workflow-runs", () => {
    it("returns a workflow run list response", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/workflow-runs"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(Array.isArray(body.workflowRuns)).toBe(true);

      await app.close();
    });

    it("returns workflow runs with intake context", async () => {
      const app = buildApp();

      const intakeBatch = await prisma.intakeBatch.create({
        data: {
          name: "Workflow Runs Dashboard Batch",
          sourceType: "FREEFORM_NOTES",
          itemCount: 1,
          items: {
            create: [
              {
                rawText: "Callaway Rogue ST Max driver, stiff, RH"
              }
            ]
          }
        },
        include: {
          items: true
        }
      });

      const intakeItem = intakeBatch.items[0];

      expect(intakeItem).toBeDefined();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          intakeBatchId: intakeBatch.id,
          intakeItemId: intakeItem!.id,
          workflowName: "workflow-runs-dashboard-list",
          status: "QUEUED"
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/workflow-runs"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      const listedRun = body.workflowRuns.find(
        (run: { id: string }) => run.id === workflowRun.id
      );

      expect(listedRun).toMatchObject({
        id: workflowRun.id,
        intakeBatchId: intakeBatch.id,
        intakeItemId: intakeItem!.id,
        workflowName: "workflow-runs-dashboard-list",
        status: "QUEUED",
        intakeBatch: {
          id: intakeBatch.id,
          name: "Workflow Runs Dashboard Batch"
        },
        intakeItem: {
          id: intakeItem!.id,
          rawText: "Callaway Rogue ST Max driver, stiff, RH"
        },
        latestModelCallLog: null,
        totalReviewQueueItemCount: 0,
        openReviewQueueItemCount: 0
      });

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });
      await prisma.intakeBatch.delete({
        where: {
          id: intakeBatch.id
        }
      });

      await app.close();
    });

    it("includes the latest model call log for each workflow run", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "workflow-runs-dashboard-model-log"
        }
      });

      await prisma.modelCallLog.create({
        data: {
          workflowRunId: workflowRun.id,
          provider: "MOCK",
          model: "older-model-route",
          status: "SUCCEEDED",
          latencyMs: 42,
          estimatedCostUsd: 0,
          requestJson: {
            routingGoal: "LOW_COST"
          },
          responseJson: {
            routingDecision: {
              provider: "MOCK",
              model: "older-model-route"
            }
          },
          startedAt: new Date("2026-01-01T00:00:00.000Z"),
          completedAt: new Date("2026-01-01T00:00:01.000Z"),
          createdAt: new Date("2026-01-01T00:00:01.000Z")
        }
      });

      await prisma.modelCallLog.create({
        data: {
          workflowRunId: workflowRun.id,
          provider: "MOCK",
          model: "latest-model-route",
          status: "SUCCEEDED",
          latencyMs: 24,
          estimatedCostUsd: 0,
          requestJson: {
            routingGoal: "QUALITY"
          },
          responseJson: {
            routingDecision: {
              provider: "MOCK",
              model: "latest-model-route",
              estimatedCostTier: "FREE",
              expectedLatencyTier: "LOW",
              qualityTier: "LOW"
            }
          },
          startedAt: new Date("2026-01-02T00:00:00.000Z"),
          completedAt: new Date("2026-01-02T00:00:01.000Z"),
          createdAt: new Date("2026-01-02T00:00:01.000Z")
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/workflow-runs"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      const listedRun = body.workflowRuns.find(
        (run: { id: string }) => run.id === workflowRun.id
      );

      expect(listedRun.latestModelCallLog).toMatchObject({
        workflowRunId: workflowRun.id,
        provider: "MOCK",
        model: "latest-model-route",
        status: "SUCCEEDED",
        latencyMs: 24,
        estimatedCostUsd: 0,
        requestJson: {
          routingGoal: "QUALITY"
        }
      });

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });

    it("includes latest tool call log and audit-only counts for each workflow run", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "workflow-runs-dashboard-tool-log-summary"
        }
      });

      await prisma.toolCallLog.create({
        data: {
          workflowRunId: workflowRun.id,
          toolName: "simulate.parseInput",
          status: "SUCCEEDED",
          inputJson: {
            sku: "OLDER-1"
          },
          outputJson: {
            simulated: true,
            parsedItemCount: 1
          },
          startedAt: new Date("2026-01-01T00:00:00.000Z"),
          completedAt: new Date("2026-01-01T00:00:01.000Z"),
          createdAt: new Date("2026-01-01T00:00:01.000Z")
        }
      });

      await prisma.toolCallLog.create({
        data: {
          workflowRunId: workflowRun.id,
          toolName: "inventory.reserveTradeInSlot",
          status: "STARTED",
          inputJson: {
            sku: "AUDIT-ONLY-1"
          },
          outputJson: {
            previewOnly: true,
            executionAttempted: false,
            policyDecision: "REQUIRES_HUMAN_APPROVAL",
            policyReasonCodes: ["MUTATION_TOOL", "HUMAN_APPROVAL_REQUIRED"],
            invocationStatus: "BLOCKED",
            requestedBy: "operator@example.com"
          },
          startedAt: new Date("2026-01-02T00:00:00.000Z"),
          createdAt: new Date("2026-01-02T00:00:00.000Z")
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/workflow-runs"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      const listedRun = body.workflowRuns.find(
        (run: { id: string }) => run.id === workflowRun.id
      );

      expect(listedRun.latestToolCallLog).toMatchObject({
        workflowRunId: workflowRun.id,
        toolName: "inventory.reserveTradeInSlot",
        status: "STARTED",
        outputJson: {
          previewOnly: true,
          executionAttempted: false,
          policyDecision: "REQUIRES_HUMAN_APPROVAL",
          policyReasonCodes: ["MUTATION_TOOL", "HUMAN_APPROVAL_REQUIRED"],
          invocationStatus: "BLOCKED",
          requestedBy: "operator@example.com"
        }
      });
      expect(listedRun.totalToolCallLogCount).toBe(2);
      expect(listedRun.auditOnlyToolCallLogCount).toBe(1);

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });

    it("includes review queue counts for each workflow run", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "workflow-runs-dashboard-review-counts",
          reviewQueueItems: {
            create: [
              {
                reason: "LOW_CONFIDENCE",
                status: "OPEN",
                originalText: "TM driver, shaft unknown"
              },
              {
                reason: "AMBIGUOUS_INPUT",
                status: "IN_REVIEW",
                originalText: "Ping irons maybe 5-PW"
              },
              {
                reason: "MISSING_REQUIRED_FIELDS",
                status: "RESOLVED",
                originalText: "Odyssey putter"
              }
            ]
          }
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/workflow-runs"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      const listedRun = body.workflowRuns.find(
        (run: { id: string }) => run.id === workflowRun.id
      );

      expect(listedRun.totalReviewQueueItemCount).toBe(3);
      expect(listedRun.openReviewQueueItemCount).toBe(2);

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });
  });

  describe("POST /workflow-runs/agentic-trade-in-demo", () => {
    it("runs the polished end-to-end agentic trade-in demo and returns an audit trail", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/workflow-runs/agentic-trade-in-demo",
        payload: {
          rawInput: [
            "TM stealth2 drv 10.5 Ventus stiff, no hc, sky mark on crown",
            "unknown maybe 5w shaft unknown condition unclear"
          ].join("\n")
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.rawInput).toContain("TM stealth2");
      expect(body.parsedItems).toHaveLength(2);
      expect(body.parsedItems[0]).toMatchObject({
        brand: "TaylorMade",
        productLine: "Stealth 2",
        category: "DRIVER",
        shaftFlex: "STIFF",
        missingFields: []
      });
      expect(body.parsedItems[1].confidence).toBeLessThan(0.72);
      expect(body.parsedItems[1].missingFields.length).toBeGreaterThan(0);

      expect(body.knowledgeMatchesByItem).toHaveLength(2);
      expect(Array.isArray(body.knowledgeMatchesByItem[0].search.results)).toBe(true);
      if (body.knowledgeMatchesByItem[0].search.results.length > 0) {
        expect(body.knowledgeMatchesByItem[0].search.results[0]).toHaveProperty(
          "scoreBreakdown"
        );
        expect(body.knowledgeMatchesByItem[0].search.results[0].scoreBreakdown.components).toHaveProperty(
          "brand"
        );
      }

      expect(body.inventoryMatchesByItem).toHaveLength(2);
      expect(body.inventoryMatchesByItem[0]).toMatchObject({
        parsedItemId: body.parsedItems[0].id,
        lookup: {
          sku: "TM-STEALTH2-DRV-2023",
          confidence: expect.any(Number),
          matchReasons: expect.arrayContaining([
            "Brand matched TaylorMade.",
            "Product line matched Stealth 2."
          ])
        }
      });

      expect(body.valuationEvidenceByItem).toHaveLength(2);
      expect(body.valuationEvidenceByItem[0]).toMatchObject({
        parsedItemId: body.parsedItems[0].id,
        estimate: {
          lowValue: 109,
          highValue: 149,
          confidence: "MEDIUM",
          reviewRequired: false,
          adjustments: expect.arrayContaining([
            expect.objectContaining({
              reason: "Crown sky mark reduces the demo range."
            }),
            expect.objectContaining({
              reason: "Missing headcover reduces the demo range."
            })
          ])
        }
      });
      expect(body.valuationEvidenceByItem[1].estimate.reviewRequired).toBe(true);

      expect(body.modelRoutingDecision).toMatchObject({
        selectedProvider: expect.any(String),
        selectedModel: expect.any(String),
        candidatesConsidered: expect.any(Array)
      });
      expect(body.modelCallLog).toMatchObject({
        workflowRunId: body.persisted.workflowRunId,
        status: "SUCCEEDED"
      });

      expect(body.toolCallingPlan.plannedCalls.map((call: { toolName: string }) => call.toolName)).toEqual([
        "swingops.workflowRuns.get",
        "swingops.knowledgeBase.search",
        "swingops.inventory.lookupProduct",
        "swingops.tradeInValuation.estimate",
        "swingops.reviewQueueItems.list",
        "swingops.inventory.createSku"
      ]);
      expect(body.toolCallResults).toHaveLength(6);
      expect(body.toolCallResults.filter((result: { status: string }) => result.status === "SUCCEEDED")).toHaveLength(5);
      expect(body.blockedToolCallResult).toMatchObject({
        toolName: "swingops.inventory.createSku",
        status: "BLOCKED",
        executionAttempted: false
      });

      expect(body.reviewQueueItemsCreated.length).toBeGreaterThanOrEqual(1);
      expect(body.reviewQueueItemsCreated[0]).toMatchObject({
        workflowRunId: body.persisted.workflowRunId,
        status: "OPEN"
      });
      expect(body.finalSummary).toMatchObject({
        parsedItemCount: 2,
        lowConfidenceItemCount: 1,
        reviewQueueItemCount: body.reviewQueueItemsCreated.length,
        successfulReadOnlyToolCallCount: 5,
        blockedMutationToolCallCount: 1,
        inventoryMatchCount: 1,
        valuationRangeCount: 1,
        valuationReviewRequiredCount: 1
      });

      expect(body.agentPlan.map((step: { id: string }) => step.id)).toEqual([
        "agent-plan-validate-fields",
        "agent-plan-search-knowledge",
        "agent-plan-match-inventory",
        "agent-plan-estimate-value",
        "agent-plan-select-tools",
        "agent-plan-provider-fallback",
        "agent-plan-retry-shaft-flex",
        "agent-plan-human-review",
        "agent-plan-block-mutation",
        "agent-plan-record-quality-summary"
      ]);
      expect(body.agentPlan).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: "Attempt targeted retry for recoverable missing fields",
            actionType: "RETRY_EXTRACTION",
            retryPolicy: "one targeted retry before human review"
          }),
          expect.objectContaining({
            label: "Block unsafe mutations unless approved",
            actionType: "ENFORCE_POLICY",
            status: "BLOCKED"
          })
        ])
      );

      expect(body.validationChecks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: "Brand recognized",
            status: "PASS"
          }),
          expect.objectContaining({
            label: "Shaft/flex data complete",
            status: "WARNING",
            field: "shaftFlex",
            reviewRequired: true
          }),
          expect.objectContaining({
            label: "Inventory product match",
            status: "PASS"
          }),
          expect.objectContaining({
            label: "Demo valuation range generated",
            status: "PASS",
            field: "demoValuationRange"
          }),
          expect.objectContaining({
            label: "Review requirement determined",
            status: "WARNING",
            reviewRequired: true
          }),
          expect.objectContaining({
            label: "Unsafe mutation blocked",
            status: "PASS",
            reviewRequired: false
          })
        ])
      );

      expect(body.retryEvents).toEqual([
        expect.objectContaining({
          reason: "missing or uncertain shaft/flex data",
          targetField: "shaftFlex",
          status: "UNRESOLVED",
          policy: "one targeted retry before human review"
        })
      ]);

      expect(body.providerFallbackTrace).toMatchObject({
        routingGoal: "HIGH_QUALITY",
        finalProvider: body.modelCallLog.provider,
        finalModel: body.modelCallLog.model,
        fallbackUsed: true,
        attempts: expect.any(Array)
      });
      expect(body.providerFallbackTrace.attempts.length).toBeGreaterThanOrEqual(1);

      expect(body.toolSelectionRationales).toEqual([
        expect.objectContaining({
          toolName: "swingops.workflowRuns.get",
          expectedRiskLevel: "LOW",
          expectedMutatesData: false
        }),
        expect.objectContaining({
          toolName: "swingops.knowledgeBase.search",
          expectedRiskLevel: "LOW",
          expectedMutatesData: false
        }),
        expect.objectContaining({
          toolName: "swingops.inventory.lookupProduct",
          expectedRiskLevel: "LOW",
          expectedMutatesData: false
        }),
        expect.objectContaining({
          toolName: "swingops.tradeInValuation.estimate",
          expectedRiskLevel: "LOW",
          expectedMutatesData: false
        }),
        expect.objectContaining({
          toolName: "swingops.reviewQueueItems.list",
          expectedRiskLevel: "LOW",
          expectedMutatesData: false
        }),
        expect.objectContaining({
          toolName: "swingops.inventory.createSku",
          expectedRiskLevel: "HIGH",
          expectedMutatesData: true,
          expectedRequiresHumanApproval: true
        })
      ]);

      expect(body.reviewOutcomes.length).toBeGreaterThanOrEqual(1);
      expect(body.reviewOutcomes[0]).toMatchObject({
        reviewQueueItemId: body.reviewQueueItemsCreated[0].id,
        reason: body.reviewQueueItemsCreated[0].reason,
        validationWarnings: expect.any(Array),
        suggestedNextAction:
          "Review the original text, confirm uncertain equipment fields, and approve or correct the proposed structured record."
      });

      expect(body.workflowQualitySummary).toMatchObject({
        status: "NEEDS_REVIEW",
        recordsProcessed: 2,
        validationFailures: 0,
        retryAttempts: 1,
        reviewItemsCreated: body.reviewQueueItemsCreated.length,
        toolCalls: 6,
        blockedMutations: 1,
        inventoryMatches: 1,
        valuationRangesGenerated: 1,
        valuationReviewRequired: 1,
        providerFallbackUsed: true,
        evidenceCoverage: expect.any(String)
      });
      expect(body.workflowQualitySummary.validationPassed).toBeGreaterThan(0);
      expect(body.workflowQualitySummary.validationWarnings).toBeGreaterThan(0);
      expect(body.workflowQualitySummary.summary).toContain(
        "validation found unresolved uncertainty"
      );

      expect(body.auditTrail.map((event: { label: string }) => event.label)).toEqual([
        "Raw messy intake received",
        "Structured equipment records parsed",
        "RAG knowledge retrieved",
        "Inventory product matched",
        "Demo valuation range estimated",
        "Model route selected",
        "Read-only tools executed",
        "Mutation tool blocked",
        "Human review surfaced",
        "Final demo summary"
      ]);

      expect(body.persisted.toolCallLogIds).toHaveLength(6);

      const persistedToolCallLogCount = await prisma.toolCallLog.count({
        where: {
          id: {
            in: body.persisted.toolCallLogIds
          }
        }
      });
      expect(persistedToolCallLogCount).toBe(body.persisted.toolCallLogIds.length);

      await prisma.intakeBatch.delete({
        where: {
          id: body.persisted.intakeBatchId
        }
      });
      await prisma.workflowRun.delete({
        where: {
          id: body.persisted.workflowRunId
        }
      });

      await app.close();
    });

    it("rejects invalid agentic trade-in demo payloads", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/workflow-runs/agentic-trade-in-demo",
        payload: {
          rawInput: "TM stealth2 driver",
          unexpected: true
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: "Invalid agentic trade-in demo request"
      });

      await app.close();
    });
  });

  describe("POST /workflow-runs/multi-source-intake-demo", () => {
    it("runs the multi-source intake demo for all four source types", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/workflow-runs/multi-source-intake-demo",
        payload: {}
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.sourcesProcessed).toBe(4);
      expect(body.sourceResults.map((source: { sourceType: string }) => source.sourceType)).toEqual([
        "FREE_TEXT",
        "POORLY_FORMED_CSV",
        "EMAIL",
        "LOG"
      ]);
      expect(body.recordsExtracted).toBeGreaterThanOrEqual(8);
      expect(body.assetsCreated).toBe(6);
      expect(body.reviewNeeded).toBeGreaterThanOrEqual(1);
      expect(body.cleanedDatasetPreview).toHaveLength(body.recordsExtracted);
      expect(body.inferredDatasetSchema.map((field: { fieldName: string }) => field.fieldName)).toContain(
        "reviewNeeded"
      );
      expect(body.ragReadinessSummary).toMatchObject({
        embeddingReady: true,
        ragIndexReady: true
      });
      expect(body.finalSummary).toBe(
        "Processed 4 source types into normalized records, inferred schema fields, metadata, review signals, and RAG-ready asset summaries."
      );
      expect(body.persistedIds).toMatchObject({
        intakeBatchId: expect.any(String),
        workflowRunId: expect.any(String)
      });

      await prisma.intakeBatch.delete({
        where: {
          id: body.persistedIds.intakeBatchId
        }
      });
      await prisma.workflowRun.delete({
        where: {
          id: body.persistedIds.workflowRunId
        }
      });

      await app.close();
    });

    it("extracts records from malformed CSV input through the route", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/workflow-runs/multi-source-intake-demo",
        payload: {
          sourceTypes: ["POORLY_FORMED_CSV"]
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.sourcesProcessed).toBe(1);
      expect(body.sourceResults[0]).toMatchObject({
        sourceType: "POORLY_FORMED_CSV"
      });
      expect(body.sourceResults[0].metadata.operationalTags).toContain(
        "delimiter-normalization"
      );
      expect(body.cleanedDatasetPreview.some((record: { brand: string | null }) => record.brand === "Callaway")).toBe(true);

      await prisma.intakeBatch.delete({
        where: {
          id: body.persistedIds.intakeBatchId
        }
      });
      await prisma.workflowRun.delete({
        where: {
          id: body.persistedIds.workflowRunId
        }
      });

      await app.close();
    });

    it("runs the multi-source intake demo with user-provided sources", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/workflow-runs/multi-source-intake-demo",
        payload: {
          sources: [
            {
              sourceType: "EMAIL",
              sourceName: "Forwarded customer email",
              rawContent: [
                "From: Alex Kim <alex.kim@example.com>",
                "Subject: Trade estimate",
                "",
                "I have a Titleist TSR2 3 wood with Tensei stiff shaft.",
                "There is face wear and I can bring it to store 104."
              ].join("\n")
            }
          ]
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.sourcesProcessed).toBe(1);
      expect(body.sourceResults[0]).toMatchObject({
        sourceType: "EMAIL",
        sourceName: "Forwarded customer email"
      });
      expect(body.metadataSummary.customerEmails).toContain("alex.kim@example.com");
      expect(body.metadataSummary.detectedStoreIds).toContain("104");
      expect(body.cleanedDatasetPreview.some((record: { brand: string }) => record.brand === "Titleist")).toBe(
        true
      );

      await prisma.intakeBatch.delete({
        where: {
          id: body.persistedIds.intakeBatchId
        }
      });
      await prisma.workflowRun.delete({
        where: {
          id: body.persistedIds.workflowRunId
        }
      });

      await app.close();
    });

    it("extracts email metadata and log timestamps through filtered runs", async () => {
      const app = buildApp();

      const emailResponse = await app.inject({
        method: "POST",
        url: "/workflow-runs/multi-source-intake-demo",
        payload: {
          sourceTypes: ["EMAIL"]
        }
      });

      expect(emailResponse.statusCode).toBe(200);

      const emailBody = emailResponse.json();
      expect(emailBody.metadataSummary.customerEmails).toContain("hannah.lee@example.com");
      expect(emailBody.metadataSummary.attachmentNames).toContain("trade_sheet_8821.pdf");

      await prisma.intakeBatch.delete({
        where: {
          id: emailBody.persistedIds.intakeBatchId
        }
      });
      await prisma.workflowRun.delete({
        where: {
          id: emailBody.persistedIds.workflowRunId
        }
      });

      const logResponse = await app.inject({
        method: "POST",
        url: "/workflow-runs/multi-source-intake-demo",
        payload: {
          sourceTypes: ["LOG"]
        }
      });

      expect(logResponse.statusCode).toBe(200);

      const logBody = logResponse.json();
      expect(logBody.metadataSummary.eventTimestamps).toContain(
        "2026-05-18T14:33:04Z"
      );
      expect(logBody.metadataSummary.operationalTags).toContain("import-observability");

      await prisma.intakeBatch.delete({
        where: {
          id: logBody.persistedIds.intakeBatchId
        }
      });
      await prisma.workflowRun.delete({
        where: {
          id: logBody.persistedIds.workflowRunId
        }
      });

      await app.close();
    });

    it("rejects invalid multi-source intake demo payloads", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/workflow-runs/multi-source-intake-demo",
        payload: {
          sourceTypes: ["FREE_TEXT"],
          unexpected: true
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: "Invalid multi-source intake demo request"
      });

      await app.close();
    });
  });


  describe("POST /workflow-runs/:id/model-provider-fallback-demo", () => {
    it("creates a high-quality provider fallback model call log for a workflow run", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "test-provider-fallback-demo-route"
        }
      });

      const response = await app.inject({
        method: "POST",
        url: `/workflow-runs/${workflowRun.id}/model-provider-fallback-demo`
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.modelCallLog.workflowRunId).toBe(workflowRun.id);
      expect(body.modelCallLog.provider).toBe("MOCK");
      expect(body.modelCallLog.model).toBe("mock-golf-workflow-model");
      expect(body.modelCallLog.status).toBe("SUCCEEDED");
      expect(body.modelCallLog.requestJson).toMatchObject({
        workflowRunId: workflowRun.id,
        taskType: "INTAKE_PARSING",
        routingGoal: "HIGH_QUALITY",
        providerFallbackExecutor: true,
        mock: true
      });
      expect(body.modelCallLog.responseJson).toMatchObject({
        mock: true,
        providerFallbackExecutor: true,
        routingDecision: {
          provider: "OPENAI",
          model: "gpt-4.1-mini",
          fallbackProvider: "AZURE_OPENAI",
          fallbackModel: "azure-gpt-4.1-mini"
        }
      });
      expect(body.modelCallLog.attemptLogs).toHaveLength(3);
      expect(body.modelCallLog.attemptLogs.map((attempt: { provider: string }) => attempt.provider)).toEqual([
        "OPENAI",
        "AZURE_OPENAI",
        "MOCK"
      ]);
      expect(body.modelCallLog.attemptLogs[0]).toMatchObject({
        provider: "OPENAI",
        model: "gpt-4.1-mini",
        attemptOrder: 1,
        status: "SKIPPED"
      });
      expect(body.modelCallLog.attemptLogs[0].errorMessage).toContain(
        "OPENAI real model calls are disabled"
      );
      expect(body.modelCallLog.attemptLogs[1]).toMatchObject({
        provider: "AZURE_OPENAI",
        model: "azure-gpt-4.1-mini",
        attemptOrder: 2,
        status: "SKIPPED"
      });
      expect(body.modelCallLog.attemptLogs[1].errorMessage).toContain(
        "AZURE_OPENAI real model calls are disabled"
      );
      expect(body.modelCallLog.attemptLogs[2]).toMatchObject({
        provider: "MOCK",
        model: "mock-golf-workflow-model",
        attemptOrder: 3,
        status: "SUCCESS",
        errorMessage: null
      });

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });

    it("returns 404 when creating a provider fallback demo for a missing workflow run", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/workflow-runs/missing-workflow-run/model-provider-fallback-demo"
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: "Workflow run not found"
      });

      await app.close();
    });
  });

  describe("GET /workflow-runs/:id", () => {
    it("returns a workflow run with persisted model call logs", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "test-workflow-run-detail"
        }
      });

      await createMockModelCallLogForWorkflowRun({
        workflowRunId: workflowRun.id,
        taskType: "INTAKE_PARSING",
        goal: "LOW_COST"
      });

      const response = await app.inject({
        method: "GET",
        url: `/workflow-runs/${workflowRun.id}`
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.workflowRun.id).toBe(workflowRun.id);
      expect(body.workflowRun.workflowName).toBe("test-workflow-run-detail");

      expect(body.modelCallLogs).toHaveLength(1);
      expect(body.modelCallLogs[0].workflowRunId).toBe(workflowRun.id);
      expect(body.modelCallLogs[0].provider).toBe("MOCK");
      expect(body.modelCallLogs[0].model).toBe("mock-golf-workflow-model");
      expect(body.modelCallLogs[0].status).toBe("SUCCEEDED");
      expect(body.modelCallLogs[0].requestJson).toMatchObject({
        workflowRunId: workflowRun.id,
        taskType: "INTAKE_PARSING",
        routingGoal: "LOW_COST",
        mock: true
      });
      expect(body.modelCallLogs[0].responseJson).toMatchObject({
        mock: true,
        routingDecision: {
          provider: "MOCK",
          model: "mock-golf-workflow-model",
          estimatedCostTier: "FREE",
          expectedLatencyTier: "LOW",
          qualityTier: "LOW"
        }
      });

      expect(body.modelCallLogs[0].attemptLogs).toHaveLength(1);
      expect(body.modelCallLogs[0].attemptLogs[0]).toMatchObject({
        provider: "MOCK",
        model: "mock-golf-workflow-model",
        attemptOrder: 1,
        status: "SUCCESS",
        latencyMs: 0,
        estimatedCostUsd: 0
      });
      expect(body.modelCallLogs[0].attemptLogs[0].modelCallLogId).toBe(
        body.modelCallLogs[0].id
      );

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });

    it("returns persisted MCP tool invocation preview logs as audit-only tool call logs", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "test-workflow-run-tool-preview-logs"
        }
      });

      const toolCallLog = await prisma.toolCallLog.create({
        data: {
          workflowRunId: workflowRun.id,
          toolName: "inventory.reserveTradeInSlot",
          status: "STARTED",
          inputJson: {
            clubId: "club-123",
            reservationType: "TRADE_IN_SLOT"
          },
          outputJson: {
            previewOnly: true,
            executionAttempted: false,
            actualToolOutput: null,
            policyDecision: "REQUIRES_HUMAN_APPROVAL",
            policyReasonCodes: ["MUTATION_TOOL", "HUMAN_APPROVAL_REQUIRED"],
            invocationStatus: "BLOCKED",
            requestedBy: "operator@example.com",
            persistedPurpose:
              "Audit-only planned invocation preview. No tool execution was attempted."
          },
          startedAt: new Date("2026-02-01T00:00:00.000Z"),
          createdAt: new Date("2026-02-01T00:00:00.000Z")
        }
      });

      const response = await app.inject({
        method: "GET",
        url: `/workflow-runs/${workflowRun.id}`
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.toolCallLogs).toHaveLength(1);
      expect(body.toolCallLogs[0]).toMatchObject({
        id: toolCallLog.id,
        workflowRunId: workflowRun.id,
        workflowStepId: null,
        toolName: "inventory.reserveTradeInSlot",
        status: "STARTED",
        inputJson: {
          clubId: "club-123",
          reservationType: "TRADE_IN_SLOT"
        },
        outputJson: {
          previewOnly: true,
          executionAttempted: false,
          actualToolOutput: null,
          policyDecision: "REQUIRES_HUMAN_APPROVAL",
          policyReasonCodes: ["MUTATION_TOOL", "HUMAN_APPROVAL_REQUIRED"],
          invocationStatus: "BLOCKED",
          requestedBy: "operator@example.com"
        }
      });
      expect(body.toolCallLogs[0].completedAt).toBeNull();

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });

    it("returns 404 when the workflow run does not exist", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/workflow-runs/not-real"
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();

      expect(body.error).toBe("Workflow run not found");

      await app.close();
    });
  });

  describe("POST /workflow-runs/:id/execute", () => {
    it("executes a queued workflow run simulation and returns completed steps", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "test-workflow-run-execute-route",
          status: "QUEUED",
          steps: {
            create: [
              {
                stepName: "Parse intake input",
                stepType: "PARSE_INPUT",
                orderIndex: 1,
                status: "PENDING",
                inputJson: {
                  intakeBatchId: "route-test-batch",
                  intakeBatchName: "Route Execution Test Batch",
                  sourceType: "FREEFORM_NOTES",
                  itemCount: 1
                }
              },
              {
                stepName: "Normalize trade-in data",
                stepType: "NORMALIZE_DATA",
                orderIndex: 2,
                status: "PENDING",
                inputJson: {
                  intakeBatchId: "route-test-batch",
                  intakeBatchName: "Route Execution Test Batch",
                  sourceType: "FREEFORM_NOTES",
                  itemCount: 1
                }
              }
            ]
          }
        }
      });

      const response = await app.inject({
        method: "POST",
        url: `/workflow-runs/${workflowRun.id}/execute`
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.workflowRun.id).toBe(workflowRun.id);
      expect(body.workflowRun.status).toBe("COMPLETED");
      expect(body.workflowRun.startedAt).not.toBeNull();
      expect(body.workflowRun.completedAt).not.toBeNull();

      expect(body.steps).toHaveLength(2);
      expect(body.steps.map((step: { status: string }) => step.status)).toEqual([
        "COMPLETED",
        "COMPLETED"
      ]);
      expect(body.steps[0].outputJson).toMatchObject({
        simulated: true,
        stepType: "PARSE_INPUT",
        parsedItemCount: 1
      });

      expect(body.toolCallLogs).toHaveLength(2);
      expect(
        body.toolCallLogs.map((log: { toolName: string }) => log.toolName)
      ).toEqual(["simulate.parseInput", "simulate.normalizeData"]);
      expect(body.reviewQueueItems).toEqual([]);

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });

    it("executes a review-needed simulation and returns review queue items", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "test-workflow-run-review-route",
          status: "QUEUED",
          steps: {
            create: [
              {
                stepName: "Parse intake input",
                stepType: "PARSE_INPUT",
                orderIndex: 1,
                status: "PENDING",
                inputJson: {
                  intakeBatchId: "route-review-batch",
                  intakeBatchName: "Route Review Simulation Batch",
                  sourceType: "FREEFORM_NOTES",
                  itemCount: 1,
                  originalText:
                    "TM driver maybe 10.5, shaft unknown, condition unclear"
                }
              },
              {
                stepName: "Validate structured output",
                stepType: "VALIDATE_STRUCTURED_OUTPUT",
                orderIndex: 2,
                status: "PENDING",
                inputJson: {
                  intakeBatchId: "route-review-batch",
                  intakeBatchName: "Route Review Simulation Batch",
                  sourceType: "FREEFORM_NOTES",
                  itemCount: 1,
                  originalText:
                    "TM driver maybe 10.5, shaft unknown, condition unclear"
                }
              },
              {
                stepName: "Create review item when needed",
                stepType: "CREATE_REVIEW_ITEM",
                orderIndex: 3,
                status: "PENDING",
                inputJson: {
                  intakeBatchId: "route-review-batch",
                  intakeBatchName: "Route Review Simulation Batch",
                  sourceType: "FREEFORM_NOTES",
                  itemCount: 1,
                  originalText:
                    "TM driver maybe 10.5, shaft unknown, condition unclear"
                }
              }
            ]
          }
        }
      });

      const response = await app.inject({
        method: "POST",
        url: `/workflow-runs/${workflowRun.id}/execute`,
        payload: {
          scenario: "NEEDS_REVIEW"
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.workflowRun.id).toBe(workflowRun.id);
      expect(body.workflowRun.status).toBe("NEEDS_REVIEW");

      expect(body.steps).toHaveLength(3);
      expect(body.steps.map((step: { status: string }) => step.status)).toEqual([
        "COMPLETED",
        "COMPLETED",
        "COMPLETED"
      ]);
      expect(body.steps[1].outputJson).toMatchObject({
        simulated: true,
        stepType: "VALIDATE_STRUCTURED_OUTPUT",
        validationStatus: "NEEDS_REVIEW",
        needsReview: true,
        reviewReason: "LOW_CONFIDENCE"
      });
      expect(body.steps[2].outputJson).toMatchObject({
        simulated: true,
        stepType: "CREATE_REVIEW_ITEM",
        reviewItemCreated: true,
        reviewReason: "LOW_CONFIDENCE"
      });

      expect(body.reviewQueueItems).toHaveLength(1);
      expect(body.reviewQueueItems[0]).toMatchObject({
        workflowRunId: workflowRun.id,
        reason: "LOW_CONFIDENCE",
        status: "OPEN",
        originalText: "TM driver maybe 10.5, shaft unknown, condition unclear"
      });
      expect(body.reviewQueueItems[0].proposedGolfClubJson).toMatchObject({
        brand: "Titleist",
        model: "Ambiguous TSR/TS-series fairway wood",
        confidenceScore: 0.58,
        missingFields: ["condition", "exactModel"],
        grounding: {
          toolName: "swingops.clubReference.search",
          summary: expect.any(String),
          matches: expect.any(Array)
        }
      });

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });

    it("returns 404 when executing a missing workflow run", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/workflow-runs/not-real/execute"
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();

      expect(body.error).toBe("Workflow run not found");

      await app.close();
    });
  });
  describe("POST /workflow-runs/:id/tool-calling-plan/execute", () => {
    it("returns 404 when the workflow run does not exist", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/workflow-runs/not-real/tool-calling-plan/execute"
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: "Workflow run not found"
      });

      await app.close();
    });

    it("creates a structured tool-calling plan, executes safe tools, and persists audit logs", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "test-workflow-tool-calling-plan",
          status: "NEEDS_REVIEW",
          reviewQueueItems: {
            create: [
              {
                reason: "LOW_CONFIDENCE",
                status: "OPEN",
                originalText: "Titleist TSR maybe TS2 fairway wood",
                proposedGolfClubJson: {
                  brand: "Titleist",
                  confidenceScore: 0.58
                }
              }
            ]
          }
        }
      });

      const response = await app.inject({
        method: "POST",
        url: `/workflow-runs/${workflowRun.id}/tool-calling-plan/execute`
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.plan).toMatchObject({
        workflowRunId: workflowRun.id,
        status: "PARTIALLY_EXECUTED"
      });
      expect(body.plan.planId).toContain(workflowRun.id);
      expect(body.plan.plannedCalls).toHaveLength(5);
      expect(body.plan.plannedCalls.map((call: { toolName: string }) => call.toolName)).toEqual([
        "swingops.workflowRuns.get",
        "swingops.reviewQueueItems.list",
          "swingops.knowledgeBase.search",
        "swingops.clubReference.search",
        "swingops.reviewQueueItems.resolve"
      ]);

      expect(body.results).toHaveLength(5);

      const workflowGetResult = body.results.find(
        (result: { toolName: string }) => result.toolName === "swingops.workflowRuns.get"
      );
      expect(workflowGetResult).toMatchObject({
        status: "SUCCEEDED",
        policyDecision: "ALLOW",
        policyReasonCodes: ["TOOL_ALLOWED"],
        executionAttempted: true,
        toolCallLogId: expect.any(String)
      });
      expect(workflowGetResult.connectorResultPreview.workflowRun.id).toBe(workflowRun.id);

      const clubReferenceResult = body.results.find(
        (result: { toolName: string }) => result.toolName === "swingops.clubReference.search"
      );
      expect(clubReferenceResult).toMatchObject({
        status: "SUCCEEDED",
        policyDecision: "ALLOW",
        executionAttempted: true,
        toolCallLogId: expect.any(String)
      });
      expect(clubReferenceResult.connectorResultPreview.clubReferenceSearch.query).toBe(
        "Titleist TSR maybe TS2 fairway wood"
      );

      const blockedMutationResult = body.results.find(
        (result: { toolName: string }) => result.toolName === "swingops.reviewQueueItems.resolve"
      );
      expect(blockedMutationResult).toMatchObject({
        status: "BLOCKED",
        policyDecision: "BLOCK",
        policyReasonCodes: ["TOOL_DISABLED"],
        executionAttempted: false,
        toolCallLogId: expect.any(String),
        failurePreview: "Tool is disabled and cannot be executed."
      });

      expect(body.toolCallLogs).toHaveLength(5);
      expect(
        body.toolCallLogs.map((log: { id: string }) => log.id)
      ).toEqual(body.results.map((result: { toolCallLogId: string }) => result.toolCallLogId));
      expect(body.executionMetadata).toMatchObject({
        planner: "deterministic.swingops.workflow-tool-calling-plan.v1",
        readOnlyConnectorSurface: true,
        mutationToolsEnabled: false,
        policyCheckedBeforeEachExecution: true
      });

      const persistedLogs = await prisma.toolCallLog.findMany({
        where: {
          workflowRunId: workflowRun.id,
          toolName: {
            in: [
              "swingops.workflowRuns.get",
              "swingops.reviewQueueItems.list",
              "swingops.knowledgeBase.search",
              "swingops.clubReference.search",
              "swingops.reviewQueueItems.resolve"
            ]
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      });

      expect(persistedLogs).toHaveLength(5);
      expect(persistedLogs.map((log) => log.status)).toEqual([
        "SUCCEEDED",
        "SUCCEEDED",
        "SUCCEEDED",
        "SUCCEEDED",
        "FAILED"
      ]);
      const blockedPersistedLog = persistedLogs.find(
        (log) => log.toolName === "swingops.reviewQueueItems.resolve"
      );
      expect(blockedPersistedLog).toBeDefined();
      expect(blockedPersistedLog!.outputJson).toMatchObject({
        connectorInvocation: true,
        executionAttempted: false,
        policyDecision: "BLOCK",
        policyReasonCodes: ["TOOL_DISABLED"],
        failureReason: "Tool is disabled and cannot be executed."
      });

      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });
  });
  describe("POST /workflow-runs/:id/agentic-trade-in-run", () => {
    it("returns 404 when the workflow run does not exist", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/workflow-runs/not-real/agentic-trade-in-run"
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: "Workflow run not found"
      });

      await app.close();
    });

    it("runs model routing, provider fallback attempts, MCP connector plan, and deterministic eval summary", async () => {
      const app = buildApp();

      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "test-agentic-trade-in-run",
          status: "NEEDS_REVIEW",
          reviewQueueItems: {
            create: [
              {
                reason: "LOW_CONFIDENCE",
                status: "OPEN",
                originalText: "Titleist TSR maybe TS2 fairway wood",
                proposedGolfClubJson: {
                  brand: "Titleist",
                  confidenceScore: 0.58
                }
              }
            ]
          }
        }
      });

      const response = await app.inject({
        method: "POST",
        url: `/workflow-runs/${workflowRun.id}/agentic-trade-in-run`
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.workflowRunId).toBe(workflowRun.id);
      expect(body.modelCallLog).toMatchObject({
        workflowRunId: workflowRun.id,
        provider: "MOCK",
        model: "mock-golf-workflow-model",
        status: "SUCCEEDED",
        requestJson: {
          workflowRunId: workflowRun.id,
          taskType: "INTAKE_PARSING",
          routingGoal: "HIGH_QUALITY",
          providerFallbackExecutor: true
        }
      });
      expect(body.modelCallLog.attemptLogs).toHaveLength(3);
      expect(
        body.modelCallLog.attemptLogs.map(
          (attempt: { provider: string }) => attempt.provider
        )
      ).toEqual(["OPENAI", "AZURE_OPENAI", "MOCK"]);
      expect(
        body.modelCallLog.attemptLogs.map(
          (attempt: { status: string }) => attempt.status
        )
      ).toEqual(["SKIPPED", "SKIPPED", "SUCCESS"]);

      expect(body.plan).toMatchObject({
        workflowRunId: workflowRun.id,
        status: "PARTIALLY_EXECUTED"
      });
      expect(body.results).toHaveLength(5);
      expect(
        body.results.map((result: { toolName: string }) => result.toolName)
      ).toEqual([
        "swingops.workflowRuns.get",
        "swingops.reviewQueueItems.list",
          "swingops.knowledgeBase.search",
        "swingops.clubReference.search",
        "swingops.reviewQueueItems.resolve"
      ]);
      expect(
        body.results.map((result: { status: string }) => result.status)
      ).toEqual(["SUCCEEDED", "SUCCEEDED", "SUCCEEDED", "SUCCEEDED", "BLOCKED"]);
      expect(body.toolCallLogs).toHaveLength(5);

      expect(body.evalSummary).toEqual({
        extractionCompleteness: 0.8,
        groundingConfidence: 0.86,
        toolCallsAttempted: 5,
        toolCallsSucceeded: 4,
        modelProviderFallbackUsed: true,
        reviewRequired: true,
        pass: true
      });
      expect(body.executionMetadata).toMatchObject({
        orchestrator: "deterministic.swingops.agentic-trade-in-run.v1",
        modelRoutingGoal: "HIGH_QUALITY",
        modelTaskType: "INTAKE_PARSING",
        providerFallbackExecutor: true,
        deterministicToolPlan: true,
        readOnlyMcpConnectorSurface: true,
        qualityEvalPersisted: false
      });

      const persistedModelLogs = await prisma.modelCallLog.findMany({
        where: {
          workflowRunId: workflowRun.id
        },
        include: {
          attemptLogs: true
        }
      });
      const persistedToolLogs = await prisma.toolCallLog.findMany({
        where: {
          workflowRunId: workflowRun.id,
          toolName: {
            in: [
              "swingops.workflowRuns.get",
              "swingops.reviewQueueItems.list",
              "swingops.knowledgeBase.search",
              "swingops.clubReference.search",
              "swingops.reviewQueueItems.resolve"
            ]
          }
        }
      });

      expect(persistedModelLogs).toHaveLength(1);
      expect(persistedModelLogs[0]!.attemptLogs).toHaveLength(3);
      expect(persistedToolLogs).toHaveLength(5);

      await prisma.modelCallAttemptLog.deleteMany({
        where: {
          modelCallLog: {
            workflowRunId: workflowRun.id
          }
        }
      });
      await prisma.modelCallLog.deleteMany({
        where: {
          workflowRunId: workflowRun.id
        }
      });
      await prisma.toolCallLog.deleteMany({
        where: {
          workflowRunId: workflowRun.id
        }
      });
      await prisma.reviewQueueItem.deleteMany({
        where: {
          workflowRunId: workflowRun.id
        }
      });
      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });

      await app.close();
    });
  });

});
