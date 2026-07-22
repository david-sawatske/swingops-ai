import type { AiReadyIntakeRecord } from "../../types/workflow";

export type AiReadyStatusFilter =
  | "ACTIVE"
  | "ALL"
  | AiReadyIntakeRecord["status"];
export type AiReadyReadinessFilter =
  | "ALL"
  | "REVIEW_NEEDED"
  | "GROUNDING_READY"
  | "MISSING_FIELDS"
  | "COMPLETE";
export type AiReadySortOption = "NEWEST" | "STATUS" | "SOURCE";
export type AiReadyDateFilter =
  | "ALL"
  | "TODAY"
  | "LAST_7_DAYS"
  | "LAST_30_DAYS";
export type AiReadyInsightTab = "MISSING_FIELDS" | "SOURCE_QUALITY";

export const AI_READY_STATUS_FILTERS: {
  label: string;
  value: AiReadyStatusFilter;
}[] = [
  { label: "Active records", value: "ACTIVE" },
  { label: "All records", value: "ALL" },
  { label: "Grounding-ready", value: "READY_FOR_RAG" },
  { label: "Ready for review", value: "READY_FOR_REVIEW" },
  { label: "Needs review", value: "NEEDS_REVIEW" },
  { label: "Replaced history", value: "SUPERSEDED" },
];

export const AI_READY_READINESS_FILTERS: {
  label: string;
  value: AiReadyReadinessFilter;
}[] = [
  { label: "All readiness states", value: "ALL" },
  { label: "Needs review", value: "REVIEW_NEEDED" },
  { label: "Grounding-ready", value: "GROUNDING_READY" },
  { label: "Has missing fields", value: "MISSING_FIELDS" },
  { label: "Complete active records", value: "COMPLETE" },
];

export const AI_READY_SORT_OPTIONS: {
  label: string;
  value: AiReadySortOption;
}[] = [
  { label: "Newest first", value: "NEWEST" },
  { label: "Lifecycle status", value: "STATUS" },
  { label: "Source type", value: "SOURCE" },
];

export const AI_READY_DATE_FILTERS: {
  label: string;
  value: AiReadyDateFilter;
}[] = [
  { label: "All dates", value: "ALL" },
  { label: "Today", value: "TODAY" },
  { label: "Last 7 days", value: "LAST_7_DAYS" },
  { label: "Last 30 days", value: "LAST_30_DAYS" },
];

export const AI_READY_INSIGHT_TABS: {
  label: string;
  value: AiReadyInsightTab;
}[] = [
  { label: "Missing fields", value: "MISSING_FIELDS" },
  { label: "Source quality", value: "SOURCE_QUALITY" },
];

export const AI_READY_RECORD_PAGE_SIZE = 25;

export function isSupersededAiReadyRecord(record: AiReadyIntakeRecord) {
  return record.status === "SUPERSEDED";
}

export function getAiReadyRecordMissingFields(record: AiReadyIntakeRecord) {
  return record.normalizedJson.missingFields ?? [];
}

export function formatAiReadyRecordDisplayName(record: AiReadyIntakeRecord) {
  const normalized = record.normalizedJson;
  const displayName = [normalized.brand, normalized.productLine]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return displayName || record.sourceName || "Unidentified intake candidate";
}

export function getSupersededRecordReplacementLabel(
  record: AiReadyIntakeRecord,
) {
  return record.supersededByAiReadyIntakeRecordId
    ? "replaced by final reviewed record"
    : "replaced by later workflow output";
}

export function formatAiReadyStatusLabel(
  status: AiReadyIntakeRecord["status"],
) {
  switch (status) {
    case "READY_FOR_RAG":
      return "Grounding-ready";
    case "READY_FOR_REVIEW":
      return "Ready for review";
    case "NEEDS_REVIEW":
      return "Needs review";
    case "SUPERSEDED":
      return "Replaced";
    default:
      return status;
  }
}

export function getAiReadyCreatedDateRange(dateFilter: AiReadyDateFilter) {
  if (dateFilter === "ALL") {
    return {};
  }

  const now = new Date();
  const start = new Date(now);

  if (dateFilter === "TODAY") {
    start.setHours(0, 0, 0, 0);
  }

  if (dateFilter === "LAST_7_DAYS") {
    start.setDate(start.getDate() - 7);
  }

  if (dateFilter === "LAST_30_DAYS") {
    start.setDate(start.getDate() - 30);
  }

  return {
    createdFrom: start.toISOString(),
    createdTo: now.toISOString(),
  };
}

export function getAiReadyExplorerStatusFilter(
  statusFilter: AiReadyStatusFilter,
) {
  if (statusFilter === "ALL" || statusFilter === "ACTIVE") {
    return undefined;
  }

  return statusFilter;
}

export function getAiReadyExplorerReadinessFilters(
  readinessFilter: AiReadyReadinessFilter,
) {
  switch (readinessFilter) {
    case "REVIEW_NEEDED":
      return { reviewNeeded: true };
    case "GROUNDING_READY":
      return { ragReady: true };
    case "MISSING_FIELDS":
      return { missingFields: true };
    case "COMPLETE":
      return { reviewNeeded: false, missingFields: false };
    case "ALL":
    default:
      return {};
  }
}

export function getAiReadyExplorerSort(sortOption: AiReadySortOption) {
  switch (sortOption) {
    case "STATUS":
      return "status_asc" as const;
    case "SOURCE":
      return "sourceType_asc" as const;
    case "NEWEST":
    default:
      return "createdAt_desc" as const;
  }
}
