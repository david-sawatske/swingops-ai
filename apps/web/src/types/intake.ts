export type IntakeBatchSourceType =
  | "FREEFORM_NOTES"
  | "CSV_UPLOAD"
  | "EMAIL";

export type IntakeBatchStatus =
  | "DRAFT"
  | "PROCESSING"
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
