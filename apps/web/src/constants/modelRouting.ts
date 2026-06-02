import type { ModelRoutingGoal, ModelTaskType } from "../types/ai";

export const MODEL_TASK_TYPES: ModelTaskType[] = [
  "INTAKE_PARSING",
  "FIELD_NORMALIZATION",
  "VALIDATION",
  "REVIEW_SUMMARY",
];

export const MODEL_ROUTING_GOALS: ModelRoutingGoal[] = [
  "LOW_COST",
  "LOW_LATENCY",
  "HIGH_QUALITY",
  "LOCAL_ONLY",
];
