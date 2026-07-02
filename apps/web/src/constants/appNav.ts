export type AppView =
  | "GUIDED_DEMO"
  | "WORKFLOW_RUNS"
  | "REVIEW_QUEUE"
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
