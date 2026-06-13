import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import { executeReadOnlyToolInvocation } from "./read-only-tool-invocation.js";
import { ingestDemoKnowledgeBase } from "../knowledge/knowledge-ingestion.js";
const TEST_KNOWLEDGE_SOURCE_NAME = "test-read-only-tool-invocation-knowledge-source";

const testWorkflowName = "test-read-only-tool-invocation";

afterEach(async () => {
  const workflowRuns = await prisma.workflowRun.findMany({
    where: {
      workflowName: testWorkflowName
    },
    select: {
      id: true
    }
  });
  const workflowRunIds = workflowRuns.map((workflowRun) => workflowRun.id);

  await prisma.toolCallLog.deleteMany({
    where: {
      OR: [
        {
          workflowRunId: {
            in: workflowRunIds
          }
        },
        {
          toolName: {
            in: [
              "swingops.reviewQueueItems.resolve",
              "swingops.inventory.createSku",
              "swingops.inventory.lookupProduct",
              "swingops.tradeInValuation.estimate",
              "swingops.notRegistered"
            ]
          }
        }
      ]
    }
  });

  await prisma.workflowRun.deleteMany({
    where: {
      id: {
        in: workflowRunIds
      }
    }
  });

  await prisma.knowledgeDocument.deleteMany({
    where: {
      sourceName: TEST_KNOWLEDGE_SOURCE_NAME
    }
  });

  await prisma.knowledgeIngestionRun.deleteMany({
    where: {
      sourceName: TEST_KNOWLEDGE_SOURCE_NAME
    }
  });
});

