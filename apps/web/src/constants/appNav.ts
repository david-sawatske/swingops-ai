export type AppView =
  | "GUIDED_DEMO"
  | "OVERVIEW"
  | "AGENTIC_DEMO"
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
    view: "GUIDED_DEMO",
    label: "Guided Workflow",
    eyebrow: "Trade-in operations",
  },
];
