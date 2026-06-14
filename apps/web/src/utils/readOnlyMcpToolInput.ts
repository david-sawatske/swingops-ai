import type { ReadOnlyMcpToolName } from "../constants/mcpDemoTools";

export function getReadOnlyMcpToolInput(
  toolName: ReadOnlyMcpToolName,
  workflowRunId: string,
): unknown {
  if (toolName === "swingops.knowledgeBase.search") {
    return {
      query: "TM stealth2 drv 10.5 stiff condition 8.0 Average",
      maxResults: 5,
    };
  }

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
