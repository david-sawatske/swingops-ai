import { describe, expect, it } from "vitest";

import { getAgentTool, listAgentTools } from "./tool-registry.js";

describe("agent tool registry", () => {
  it("registers read-only tools for existing intake, workflow, and review capabilities", () => {
    const tools = listAgentTools();

    expect(tools.map((tool) => tool.name)).toEqual([
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

    expect(
      tools.filter((tool) => tool.enabled).map((tool) => tool.name)
    ).toEqual([
      "swingops.intakeBatches.list",
      "swingops.intakeBatches.get",
      "swingops.clubReference.search",
      "swingops.workflowRuns.list",
      "swingops.workflowRuns.get",
      "swingops.reviewQueueItems.list",
      "swingops.reviewQueueItems.get"
    ]);
  });

  it("marks review mutations as high-risk, approval-required, and disabled for execution", () => {
    const resolveTool = getAgentTool("swingops.reviewQueueItems.resolve");
    const dismissTool = getAgentTool("swingops.reviewQueueItems.dismiss");

    expect(resolveTool).toMatchObject({
      riskLevel: "HIGH",
      requiresHumanApproval: true,
      mutatesData: true,
      enabled: false,
      implementationStatus: "DISABLED_PREVIEW_ONLY",
      existingHttpRoute: {
        method: "POST",
        path: "/review-queue-items/:id/resolve"
      }
    });

    expect(dismissTool).toMatchObject({
      riskLevel: "HIGH",
      requiresHumanApproval: true,
      mutatesData: true,
      enabled: false,
      implementationStatus: "DISABLED_PREVIEW_ONLY",
      existingHttpRoute: {
        method: "POST",
        path: "/review-queue-items/:id/dismiss"
      }
    });
  });

  it("filters tools by category and enabled status", () => {
    const enabledReviewTools = listAgentTools({
      category: "REVIEW_QUEUE",
      enabled: true
    });

    expect(enabledReviewTools.map((tool) => tool.name)).toEqual([
      "swingops.reviewQueueItems.list",
      "swingops.reviewQueueItems.get"
    ]);
  });

  it("filters tools by data mutation and approval requirements", () => {
    const approvalRequiredMutationTools = listAgentTools({
      mutatesData: true,
      requiresHumanApproval: true
    });

    expect(approvalRequiredMutationTools.map((tool) => tool.name)).toEqual([
      "swingops.reviewQueueItems.resolve",
      "swingops.reviewQueueItems.dismiss"
    ]);
  });

  it("returns cloned tool definitions so callers cannot mutate registry state", () => {
    const firstLookup = getAgentTool("swingops.workflowRuns.get");

    expect(firstLookup).not.toBeNull();

    firstLookup!.inputShape.fields[0]!.name = "changed";

    const secondLookup = getAgentTool("swingops.workflowRuns.get");

    expect(secondLookup?.inputShape.fields[0]?.name).toBe("id");
  });
});
