import type { ReadOnlyMcpToolName } from "../constants/mcpDemoTools";

export function getReadOnlyMcpToolInput(
  toolName: ReadOnlyMcpToolName,
  workflowRunId: string,
): unknown {
  if (toolName === "swingops.clubReference.search") {
    return {
      query:
        "Titleist TSR3 fairway wood, 15 degree, stiff shaft. Customer wrote TSR maybe TS2.",
    };
  }

  if (toolName === "swingops.workflowRuns.get") {
    return {
      id: workflowRunId,
    };
  }

  if (toolName === "swingops.reviewQueueItems.resolve") {
    return {
      id: "blocked-demo-review-item",
      reviewerNotes: "Blocked demo only. Mutations are disabled on this surface.",
    };
  }

  return {};
}
