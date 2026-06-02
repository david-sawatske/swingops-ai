export type ReadOnlyMcpToolName =
  | "swingops.clubReference.search"
  | "swingops.workflowRuns.list"
  | "swingops.workflowRuns.get"
  | "swingops.reviewQueueItems.list"
  | "swingops.intakeBatches.list"
  | "swingops.reviewQueueItems.resolve";

export type ReadOnlyMcpToolDemoOption = {
  name: ReadOnlyMcpToolName;
  label: string;
  description: string;
  category: "INTAKE" | "WORKFLOW" | "REVIEW_QUEUE";
  riskLevel: "LOW" | "HIGH";
  enabled: boolean;
  mutatesData: boolean;
  requiresHumanApproval: boolean;
  blockedDemo: boolean;
};

export const READ_ONLY_MCP_TOOL_OPTIONS: ReadOnlyMcpToolDemoOption[] = [
  {
    name: "swingops.clubReference.search",
    label: "Search club reference",
    description:
      "Reads a local golf club reference dataset to ground ambiguous trade-in notes before human review.",
    category: "WORKFLOW",
    riskLevel: "LOW",
    enabled: true,
    mutatesData: false,
    requiresHumanApproval: false,
    blockedDemo: false,
  },
  {
    name: "swingops.workflowRuns.list",
    label: "List workflow runs",
    description: "Reads workflow run summaries from internal SwingOps data.",
    category: "WORKFLOW",
    riskLevel: "LOW",
    enabled: true,
    mutatesData: false,
    requiresHumanApproval: false,
    blockedDemo: false,
  },
  {
    name: "swingops.reviewQueueItems.list",
    label: "List review queue items",
    description: "Reads human-review queue items without changing their status.",
    category: "REVIEW_QUEUE",
    riskLevel: "LOW",
    enabled: true,
    mutatesData: false,
    requiresHumanApproval: false,
    blockedDemo: false,
  },
  {
    name: "swingops.intakeBatches.list",
    label: "List intake batches",
    description: "Reads imported golf trade-in intake batches.",
    category: "INTAKE",
    riskLevel: "LOW",
    enabled: true,
    mutatesData: false,
    requiresHumanApproval: false,
    blockedDemo: false,
  },
  {
    name: "swingops.workflowRuns.get",
    label: "Get workflow run detail",
    description:
      "Reads one workflow run with steps, model logs, tool logs, and review items.",
    category: "WORKFLOW",
    riskLevel: "LOW",
    enabled: true,
    mutatesData: false,
    requiresHumanApproval: false,
    blockedDemo: false,
  },
  {
    name: "swingops.reviewQueueItems.resolve",
    label: "Blocked demo: resolve review item",
    description:
      "Mutation tool intentionally blocked by the read-only connector surface.",
    category: "REVIEW_QUEUE",
    riskLevel: "HIGH",
    enabled: false,
    mutatesData: true,
    requiresHumanApproval: true,
    blockedDemo: true,
  },
];
