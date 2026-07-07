export type AppView =
  | "GUIDED_DEMO"
  | "QUALITY_CHECKS"
  | "REVIEW_QUEUE";

export type AppNavItem = {
  view: AppView;
  label: string;
  eyebrow: string;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    view: "GUIDED_DEMO",
    label: "Main Workflow",
    eyebrow: "Trade-in run",
  },
  {
    view: "QUALITY_CHECKS",
    label: "Quality Checks",
    eyebrow: "Scenario matrix",
  },
];
