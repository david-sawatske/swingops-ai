export type IntakeBatchSourceType =
  | "FREEFORM_NOTES"
  | "CSV_UPLOAD"
  | "EMAIL";

export type IntakeBatchStatus =
  | "DRAFT"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type IntakeItemStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type WorkflowRunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
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

export type WorkflowRunSummary = {
  id: string;
  intakeBatchId: string;
  status: WorkflowRunStatus;
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
