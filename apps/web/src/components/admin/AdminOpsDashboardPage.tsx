import { useEffect, useMemo, useState } from "react";

import {
  getAdminOpsNormalizationMatrix,
  getAdminOpsSummary,
  getAdminOpsWorkflowConfig,
  listAiReadyIntakeRecords,
} from "../../api/workflows";
import type {
  AdminOpsNormalizationMatrixEntry,
  AiReadyIntakeRecord,
  GetAdminOpsSummaryResponse,
  GetAdminOpsWorkflowConfigResponse,
  GlobalWorkflowRunSummary,
} from "../../types/workflow";
import { WorkflowQualityChecksPage } from "../workflow-evals/WorkflowQualityChecksPage";

type AdminOpsMetric = {
  label: string;
  value: string | number;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
};

type AdminOpsModelTelemetryTab =
  | "PROVIDER_MIX"
  | "LATENCY_COST"
  | "VALIDATION";

const ADMIN_OPS_MODEL_TELEMETRY_TABS: {
  label: string;
  value: AdminOpsModelTelemetryTab;
}[] = [
  { label: "Provider mix", value: "PROVIDER_MIX" },
  { label: "Latency and cost", value: "LATENCY_COST" },
  { label: "Validation", value: "VALIDATION" },
];

type AdminOpsDashboardPageProps = {
  workflowRuns: GlobalWorkflowRunSummary[];
  workflowRunCount: number;
  openReviewQueueItemCount: number;
  toolCallLogCount: number;
};

const ADMIN_OPS_SECTIONS = [
  {
    id: "admin-ops-records-title",
    title: "AI-ready records",
    body: "Structured output, missing fields, and review state.",
  },
  {
    id: "admin-ops-quality-checks-title",
    title: "Quality checks",
    body: "Scenario matrix and protected workflow behavior.",
  },
  {
    id: "admin-ops-model-title",
    title: "Model telemetry",
    body: "Cost, latency, fallback, and validation status.",
  },
  {
    id: "admin-ops-normalization-title",
    title: "Normalization matrix",
    body: "Aliases, negative evidence, and blocked repairs.",
  },
  {
    id: "admin-ops-knowledge-title",
    title: "Knowledge grounding",
    body: "Record readiness and source-level grounding signals.",
  },
] as const;

function AdminOpsMetricCard({ metric }: { metric: AdminOpsMetric }) {
  return (
    <article className="admin-ops-metric-card">
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      <p>{metric.detail}</p>
      {metric.actionLabel && metric.onAction ? (
        <button
          className="admin-ops-card-action-button"
          onClick={metric.onAction}
          type="button"
        >
          {metric.actionLabel}
        </button>
      ) : null}
    </article>
  );
}

function AdminOpsInspectionGuide({
  showing,
  attention,
  inspectNext,
}: {
  showing: string;
  attention: string;
  inspectNext: string;
}) {
  const items = [
    {
      label: "What this shows",
      value: showing,
    },
    {
      label: "Needs attention",
      value: attention,
    },
    {
      label: "Inspect next",
      value: inspectNext,
    },
  ];

  return (
    <div
      className="admin-ops-inspection-guide"
      aria-label="Section inspection guidance"
    >
      {items.map((item) => (
        <article key={item.label}>
          <span>{item.label}</span>
          <p>{item.value}</p>
        </article>
      ))}
    </div>
  );
}

function formatNullable(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Blank";
  }

  return String(value);
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Not tracked";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 4,
    style: "currency",
  }).format(value);
}

function formatLatency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Not tracked";
  }

  return `${value} ms`;
}

function formatShortId(value: string | null | undefined) {
  if (!value) {
    return "Blank";
  }

  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatAdminOpsPercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return "0%";
  }

  return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatAdminOpsCountLabel(
  count: number,
  singularLabel: string,
  pluralLabel = `${singularLabel}s`,
) {
  return `${count.toLocaleString()} ${count === 1 ? singularLabel : pluralLabel}`;
}

function AdminOpsStatusBadge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: "success" | "warning" | "neutral";
}) {
  return (
    <span className={`admin-ops-status-badge admin-ops-status-badge--${tone}`}>
      {children}
    </span>
  );
}

function AdminOpsAliasList({ aliases }: { aliases: string[] }) {
  const visibleAliases = aliases.slice(0, 5);
  const hiddenAliasCount = aliases.length - visibleAliases.length;

  return (
    <div className="admin-ops-alias-list">
      {visibleAliases.map((alias) => (
        <span key={alias}>{alias}</span>
      ))}
      {hiddenAliasCount > 0 ? <small>+{hiddenAliasCount}</small> : null}
    </div>
  );
}

type AiReadyStatusFilter = "ACTIVE" | "ALL" | AiReadyIntakeRecord["status"];
type AiReadyReadinessFilter =
  | "ALL"
  | "REVIEW_NEEDED"
  | "GROUNDING_READY"
  | "MISSING_FIELDS"
  | "COMPLETE";
type AiReadySortOption =
  | "NEWEST"
  | "STATUS"
  | "SOURCE";
type AiReadyDateFilter = "ALL" | "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS";
type AiReadyInsightTab =
  | "MISSING_FIELDS"
  | "SOURCE_QUALITY";

