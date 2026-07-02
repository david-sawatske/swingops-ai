export type AppView =
  | "GUIDED_DEMO"
  | "REVIEW_QUEUE";

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
