import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";

import { buildApp } from "../app.js";

const testWorkflowName = "test-tool-route-preview-log";

afterEach(async () => {
  await prisma.workflowRun.deleteMany({
    where: {
      workflowName: testWorkflowName
    }
  });
});

describe("tool routes", () => {
  describe("POST /mcp/tools/invocations/preview", () => {
    it("previews an auditable planned invocation for allowed read-only tools", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/invocations/preview",
        payload: {
          toolName: "swingops.workflowRuns.get",
          inputJson: {
            id: "workflow-run-1"
          },
          requestedBy: "agent.route-test",
          workflowRunId: "workflow-run-1",
          executionMode: "AGENT_AUTONOMOUS"
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.invocation).toMatchObject({
        toolName: "swingops.workflowRuns.get",
        status: "READY_TO_EXECUTE",
        requestedBy: "agent.route-test",
        workflowRunId: "workflow-run-1",
        workflowStepId: null,
        inputJson: {
          id: "workflow-run-1"
        },
        executionAttempted: false,
        persisted: false,
        policyDecision: "ALLOW",
        policyReasonCodes: ["TOOL_ALLOWED"]
      });
      expect(body.invocation.invocationId).toEqual(expect.any(String));
      expect(body.invocation.createdAt).toEqual(expect.any(String));
      expect(body.policyEvaluation.executionEnabled).toBe(true);
      expect(body.previewMetadata).toEqual({
        status: "DRY_RUN_ONLY",
        executionAttempted: false,
        persisted: false,
        message:
          "Tool invocation preview only. No tool execution was attempted and no ToolCallLog row was persisted."
      });

      await app.close();
    });

    it("previews a blocked invocation for preview-only mode", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/invocations/preview",
        payload: {
          toolName: "swingops.workflowRuns.get"
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.invocation).toMatchObject({
        toolName: "swingops.workflowRuns.get",
        status: "BLOCKED",
        requestedBy: "agent.preview",
        executionAttempted: false,
        persisted: false,
        policyDecision: "BLOCK",
        policyReasonCodes: ["PREVIEW_ONLY_MODE"]
      });
      expect(body.policyEvaluation.executionEnabled).toBe(false);

      await app.close();
    });

    it("previews a blocked invocation for disabled mutation tools", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/invocations/preview",
        payload: {
          toolName: "swingops.reviewQueueItems.resolve",
          inputJson: {
            id: "review-item-1",
            reviewerNotes: "Looks correct."
          },
          executionMode: "HUMAN_APPROVED",
          humanApprovalGranted: true
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.invocation).toMatchObject({
        toolName: "swingops.reviewQueueItems.resolve",
        status: "BLOCKED",
        policyDecision: "BLOCK",
        policyReasonCodes: ["TOOL_DISABLED"],
        executionAttempted: false,
        persisted: false
      });
      expect(body.policyEvaluation.tool).toMatchObject({
        name: "swingops.reviewQueueItems.resolve",
        enabled: false,
        riskLevel: "HIGH",
        mutatesData: true,
        requiresHumanApproval: true
      });

      await app.close();
    });

    it("returns 400 for invalid invocation preview payloads", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/invocations/preview",
        payload: {
          toolName: "",
          executionMode: "NOT_A_MODE"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe(
        "Invalid tool invocation preview request"
      );

      await app.close();
    });
  });

  describe("POST /mcp/tools/invocations/preview-log", () => {
    it("persists a planned invocation preview for an allowed read-only tool tied to a workflow run", async () => {
      const app = buildApp();
      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: testWorkflowName
        }
      });

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/invocations/preview-log",
        payload: {
          toolName: "swingops.workflowRuns.get",
          inputJson: {
            id: workflowRun.id
          },
          requestedBy: "agent.route-test",
          workflowRunId: workflowRun.id,
          executionMode: "AGENT_AUTONOMOUS"
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.invocation).toMatchObject({
        toolName: "swingops.workflowRuns.get",
        status: "READY_TO_EXECUTE",
        requestedBy: "agent.route-test",
        workflowRunId: workflowRun.id,
        executionAttempted: false,
        persisted: true,
        policyDecision: "ALLOW",
        policyReasonCodes: ["TOOL_ALLOWED"],
        toolCallLogId: expect.any(String)
      });
      expect(body.previewMetadata).toMatchObject({
        status: "DRY_RUN_ONLY",
        executionAttempted: false,
        persisted: true,
        toolCallLogId: body.invocation.toolCallLogId,
        message:
          "Tool invocation preview log persisted for audit only. No tool execution was attempted."
      });
      expect(body.toolCallLog).toMatchObject({
        id: body.invocation.toolCallLogId,
        workflowRunId: workflowRun.id,
        workflowStepId: null,
        toolName: "swingops.workflowRuns.get",
        status: "STARTED",
        completedAt: null,
        errorMessage: null
      });
      expect(body.toolCallLog.outputJson).toMatchObject({
        previewOnly: true,
        executionAttempted: false,
        actualToolOutput: null,
        policyDecision: "ALLOW",
        policyReasonCodes: ["TOOL_ALLOWED"],
        invocationStatus: "READY_TO_EXECUTE",
        requestedBy: "agent.route-test",
        executionMode: "AGENT_AUTONOMOUS",
        executionEnabled: true,
        humanApprovalGranted: false
      });

      await app.close();
    });

    it("persists a blocked planned invocation for preview-only mode without executing tools", async () => {
      const app = buildApp();
      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowName: testWorkflowName
        }
      });

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/invocations/preview-log",
        payload: {
          toolName: "swingops.workflowRuns.get",
          workflowRunId: workflowRun.id
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.invocation).toMatchObject({
        toolName: "swingops.workflowRuns.get",
        status: "BLOCKED",
        executionAttempted: false,
        persisted: true,
        policyDecision: "BLOCK",
        policyReasonCodes: ["PREVIEW_ONLY_MODE"]
      });
      expect(body.toolCallLog).toMatchObject({
        workflowRunId: workflowRun.id,
        toolName: "swingops.workflowRuns.get",
        status: "STARTED",
        completedAt: null
      });
      expect(body.toolCallLog.outputJson).toMatchObject({
        previewOnly: true,
        executionAttempted: false,
        actualToolOutput: null,
        policyDecision: "BLOCK",
        policyReasonCodes: ["PREVIEW_ONLY_MODE"],
        invocationStatus: "BLOCKED",
        executionMode: "PREVIEW_ONLY",
        executionEnabled: false
      });

      await app.close();
    });

    it("rejects preview-log persistence when no workflow context is supplied", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/invocations/preview-log",
        payload: {
          toolName: "swingops.workflowRuns.get"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error:
          "A workflowRunId or workflowStepId is required to persist a tool invocation preview log."
      });

      await app.close();
    });

    it("returns 400 for invalid invocation preview-log payloads", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/invocations/preview-log",
        payload: {
          toolName: "",
          executionMode: "NOT_A_MODE"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe(
        "Invalid tool invocation preview log request"
      );

      await app.close();
    });
  });

  describe("POST /mcp/tools/execution-policy/preview", () => {
    it("previews blocked execution for preview-only mode without executing tools", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/execution-policy/preview",
        payload: {
          toolName: "swingops.workflowRuns.get"
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body).toMatchObject({
        requestedToolName: "swingops.workflowRuns.get",
        evaluation: {
          toolName: "swingops.workflowRuns.get",
          decision: "BLOCK",
          reasonCodes: ["PREVIEW_ONLY_MODE"],
          executionMode: "PREVIEW_ONLY",
          executionEnabled: false
        },
        policyMetadata: {
          status: "PREVIEW_ONLY",
          executionAttempted: false,
          message:
            "Policy preview only. No tool execution was attempted by this endpoint."
        }
      });

      await app.close();
    });

    it("previews allowed execution for enabled low-risk read-only tools", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/execution-policy/preview",
        payload: {
          toolName: "swingops.workflowRuns.get",
          executionMode: "AGENT_AUTONOMOUS"
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.evaluation).toMatchObject({
        decision: "ALLOW",
        reasonCodes: ["TOOL_ALLOWED"],
        executionEnabled: true,
        tool: {
          name: "swingops.workflowRuns.get",
          riskLevel: "LOW",
          mutatesData: false,
          requiresHumanApproval: false
        }
      });
      expect(body.policyMetadata.executionAttempted).toBe(false);

      await app.close();
    });

    it("previews blocked execution for disabled approval-required mutation tools", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/execution-policy/preview",
        payload: {
          toolName: "swingops.reviewQueueItems.resolve",
          executionMode: "HUMAN_APPROVED",
          humanApprovalGranted: true
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.evaluation).toMatchObject({
        decision: "BLOCK",
        reasonCodes: ["TOOL_DISABLED"],
        executionEnabled: false,
        humanApprovalGranted: true,
        tool: {
          name: "swingops.reviewQueueItems.resolve",
          riskLevel: "HIGH",
          mutatesData: true,
          requiresHumanApproval: true,
          enabled: false
        }
      });

      await app.close();
    });

    it("returns 400 for invalid policy preview payloads", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/execution-policy/preview",
        payload: {
          toolName: "",
          executionMode: "NOT_A_MODE"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe(
        "Invalid tool execution policy preview request"
      );

      await app.close();
    });
  });

  describe("POST /mcp/tools/invocations/execute-readonly", () => {
    it("executes safe read-only tools and persists an executed ToolCallLog", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/invocations/execute-readonly",
        payload: {
          toolName: "swingops.intakeBatches.list",
          requestedBy: "agent.route-readonly-test"
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.invocation).toMatchObject({
        toolName: "swingops.intakeBatches.list",
        status: "SUCCEEDED",
        requestedBy: "agent.route-readonly-test",
        workflowRunId: null,
        workflowStepId: null,
        inputJson: null,
        executionAttempted: true,
        toolCallLogId: expect.any(String)
      });
      expect(body.policyEvaluation).toMatchObject({
        decision: "ALLOW",
        reasonCodes: ["TOOL_ALLOWED"],
        executionMode: "AGENT_AUTONOMOUS",
        executionEnabled: true,
        tool: {
          name: "swingops.intakeBatches.list",
          enabled: true,
          riskLevel: "LOW",
          mutatesData: false,
          requiresHumanApproval: false
        }
      });
      expect(body.connectorResult).toMatchObject({
        metadata: {
          readOnly: true,
          mutatesData: false,
          externalTransport: false
        },
        data: {
          intakeBatches: expect.any(Array)
        }
      });
      expect(body.toolCallLog).toMatchObject({
        id: body.invocation.toolCallLogId,
        workflowRunId: null,
        workflowStepId: null,
        toolName: "swingops.intakeBatches.list",
        status: "SUCCEEDED",
        errorMessage: null
      });
      expect(body.executionMetadata).toMatchObject({
        route: "POST /mcp/tools/invocations/execute-readonly",
        externalTransport: false,
        readOnlyOnly: true,
        mutationToolsEnabled: false,
        policyCheckedBeforeExecution: true
      });

      await app.close();
    });

    it("blocks mutating tools on the read-only invocation surface", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/invocations/execute-readonly",
        payload: {
          toolName: "swingops.reviewQueueItems.resolve",
          inputJson: {
            id: "review-item-1",
            reviewerNotes: "Looks correct."
          },
          executionMode: "HUMAN_APPROVED",
          humanApprovalGranted: true
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.invocation).toMatchObject({
        toolName: "swingops.reviewQueueItems.resolve",
        status: "BLOCKED",
        executionAttempted: false
      });
      expect(body.policyEvaluation).toMatchObject({
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
      expect(body.connectorResult).toBeNull();
      expect(body.toolCallLog).toMatchObject({
        toolName: "swingops.reviewQueueItems.resolve",
        status: "FAILED",
        errorMessage: "Tool is disabled and cannot be executed."
      });

      await app.close();
    });

    it("returns 400 for invalid read-only invocation payloads", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/mcp/tools/invocations/execute-readonly",
        payload: {
          toolName: "",
          executionMode: "NOT_A_MODE"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe(
        "Invalid read-only tool invocation request"
      );

      await app.close();
    });
  });

  describe("GET /mcp/tools", () => {
    it("returns the MCP-style internal tool registry preview", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/mcp/tools"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.registryMetadata).toEqual({
        transport: "INTERNAL_PREVIEW",
        executionEnabled: false,
        status:
          "Tool registry preview only. MCP transport and tool execution are intentionally not enabled in this slice."
      });

      expect(body.tools.map((tool: { name: string }) => tool.name)).toEqual([
        "swingops.intakeBatches.list",
        "swingops.intakeBatches.get",
        "swingops.clubReference.search",
        "swingops.workflowRuns.list",
        "swingops.workflowRuns.get",
        "swingops.reviewQueueItems.list",
        "swingops.reviewQueueItems.get",
        "swingops.reviewQueueItems.resolve",
        "swingops.reviewQueueItems.dismiss"
      ]);

      await app.close();
    });

    it("filters the registry by category and enabled status", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/mcp/tools?category=REVIEW_QUEUE&enabled=true"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.tools.map((tool: { name: string }) => tool.name)).toEqual([
        "swingops.reviewQueueItems.list",
        "swingops.reviewQueueItems.get"
      ]);

      await app.close();
    });

    it("returns disabled high-risk approval-required mutation tools when requested", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url:
          "/mcp/tools?mutatesData=true&requiresHumanApproval=true&enabled=false"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.tools.map((tool: { name: string }) => tool.name)).toEqual([
        "swingops.reviewQueueItems.resolve",
        "swingops.reviewQueueItems.dismiss"
      ]);

      expect(body.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "swingops.reviewQueueItems.resolve",
            riskLevel: "HIGH",
            requiresHumanApproval: true,
            mutatesData: true,
            enabled: false
          })
        ])
      );

      await app.close();
    });

    it("returns 400 for invalid registry query filters", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/mcp/tools?category=NOT_REAL"
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("Invalid agent tool registry query");

      await app.close();
    });
  });

  describe("GET /mcp/tools/:name", () => {
    it("returns one registered tool by name", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/mcp/tools/swingops.workflowRuns.get"
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.tool).toMatchObject({
        name: "swingops.workflowRuns.get",
        category: "WORKFLOW",
        riskLevel: "LOW",
        requiresHumanApproval: false,
        mutatesData: false,
        enabled: true,
        existingHttpRoute: {
          method: "GET",
          path: "/workflow-runs/:id"
        }
      });

      expect(body.tool.inputShape.fields).toEqual([
        {
          name: "id",
          type: "string",
          required: true,
          description: "The workflow run ID to retrieve."
        }
      ]);

      await app.close();
    });

    it("returns 404 when the registered tool does not exist", async () => {
      const app = buildApp();

      const response = await app.inject({
        method: "GET",
        url: "/mcp/tools/swingops.notReal"
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe("Agent tool not found");

      await app.close();
    });
  });
});