describe("read-only tool invocation", () => {
  it("executes enabled read-only tools and persists a succeeded ToolCallLog", async () => {
    const workflowRun = await prisma.workflowRun.create({
      data: {
        workflowName: testWorkflowName,
        status: "QUEUED"
      }
    });

    const result = await executeReadOnlyToolInvocation({
      toolName: "swingops.workflowRuns.get",
      inputJson: {
        id: workflowRun.id
      },
      requestedBy: "agent.readonly-test",
      workflowRunId: workflowRun.id
    });

    expect(result.invocation).toMatchObject({
      toolName: "swingops.workflowRuns.get",
      status: "SUCCEEDED",
      requestedBy: "agent.readonly-test",
      workflowRunId: workflowRun.id,
      workflowStepId: null,
      inputJson: {
        id: workflowRun.id
      },
      executionAttempted: true,
      toolCallLogId: expect.any(String)
    });

    expect(result.policyEvaluation).toMatchObject({
      decision: "ALLOW",
      reasonCodes: ["TOOL_ALLOWED"],
      executionMode: "AGENT_AUTONOMOUS",
      executionEnabled: true,
      tool: {
        name: "swingops.workflowRuns.get",
        enabled: true,
        riskLevel: "LOW",
        mutatesData: false,
        requiresHumanApproval: false
      }
    });

    expect(result.connectorResult).toMatchObject({
      contentType: "application/json",
      metadata: {
        source: "swingops.internal-db",
        readOnly: true,
        mutatesData: false,
        externalTransport: false
      },
      data: {
        workflowRun: {
          id: workflowRun.id,
          workflowName: testWorkflowName
        }
      }
    });

    expect(result.toolCallLog).toMatchObject({
      id: result.invocation.toolCallLogId,
      workflowRunId: workflowRun.id,
      workflowStepId: null,
      toolName: "swingops.workflowRuns.get",
      status: "SUCCEEDED",
      errorMessage: null
    });
    expect(result.toolCallLog.completedAt).not.toBeNull();
    expect(result.toolCallLog.inputJson).toMatchObject({
      id: workflowRun.id
    });
    expect(result.toolCallLog.outputJson).toMatchObject({
      connectorInvocation: true,
      executionAttempted: true,
      requestedBy: "agent.readonly-test",
      policyDecision: "ALLOW",
      policyReasonCodes: ["TOOL_ALLOWED"],
      executionMode: "AGENT_AUTONOMOUS",
      executionEnabled: true,
      humanApprovalGranted: false,
      connectorResult: {
        metadata: {
          readOnly: true,
          mutatesData: false,
          externalTransport: false
        }
      }
    });

    const persistedLog = await prisma.toolCallLog.findUnique({
      where: {
        id: result.invocation.toolCallLogId
      }
    });

    expect(persistedLog).toMatchObject({
      status: "SUCCEEDED",
      toolName: "swingops.workflowRuns.get",
      workflowRunId: workflowRun.id
    });
  });

  it("executes club reference search and persists a succeeded ToolCallLog", async () => {
    const result = await executeReadOnlyToolInvocation({
      toolName: "swingops.clubReference.search",
      inputJson: {
        query: "Titleist TSR maybe TS2 fairway wood"
      },
      requestedBy: "agent.readonly-test"
    });

    expect(result.invocation).toMatchObject({
      toolName: "swingops.clubReference.search",
      status: "SUCCEEDED",
      requestedBy: "agent.readonly-test",
      executionAttempted: true
    });
    expect(result.policyEvaluation).toMatchObject({
      decision: "ALLOW",
      reasonCodes: ["TOOL_ALLOWED"],
      tool: {
        name: "swingops.clubReference.search",
        enabled: true,
        riskLevel: "LOW",
        mutatesData: false,
        requiresHumanApproval: false
      }
    });
    expect(result.connectorResult?.data).toMatchObject({
      clubReferenceSearch: {
        query: "Titleist TSR maybe TS2 fairway wood",
        matches: expect.arrayContaining([
          expect.objectContaining({
            brand: "Titleist",
            model: "TSR3"
          }),
          expect.objectContaining({
            brand: "Titleist",
            model: "TS2"
          })
        ])
      }
    });
    expect(result.toolCallLog).toMatchObject({
      toolName: "swingops.clubReference.search",
      status: "SUCCEEDED"
    });
  });

  it("executes knowledge base search and persists a succeeded ToolCallLog", async () => {
    await ingestDemoKnowledgeBase({ sourceName: TEST_KNOWLEDGE_SOURCE_NAME });

    const result = await executeReadOnlyToolInvocation({
      toolName: "swingops.knowledgeBase.search",
      inputJson: {
        query: "TM stealth2 drv 10.5 stiff no hc",
        sourceName: TEST_KNOWLEDGE_SOURCE_NAME,
        maxResults: 3
      },
      requestedBy: "agent.readonly-test"
    });

    expect(result.invocation).toMatchObject({
      toolName: "swingops.knowledgeBase.search",
      status: "SUCCEEDED",
      requestedBy: "agent.readonly-test",
      executionAttempted: true
    });
    expect(result.policyEvaluation).toMatchObject({
      decision: "ALLOW",
      reasonCodes: ["TOOL_ALLOWED"],
      tool: {
        name: "swingops.knowledgeBase.search",
        enabled: true,
        riskLevel: "LOW",
        mutatesData: false,
        requiresHumanApproval: false
      }
    });
    expect(result.connectorResult?.data).toMatchObject({
      knowledgeBaseSearch: {
        query: "TM stealth2 drv 10.5 stiff no hc",
        results: expect.arrayContaining([
          expect.objectContaining({
            brand: "TaylorMade",
            productLine: "Stealth 2",
            category: "DRIVER",
            scoreBreakdown: expect.objectContaining({
              weightedScore: expect.any(Number),
              components: expect.objectContaining({
                brand: expect.objectContaining({
                  weight: 0.25
                }),
                vector: expect.objectContaining({
                  weight: 0.05
                })
              })
            })
          })
        ]),
        queryMetadata: {
          retrievalMode: "PGVECTOR_DETERMINISTIC_EMBEDDINGS",
          productionVectorEmbeddings: false
        }
      }
    });
    expect(result.toolCallLog).toMatchObject({
      toolName: "swingops.knowledgeBase.search",
      status: "SUCCEEDED"
    });
  });

  it("executes inventory product lookup and persists a succeeded ToolCallLog", async () => {
    const result = await executeReadOnlyToolInvocation({
      toolName: "swingops.inventory.lookupProduct",
      inputJson: {
        brand: "TM",
        productLine: "stealth2",
        category: "drv",
        shaftBrand: "Ventus",
        rawText: "TM stealth2 drv 10.5 Ventus stiff, no hc, sky mark on crown"
      },
      requestedBy: "agent.readonly-test"
    });

    expect(result.invocation).toMatchObject({
      toolName: "swingops.inventory.lookupProduct",
      status: "SUCCEEDED",
      executionAttempted: true
    });
    expect(result.policyEvaluation).toMatchObject({
      decision: "ALLOW",
      reasonCodes: ["TOOL_ALLOWED"],
      tool: {
        name: "swingops.inventory.lookupProduct",
        enabled: true,
        riskLevel: "LOW",
        mutatesData: false,
        requiresHumanApproval: false
      }
    });
    expect(result.connectorResult?.data).toMatchObject({
      inventoryProductLookup: {
        sku: "TM-STEALTH2-DRV-2023",
        confidence: expect.any(Number),
        matchReasons: expect.arrayContaining([
          "Brand matched TaylorMade.",
          "Product line matched Stealth 2."
        ])
      }
    });
    expect(result.toolCallLog).toMatchObject({
      toolName: "swingops.inventory.lookupProduct",
      status: "SUCCEEDED"
    });
  });

  it("executes trade-in valuation estimate and persists a succeeded ToolCallLog", async () => {
    const result = await executeReadOnlyToolInvocation({
      toolName: "swingops.tradeInValuation.estimate",
      inputJson: {
        brand: "Callaway",
        productLine: "Rogue ST Max",
        category: "driver",
        rawText:
          "Cally Rogue ST Max driver 9 Project X HZRDUS x-stiff, paint wear, no wrench",
        conditionNotes: "paint wear",
        accessoriesNotes: "no wrench"
      },
      requestedBy: "agent.readonly-test"
    });

    expect(result.invocation).toMatchObject({
      toolName: "swingops.tradeInValuation.estimate",
      status: "SUCCEEDED",
      executionAttempted: true
    });
    expect(result.connectorResult?.data).toMatchObject({
      tradeInValuationEstimate: {
        lowValue: 107,
        highValue: 145,
        confidence: "MEDIUM",
        reviewRequired: false,
        adjustments: expect.arrayContaining([
          expect.objectContaining({
            reason: "Paint wear reduces the demo range."
          }),
          expect.objectContaining({
            reason: "Missing wrench reduces the demo range for adjustable clubs."
          })
        ])
      }
    });
    expect(result.toolCallLog).toMatchObject({
      toolName: "swingops.tradeInValuation.estimate",
      status: "SUCCEEDED"
    });
  });

  it("executes list tools with structured connector results", async () => {
    await prisma.workflowRun.create({
      data: {
        workflowName: testWorkflowName,
        status: "NEEDS_REVIEW"
      }
    });

    const result = await executeReadOnlyToolInvocation({
      toolName: "swingops.workflowRuns.list",
      inputJson: {
        status: "NEEDS_REVIEW"
      }
    });

    expect(result.invocation.status).toBe("SUCCEEDED");
    expect(result.connectorResult?.data).toMatchObject({
      workflowRuns: expect.arrayContaining([
        expect.objectContaining({
          workflowName: testWorkflowName,
          status: "NEEDS_REVIEW"
        })
      ])
    });
    expect(result.toolCallLog.status).toBe("SUCCEEDED");
  }, 10_000);

  it("blocks unknown tools and persists a failed ToolCallLog with policy metadata", async () => {
    const result = await executeReadOnlyToolInvocation({
      toolName: "swingops.notRegistered",
      requestedBy: "agent.readonly-test"
    });

    expect(result.invocation).toMatchObject({
      toolName: "swingops.notRegistered",
      status: "BLOCKED",
      requestedBy: "agent.readonly-test",
      executionAttempted: false
    });
    expect(result.policyEvaluation).toMatchObject({
      decision: "BLOCK",
      reasonCodes: ["TOOL_NOT_FOUND"],
      executionEnabled: false,
      tool: null
    });
    expect(result.connectorResult).toBeNull();
    expect(result.toolCallLog).toMatchObject({
      toolName: "swingops.notRegistered",
      status: "FAILED",
      errorMessage: "Tool is not registered and cannot be exposed to an agent."
    });
    expect(result.toolCallLog.completedAt).not.toBeNull();
    expect(result.toolCallLog.outputJson).toMatchObject({
      connectorInvocation: true,
      executionAttempted: false,
      policyDecision: "BLOCK",
      policyReasonCodes: ["TOOL_NOT_FOUND"],
      executionEnabled: false
    });
  });

  it("blocks disabled mutation tools even when human approval is granted", async () => {
    const result = await executeReadOnlyToolInvocation({
      toolName: "swingops.inventory.createSku",
      inputJson: {
        productId: "prod_taylormade_stealth2_driver_2023"
      },
      executionMode: "HUMAN_APPROVED",
      humanApprovalGranted: true
    });

    expect(result.invocation).toMatchObject({
      toolName: "swingops.inventory.createSku",
      status: "BLOCKED",
      executionAttempted: false
    });
    expect(result.policyEvaluation).toMatchObject({
      decision: "BLOCK",
      reasonCodes: ["TOOL_DISABLED"],
      executionEnabled: false,
      humanApprovalGranted: true,
      tool: {
        enabled: false,
        mutatesData: true,
        requiresHumanApproval: true
      }
    });
    expect(result.toolCallLog).toMatchObject({
      toolName: "swingops.inventory.createSku",
      status: "FAILED",
      errorMessage: "Tool is disabled and cannot be executed."
    });
    expect(result.toolCallLog.outputJson).toMatchObject({
      connectorInvocation: true,
      executionAttempted: false,
      policyDecision: "BLOCK",
      policyReasonCodes: ["TOOL_DISABLED"],
      humanApprovalGranted: true
    });
  });
});
