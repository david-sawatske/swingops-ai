import type {
  IntakeBatchSourceType,
  IntakeBatchStatus,
} from "../types/intake";

const sourceTypeLabels: Record<IntakeBatchSourceType, string> = {
  FREEFORM_NOTES: "Freeform Notes",
  CSV_UPLOAD: "CSV Upload",
  EMAIL: "Email",
};

const statusLabels: Record<IntakeBatchStatus, string> = {
  DRAFT: "Draft",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

export function formatIntakeBatchSourceType(
  sourceType: IntakeBatchSourceType,
): string {
  return sourceTypeLabels[sourceType];
}

export function formatIntakeBatchStatus(status: IntakeBatchStatus): string {
  return statusLabels[status];
}
