import type { WorkflowRunSummary } from "./workflow";

export type IntakeBatchSourceType =
  | "FREEFORM_NOTES"
  | "BAD_CSV"
  | "EMAIL"
  | "PDF_TEXT"
  | "MANUAL_ENTRY";

export type IntakeBatchStatus =
  | "DRAFT"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "NEEDS_REVIEW";

export type IntakeItemStatus =
  | "PENDING"
  | "PROCESSING"
  | "STRUCTURED"
  | "NEEDS_REVIEW"
  | "FAILED";

export type IntakeBatchSummary = {
  id: string;
  name: string;
  description: string | null;
  sourceType: IntakeBatchSourceType;
  status: IntakeBatchStatus;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type IntakeItem = {
  id: string;
  intakeBatchId: string;
  rawText: string;
  sourceRowNumber: number | null;
  status: IntakeItemStatus;
  createdAt: string;
  updatedAt: string;
};

export type IntakeBatchDetail = {
  intakeBatch: IntakeBatchSummary;
  items: IntakeItem[];
  workflowRuns: WorkflowRunSummary[];
};

export type IntakeBatchItemInput = {
  rawText: string;
};

export type CreateIntakeBatchRequest = {
  name: string;
  description?: string;
  sourceType: IntakeBatchSourceType;
  items: IntakeBatchItemInput[];
};

export type CreateIntakeBatchResponse = {
  intakeBatch: IntakeBatchSummary;
};

export type ListIntakeBatchesResponse = {
  intakeBatches: IntakeBatchSummary[];
};

export type GetIntakeBatchResponse = IntakeBatchDetail;
