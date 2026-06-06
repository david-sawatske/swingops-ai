import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { DEMO_KNOWLEDGE_SOURCE_NAME } from "../knowledge/knowledge-seed-data.js";

afterEach(async () => {
  await prisma.toolCallLog.deleteMany({
    where: {
      toolName: "swingops.knowledgeBase.search"
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
});

describe("knowledge routes", () => {
  it("ingests demo knowledge and searches direct API route", async () => {
    const app = buildApp();

    const ingestResponse = await app.inject({
      method: "POST",
      url: "/knowledge/ingest-demo"
    });

    expect(ingestResponse.statusCode).toBe(200);
    expect(ingestResponse.json()).toMatchObject({
      status: "SUCCEEDED",
      sourceName: DEMO_KNOWLEDGE_SOURCE_NAME,
      documentsCreated: 3,
      chunksCreated: 42
    });

    const searchResponse = await app.inject({
      method: "POST",
      url: "/knowledge/search",
      payload: {
        query: "Cally AiSmoke 3w reg",
        maxResults: 3
      }
    });

    expect(searchResponse.statusCode).toBe(200);
    expect(searchResponse.json().results[0]).toMatchObject({
      brand: "Callaway",
      productLine: "Ai Smoke",
      category: "FAIRWAY_WOOD",
      scoreBreakdown: {
        components: {
          brand: {
            weight: 0.25
          },
          productLine: {
            weight: 0.3
          },
          category: {
            weight: 0.15
          },
          shaft: {
            weight: 0.15
          },
          notes: {
            weight: 0.1
          },
          vector: {
            weight: 0.05
          }
        }
      }
    });

    await app.close();
  });

  it("runs deterministic retrieval evals", async () => {
    const app = buildApp();

    await app.inject({
      method: "POST",
      url: "/knowledge/ingest-demo"
    });

    const response = await app.inject({
      method: "POST",
      url: "/knowledge/evals/run"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      casesEvaluated: 5,
      passCount: 5,
      failedCases: []
    });

    await app.close();
  });

  it("calls knowledge search through MCP-compatible tool surface and persists ToolCallLog", async () => {
    const app = buildApp();

    await app.inject({
      method: "POST",
      url: "/knowledge/ingest-demo"
    });

    const response = await app.inject({
      method: "POST",
      url: "/mcp/tools/swingops.knowledgeBase.search/call",
      payload: {
        arguments: {
          query: "Ping g430 max xstiff 9",
          maxResults: 3
        },
        requestedBy: "agent.route-test"
      }
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body).toMatchObject({
      toolId: "swingops.knowledgeBase.search",
      executionAttempted: true,
      status: "SUCCEEDED",
      policyDecision: {
        decision: "ALLOW",
        reasonCodes: ["TOOL_ALLOWED"],
        executionEnabled: true
      },
      resultJson: {
        knowledgeBaseSearch: {
          results: expect.arrayContaining([
            expect.objectContaining({
              brand: "PING",
              productLine: "G430 Max",
              category: "DRIVER"
            })
          ])
        }
      },
      toolCallLogId: expect.any(String),
      mcpSurface: {
        protocolShape: "MCP_TOOLS_CALL_COMPATIBLE",
        transport: "REST_ADAPTER",
        externalMcpServer: false,
        reusedInternalPolicyAndExecutor: true,
        auditLogPersistence: "TOOL_CALL_LOG"
      }
    });

    const persistedLog = await prisma.toolCallLog.findUnique({
      where: {
        id: body.toolCallLogId
      }
    });

    expect(persistedLog).toMatchObject({
      toolName: "swingops.knowledgeBase.search",
      status: "SUCCEEDED",
      errorMessage: null
    });

    await app.close();
  });
});
