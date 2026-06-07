import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import {
  callExternalMcpTool,
  listExternalMcpTools
} from "./external-mcp-server-transport.js";

afterEach(async () => {
  await prisma.toolCallLog.deleteMany({
    where: {
      OR: [
        {
          toolName: "swingops.knowledgeBase.search"
        },
        {
          toolName: "swingops.reviewQueueItems.resolve"
        }
      ]
    }
  });
});

describe("external MCP server transport adapter", () => {
  it("lists the registered SwingOps tools through MCP tools/list shape", () => {
    const response = listExternalMcpTools();

    expect(response.transportMetadata).toEqual({
      name: "swingops.external-mcp-server",
      transport: "STDIO",
      externalMcpServer: true,
      localOnly: true,
      productionAuthImplemented: false,
      reusedInternalContracts: true,
      reusedInternalPolicyAndExecutor: true,
      auditLogPersistence: "TOOL_CALL_LOG",
      mutationExecutionEnabled: false,
      summary:
        "Local stdio MCP server transport that wraps the existing SwingOps connector contracts, policy evaluator, read-only executor, ToolCallLog persistence, and output sanitizer."
    });

    expect(response.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "swingops.knowledgeBase.search",
          inputSchema: expect.objectContaining({
            type: "object",
            additionalProperties: false,
            required: ["query"]
          }),
          annotations: expect.objectContaining({
            riskLevel: "LOW",
            mutatesData: false,
            enabled: true,
            allowedMode: "AGENT_AUTONOMOUS"
          })
        }),
        expect.objectContaining({
          name: "swingops.reviewQueueItems.resolve",
          annotations: expect.objectContaining({
            riskLevel: "HIGH",
            mutatesData: true,
            requiresApproval: true,
            enabled: false,
            allowedMode: "DISABLED"
          })
        })
      ])
    );
  });

  it("calls a read-only knowledge-base tool and preserves sanitizer metadata", async () => {
    const response = await callExternalMcpTool({
      name: "swingops.knowledgeBase.search",
      arguments: {
        query: "TM stealth2 drv 10.5 stiff no hc",
        maxResults: 3
      }
    });

    expect(response.isError).toBe(false);
    expect(response.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("swingops.knowledgeBase.search succeeded")
    });
    expect(response.structuredContent).toMatchObject({
      toolId: "swingops.knowledgeBase.search",
      status: "SUCCEEDED",
      executionAttempted: true,
      policyDecision: {
        decision: "ALLOW",
        reasonCodes: ["TOOL_ALLOWED"],
        executionMode: "AGENT_AUTONOMOUS",
        executionEnabled: true,
        humanApprovalGranted: false
      },
      outputSafety: {
        sanitized: true,
        sanitizerVersion: "2026-06-06",
        intentionallyExposedFieldsOnly: true
      },
      transportMetadata: {
        transport: "STDIO",
        externalMcpServer: true,
        localOnly: true,
        productionAuthImplemented: false,
        reusedInternalPolicyAndExecutor: true,
        auditLogPersistence: "TOOL_CALL_LOG",
        mutationExecutionEnabled: false
      }
    });
    expect(response.structuredContent.outputSafety.redactionNotes).toEqual(
      expect.any(String)
    );
    expect(response.structuredContent.resultJson).toMatchObject({
      knowledgeBaseSearch: expect.any(Object)
    });

    const log = await prisma.toolCallLog.findUniqueOrThrow({
      where: {
        id: response.structuredContent.toolCallLogId
      }
    });

    expect(log).toMatchObject({
      toolName: "swingops.knowledgeBase.search",
      status: "SUCCEEDED",
      errorMessage: null
    });
  });

  it("keeps disabled mutation tools visible but blocked before execution", async () => {
    const response = await callExternalMcpTool({
      name: "swingops.reviewQueueItems.resolve",
      arguments: {
        id: "review-item-1",
        reviewerNotes: "Looks correct."
      }
    });

    expect(response.isError).toBe(true);
    expect(response.structuredContent).toMatchObject({
      toolId: "swingops.reviewQueueItems.resolve",
      status: "BLOCKED",
      executionAttempted: false,
      resultJson: null,
      outputSafety: {
        sanitized: false,
        sanitizerVersion: null,
        redactionNotes: null,
        intentionallyExposedFieldsOnly: false
      },
      errorMessage: "Tool is disabled and cannot be executed.",
      policyDecision: {
        decision: "BLOCK",
        reasonCodes: ["TOOL_DISABLED"],
        executionMode: "AGENT_AUTONOMOUS",
        executionEnabled: false,
        humanApprovalGranted: false
      }
    });

    const log = await prisma.toolCallLog.findUniqueOrThrow({
      where: {
        id: response.structuredContent.toolCallLogId
      }
    });

    expect(log).toMatchObject({
      toolName: "swingops.reviewQueueItems.resolve",
      status: "FAILED",
      errorMessage: "Tool is disabled and cannot be executed."
    });
  });

  it("returns failed execution for invalid read-only tool arguments through existing validation", async () => {
    const response = await callExternalMcpTool({
      name: "swingops.knowledgeBase.search",
      arguments: {
        maxResults: 3
      }
    });

    expect(response.isError).toBe(true);
    expect(response.structuredContent).toMatchObject({
      toolId: "swingops.knowledgeBase.search",
      status: "FAILED",
      executionAttempted: true,
      resultJson: null,
      outputSafety: {
        sanitized: false,
        sanitizerVersion: null,
        redactionNotes: null,
        intentionallyExposedFieldsOnly: false
      }
    });
    expect(response.structuredContent.errorMessage).toContain("Required");

    const log = await prisma.toolCallLog.findUniqueOrThrow({
      where: {
        id: response.structuredContent.toolCallLogId
      }
    });

    expect(log).toMatchObject({
      toolName: "swingops.knowledgeBase.search",
      status: "FAILED"
    });
    expect(log.errorMessage).toContain("Required");
  });
});
