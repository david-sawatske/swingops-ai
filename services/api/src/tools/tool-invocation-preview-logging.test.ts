import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import {
  persistToolInvocationPreviewLog,
  ToolInvocationPreviewLogRequiresWorkflowContextError
} from "./tool-invocation-preview-logging.js";

const testWorkflowName = "test-tool-invocation-preview-log";

afterEach(async () => {
  await prisma.workflowRun.deleteMany({
    where: {
      workflowName: testWorkflowName
    }
  });
});

describe("tool invocation preview logging", () => {
  it("persists an audit-only planned invocation preview for an allowed read-only tool", async () => {
    const workflowRun = await prisma.workflowRun.create({
      data: {
        workflowName: testWorkflowName
      }
    });

    const preview = await persistToolInvocationPreviewLog({
      toolName: "swingops.workflowRuns.get",
      inputJson: {
        id: workflowRun.id
      },
      requestedBy: "agent.test",
      workflowRunId: workflowRun.id,
      executionMode: "AGENT_AUTONOMOUS",
      invocationId: "preview-log-1",
      createdAt: "2026-05-28T17:30:00.000Z"
    });

    expect(preview.invocation).toMatchObject({
      invocationId: "preview-log-1",
      toolName: "swingops.workflowRuns.get",
      status: "READY_TO_EXECUTE",
      workflowRunId: workflowRun.id,
      executionAttempted: false,
      persisted: true,
      policyDecision: "ALLOW",
      policyReasonCodes: ["TOOL_ALLOWED"],
      toolCallLogId: preview.toolCallLog.id
    });

    expect(preview.previewMetadata).toMatchObject({
      status: "DRY_RUN_ONLY",
      executionAttempted: false,
      persisted: true,
      toolCallLogId: preview.toolCallLog.id
    });

    expect(preview.toolCallLog).toMatchObject({
      workflowRunId: workflowRun.id,
      workflowStepId: null,
      toolName: "swingops.workflowRuns.get",
      status: "STARTED",
      completedAt: null,
      errorMessage: null
    });

    expect(preview.toolCallLog.inputJson).toMatchObject({
      id: workflowRun.id
    });

    expect(preview.toolCallLog.outputJson).toMatchObject({
      previewOnly: true,
      executionAttempted: false,
      actualToolOutput: null,
      policyDecision: "ALLOW",
      policyReasonCodes: ["TOOL_ALLOWED"],
      invocationStatus: "READY_TO_EXECUTE",
      requestedBy: "agent.test",
      invocationId: "preview-log-1",
      executionMode: "AGENT_AUTONOMOUS",
      executionEnabled: true,
      humanApprovalGranted: false
    });
  });

  it("persists a blocked planned invocation preview without attempting execution", async () => {
    const workflowRun = await prisma.workflowRun.create({
      data: {
        workflowName: testWorkflowName
      }
    });

    const preview = await persistToolInvocationPreviewLog({
      toolName: "swingops.workflowRuns.get",
      workflowRunId: workflowRun.id,
      invocationId: "preview-log-2",
      createdAt: "2026-05-28T17:31:00.000Z"
    });

    expect(preview.invocation).toMatchObject({
      status: "BLOCKED",
      executionAttempted: false,
      persisted: true,
      policyDecision: "BLOCK",
      policyReasonCodes: ["PREVIEW_ONLY_MODE"]
    });

    expect(preview.toolCallLog.status).toBe("STARTED");
    expect(preview.toolCallLog.completedAt).toBeNull();
    expect(preview.toolCallLog.outputJson).toMatchObject({
      previewOnly: true,
      executionAttempted: false,
      actualToolOutput: null,
      policyDecision: "BLOCK",
      policyReasonCodes: ["PREVIEW_ONLY_MODE"],
      invocationStatus: "BLOCKED",
      executionMode: "PREVIEW_ONLY",
      executionEnabled: false
    });
  });

  it("rejects persistence when no workflow context is supplied", async () => {
    await expect(
      persistToolInvocationPreviewLog({
        toolName: "swingops.workflowRuns.get"
      })
    ).rejects.toBeInstanceOf(
      ToolInvocationPreviewLogRequiresWorkflowContextError
    );
  });
});
