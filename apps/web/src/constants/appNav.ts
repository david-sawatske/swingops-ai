export type AppView =
  | "OVERVIEW"
  | "INTAKE"
  | "WORKFLOW_RUNS"
  | "REVIEW_QUEUE"
  | "MODEL_ROUTING"
  | "MCP_CONNECTORS";

export type AppNavItem = {
  view: AppView;
  label: string;
  eyebrow: string;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    view: "OVERVIEW",
    label: "Overview",
    eyebrow: "Product story",
  },
  {
    view: "INTAKE",
    label: "Intake",
    eyebrow: "Messy notes",
  },
  {
    view: "WORKFLOW_RUNS",
    label: "Workflow Runs",
    eyebrow: "Orchestration",
  },
  {
    view: "REVIEW_QUEUE",
    label: "Review Queue",
    eyebrow: "Human-in-loop",
  },
  {
    view: "MODEL_ROUTING",
    label: "Model Routing",
    eyebrow: "Cost / latency / quality",
  },
  {
    view: "MCP_CONNECTORS",
    label: "MCP Connectors",
    eyebrow: "Tool safety",
  },
];
