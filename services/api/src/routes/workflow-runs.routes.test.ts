import { LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE } from "../intake/legacy-intake-source-types.js";
import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { DEMO_KNOWLEDGE_SOURCE_NAME } from "../knowledge/knowledge-seed-data.js";
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
          sourceType: LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE,
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
    it("returns prior review learning suggestions when a later run matches field-specific raw text", async () => {
      const app = buildApp();

      const priorWorkflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: "prior-review-learning-source",
          status: "COMPLETED"
        }
      });

      const priorReviewQueueItem = await prisma.reviewQueueItem.create({
        data: {
          workflowRunId: priorWorkflowRun.id,
          reason: "MISSING_REQUIRED_FIELDS",
          status: "RESOLVED",
          originalText: "Prior reviewed record with shaft stf",
          proposedGolfClubJson: {
            shaftFlex: null,
            reviewReasonSummary: "Missing shaftFlex"
          }
        }
      });

      const reviewedTradeInRecord = await prisma.reviewedTradeInRecord.create({
        data: {
          reviewQueueItemId: priorReviewQueueItem.id,
          workflowRunId: priorWorkflowRun.id,
          originalText: "Prior reviewed record with shaft stf",
          correctedShaftFlex: "STIFF",
          reviewerNotes: "Reviewer confirmed stf means STIFF."
        }
      });

      await prisma.humanReviewLearningEvent.create({
        data: {
          reviewedTradeInRecordId: reviewedTradeInRecord.id,
          reviewQueueItemId: priorReviewQueueItem.id,
          workflowRunId: priorWorkflowRun.id,
          fieldName: "shaftFlex",
          rawTextMatch: "stf",
          proposedValue: "Missing",
          correctedValue: "STIFF",
          evidenceText: "Reviewer corrected shaft stf to STIFF."
        }
      });

      const response = await app.inject({
        method: "POST",
        url: "/workflow-runs/agentic-trade-in-demo",
        payload: {
          rawInput: "Titleist TSR 3w shaft stf condition 8.0 Average"
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      const priorReviewEvidence = body.priorReviewLearningEvidenceByItem.flatMap(
        (item: { evidence: unknown[] }) => item.evidence
      );
      const priorReviewSuggestions =
        body.priorReviewLearningSuggestionsByItem.flatMap(
          (item: { suggestions: unknown[] }) => item.suggestions
        );

      expect(body.priorReviewLearningEvidenceByItem).toHaveLength(
        body.parsedItems.length
      );
      expect(body.priorReviewLearningSuggestionsByItem).toHaveLength(
        body.parsedItems.length
      );
      expect(priorReviewEvidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldName: "shaftFlex",
            correctedValue: "STIFF",
            strength: "STRONG",
            summary:
              "Prior review evidence suggested shaftFlex = STIFF from similar raw text: stf."
          })
        ])
      );
      expect(priorReviewSuggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldName: "shaftFlex",
            suggestedValue: "STIFF",
            previousCorrectedValue: "STIFF",
            rawTextMatch: "stf",
            status: "SUGGESTED",
            strength: "STRONG"
          })
        ])
      );
      expect(body.finalSummary).toMatchObject({
        priorReviewEvidenceCount: priorReviewEvidence.length,
        priorReviewSuggestionCount: priorReviewSuggestions.length
      });
      expect(body.auditTrail).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: "Prior review evidence checked",
            summary: expect.stringContaining("prior review suggestion")
          })
        ])
      );

      await prisma.workflowRun.delete({
        where: {
          id: priorWorkflowRun.id
        }
      });

      await app.close();
    });

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
        status: "SUCCEEDED",
        provider: "MOCK",
        model: "mock-golf-workflow-model"
      });
      expect(body.modelCallLog.requestJson).toMatchObject({
        taskType: "FIELD_NORMALIZATION",
        policyKey: "MAIN_RUN_FIELD_REPAIR",
        agentName: "main-run-field-repair-agent",
        allowDisabledProvidersForSimulation: false
      });
      expect(body.fieldRepairExecution).toMatchObject({
        modelCallLogId: body.modelCallLog.id,
        jsonValid: true,
        validationPassed: true,
        suggestions: expect.any(Array),
        validationErrors: []
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
        fallbackUsed: false,
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
        providerFallbackUsed: false,
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
        "Prior review evidence checked",
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

    it("self-prepares demo RAG and returns evidence for guided populated input", async () => {
      const app = buildApp();

      await prisma.knowledgeDocument.deleteMany({
        where: {
          sourceName: DEMO_KNOWLEDGE_SOURCE_NAME
        }
      });
      await prisma.knowledgeIngestionRun.deleteMany({
        where: {
          sourceName: DEMO_KNOWLEDGE_SOURCE_NAME
        }
      });

      const response = await app.inject({
        method: "POST",
        url: "/workflow-runs/agentic-trade-in-demo",
        payload: {
          rawInput: [
            "Store associate pasted trade-in notes:",
            "PING G430 Max driver, Stiff, 9.0 Above Average, clean crown, normal face wear.",
            "TaylorMade Stealth 2 driver, Regular, 8.0 Average, stock shaft, playable condition.",
            "Callaway Rogue ST Max driver, Senior, 8.0 Average, light bag chatter.",
            "Titleist TSR2 fairway wood, Stiff, 8.0 Average, standard length.",
            "Cleveland RTX 6 ZipCore wedge, Tour X-Stiff, 7.0 Below Average, groove wear noted.",
            "Odyssey White Hot OG putter, Regular, 8.0 Average, headcover included.",
            "Mizuno JPX 923 Hot Metal iron set, Regular, 9.0 Above Average, 5-PW set."
          ].join("\n")
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.parsedItems).toHaveLength(7);
      expect(body.finalSummary).toMatchObject({
        parsedItemCount: 7,
        inventoryMatchCount: 7,
        valuationRangeCount: 7
      });
      expect(body.finalSummary.knowledgeMatchCount).toBeGreaterThan(0);
      expect(body.workflowQualitySummary.evidenceCoverage).toMatch(/\/7 records$/);
      expect(body.workflowQualitySummary.evidenceCoverage).not.toBe("0/7 records");
      expect(body.knowledgeMatchesByItem.every(
        (match: { search: { results: unknown[] } }) => match.search.results.length > 0
      )).toBe(true);

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
      await prisma.knowledgeDocument.deleteMany({
        where: {
          sourceName: DEMO_KNOWLEDGE_SOURCE_NAME
        }
      });
      await prisma.knowledgeIngestionRun.deleteMany({
        where: {
          sourceName: DEMO_KNOWLEDGE_SOURCE_NAME
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
        latencyMs: expect.any(Number),
        estimatedCostUsd: 0
      });
      expect(body.modelCallLogs[0].attemptLogs[0].latencyMs).toBeGreaterThanOrEqual(0);
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

});
