import { describe, expect, it } from "vitest";

import { evaluateToolExecutionPolicy } from "./tool-execution-policy.js";

describe("tool execution policy", () => {
  it("blocks unknown tools", () => {
    const evaluation = evaluateToolExecutionPolicy({
      toolName: "swingops.notRegistered",
      executionMode: "AGENT_AUTONOMOUS"
    });

    expect(evaluation).toMatchObject({
      toolName: "swingops.notRegistered",
      decision: "BLOCK",
      reasonCodes: ["TOOL_NOT_FOUND"],
      executionEnabled: false,
      tool: null
    });
  });

  it("blocks registered tools in preview-only mode", () => {
    const evaluation = evaluateToolExecutionPolicy({
      toolName: "swingops.workflowRuns.get"
    });

    expect(evaluation).toMatchObject({
      toolName: "swingops.workflowRuns.get",
      decision: "BLOCK",
      reasonCodes: ["PREVIEW_ONLY_MODE"],
      executionMode: "PREVIEW_ONLY",
      executionEnabled: false
    });
  });

  it("allows enabled low-risk read-only tools in autonomous mode", () => {
    const evaluation = evaluateToolExecutionPolicy({
      toolName: "swingops.workflowRuns.get",
      executionMode: "AGENT_AUTONOMOUS"
    });

    expect(evaluation).toMatchObject({
      toolName: "swingops.workflowRuns.get",
      decision: "ALLOW",
      reasonCodes: ["TOOL_ALLOWED"],
      executionMode: "AGENT_AUTONOMOUS",
      executionEnabled: true,
      humanApprovalGranted: false,
      tool: {
        enabled: true,
        riskLevel: "LOW",
        mutatesData: false,
        requiresHumanApproval: false
      }
    });
  });

  it("blocks disabled mutation tools even when human approval is granted", () => {
    const evaluation = evaluateToolExecutionPolicy({
      toolName: "swingops.reviewQueueItems.resolve",
      executionMode: "HUMAN_APPROVED",
      humanApprovalGranted: true
    });

    expect(evaluation).toMatchObject({
      toolName: "swingops.reviewQueueItems.resolve",
      decision: "BLOCK",
      reasonCodes: ["TOOL_DISABLED"],
      executionEnabled: false,
      humanApprovalGranted: true,
      tool: {
        enabled: false,
        riskLevel: "HIGH",
        mutatesData: true,
        requiresHumanApproval: true
      }
    });
  });

  it("keeps disabled high-risk mutation tools blocked before approval checks", () => {
    const evaluation = evaluateToolExecutionPolicy({
      toolName: "swingops.reviewQueueItems.dismiss",
      executionMode: "AGENT_AUTONOMOUS"
    });

    expect(evaluation.decision).toBe("BLOCK");
    expect(evaluation.reasonCodes).toEqual(["TOOL_DISABLED"]);
    expect(evaluation.executionEnabled).toBe(false);
  });
});
