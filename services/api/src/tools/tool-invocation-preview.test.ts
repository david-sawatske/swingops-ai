import { describe, expect, it } from "vitest";

import { previewToolInvocation } from "./tool-invocation-preview.js";

describe("tool invocation preview", () => {
  it("builds an auditable dry-run record for an allowed read-only tool", () => {
    const preview = previewToolInvocation({
      toolName: "swingops.workflowRuns.get",
      inputJson: {
        id: "workflow-run-1"
      },
      requestedBy: "agent.test",
      workflowRunId: "workflow-run-1",
      executionMode: "AGENT_AUTONOMOUS",
      invocationId: "preview-1",
      createdAt: "2026-05-28T17:00:00.000Z"
    });

    expect(preview).toMatchObject({
      invocation: {
        invocationId: "preview-1",
        toolName: "swingops.workflowRuns.get",
        status: "READY_TO_EXECUTE",
        requestedBy: "agent.test",
        workflowRunId: "workflow-run-1",
        workflowStepId: null,
        inputJson: {
          id: "workflow-run-1"
        },
        executionAttempted: false,
        persisted: false,
        policyDecision: "ALLOW",
        policyReasonCodes: ["TOOL_ALLOWED"],
        createdAt: "2026-05-28T17:00:00.000Z"
      },
      policyEvaluation: {
        decision: "ALLOW",
        executionEnabled: true
      },
      previewMetadata: {
        status: "DRY_RUN_ONLY",
        executionAttempted: false,
        persisted: false
      }
    });
  });

  it("builds a blocked dry-run record for preview-only mode", () => {
    const preview = previewToolInvocation({
      toolName: "swingops.workflowRuns.get",
      invocationId: "preview-2",
      createdAt: "2026-05-28T17:01:00.000Z"
    });

    expect(preview.invocation).toMatchObject({
      invocationId: "preview-2",
      status: "BLOCKED",
      policyDecision: "BLOCK",
      policyReasonCodes: ["PREVIEW_ONLY_MODE"],
      executionAttempted: false,
      persisted: false
    });
    expect(preview.policyEvaluation.executionEnabled).toBe(false);
  });

  it("builds a blocked dry-run record for disabled mutation tools", () => {
    const preview = previewToolInvocation({
      toolName: "swingops.reviewQueueItems.resolve",
      inputJson: {
        id: "review-item-1",
        reviewerNotes: "Looks correct."
      },
      executionMode: "HUMAN_APPROVED",
      humanApprovalGranted: true,
      invocationId: "preview-3",
      createdAt: "2026-05-28T17:02:00.000Z"
    });

    expect(preview.invocation).toMatchObject({
      invocationId: "preview-3",
      toolName: "swingops.reviewQueueItems.resolve",
      status: "BLOCKED",
      policyDecision: "BLOCK",
      policyReasonCodes: ["TOOL_DISABLED"],
      executionAttempted: false,
      persisted: false
    });
  });

  it("builds a blocked dry-run record for unknown tools", () => {
    const preview = previewToolInvocation({
      toolName: "swingops.notRegistered",
      executionMode: "AGENT_AUTONOMOUS",
      invocationId: "preview-4",
      createdAt: "2026-05-28T17:03:00.000Z"
    });

    expect(preview.invocation).toMatchObject({
      invocationId: "preview-4",
      toolName: "swingops.notRegistered",
      status: "BLOCKED",
      policyDecision: "BLOCK",
      policyReasonCodes: ["TOOL_NOT_FOUND"]
    });
    expect(preview.policyEvaluation.tool).toBeNull();
  });
});
