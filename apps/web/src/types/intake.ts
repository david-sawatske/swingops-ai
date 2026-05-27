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

export type ListIntakeBatchesResponse = {
  intakeBatches: IntakeBatchSummary[];
};
