import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getAdminOpsSummary,
  listAiReadyIntakeRecords,
} from "../../api/workflows";
import type {
  AiReadyIntakeRecord,
  GetAdminOpsSummaryResponse,
} from "../../types/workflow";
import { AdminOpsAiReadyRecordDetail } from "./AdminOpsAiReadyRecordDetail";
import { AdminOpsAiReadyRecordHistory } from "./AdminOpsAiReadyRecordHistory";
import {
  AI_READY_DATE_FILTERS,
  AI_READY_HISTORY_SORT_OPTIONS,
  AI_READY_INSIGHT_TABS,
  AI_READY_READINESS_FILTERS,
  AI_READY_RECORD_PAGE_SIZE,
  AI_READY_SORT_OPTIONS,
  AI_READY_STATUS_FILTERS,
  type AiReadyDateFilter,
  type AiReadyInsightTab,
  type AiReadyReadinessFilter,
  type AiReadySortOption,
  type AiReadyStatusFilter,
  formatAiReadyFieldLabel,
  formatAiReadyRecordDisplayName,
  formatAiReadySourceTypeLabel,
  formatAiReadyStatusLabel,
  getAiReadyCreatedDateRange,
  getAiReadyExplorerReadinessFilters,
  getAiReadyExplorerSort,
  getAiReadyExplorerStatusFilter,
  getAiReadyRecordMissingFields,
  isSupersededAiReadyRecord,
} from "./adminOpsAiReadyUtils";
import {
  AdminOpsMetricCard,
  AdminOpsStatusBadge,
  formatAdminOpsDate,
  formatAdminOpsPercent,
  formatNullable,
} from "./adminOpsPresentation";

