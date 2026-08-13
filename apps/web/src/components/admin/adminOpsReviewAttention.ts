export function getReviewAttentionMessage({
  missingFieldCount,
  qualitySignalCount,
}: {
  missingFieldCount: number;
  qualitySignalCount: number;
}): string {
  if (missingFieldCount > 0 && qualitySignalCount > 0) {
    return "Review the unresolved fields and quality signals before this record moves downstream.";
  }

  if (missingFieldCount > 0) {
    return "Review the unresolved fields before this record moves downstream.";
  }

  if (qualitySignalCount > 0) {
    return "Review the source-quality signals before this otherwise complete record moves downstream.";
  }

  return "Review this record's active hold before it moves downstream.";
}
