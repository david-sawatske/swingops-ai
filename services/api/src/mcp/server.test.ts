import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";

const require = createRequire(import.meta.url);
const tsxCliPath = require.resolve("tsx/cli");
const apiDirectory = fileURLToPath(new URL("../../", import.meta.url));
const serverPath = fileURLToPath(new URL("./server.ts", import.meta.url));
const createdToolCallLogIds: string[] = [];

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("The MCP transport test requires DATABASE_URL.");
  }

  return databaseUrl;
}

function requireStructuredContent(result: unknown): Record<string, unknown> {
  if (
    typeof result !== "object" ||
    result === null ||
    !("structuredContent" in result) ||
    typeof result.structuredContent !== "object" ||
    result.structuredContent === null
  ) {
    throw new Error("Expected an MCP tool result with structured content.");
  }

  return result.structuredContent as Record<string, unknown>;
}

function requireToolCallLogId(content: Record<string, unknown>): string {
  const toolCallLogId = content.toolCallLogId;

  if (typeof toolCallLogId !== "string") {
    throw new Error(
      "Expected the MCP tool result to include a ToolCallLog ID.",
    );
  }

  createdToolCallLogIds.push(toolCallLogId);
  return toolCallLogId;
}

afterEach(async () => {
  if (createdToolCallLogIds.length === 0) {
    return;
  }

  await prisma.toolCallLog.deleteMany({
    where: {
      id: {
        in: createdToolCallLogIds.splice(0),
      },
    },
  });
});

describe("MCP stdio server", () => {
  it("negotiates with an SDK client and enforces execution policy across the process boundary", async () => {
    const client = new Client({
      name: "swingops-stdio-transport-test",
      version: "0.1.0",
    });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [tsxCliPath, serverPath],
      cwd: apiDirectory,
      env: {
        ...getDefaultEnvironment(),
        DATABASE_URL: requireDatabaseUrl(),
        NODE_ENV: "test",
        LOG_LEVEL: "silent",
      },
      stderr: "pipe",
    });

    let serverStderr = "";
    transport.stderr?.on("data", (chunk: Buffer | string) => {
      serverStderr += chunk.toString();
    });

    try {
      await client.connect(transport);

      expect(client.getServerVersion()).toMatchObject({
        name: "swingops-external-readonly-mcp-server",
        version: "0.1.0",
      });

      const toolList = await client.listTools();

      expect(toolList.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "swingops.workflowRuns.list",
            inputSchema: expect.objectContaining({
              type: "object",
            }),
          }),
          expect.objectContaining({
            name: "swingops.reviewQueueItems.resolve",
          }),
        ]),
      );

      const allowedResult = await client.callTool({
        name: "swingops.workflowRuns.list",
        arguments: {
          maxResults: 1,
        },
      });
      const allowedContent = requireStructuredContent(allowedResult);
      const allowedToolCallLogId = requireToolCallLogId(allowedContent);

      expect(allowedResult).toMatchObject({
        isError: false,
      });
      expect(allowedContent).toMatchObject({
        toolId: "swingops.workflowRuns.list",
        status: "SUCCEEDED",
        executionAttempted: true,
        policyDecision: {
          decision: "ALLOW",
          reasonCodes: ["TOOL_ALLOWED"],
        },
        transportMetadata: {
          transport: "STDIO",
          auditLogPersistence: "TOOL_CALL_LOG",
          mutationExecutionEnabled: false,
        },
      });

      const blockedResult = await client.callTool({
        name: "swingops.reviewQueueItems.resolve",
        arguments: {
          id: "review-item-transport-test",
          reviewerNotes: "Transport policy verification.",
        },
      });
      const blockedContent = requireStructuredContent(blockedResult);
      const blockedToolCallLogId = requireToolCallLogId(blockedContent);

      expect(blockedResult).toMatchObject({
        isError: true,
      });
      expect(blockedContent).toMatchObject({
        toolId: "swingops.reviewQueueItems.resolve",
        status: "BLOCKED",
        executionAttempted: false,
        errorMessage: "Tool is disabled and cannot be executed.",
        policyDecision: {
          decision: "BLOCK",
          reasonCodes: ["TOOL_DISABLED"],
        },
      });

      const persistedLogs = await prisma.toolCallLog.findMany({
        where: {
          id: {
            in: [allowedToolCallLogId, blockedToolCallLogId],
          },
        },
      });

      expect(persistedLogs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: allowedToolCallLogId,
            toolName: "swingops.workflowRuns.list",
            status: "SUCCEEDED",
            errorMessage: null,
          }),
          expect.objectContaining({
            id: blockedToolCallLogId,
            toolName: "swingops.reviewQueueItems.resolve",
            status: "FAILED",
            errorMessage: "Tool is disabled and cannot be executed.",
          }),
        ]),
      );
    } catch (error) {
      const detail = serverStderr.trim();

      if (detail) {
        throw new Error(`MCP stdio server failed: ${detail}`, {
          cause: error,
        });
      }

      throw error;
    } finally {
      await client.close();
    }
  }, 20_000);
});
