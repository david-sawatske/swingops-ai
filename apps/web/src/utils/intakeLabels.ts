import type {
  IntakeBatchSourceType,
  IntakeBatchStatus,
} from "../types/intake";

const sourceTypeLabels: Record<IntakeBatchSourceType, string> = {
  FREEFORM_NOTES: "Freeform Notes",
  BAD_CSV: "Bad CSV",
  EMAIL: "Email",
  PDF_TEXT: "PDF Text",
  MANUAL_ENTRY: "Manual Entry",
};

const statusLabels: Record<IntakeBatchStatus, string> = {
  DRAFT: "Draft",
  QUEUED: "Queued",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  NEEDS_REVIEW: "Needs Review",
};

export function formatIntakeBatchSourceType(
  sourceType: IntakeBatchSourceType,
): string {
  return sourceTypeLabels[sourceType];
}

export function formatIntakeBatchStatus(status: IntakeBatchStatus): string {
  return statusLabels[status];
}
