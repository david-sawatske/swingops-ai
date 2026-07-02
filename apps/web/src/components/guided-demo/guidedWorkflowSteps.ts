export type GuidedStep =
  | "MESSY_SOURCE_INTAKE"
  | "AI_READY_RECORDS"
  | "GUARDED_AGENT_EXECUTION"
  | "VALIDATION_REVIEW"
  | "FINAL_RUN_REPORT";

export type GuidedWorkflowStepDefinition = {
  id: GuidedStep;
  label: string;
  eyebrow: string;
  description: string;
};

export const GUIDED_STEPS: GuidedWorkflowStepDefinition[] = [
  {
    id: "MESSY_SOURCE_INTAKE",
    label: "Messy Source Intake",
    eyebrow: "Step 1",
    description: "Normalize messy operational source text into candidate records.",
  },
  {
    id: "AI_READY_RECORDS",
    label: "AI-Ready Record Creation",
    eyebrow: "Step 2",
    description: "Inspect the structured records created by intake.",
  },
  {
    id: "GUARDED_AGENT_EXECUTION",
    label: "Guarded Agent Execution",
    eyebrow: "Step 3",
    description: "Run a controlled workflow from the AI-ready records.",
  },
  {
    id: "VALIDATION_REVIEW",
    label: "Validation and Human Review",
    eyebrow: "Step 4",
    description: "Understand what the workflow trusted and what it escalated.",
  },
  {
    id: "FINAL_RUN_REPORT",
    label: "Final Run Report",
    eyebrow: "Step 5",
    description: "Summarize what happened in plain business language.",
  },
];

export function getGuidedStepIndex(step: GuidedStep) {
  return GUIDED_STEPS.findIndex((item) => item.id === step);
}
