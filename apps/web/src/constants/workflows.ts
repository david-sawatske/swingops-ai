import type { WorkflowRunStatus } from "../types/workflow";

export type WorkflowRunStatusFilter = "ALL" | WorkflowRunStatus;

export const WORKFLOW_RUN_STATUS_FILTERS: WorkflowRunStatusFilter[] = [
  "ALL",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "NEEDS_REVIEW",
  "FAILED",
  "CANCELLED",
];
