import type { GetAdminOpsSummaryResponse } from "../../types/workflow";
import type { OperationalDataOriginFilter } from "../../types/operationalData";
import {
  AdminOpsMetricCard,
  AdminOpsStatusBadge,
  formatAdminOpsPercent,
} from "./adminOpsPresentation";

const REPORT_SCOPE_OPTIONS: Array<{
  description: string;
  label: string;
  value: OperationalDataOriginFilter;
}> = [
  {
    description:
      "Repeatable, isolated records that demonstrate a representative seven-day operating pattern. No customer activity is included.",
    label: "Synthetic 7-day baseline",
    value: "SEEDED_BASELINE",
  },
  {
    description:
      "Records and execution evidence created through live product flows on this environment.",
    label: "Live demo activity",
    value: "LIVE_DEMO",
  },
  {
    description:
      "A combined view of baseline, live demo, and protected demonstration data.",
    label: "All tracked data",
    value: "ALL",
  },
];

function formatOperationalLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function AdminOpsOperationalBriefing({
  error,
  isLoading,
  onScopeChange,
  scope,
  summary,
}: {
  error: string | null;
  isLoading: boolean;
  onScopeChange: (scope: OperationalDataOriginFilter) => void;
  scope: OperationalDataOriginFilter;
  summary: GetAdminOpsSummaryResponse | null;
}) {
  const scopeOption =
    REPORT_SCOPE_OPTIONS.find((option) => option.value === scope) ??
    REPORT_SCOPE_OPTIONS[0];
  const records = summary?.aiReadyRecords;
  const workflows = summary?.workflowRuns;
  const reviews = summary?.reviewQueue;
  const models = summary?.modelExecutions;
  const tools = summary?.toolActivity;
  const completedRuns = workflows?.byStatus.COMPLETED ?? 0;
  const attentionRuns =
    (workflows?.byStatus.NEEDS_REVIEW ?? 0) + (workflows?.byStatus.FAILED ?? 0);
  const topMissingField = records?.missingFieldHotspots[0] ?? null;
  const topReviewReason = reviews?.reasonHotspots[0] ?? null;
  const sourceWithMostReviewPressure = records
    ? ([...records.sourceQuality]
        .filter((source) => source.active > 0)
        .sort((left, right) => {
          const leftRate = left.reviewNeeded / left.active;
          const rightRate = right.reviewNeeded / right.active;

          return rightRate - leftRate || right.reviewNeeded - left.reviewNeeded;
        })[0] ?? null)
    : null;

  return (
    <section
      aria-labelledby="admin-ops-briefing-title"
      className="admin-ops-briefing"
    >
      <div className="admin-ops-briefing__header">
        <div>
          <span className="model-route-card__eyebrow">Operations briefing</span>
          <h3 id="admin-ops-briefing-title">What needs attention this week?</h3>
          <p>{scopeOption.description}</p>
        </div>

        <label className="admin-ops-scope-control">
          <span>Reporting data</span>
          <select
            aria-label="Admin Ops reporting data"
            disabled={isLoading}
            onChange={(event) =>
              onScopeChange(event.target.value as OperationalDataOriginFilter)
            }
            value={scope}
          >
            {REPORT_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="admin-ops-error">{error}</p> : null}

      <div className="admin-ops-briefing__metrics">
        <AdminOpsMetricCard
          metric={{
            detail: records
              ? `${records.reviewNeeded} still need human review.`
              : "Grounding readiness across active records.",
            label: "Grounding-ready records",
            value: records ? `${records.ragReady} / ${records.active}` : "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: reviews
              ? `${reviews.handled} handled across the retained reporting period.`
              : "Open and in-review queue items.",
            label: "Active review queue",
            value: reviews?.active ?? "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: workflows
              ? `${attentionRuns} need attention or failed.`
              : "Completed workflow runs.",
            label: "Completed workflows",
            value: workflows ? `${completedRuns} / ${workflows.total}` : "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: models
              ? `${models.fallbackCount} recovered through fallback behavior.`
              : "Successful logical model executions.",
            label: "Model execution success",
            value: models ? `${models.executionSuccessRate}%` : "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: tools
              ? `${tools.succeeded} of ${tools.total} tool calls completed.`
              : "Unsafe mutation attempts stopped by policy.",
            label: "Blocked mutations",
            value: tools?.blockedMutations ?? "—",
          }}
        />
      </div>

      {summary ? (
        <div className="admin-ops-briefing__narrative-grid">
          <article className="admin-ops-briefing__narrative admin-ops-briefing__narrative--attention">
            <div className="admin-ops-briefing__narrative-heading">
              <h4>Attention signals</h4>
              <AdminOpsStatusBadge
                tone={reviews?.active ? "warning" : "success"}
              >
                {reviews?.active ? `${reviews.active} active` : "Clear"}
              </AdminOpsStatusBadge>
            </div>
            <ul>
              <li>
                {sourceWithMostReviewPressure
                  ? `${formatOperationalLabel(sourceWithMostReviewPressure.sourceType)} has the highest review pressure: ${sourceWithMostReviewPressure.reviewNeeded} of ${sourceWithMostReviewPressure.active} active records.`
                  : "No source-level review pressure is currently visible."}
              </li>
              <li>
                {topMissingField
                  ? `${formatOperationalLabel(topMissingField.label)} is the most common missing field across ${topMissingField.count} active records.`
                  : "No missing-field hotspot is currently visible."}
              </li>
              <li>
                {topReviewReason
                  ? `${formatOperationalLabel(topReviewReason.label)} is the most common queue reason (${topReviewReason.count}).`
                  : "No review-reason hotspot is currently visible."}
              </li>
            </ul>
          </article>

          <article className="admin-ops-briefing__narrative admin-ops-briefing__narrative--healthy">
            <div className="admin-ops-briefing__narrative-heading">
              <h4>Controls working as designed</h4>
              <AdminOpsStatusBadge tone="success">
                Protected
              </AdminOpsStatusBadge>
            </div>
            <ul>
              <li>
                {models?.validationTrackedCalls
                  ? `${models.validationPassedCalls} of ${models.validationTrackedCalls} model responses passed contract validation.`
                  : "No model contract validations are tracked in this scope."}
              </li>
              <li>
                {tools
                  ? `${tools.blockedMutations} unsafe mutation attempts were blocked; read-only tool success is ${tools.successRate}%.`
                  : "Tool-policy evidence is loading."}
              </li>
              <li>
                {records
                  ? `${records.superseded} replaced records remain available as history instead of appearing as active issues.`
                  : "Replacement-history evidence is loading."}
              </li>
            </ul>
          </article>

          <article className="admin-ops-briefing__narrative admin-ops-briefing__narrative--coverage">
            <div className="admin-ops-briefing__narrative-heading">
              <h4>Store coverage</h4>
              <AdminOpsStatusBadge tone="neutral">
                {records?.storeMix.length ?? 0} locations
              </AdminOpsStatusBadge>
            </div>
            {records?.storeMix.length ? (
              <ul>
                {records.storeMix.map((store) => (
                  <li key={store.label}>
                    {store.label === "Unassigned"
                      ? "Unassigned"
                      : `Store ${store.label}`}
                    : {store.count} active records
                  </li>
                ))}
              </ul>
            ) : (
              <p>No store coverage is currently visible.</p>
            )}
            {reviews ? (
              <small>
                {formatAdminOpsPercent(reviews.handled, reviews.total)} of
                retained review items have been handled.
              </small>
            ) : null}
          </article>
        </div>
      ) : isLoading ? (
        <p className="admin-ops-muted">Loading the operational briefing...</p>
      ) : null}
    </section>
  );
}