export function AdminOpsAiReadyRecordsPanel({
  onOpenReviewQueue,
}: {
  onOpenReviewQueue: (intakeItemId: string | null) => void;
}) {
  const [summary, setSummary] = useState<GetAdminOpsSummaryResponse | null>(
    null,
  );
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
  const [selectedRecord, setSelectedRecord] =
    useState<AiReadyIntakeRecord | null>(null);
  const recordWorkbenchPanelRef = useRef<HTMLDivElement | null>(null);
  const recordListScrollPositionRef = useRef(0);

  const aiReadySummary = summary?.aiReadyRecords;
  const sourceTypeOptions = useMemo(
    () =>
      aiReadySummary ? Object.keys(aiReadySummary.bySourceType).sort() : [],
    [aiReadySummary],
  );
  const displayedActiveRecords = records.filter(
    (record) => !isSupersededAiReadyRecord(record),
  );
  const displayedSupersededRecords = records.filter(isSupersededAiReadyRecord);
  const isHistoryMode = statusFilter === "SUPERSEDED";
  const activeRecordFilterCount = [
    searchQuery.trim() !== "",
    statusFilter !== "ACTIVE",
    sourceFilter !== "ALL",
    readinessFilter !== "ALL",
    dateFilter !== "ALL",
    sortOption !== "NEWEST",
  ].filter(Boolean).length;
  const historyFilterCount = [
    searchQuery.trim() !== "",
    sourceFilter !== "ALL",
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

  const loadRecords = useCallback(async () => {
    try {
      setIsRecordsLoading(true);
      setRecordsError(null);
      setRecords([]);
      setRecordTotalCount(0);
      setRecordHasMore(false);

      const response = await listAiReadyIntakeRecords({
        ...getAiReadyCreatedDateRange(dateFilter),
        ...(isHistoryMode
          ? {}
          : getAiReadyExplorerReadinessFilters(readinessFilter)),
        limit: AI_READY_RECORD_PAGE_SIZE,
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
  }, [
    dateFilter,
    isHistoryMode,
    readinessFilter,
    recordOffset,
    searchQuery,
    sortOption,
    sourceFilter,
    statusFilter,
  ]);

  useEffect(() => {
    void loadSummary();
  }, []);

  useEffect(() => {
    if (isRecordWorkbenchOpen) {
      void loadRecords();
    }
  }, [isRecordWorkbenchOpen, loadRecords]);

  useEffect(() => {
    const panel = recordWorkbenchPanelRef.current;

    if (!panel) {
      return;
    }

    panel.scrollTop = selectedRecord ? 0 : recordListScrollPositionRef.current;
  }, [selectedRecord]);

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
    setSelectedRecord(null);
    recordListScrollPositionRef.current = 0;
    setIsRecordWorkbenchOpen(true);
  }

  function openRecordDetail(record: AiReadyIntakeRecord) {
    recordListScrollPositionRef.current =
      recordWorkbenchPanelRef.current?.scrollTop ?? 0;
    setSelectedRecord(record);
  }

  function closeRecordWorkbench() {
    setSelectedRecord(null);
    setIsRecordWorkbenchOpen(false);
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

  function resetHistoryFilters() {
    setSearchDraft("");
    setSearchQuery("");
    setStatusFilter("SUPERSEDED");
    setSourceFilter("ALL");
    setReadinessFilter("ALL");
    setDateFilter("ALL");
    setSortOption("NEWEST");
    setRecordOffset(0);
  }

  function updateStatusFilter(value: AiReadyStatusFilter) {
    setStatusFilter(value);
    if (value === "SUPERSEDED") {
      setReadinessFilter("ALL");
      setSortOption((currentSort) =>
        currentSort === "STATUS" ? "NEWEST" : currentSort,
      );
    }
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
    <section
      className="admin-ops-panel"
      aria-labelledby="admin-ops-records-title"
    >
      <div className="admin-ops-panel-heading">
        <span className="model-route-card__eyebrow">AI-ready records</span>
        <h3 id="admin-ops-records-title">Created record visibility</h3>
        <p>
          Prioritize records that need review, inspect missing fields, and open
          focused workbench views for the records that need action.
        </p>
      </div>

      <div className="admin-ops-mini-metric-grid admin-ops-ai-ready-metric-grid">
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
            detail:
              "Active records that should not move forward without review.",
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
                        <div
                          className="admin-ops-insight-row"
                          key={entry.label}
                        >
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
                      <div
                        className="admin-ops-insight-row"
                        key={entry.sourceType}
                      >
                        <span>{entry.sourceType}</span>
                        <strong>{entry.active} active</strong>
                        <small>
                          {formatAdminOpsPercent(
                            entry.groundingReady,
                            entry.active,
                          )}{" "}
                          ready ·{" "}
                          {formatAdminOpsPercent(
                            entry.reviewNeeded,
                            entry.active,
                          )}{" "}
                          need review
                        </small>
                        <small>
                          {entry.groundingReady} ready / {entry.reviewNeeded}{" "}
                          review
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
          <div
            className="guided-expanded-table-panel admin-ops-record-workbench-panel"
            ref={recordWorkbenchPanelRef}
          >
            <div className="guided-expanded-table-header">
              <div>
                <span className="model-route-card__eyebrow">
                  {selectedRecord
                    ? isHistoryMode
                      ? "Historical record detail"
                      : "AI-ready record detail"
                    : isHistoryMode
                      ? "Historical record audit"
                      : "Expanded record view"}
                </span>
                <h4>
                  {selectedRecord
                    ? formatAiReadyRecordDisplayName(selectedRecord)
                    : isHistoryMode
                      ? "Replaced record history"
                      : "Full AI-ready record workbench"}
                </h4>
                <p>
                  {selectedRecord
                    ? isHistoryMode
                      ? "Inspect the earlier candidate, its replacement context, source evidence, and workflow provenance."
                      : "Review readiness, normalized fields, source evidence, and workflow provenance for this record."
                    : isHistoryMode
                      ? "Audit earlier intake candidates, understand why they were replaced, and trace the authoritative workflow result."
                      : "Search, filter, sort, page through records, and audit active records without treating replaced intake candidates as active issues."}
                </p>
              </div>

              <button
                aria-label="Close AI-ready record workbench"
                className="guided-expanded-table-close-button"
                onClick={closeRecordWorkbench}
                title="Close"
                type="button"
              >
                ×
              </button>
            </div>

            {selectedRecord ? (
              <AdminOpsAiReadyRecordDetail
                onBack={() => setSelectedRecord(null)}
                onOpenReviewQueue={onOpenReviewQueue}
                record={selectedRecord}
              />
            ) : (
              <>
                <div
                  className={
                    isHistoryMode
                      ? "admin-ops-record-controls admin-ops-record-controls--history"
                      : "admin-ops-record-controls"
                  }
                  aria-label={
                    isHistoryMode
                      ? "Replaced history controls"
                      : "AI-ready record controls"
                  }
                >
                  <label className="admin-ops-field admin-ops-field--wide">
                    <span>
                      {isHistoryMode ? "Search history" : "Search records"}
                    </span>
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
                        placeholder={
                          isHistoryMode
                            ? "Brand, product, source, or replacement reason"
                            : "Brand, product, source, status, missing field"
                        }
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

                  {!isHistoryMode ? (
                    <label className="admin-ops-field">
                      <span>Status</span>
                      <select
                        value={statusFilter}
                        onChange={(event) =>
                          updateStatusFilter(
                            event.target.value as AiReadyStatusFilter,
                          )
                        }
                      >
                        {AI_READY_STATUS_FILTERS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label className="admin-ops-field">
                    <span>Source</span>
                    <select
                      value={sourceFilter}
                      onChange={(event) =>
                        updateSourceFilter(event.target.value)
                      }
                    >
                      <option value="ALL">All sources</option>
                      {sourceTypeOptions.map((sourceType) => (
                        <option key={sourceType} value={sourceType}>
                          {formatAiReadySourceTypeLabel(sourceType)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {!isHistoryMode ? (
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
                  ) : null}

                  <label className="admin-ops-field">
                    <span>
                      {isHistoryMode ? "Original record date" : "Created date"}
                    </span>
                    <select
                      value={dateFilter}
                      onChange={(event) =>
                        updateDateFilter(
                          event.target.value as AiReadyDateFilter,
                        )
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
                        updateSortOption(
                          event.target.value as AiReadySortOption,
                        )
                      }
                    >
                      {(isHistoryMode
                        ? AI_READY_HISTORY_SORT_OPTIONS
                        : AI_READY_SORT_OPTIONS
                      ).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    className="admin-ops-clear-button"
                    type="button"
                    onClick={isHistoryMode ? resetHistoryFilters : clearFilters}
                    disabled={
                      isHistoryMode
                        ? historyFilterCount === 0
                        : activeRecordFilterCount === 0
                    }
                  >
                    {isHistoryMode ? "Reset history filters" : "Clear filters"}
                  </button>
                </div>

                {recordsError ? (
                  <p className="admin-ops-error">{recordsError}</p>
                ) : null}

                {isHistoryMode ? (
                  <>
                    {isRecordsLoading ? (
                      <p className="admin-ops-muted">
                        Loading replaced record history...
                      </p>
                    ) : null}

                    {!isRecordsLoading &&
                    !recordsError &&
                    displayedSupersededRecords.length === 0 ? (
                      <div className="admin-ops-history-empty">
                        <strong>No replaced records found</strong>
                        <p>
                          Adjust the history search or filters to see earlier
                          intake candidates.
                        </p>
                      </div>
                    ) : null}

                    {!isRecordsLoading &&
                    !recordsError &&
                    displayedSupersededRecords.length > 0 ? (
                      <AdminOpsAiReadyRecordHistory
                        onInspectRecord={openRecordDetail}
                        records={displayedSupersededRecords}
                        totalCount={recordTotalCount}
                      />
                    ) : null}

                    {recordOffset > 0 || recordHasMore ? (
                      <div className="admin-ops-pagination">
                        <button
                          type="button"
                          onClick={() =>
                            setRecordOffset((currentOffset) =>
                              Math.max(
                                0,
                                currentOffset - AI_READY_RECORD_PAGE_SIZE,
                              ),
                            )
                          }
                          disabled={recordOffset === 0 || isRecordsLoading}
                        >
                          Previous page
                        </button>
                        <span>
                          Page{" "}
                          {Math.floor(
                            recordOffset / AI_READY_RECORD_PAGE_SIZE,
                          ) + 1}{" "}
                          · {records.length} loaded
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRecordOffset(
                              (currentOffset) =>
                                currentOffset + AI_READY_RECORD_PAGE_SIZE,
                            )
                          }
                          disabled={!recordHasMore || isRecordsLoading}
                        >
                          Next page
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    {!isRecordsLoading &&
                    !recordsError &&
                    records.length === 0 ? (
                      <p className="admin-ops-muted">
                        No AI-ready records match the current search and
                        filters.
                      </p>
                    ) : null}

                    <div className="admin-ops-record-summary">
                      Showing {records.length} records on this page.{" "}
                      {recordTotalCount} records match the current search and
                      filters.
                      {activeRecordFilterCount > 0 ? (
                        <span>{activeRecordFilterCount} controls active.</span>
                      ) : null}
                    </div>

                    <div className="admin-ops-pagination">
                      <button
                        type="button"
                        onClick={() =>
                          setRecordOffset((currentOffset) =>
                            Math.max(
                              0,
                              currentOffset - AI_READY_RECORD_PAGE_SIZE,
                            ),
                          )
                        }
                        disabled={recordOffset === 0 || isRecordsLoading}
                      >
                        Previous page
                      </button>
                      <span>
                        Page{" "}
                        {Math.floor(recordOffset / AI_READY_RECORD_PAGE_SIZE) +
                          1}{" "}
                        ·{" "}
                        {isRecordsLoading
                          ? "Loading..."
                          : `${records.length} loaded`}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setRecordOffset(
                            (currentOffset) =>
                              currentOffset + AI_READY_RECORD_PAGE_SIZE,
                          )
                        }
                        disabled={!recordHasMore || isRecordsLoading}
                      >
                        Next page
                      </button>
                    </div>

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
                                            record.reviewNeeded
                                              ? "warning"
                                              : "success"
                                          }
                                        >
                                          {formatAiReadyStatusLabel(
                                            record.status,
                                          )}
                                        </AdminOpsStatusBadge>
                                      </div>
                                    </td>
                                    <td>
                                      <div className="admin-ops-table-stack">
                                        <button
                                          aria-label={`View details for ${formatAiReadyRecordDisplayName(record)}`}
                                          className="admin-ops-record-detail-link"
                                          onClick={() =>
                                            openRecordDetail(record)
                                          }
                                          type="button"
                                        >
                                          {formatAiReadyRecordDisplayName(
                                            record,
                                          )}
                                        </button>
                                        <small>
                                          {formatAiReadyFieldLabel(
                                            normalized.category ?? "",
                                          )}{" "}
                                          · Shaft{" "}
                                          {formatAiReadyFieldLabel(
                                            normalized.shaftFlex ?? "",
                                          )}{" "}
                                          · Condition{" "}
                                          {formatNullable(
                                            normalized.conditionGrade,
                                          )}
                                        </small>
                                      </div>
                                    </td>
                                    <td>
                                      <div className="admin-ops-table-stack">
                                        <strong>
                                          {formatAiReadySourceTypeLabel(
                                            record.sourceType,
                                          )}
                                        </strong>
                                        <small className="admin-ops-source-meta">
                                          <span>{record.sourceName}</span>
                                          <span>
                                            Created{" "}
                                            {formatAdminOpsDate(
                                              record.createdAt,
                                            )}
                                          </span>
                                        </small>
                                      </div>
                                    </td>
                                    <td>
                                      {missingFields.length > 0
                                        ? missingFields
                                            .map(formatAiReadyFieldLabel)
                                            .join(", ")
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
                  </>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