const AI_READY_STATUS_FILTERS: {
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

const AI_READY_READINESS_FILTERS: {
  label: string;
  value: AiReadyReadinessFilter;
}[] = [
  { label: "All readiness states", value: "ALL" },
  { label: "Needs review", value: "REVIEW_NEEDED" },
  { label: "Grounding-ready", value: "GROUNDING_READY" },
  { label: "Has missing fields", value: "MISSING_FIELDS" },
  { label: "Complete active records", value: "COMPLETE" },
];

const AI_READY_SORT_OPTIONS: {
  label: string;
  value: AiReadySortOption;
}[] = [
  { label: "Newest first", value: "NEWEST" },
  { label: "Lifecycle status", value: "STATUS" },
  { label: "Source type", value: "SOURCE" },
];

const AI_READY_DATE_FILTERS: {
  label: string;
  value: AiReadyDateFilter;
}[] = [
  { label: "All dates", value: "ALL" },
  { label: "Today", value: "TODAY" },
  { label: "Last 7 days", value: "LAST_7_DAYS" },
  { label: "Last 30 days", value: "LAST_30_DAYS" },
];

const AI_READY_INSIGHT_TABS: {
  label: string;
  value: AiReadyInsightTab;
}[] = [
  { label: "Missing fields", value: "MISSING_FIELDS" },
  { label: "Source quality", value: "SOURCE_QUALITY" },
];

const AI_READY_RECORD_PREVIEW_LIMIT = 4;

function isSupersededAiReadyRecord(record: AiReadyIntakeRecord) {
  return record.status === "SUPERSEDED";
}

function getAiReadyRecordMissingFields(record: AiReadyIntakeRecord) {
  return record.normalizedJson.missingFields ?? [];
}

function formatAiReadyRecordDisplayName(record: AiReadyIntakeRecord) {
  const normalized = record.normalizedJson;
  const displayName = [normalized.brand, normalized.productLine]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return displayName || record.sourceName || "Unidentified intake candidate";
}

function getSupersededRecordReplacementLabel(record: AiReadyIntakeRecord) {
  return record.supersededByAiReadyIntakeRecordId
    ? "replaced by final reviewed record"
    : "replaced by later workflow output";
}

function formatAdminOpsDate(value: string | null | undefined) {
  if (!value) {
    return "Not tracked";
  }

  return new Date(value).toLocaleString();
}

function getAiReadyStatusRank(status: AiReadyIntakeRecord["status"]) {
  switch (status) {
    case "NEEDS_REVIEW":
      return 0;
    case "READY_FOR_REVIEW":
      return 1;
    case "READY_FOR_RAG":
      return 2;
    case "SUPERSEDED":
      return 3;
    default:
      return 4;
  }
}

function formatAiReadyStatusLabel(status: AiReadyIntakeRecord["status"]) {
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

function getAiReadyRecordSearchText(record: AiReadyIntakeRecord) {
  const normalized = record.normalizedJson;

  return [
    record.status,
    record.sourceType,
    record.sourceName,
    normalized.brand,
    normalized.productLine,
    normalized.category,
    normalized.shaftFlex,
    normalized.conditionGrade,
    ...getAiReadyRecordMissingFields(record),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function matchesAiReadyStatusFilter(
  record: AiReadyIntakeRecord,
  statusFilter: AiReadyStatusFilter,
) {
  if (statusFilter === "ALL") {
    return true;
  }

  if (statusFilter === "ACTIVE") {
    return !isSupersededAiReadyRecord(record);
  }

  return record.status === statusFilter;
}

function matchesAiReadyDateFilter(
  record: AiReadyIntakeRecord,
  dateFilter: AiReadyDateFilter,
) {
  if (dateFilter === "ALL") {
    return true;
  }

  const createdAtTime = Date.parse(record.createdAt);

  if (Number.isNaN(createdAtTime)) {
    return false;
  }

  const now = Date.now();
  const ageInMs = now - createdAtTime;
  const oneDayInMs = 24 * 60 * 60 * 1000;

  switch (dateFilter) {
    case "TODAY":
      return new Date(createdAtTime).toDateString() === new Date().toDateString();
    case "LAST_7_DAYS":
      return ageInMs <= 7 * oneDayInMs;
    case "LAST_30_DAYS":
    default:
      return ageInMs <= 30 * oneDayInMs;
  }
}

function matchesAiReadyReadinessFilter(
  record: AiReadyIntakeRecord,
  readinessFilter: AiReadyReadinessFilter,
) {
  const missingFieldCount = getAiReadyRecordMissingFields(record).length;

  switch (readinessFilter) {
    case "REVIEW_NEEDED":
      return record.reviewNeeded;
    case "GROUNDING_READY":
      return record.ragReady;
    case "MISSING_FIELDS":
      return missingFieldCount > 0;
    case "COMPLETE":
      return missingFieldCount === 0 && !record.reviewNeeded;
    case "ALL":
    default:
      return true;
  }
}

function getAiReadyCreatedDateRange(dateFilter: AiReadyDateFilter) {
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

function getAiReadyExplorerStatusFilter(statusFilter: AiReadyStatusFilter) {
  if (statusFilter === "ALL" || statusFilter === "ACTIVE") {
    return undefined;
  }

  return statusFilter;
}

function getAiReadyExplorerReadinessFilters(
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

function getAiReadyExplorerSort(sortOption: AiReadySortOption) {
  switch (sortOption) {
    case "STATUS":
      return "status_asc";
    case "SOURCE":
      return "sourceType_asc";
    case "NEWEST":
    default:
      return "createdAt_desc";
  }
}

function AdminOpsAiReadyRecordsPanel() {
  const [summary, setSummary] = useState<GetAdminOpsSummaryResponse | null>(null);
  const [records, setRecords] = useState<AiReadyIntakeRecord[]>([]);
  const [recordTotalCount, setRecordTotalCount] = useState(0);
  const [recordHasMore, setRecordHasMore] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isRecordsLoading, setIsRecordsLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<AiReadyStatusFilter>("ACTIVE");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [readinessFilter, setReadinessFilter] =
    useState<AiReadyReadinessFilter>("ALL");
  const [dateFilter, setDateFilter] = useState<AiReadyDateFilter>("ALL");
  const [sortOption, setSortOption] = useState<AiReadySortOption>("NEWEST");
  const [insightTab, setInsightTab] =
    useState<AiReadyInsightTab>("MISSING_FIELDS");
  const [recordOffset, setRecordOffset] = useState(0);
  const [isRecordWorkbenchOpen, setIsRecordWorkbenchOpen] = useState(false);

  const recordPageSize = 25;
  const aiReadySummary = summary?.aiReadyRecords;
  const sourceTypeOptions = useMemo(
    () =>
      aiReadySummary
        ? Object.keys(aiReadySummary.bySourceType).sort()
        : [],
    [aiReadySummary],
  );
  const displayedRecords = records;
  const displayedActiveRecords = displayedRecords.filter(
    (record) => !isSupersededAiReadyRecord(record),
  );
  const displayedSupersededRecords = displayedRecords.filter(
    isSupersededAiReadyRecord,
  );
  const activeFilterCount = [
    searchQuery.trim() !== "",
    statusFilter !== "ACTIVE",
    sourceFilter !== "ALL",
    readinessFilter !== "ALL",
    dateFilter !== "ALL",
    sortOption !== "NEWEST",
  ].filter(Boolean).length;

  async function loadSummary() {
    try {
      setIsSummaryLoading(true);
      setSummaryError(null);

      setSummary(await getAdminOpsSummary());
    } catch (loadError) {
      setSummaryError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load Admin Ops summary.",
      );
    } finally {
      setIsSummaryLoading(false);
    }
  }

  async function loadRecords() {
    try {
      setIsRecordsLoading(true);
      setRecordsError(null);

      const response = await listAiReadyIntakeRecords({
        ...getAiReadyCreatedDateRange(dateFilter),
        ...getAiReadyExplorerReadinessFilters(readinessFilter),
        limit: recordPageSize,
        offset: recordOffset,
        activeOnly: statusFilter === "ACTIVE" ? true : undefined,
        sourceType: sourceFilter === "ALL" ? undefined : sourceFilter,
        status: getAiReadyExplorerStatusFilter(statusFilter),
        search: searchQuery.trim() === "" ? undefined : searchQuery.trim(),
        sort: getAiReadyExplorerSort(sortOption),
      });

      setRecords(response.records);
      setRecordTotalCount(response.totalCount);
      setRecordHasMore(response.hasMore);
    } catch (loadError) {
      setRecordsError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load AI-ready records.",
      );
    } finally {
      setIsRecordsLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  useEffect(() => {
    if (isRecordWorkbenchOpen) {
      void loadRecords();
    }
  }, [
    dateFilter,
    isRecordWorkbenchOpen,
    readinessFilter,
    recordOffset,
    sortOption,
    searchQuery,
    sourceFilter,
    statusFilter,
  ]);

  function openRecordWorkbenchWithFilters({
    status = "ACTIVE",
    source = "ALL",
    readiness = "ALL",
    date = "ALL",
    sort = "NEWEST",
  }: {
    status?: AiReadyStatusFilter;
    source?: string;
    readiness?: AiReadyReadinessFilter;
    date?: AiReadyDateFilter;
    sort?: AiReadySortOption;
  } = {}) {
    setSearchDraft("");
    setSearchQuery("");
    setStatusFilter(status);
    setSourceFilter(source);
    setReadinessFilter(readiness);
    setDateFilter(date);
    setSortOption(sort);
    setRecordOffset(0);
    setIsRecordWorkbenchOpen(true);
  }

  function submitSearchQuery() {
    const nextSearchQuery = searchDraft.trim();

    setSearchDraft(nextSearchQuery);
    setSearchQuery(nextSearchQuery);
    setRecordOffset(0);
  }

  function clearFilters() {
    setSearchDraft("");
    setSearchQuery("");
    setStatusFilter("ACTIVE");
    setSourceFilter("ALL");
    setReadinessFilter("ALL");
    setDateFilter("ALL");
    setSortOption("NEWEST");
    setRecordOffset(0);
  }

  function updateStatusFilter(value: AiReadyStatusFilter) {
    setStatusFilter(value);
    setRecordOffset(0);
  }

  function updateSourceFilter(value: string) {
    setSourceFilter(value);
    setRecordOffset(0);
  }

  function updateReadinessFilter(value: AiReadyReadinessFilter) {
    setReadinessFilter(value);
    setRecordOffset(0);
  }

  function updateDateFilter(value: AiReadyDateFilter) {
    setDateFilter(value);
    setRecordOffset(0);
  }

  function updateSortOption(value: AiReadySortOption) {
    setSortOption(value);
    setRecordOffset(0);
  }

  return (
    <section className="admin-ops-panel" aria-labelledby="admin-ops-records-title">
      <div className="admin-ops-panel-heading">
        <span className="model-route-card__eyebrow">AI-ready records</span>
        <h3 id="admin-ops-records-title">Created record visibility</h3>
        <p>
          Prioritize records that need review, inspect missing fields, and open
          focused workbench views for the records that need action.
        </p>
      </div>

      <div className="admin-ops-mini-metric-grid">
        <AdminOpsMetricCard
          metric={{
            actionLabel: "Open active records",
            detail: "Records that are still active in the workflow lifecycle.",
            label: "Active records",
            onAction: () => openRecordWorkbenchWithFilters(),
            value: aiReadySummary?.active ?? "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            actionLabel: "Review records",
            detail: "Active records that should not move forward without review.",
            label: "Need review",
            onAction: () =>
              openRecordWorkbenchWithFilters({ readiness: "REVIEW_NEEDED" }),
            value: aiReadySummary?.reviewNeeded ?? "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            actionLabel: "Open ready records",
            detail: "Active records marked ready for grounding workflows.",
            label: "Grounding-ready",
            onAction: () =>
              openRecordWorkbenchWithFilters({ readiness: "GROUNDING_READY" }),
            value: aiReadySummary?.ragReady ?? "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            actionLabel: "View history",
            detail: "Historical intake candidates replaced by final records.",
            label: "Replaced history",
            onAction: () =>
              openRecordWorkbenchWithFilters({ status: "SUPERSEDED" }),
            value: aiReadySummary?.superseded ?? "—",
          }}
        />
      </div>

      {isSummaryLoading ? (
        <p className="admin-ops-muted">Loading AI-ready record snapshots...</p>
      ) : null}

      {summaryError ? <p className="admin-ops-error">{summaryError}</p> : null}

      {aiReadySummary ? (
        <div className="admin-ops-insight-tabs-card">
          <div
            aria-label="AI-ready record insight tabs"
            className="admin-ops-insight-tabs"
            role="tablist"
          >
            {AI_READY_INSIGHT_TABS.map((tab) => (
              <button
                aria-selected={insightTab === tab.value}
                className={
                  insightTab === tab.value
                    ? "admin-ops-insight-tab admin-ops-insight-tab--active"
                    : "admin-ops-insight-tab"
                }
                key={tab.value}
                onClick={() => setInsightTab(tab.value)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <article className="admin-ops-insight-card">
            {insightTab === "MISSING_FIELDS" ? (
              <>
                <div className="admin-ops-insight-card__header">
                  <span>Missing field hotspots</span>
                  <p>
                    Fields most often blocking active records from becoming
                    complete.
                  </p>
                </div>

                <div className="admin-ops-insight-list">
                  {aiReadySummary.missingFieldHotspots.length > 0 ? (
                    aiReadySummary.missingFieldHotspots
                      .slice(0, 5)
                      .map((entry) => (
                        <div className="admin-ops-insight-row" key={entry.label}>
                          <span>{entry.label}</span>
                          <strong>{entry.count}</strong>
                        </div>
                      ))
                  ) : (
                    <p className="admin-ops-muted">
                      No active records reported missing fields.
                    </p>
                  )}
                </div>
              </>
            ) : null}

            {insightTab === "SOURCE_QUALITY" ? (
              <>
                <div className="admin-ops-insight-card__header">
                  <span>Source quality</span>
                  <h4>
                    {aiReadySummary.sourceQuality[0]
                      ? `${aiReadySummary.sourceQuality[0].sourceType} · ${aiReadySummary.sourceQuality[0].active} active`
                      : "No source activity"}
                  </h4>
                  <p>
                    Source-level review and grounding readiness across active
                    records.
                  </p>
                </div>

                <div className="admin-ops-insight-list">
                  {aiReadySummary.sourceQuality.length > 0 ? (
                    aiReadySummary.sourceQuality.slice(0, 5).map((entry) => (
                      <div className="admin-ops-insight-row" key={entry.sourceType}>
                        <span>{entry.sourceType}</span>
                        <strong>{entry.active} active</strong>
                        <small>
                          {formatAdminOpsPercent(entry.groundingReady, entry.active)} ready ·{" "}
                          {formatAdminOpsPercent(entry.reviewNeeded, entry.active)} need review
                        </small>
                        <small>
                          {entry.groundingReady} ready / {entry.reviewNeeded} review
                        </small>
                      </div>
                    ))
                  ) : (
                    <p className="admin-ops-muted">
                      Run the workflow to create source quality signals.
                    </p>
                  )}
                </div>
              </>
            ) : null}


          </article>
        </div>
      ) : null}

      {aiReadySummary ? (
        <p className="admin-ops-ai-ready-activity-note">
          Record activity: newest AI-ready record created{" "}
          {aiReadySummary.freshness.newestCreatedAt
            ? formatAdminOpsDate(aiReadySummary.freshness.newestCreatedAt)
            : "No records yet"}{" "}
          · Created in last 24h: {aiReadySummary.freshness.last24Hours} · Last
          7d: {aiReadySummary.freshness.last7Days} · Last 30d:{" "}
          {aiReadySummary.freshness.last30Days}
        </p>
      ) : null}

      {isRecordWorkbenchOpen ? (
        <div
          aria-label="Full AI-ready record workbench"
          className="guided-expanded-table-backdrop"
          role="dialog"
        >
          <div className="guided-expanded-table-panel admin-ops-record-workbench-panel">
            <div className="guided-expanded-table-header">
              <div>
                <span className="model-route-card__eyebrow">
                  Expanded record view
                </span>
                <h4>Full AI-ready record workbench</h4>
                <p>
                  Search, filter, sort, page through records, and audit active
                  records without treating replaced intake candidates as active
                  issues.
                </p>
              </div>

              <button
                aria-label="Close AI-ready record workbench"
                className="guided-expanded-table-close-button"
                onClick={() => setIsRecordWorkbenchOpen(false)}
                title="Close"
                type="button"
              >
                ×
              </button>
            </div>

            <div
              className="admin-ops-record-controls"
              aria-label="AI-ready record controls"
            >
              <label className="admin-ops-field admin-ops-field--wide">
                <span>Search records</span>
                <div className="admin-ops-search-control">
                  <input
                    type="search"
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitSearchQuery();
                      }
                    }}
                    placeholder="Brand, product, source, status, missing field"
                  />
                  <button
                    aria-label="Search AI-ready records"
                    className="admin-ops-search-submit"
                    disabled={searchDraft.trim() === searchQuery.trim()}
                    onClick={submitSearchQuery}
                    type="button"
                  >
                    →
                  </button>
                </div>
              </label>

              <label className="admin-ops-field">
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    updateStatusFilter(event.target.value as AiReadyStatusFilter)
                  }
                >
                  {AI_READY_STATUS_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-ops-field">
                <span>Source</span>
                <select
                  value={sourceFilter}
                  onChange={(event) => updateSourceFilter(event.target.value)}
                >
                  <option value="ALL">All sources</option>
                  {sourceTypeOptions.map((sourceType) => (
                    <option key={sourceType} value={sourceType}>
                      {sourceType}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-ops-field">
                <span>Readiness</span>
                <select
                  value={readinessFilter}
                  onChange={(event) =>
                    updateReadinessFilter(
                      event.target.value as AiReadyReadinessFilter,
                    )
                  }
                >
                  {AI_READY_READINESS_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-ops-field">
                <span>Created date</span>
                <select
                  value={dateFilter}
                  onChange={(event) =>
                    updateDateFilter(event.target.value as AiReadyDateFilter)
                  }
                >
                  {AI_READY_DATE_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-ops-field">
                <span>Sort</span>
                <select
                  value={sortOption}
                  onChange={(event) =>
                    updateSortOption(event.target.value as AiReadySortOption)
                  }
                >
                  {AI_READY_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="admin-ops-clear-button"
                type="button"
                onClick={clearFilters}
                disabled={activeFilterCount === 0}
              >
                Clear filters
              </button>
            </div>

            {recordsError ? <p className="admin-ops-error">{recordsError}</p> : null}

            {!isRecordsLoading && !recordsError && records.length === 0 ? (
              <p className="admin-ops-muted">
                No AI-ready records match the current search and filters.
              </p>
            ) : null}

            <div className="admin-ops-record-summary">
              Showing {displayedRecords.length} records on this page. {recordTotalCount}{" "}
              records match the current search and filters. Replaced history
              stays available through the status filter.
              {activeFilterCount > 0 ? (
                <span>{activeFilterCount} controls active.</span>
              ) : null}
            </div>

            <div className="admin-ops-pagination">
              <button
                type="button"
                onClick={() =>
                  setRecordOffset((currentOffset) =>
                    Math.max(0, currentOffset - recordPageSize),
                  )
                }
                disabled={recordOffset === 0 || isRecordsLoading}
              >
                Previous page
              </button>
              <span>
                Page {Math.floor(recordOffset / recordPageSize) + 1} ·{" "}
                {isRecordsLoading ? "Loading..." : `${records.length} loaded`}
              </span>
              <button
                type="button"
                onClick={() =>
                  setRecordOffset((currentOffset) =>
                    currentOffset + recordPageSize,
                  )
                }
                disabled={!recordHasMore || isRecordsLoading}
              >
                Next page
              </button>
            </div>

            {!isRecordsLoading &&
            !recordsError &&
            records.length > 0 &&
            displayedActiveRecords.length === 0 ? (
              <p className="admin-ops-muted">
                No active AI-ready records match the current search and filters. Replaced
                intake candidates remain available below when they match the
                filters.
              </p>
            ) : null}

            {displayedActiveRecords.length > 0 ? (
              <div className="admin-ops-record-group">
                <div className="admin-ops-table-wrap">
                  <table className="admin-ops-table admin-ops-table--dense">
                        <thead>
                          <tr>
                            <th>Status</th>
                            <th>Record</th>
                            <th>Source</th>
                            <th>Missing fields</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedActiveRecords.map((record) => {
                            const normalized = record.normalizedJson;
                            const missingFields =
                              getAiReadyRecordMissingFields(record);

                            return (
                              <tr
                                key={record.id}
                                className="admin-ops-table-row-card"
                              >
                                <td>
                                  <div className="admin-ops-table-stack">
                                    <AdminOpsStatusBadge
                                      tone={
                                        record.reviewNeeded ? "warning" : "success"
                                      }
                                    >
                                      {formatAiReadyStatusLabel(record.status)}
                                    </AdminOpsStatusBadge>

                                  </div>
                                </td>
                                <td>
                                  <div className="admin-ops-table-stack">
                                    <strong>
                                      {formatNullable(normalized.brand)}{" "}
                                      {formatNullable(normalized.productLine)}
                                    </strong>
                                    <small>
                                      {formatNullable(normalized.category)} · Shaft{" "}
                                      {formatNullable(normalized.shaftFlex)} ·
                                      Condition{" "}
                                      {formatNullable(normalized.conditionGrade)}
                                    </small>
                                  </div>
                                </td>
                                <td>
                                  <div className="admin-ops-table-stack">
                                    <strong>{record.sourceType}</strong>
                                    <small className="admin-ops-source-meta">
                                      <span>{record.sourceName}</span>
                                      <span>
                                        Created {formatAdminOpsDate(record.createdAt)}
                                      </span>
                                    </small>
                                  </div>
                                </td>
                                <td>
                                  {missingFields.length > 0
                                    ? missingFields.join(", ")
                                    : "None"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

            {displayedSupersededRecords.length > 0 ? (
              <details className="admin-ops-history-details">
                <summary>
                  Replaced record history ({displayedSupersededRecords.length})
                </summary>
                <div className="admin-ops-history-list">
                  {displayedSupersededRecords.map((record) => (
                    <article className="admin-ops-history-card" key={record.id}>
                      <div className="admin-ops-history-card__main">
                        <strong>{formatAiReadyRecordDisplayName(record)}</strong>
                        <small>{getSupersededRecordReplacementLabel(record)}</small>
                      </div>

                      <div className="admin-ops-history-card__meta">
                        <span>{record.sourceType}</span>
                        <span>{formatAiReadyStatusLabel(record.status)}</span>
                        {record.supersededAt ? (
                          <span>{formatAdminOpsDate(record.supersededAt)}</span>
                        ) : null}
                      </div>

                      {record.supersededReason ? (
                        <p>{record.supersededReason}</p>
                      ) : null}

                      <details className="admin-ops-history-technical">
                        <summary>Technical audit detail</summary>
                        <div className="admin-ops-reference-list">
                          <small>record: {record.id}</small>
                          <small>
                            replaced by:{" "}
                            {formatShortId(
                              record.supersededByAiReadyIntakeRecordId,
                            )}
                          </small>
                          <small>run: {formatShortId(record.workflowRunId)}</small>
                          <small>
                            batch: {formatShortId(record.intakeBatchId)}
                          </small>
                          <small>item: {formatShortId(record.intakeItemId)}</small>
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AdminOpsModelTelemetryPanel({
  workflowRuns,
}: {
  workflowRuns: GlobalWorkflowRunSummary[];
}) {
  const [summary, setSummary] = useState<GetAdminOpsSummaryResponse | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [activeTab, setActiveTab] =
    useState<AdminOpsModelTelemetryTab>("PROVIDER_MIX");

  const recentModelCalls = workflowRuns
    .map((run) =>
      run.latestModelCallLog
        ? {
            run,
            modelCall: run.latestModelCallLog,
          }
        : null,
    )
    .filter((entry): entry is {
      run: GlobalWorkflowRunSummary;
      modelCall: NonNullable<GlobalWorkflowRunSummary["latestModelCallLog"]>;
    } => entry !== null)
    .slice(0, 8);

  const modelExecutions = summary?.modelExecutions;
  const providerModelRows = modelExecutions?.byProviderModel ?? [];
  const latencyRows = [...providerModelRows].sort((left, right) => {
    const leftLatency = left.averageLatencyMs ?? Number.MAX_SAFE_INTEGER;
    const rightLatency = right.averageLatencyMs ?? Number.MAX_SAFE_INTEGER;

    return leftLatency - rightLatency;
  });
  const validationRows = [...providerModelRows].sort(
    (left, right) =>
      right.fallbackCount - left.fallbackCount ||
      right.failedCallCount - left.failedCallCount ||
      right.callCount - left.callCount,
  );

  useEffect(() => {
    async function loadModelTelemetrySummary() {
      try {
        setIsSummaryLoading(true);
        setSummaryError(null);
        setSummary(await getAdminOpsSummary());
      } catch (loadError) {
        setSummaryError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load model telemetry summary.",
        );
      } finally {
        setIsSummaryLoading(false);
      }
    }

    void loadModelTelemetrySummary();
  }, []);

  return (
    <section className="admin-ops-panel" aria-labelledby="admin-ops-model-title">
      <div className="admin-ops-panel-heading">
        <span className="model-route-card__eyebrow">Model telemetry</span>
        <h3 id="admin-ops-model-title">Execution cost, latency and reliability</h3>
        <p>
          Tracks model execution health across recent model calls, then keeps
          recent workflow call evidence visible for audit.
        </p>
      </div>

      <div className="admin-ops-model-metric-grid">
        <AdminOpsMetricCard
          metric={{
            detail: "Recent executions in the Admin summary.",
            label: "Total calls",
            value: modelExecutions?.totalCalls ?? "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Succeeded executions divided by total calls.",
            label: "Validation pass rate",
            value: modelExecutions
              ? `${modelExecutions.validationPassRate}%`
              : "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Average across tracked calls.",
            label: "Avg latency",
            value:
              modelExecutions?.averageLatencyMs === null ||
              modelExecutions?.averageLatencyMs === undefined
                ? "Not tracked"
                : formatLatency(modelExecutions.averageLatencyMs),
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: modelExecutions
              ? `${formatAdminOpsCountLabel(
                  modelExecutions.fallbackCount,
                  "call",
                )} with fallback or non-success attempts.`
              : "Calls with fallback or non-success attempts.",
            label: "Fallback rate",
            value: modelExecutions ? `${modelExecutions.fallbackRate}%` : "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Estimated spend across recent calls.",
            label: "Estimated cost",
            value: modelExecutions
              ? formatCurrency(modelExecutions.estimatedCostTotal)
              : "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Tracked input and output tokens.",
            label: "Tokens",
            value: modelExecutions
              ? modelExecutions.totalTokens.toLocaleString()
              : "—",
          }}
        />
      </div>

      {isSummaryLoading ? (
        <p className="admin-ops-muted">Loading model telemetry summary...</p>
      ) : null}

      {summaryError ? <p className="admin-ops-error">{summaryError}</p> : null}

      {modelExecutions ? (
        <div className="admin-ops-insight-tabs-card">
          <div
            aria-label="Model telemetry tabs"
            className="admin-ops-insight-tabs"
            role="tablist"
          >
            {ADMIN_OPS_MODEL_TELEMETRY_TABS.map((tab) => (
              <button
                aria-selected={activeTab === tab.value}
                className={
                  activeTab === tab.value
                    ? "admin-ops-insight-tab admin-ops-insight-tab--active"
                    : "admin-ops-insight-tab"
                }
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <article className="admin-ops-insight-card">
            {activeTab === "PROVIDER_MIX" ? (
              <>
                <div className="admin-ops-insight-card__header">
                  <span>Provider mix</span>
                  <p>
                    Provider and model distribution across recent model
                    executions.
                  </p>
                </div>

                <div className="admin-ops-insight-list">
                  {providerModelRows.length > 0 ? (
                    providerModelRows.map((entry) => (
                      <div
                        className="admin-ops-insight-row"
                        key={`${entry.provider}-${entry.model}`}
                      >
                        <span>
                          {entry.provider} / {entry.model}
                        </span>
                        <strong>{formatAdminOpsCountLabel(entry.callCount, "call")}</strong>
                        <small>
                          {entry.failedCallCount} failed / {entry.fallbackCount} fallback
                        </small>
                      </div>
                    ))
                  ) : (
                    <p className="admin-ops-muted">
                      No provider/model execution rows are available yet.
                    </p>
                  )}
                </div>
              </>
            ) : null}

            {activeTab === "LATENCY_COST" ? (
              <>
                <div className="admin-ops-insight-card__header">
                  <span>Latency and cost</span>
                  <p>
                    Average latency, estimated cost and token usage by provider
                    model.
                  </p>
                </div>

                <div className="admin-ops-insight-list">
                  {latencyRows.length > 0 ? (
                    latencyRows.map((entry) => (
                      <div
                        className="admin-ops-insight-row"
                        key={`${entry.provider}-${entry.model}`}
                      >
                        <span>
                          {entry.provider} / {entry.model}
                        </span>
                        <strong>{formatLatency(entry.averageLatencyMs)}</strong>
                        <small>
                          {formatCurrency(entry.estimatedCostTotal)} estimated ·{" "}
                          {entry.totalTokens.toLocaleString()} tokens
                        </small>
                      </div>
                    ))
                  ) : (
                    <p className="admin-ops-muted">
                      No latency or cost telemetry is available yet.
                    </p>
                  )}
                </div>
              </>
            ) : null}

            {activeTab === "VALIDATION" ? (
              <>
                <div className="admin-ops-insight-card__header">
                  <span>Validation</span>
                  <p>
                    Success, failure and fallback behavior for recent model
                    executions.
                  </p>
                </div>

                <div className="admin-ops-insight-list">
                  <div className="admin-ops-insight-row">
                    <span>Validation pass rate</span>
                    <strong>{modelExecutions.validationPassRate}%</strong>
                    <small>
                      {modelExecutions.succeededCalls} succeeded /{" "}
                      {modelExecutions.failedCalls} failed
                    </small>
                  </div>
                  <div className="admin-ops-insight-row">
                    <span>Fallback rate</span>
                    <strong>{modelExecutions.fallbackRate}%</strong>
                    <small>
                      {formatAdminOpsCountLabel(modelExecutions.fallbackCount, "call")} with fallback or
                      non-success attempt signals
                    </small>
                  </div>
                  {validationRows.slice(0, 5).map((entry) => (
                    <div
                      className="admin-ops-insight-row"
                      key={`${entry.provider}-${entry.model}`}
                    >
                      <span>
                        {entry.provider} / {entry.model}
                      </span>
                      <strong>
                        {formatAdminOpsPercent(
                          entry.callCount - entry.failedCallCount,
                          entry.callCount,
                        )}{" "}
                        pass
                      </strong>
                      <small>
                        {entry.failedCallCount} failed / {entry.fallbackCount} fallback
                      </small>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </article>
        </div>
      ) : null}

      {recentModelCalls.length === 0 ? (
        <p className="admin-ops-muted">
          No recent workflow model-call evidence found yet. Run the main
          workflow with field repair enabled to capture provider execution
          evidence.
        </p>
      ) : (
        <div className="admin-ops-table-wrap">
          <table className="admin-ops-table admin-ops-table--dense">
            <thead>
              <tr>
                <th>Workflow run</th>
                <th>Provider / model</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Cost</th>
                <th>Tokens</th>
              </tr>
            </thead>
            <tbody>
              {recentModelCalls.map(({ run, modelCall }) => (
                <tr key={modelCall.id} className="admin-ops-table-row-card">
                  <td>
                    <div className="admin-ops-table-stack">
                      <strong>{run.workflowName}</strong>
                      <small>{formatShortId(run.id)}</small>
                    </div>
                  </td>
                  <td>
                    <div className="admin-ops-table-stack">
                      <strong>{modelCall.provider}</strong>
                      <small>{modelCall.model}</small>
                    </div>
                  </td>
                  <td>
                    <AdminOpsStatusBadge
                      tone={modelCall.status === "SUCCEEDED" ? "success" : "warning"}
                    >
                      {modelCall.status}
                    </AdminOpsStatusBadge>
                  </td>
                  <td>{formatLatency(modelCall.latencyMs)}</td>
                  <td>{formatCurrency(modelCall.estimatedCostUsd)}</td>
                  <td>{formatNullable(modelCall.totalTokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}


function AdminOpsNormalizationMatrixPanel() {
  type FieldFilter = "ALL" | AdminOpsNormalizationMatrixEntry["field"];
  type ActionFilter = "ALL" | AdminOpsNormalizationMatrixEntry["action"];

  const [entries, setEntries] = useState<AdminOpsNormalizationMatrixEntry[]>([]);
  const [searchText, setSearchText] = useState("");
  const [fieldFilter, setFieldFilter] = useState<FieldFilter>("ALL");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMatrix() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await getAdminOpsNormalizationMatrix();

      setEntries(response.entries);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load normalization matrix.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMatrix();
  }, []);

  const blockedOrReviewEntries = entries.filter(
    (entry) => entry.action !== "NORMALIZE",
  );

  const fieldOptions = useMemo(
    () => [...new Set(entries.map((entry) => entry.field))].sort(),
    [entries],
  );

  const actionOptions = useMemo(
    () => [...new Set(entries.map((entry) => entry.action))].sort(),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchText.trim().toLocaleLowerCase();

    return entries.filter((entry) => {
      if (fieldFilter !== "ALL" && entry.field !== fieldFilter) {
        return false;
      }

      if (actionFilter !== "ALL" && entry.action !== actionFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableValues = [
        entry.id,
        entry.field,
        entry.action,
        entry.notes,
        String(entry.canonicalValue ?? ""),
        ...entry.aliases,
      ];

      return searchableValues.some((value) =>
        value.toLocaleLowerCase().includes(normalizedSearch),
      );
    });
  }, [actionFilter, entries, fieldFilter, searchText]);

  const hasActiveFilters =
    searchText.length > 0 || fieldFilter !== "ALL" || actionFilter !== "ALL";

  function clearFilters() {
    setSearchText("");
    setFieldFilter("ALL");
    setActionFilter("ALL");
  }

  return (
    <section
      className="admin-ops-panel"
      aria-labelledby="admin-ops-normalization-title"
    >
      <div className="admin-ops-panel-heading">
        <span className="model-route-card__eyebrow">Normalization matrix</span>
        <h3 id="admin-ops-normalization-title">
          Structured golf term controls
        </h3>
        <p>
          Search deterministic aliases, negative evidence, context requirements,
          and repair-blocking rules that stay higher authority than model output.
        </p>
      </div>

      <div className="admin-ops-mini-metric-grid">
        <AdminOpsMetricCard
          metric={{
            detail: "Read-only entries exposed by the Admin Ops API.",
            label: "Matrix entries",
            value: entries.length,
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Entries that block repair or route ambiguous evidence to review.",
            label: "Guardrail entries",
            value: blockedOrReviewEntries.length,
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Entries matching the current search and filters.",
            label: "Visible entries",
            value: filteredEntries.length,
          }}
        />
      </div>

      <AdminOpsInspectionGuide
        attention={`${blockedOrReviewEntries.length} entries block automatic repair or route evidence to human review.`}
        inspectNext="Filter by action to inspect blocked repairs, then check context-required aliases before changing parsing behavior."
        showing={`${entries.length} deterministic normalization and guardrail rules from the active workflow matrix.`}
      />

      <div className="admin-ops-record-controls admin-ops-normalization-controls">
        <label className="admin-ops-field admin-ops-field--wide">
          Search matrix
          <input
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search aliases, canonical values, actions, or notes"
            type="search"
            value={searchText}
          />
        </label>

        <label className="admin-ops-field">
          Field
          <select
            onChange={(event) =>
              setFieldFilter(event.target.value as FieldFilter)
            }
            value={fieldFilter}
          >
            <option value="ALL">All fields</option>
            {fieldOptions.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-ops-field">
          Action
          <select
            onChange={(event) =>
              setActionFilter(event.target.value as ActionFilter)
            }
            value={actionFilter}
          >
            <option value="ALL">All actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>

        <button
          className="admin-ops-clear-button"
          disabled={!hasActiveFilters}
          onClick={clearFilters}
          type="button"
        >
          Clear filters
        </button>
      </div>

      {isLoading ? (
        <p className="admin-ops-muted">Loading normalization matrix...</p>
      ) : null}

      {error ? <p className="admin-ops-error">{error}</p> : null}

      {!isLoading && !error && entries.length === 0 ? (
        <p className="admin-ops-muted">
          No normalization entries are currently exposed.
        </p>
      ) : null}

      {!isLoading &&
      !error &&
      entries.length > 0 &&
      filteredEntries.length === 0 ? (
        <p className="admin-ops-muted">
          No normalization entries match the current search and filters.
        </p>
      ) : null}

      {filteredEntries.length > 0 ? (
        <div className="admin-ops-table-wrap">
          <table className="admin-ops-table admin-ops-table--dense">
            <thead>
              <tr>
                <th>Field</th>
                <th>Aliases</th>
                <th>Canonical value</th>
                <th>Action</th>
                <th>Context</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="admin-ops-table-row-card">
                  <td>{entry.field}</td>
                  <td>
                    <AdminOpsAliasList aliases={entry.aliases} />
                  </td>
                  <td>{formatNullable(entry.canonicalValue)}</td>
                  <td>
                    <AdminOpsStatusBadge
                      tone={entry.action === "NORMALIZE" ? "success" : "warning"}
                    >
                      {entry.action}
                    </AdminOpsStatusBadge>
                  </td>
                  <td>{entry.requiresContext ? "Required" : "Not required"}</td>
                  <td>{entry.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function AdminOpsQualitySafeguards() {
  const [config, setConfig] =
    useState<GetAdminOpsWorkflowConfigResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadConfig() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await getAdminOpsWorkflowConfig();

      setConfig(response);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load active workflow safeguards.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig();
  }, []);

  const modelAuthority =
    config?.confidenceThresholds.find(
      (item) => item.name === "modelAuthority",
    ) ?? null;
  const reviewRouting =
    config?.confidenceThresholds.find(
      (item) => item.name === "reviewRouting",
    ) ?? null;
  const providerPolicy = config?.providerRoutingPolicy[0] ?? null;

  const safeguards = config
    ? [
        {
          label: "Model authority",
          value: modelAuthority?.value ?? "Not reported",
        },
        {
          label: "Review routing",
          value: reviewRouting?.value ?? "Not reported",
        },
        {
          label: "Tool access",
          value: config.mutationPolicy.readOnlyToolsOnly
            ? "Read-only"
            : "Mutation enabled",
        },
        {
          label: "Provider output",
          value: providerPolicy?.validationRequired
            ? "Validation required"
            : "Validation not required",
        },
      ]
    : [];

  return (
    <div
      className="admin-ops-quality-safeguards"
      aria-label="Active workflow safeguards"
    >
      <div className="admin-ops-quality-safeguards__heading">
        <span>Active safeguards</span>
        <p>Controls applied to the quality-check scenarios below.</p>
      </div>

      {isLoading ? (
        <p className="admin-ops-muted">Loading active safeguards...</p>
      ) : null}

      {error ? <p className="admin-ops-error">{error}</p> : null}

      {safeguards.length > 0 ? (
        <div className="admin-ops-quality-safeguards__list">
          {safeguards.map((safeguard) => (
            <div
              className="admin-ops-quality-safeguard"
              key={safeguard.label}
            >
              <span>{safeguard.label}</span>
              <strong>{safeguard.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AdminOpsKnowledgePanel() {
  const [summary, setSummary] = useState<GetAdminOpsSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadKnowledgeSummary() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await getAdminOpsSummary();

      setSummary(response);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load grounding readiness.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadKnowledgeSummary();
  }, []);

  const aiReadyRecords = summary?.aiReadyRecords ?? null;
  const activeSourceCount =
    aiReadyRecords?.sourceQuality.filter((entry) => entry.active > 0).length ?? 0;

  const sourceWithMostReview = aiReadyRecords
    ? [...aiReadyRecords.sourceQuality]
        .filter((entry) => entry.active > 0)
        .sort((left, right) => {
          const leftRate =
            left.active > 0 ? left.reviewNeeded / left.active : 0;
          const rightRate =
            right.active > 0 ? right.reviewNeeded / right.active : 0;

          return rightRate - leftRate || right.reviewNeeded - left.reviewNeeded;
        })[0] ?? null
    : null;

  const attentionText = aiReadyRecords
    ? aiReadyRecords.reviewNeeded === 0
      ? "No active AI-ready records are currently marked as requiring review."
      : sourceWithMostReview
        ? `${aiReadyRecords.reviewNeeded} active records need review. ${sourceWithMostReview.sourceType} has the highest current source-level review pressure.`
        : `${aiReadyRecords.reviewNeeded} active records still need review before dependable downstream grounding use.`
    : "Grounding attention signals will appear after the Admin Ops summary loads.";

  return (
    <section
      className="admin-ops-panel"
      aria-labelledby="admin-ops-knowledge-title"
    >
      <div className="admin-ops-panel-heading">
        <span className="model-route-card__eyebrow">Knowledge grounding</span>
        <h3 id="admin-ops-knowledge-title">Grounding readiness visibility</h3>
        <p>
          Uses persisted AI-ready record signals to show what can participate in
          grounding workflows without claiming seed coverage that is not exposed
          by the current API.
        </p>
      </div>

      <div className="admin-ops-mini-metric-grid">
        <AdminOpsMetricCard
          metric={{
            detail: "Active records marked ready for grounding workflows.",
            label: "Grounding-ready",
            value: aiReadyRecords?.ragReady ?? "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Share of active records currently marked grounding-ready.",
            label: "Readiness rate",
            value: aiReadyRecords
              ? formatAdminOpsPercent(
                  aiReadyRecords.ragReady,
                  aiReadyRecords.active,
                )
              : "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Source types represented by at least one active record.",
            label: "Active source types",
            value: summary ? activeSourceCount : "—",
          }}
        />
      </div>

      <AdminOpsInspectionGuide
        attention={attentionText}
        inspectNext="Inspect Source quality and Missing fields in AI-ready records, then review the workflow evidence attached to records that are not grounding-ready."
        showing="Summary-backed grounding readiness across active AI-ready records and represented source types."
      />

      {isLoading ? (
        <p className="admin-ops-muted">Loading grounding readiness...</p>
      ) : null}

      {error ? <p className="admin-ops-error">{error}</p> : null}
    </section>
  );
}

export function AdminOpsDashboardPage({
  workflowRuns,
  workflowRunCount,
  openReviewQueueItemCount,
  toolCallLogCount,
}: AdminOpsDashboardPageProps) {
  const metrics: AdminOpsMetric[] = useMemo(
    () => [
      {
        label: "Workflow runs",
        value: workflowRunCount,
        detail: "Tracked runs available for operational review.",
      },
      {
        label: "Open review items",
        value: openReviewQueueItemCount,
        detail: "Records still requiring human validation.",
      },
      {
        label: "Tool calls",
        value: toolCallLogCount,
        detail: "Safe connector activity captured in audit traces.",
      },
    ],
    [openReviewQueueItemCount, toolCallLogCount, workflowRunCount],
  );

  return (
    <section className="admin-ops-page" aria-labelledby="admin-ops-title">
      <div className="admin-ops-hero">
        <span className="model-route-card__eyebrow">Admin Ops</span>
        <h2 id="admin-ops-title">Controlled workflow operations</h2>
        <p>
          Inspect records, quality checks, model execution, normalization rules,
          grounding readiness, review routing, and auditability from one
          read-only control surface.
        </p>
      </div>

      <section className="admin-ops-metric-grid" aria-label="Admin Ops summary">
        {metrics.map((metric) => (
          <AdminOpsMetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <nav
        className="admin-ops-section-grid"
        aria-label="Admin Ops dashboard sections"
      >
        {ADMIN_OPS_SECTIONS.map((section) => (
          <a
            className="admin-ops-section-card"
            href={`#${section.id}`}
            key={section.title}
          >
            <h3>{section.title}</h3>
            <p>{section.body}</p>
          </a>
        ))}
      </nav>

      <AdminOpsAiReadyRecordsPanel />

      <section
        className="admin-ops-embedded-panel"
        aria-labelledby="admin-ops-quality-checks-title"
      >
        <div className="admin-ops-panel-heading">
          <span className="model-route-card__eyebrow">
            Validation & Quality Checks
          </span>
          <h3 id="admin-ops-quality-checks-title">
            Protected workflow behavior
          </h3>
          <p>
            Run known scenarios against the active workflow safeguards so parser
            behavior, review routing, correction suggestions, and protected
            execution remain verifiable.
          </p>
        </div>

        <AdminOpsQualitySafeguards />

        <WorkflowQualityChecksPage />
      </section>

      <AdminOpsModelTelemetryPanel workflowRuns={workflowRuns} />

      <AdminOpsNormalizationMatrixPanel />

      <AdminOpsKnowledgePanel />
    </section>
  );
}
