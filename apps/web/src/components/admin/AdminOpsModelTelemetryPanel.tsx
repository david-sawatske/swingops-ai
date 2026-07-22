import { useEffect, useState } from "react";

import { getAdminOpsSummary } from "../../api/workflows";
import type {
  GetAdminOpsSummaryResponse,
  GlobalWorkflowRunSummary,
} from "../../types/workflow";
import {
  AdminOpsMetricCard,
  AdminOpsStatusBadge,
  formatAdminOpsCountLabel,
  formatAdminOpsPercent,
  formatCurrency,
  formatLatency,
  formatNullable,
  formatShortId,
} from "./adminOpsPresentation";

type AdminOpsModelTelemetryTab =
  | "PROVIDER_MIX"
  | "ASSISTANCE"
  | "LATENCY_COST"
  | "VALIDATION";

const ADMIN_OPS_MODEL_TELEMETRY_TABS: {
  label: string;
  value: AdminOpsModelTelemetryTab;
}[] = [
  { label: "Provider mix", value: "PROVIDER_MIX" },
  { label: "Assistance", value: "ASSISTANCE" },
  { label: "Latency and cost", value: "LATENCY_COST" },
  { label: "Reliability", value: "VALIDATION" },
];

export function AdminOpsModelTelemetryPanel({
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
    .filter(
      (
        entry,
      ): entry is {
        run: GlobalWorkflowRunSummary;
        modelCall: NonNullable<
          GlobalWorkflowRunSummary["latestModelCallLog"]
        >;
      } => entry !== null,
    )
    .slice(0, 8);

  const modelExecutions = summary?.modelExecutions;
  const providerModelRows = modelExecutions?.byProviderModel ?? [];
  const providerAttemptRows = modelExecutions?.attempts.byProviderModel ?? [];
  const latencyRows = [...providerModelRows].sort((left, right) => {
    const leftLatency = left.averageLatencyMs ?? Number.MAX_SAFE_INTEGER;
    const rightLatency = right.averageLatencyMs ?? Number.MAX_SAFE_INTEGER;

    return leftLatency - rightLatency;
  });
  const attemptLatencyRows = [...providerAttemptRows].sort((left, right) => {
    const leftLatency = left.averageLatencyMs ?? Number.MAX_SAFE_INTEGER;
    const rightLatency = right.averageLatencyMs ?? Number.MAX_SAFE_INTEGER;

    return leftLatency - rightLatency;
  });
  const attemptReliabilityRows = [...providerAttemptRows].sort(
    (left, right) =>
      right.nonSuccessfulAttemptCount - left.nonSuccessfulAttemptCount ||
      right.attemptCount - left.attemptCount ||
      left.provider.localeCompare(right.provider) ||
      left.model.localeCompare(right.model),
  );
  const assistanceRows = providerModelRows
    .filter((entry) => entry.assistanceCallCount > 0)
    .sort(
      (left, right) =>
        right.assistanceCallCount - left.assistanceCallCount ||
        right.recordOutcomeCount - left.recordOutcomeCount,
    );
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
            label: "Execution success rate",
            value: modelExecutions
              ? `${modelExecutions.executionSuccessRate}%`
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
                    Final provider and model attribution for overall calls.
                    Individual provider-attempt failures are shown in
                    Reliability.
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
                        <strong>
                          {formatAdminOpsCountLabel(entry.callCount, "call")}
                        </strong>
                        <small>
                          {entry.failedCallCount} failed / {entry.fallbackCount}{" "}
                          fallback
                          {entry.assistanceCallCount > 0
                            ? ` · ${entry.assistanceCallCount} assistance call(s)`
                            : ""}
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

            {activeTab === "ASSISTANCE" ? (
              <>
                <div className="admin-ops-insight-card__header">
                  <span>Model review assistance</span>
                  <p>
                    Validated record coverage and outcome distribution for
                    evidence-bound field-repair calls.
                  </p>
                </div>

                <div className="admin-ops-insight-list">
                  <div className="admin-ops-insight-row">
                    <span>Selected-record coverage</span>
                    <strong>
                      {modelExecutions.assistance.outcomeCoverageRate}%
                    </strong>
                    <small>
                      {modelExecutions.assistance.recordOutcomes} accepted
                      outcomes / {modelExecutions.assistance.selectedRecords}{" "}
                      selected records
                    </small>
                  </div>

                  <div className="admin-ops-insight-row">
                    <span>Assistance contract validation</span>
                    <strong>
                      {modelExecutions.assistance.validationTrackedCalls > 0
                        ? `${modelExecutions.assistance.validationPassRate}%`
                        : "Not tracked"}
                    </strong>
                    <small>
                      {modelExecutions.assistance.validationPassedCalls} passed
                      / {modelExecutions.assistance.validationFailedCalls} failed
                    </small>
                  </div>

                  <div className="admin-ops-insight-row">
                    <span>Repair suggested</span>
                    <strong>{modelExecutions.assistance.repairSuggested}</strong>
                    <small>
                      Source-supported field repairs returned for review.
                    </small>
                  </div>

                  <div className="admin-ops-insight-row">
                    <span>Candidate comparison</span>
                    <strong>
                      {modelExecutions.assistance.candidateComparison}
                    </strong>
                    <small>
                      Supplied deterministic candidates requiring confirmation.
                    </small>
                  </div>

                  <div className="admin-ops-insight-row">
                    <span>No safe repair</span>
                    <strong>{modelExecutions.assistance.noSafeRepair}</strong>
                    <small>
                      Records where the model correctly withheld unsupported
                      repair.
                    </small>
                  </div>

                  {assistanceRows.map((entry) => (
                    <div
                      className="admin-ops-insight-row"
                      key={`assistance-${entry.provider}-${entry.model}`}
                    >
                      <span>
                        {entry.provider} / {entry.model}
                      </span>
                      <strong>{entry.outcomeCoverageRate}% coverage</strong>
                      <small>
                        {entry.recordOutcomeCount} outcomes /{" "}
                        {entry.selectedRecordCount} selected ·{" "}
                        {entry.repairSuggestedCount} repair ·{" "}
                        {entry.candidateComparisonCount} compare ·{" "}
                        {entry.noSafeRepairCount} withheld
                      </small>
                    </div>
                  ))}

                  {modelExecutions.assistance.totalCalls === 0 ? (
                    <p className="admin-ops-muted">
                      No persisted model review assistance calls are available
                      yet.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}

            {activeTab === "LATENCY_COST" ? (
              <>
                <div className="admin-ops-insight-card__header">
                  <span>Latency and cost</span>
                  <p>
                    Overall-call attribution and individual provider-attempt
                    latency and estimated cost.
                  </p>
                </div>

                <div className="admin-ops-insight-list">
                  {latencyRows.map((entry) => (
                    <div
                      className="admin-ops-insight-row"
                      key={`call-latency-${entry.provider}-${entry.model}`}
                    >
                      <span>
                        Final call: {entry.provider} / {entry.model}
                      </span>
                      <strong>{formatLatency(entry.averageLatencyMs)}</strong>
                      <small>
                        {formatCurrency(entry.estimatedCostTotal)} estimated ·{" "}
                        {entry.totalTokens.toLocaleString()} tokens
                      </small>
                    </div>
                  ))}

                  {attemptLatencyRows.map((entry) => (
                    <div
                      className="admin-ops-insight-row"
                      key={`attempt-latency-${entry.provider}-${entry.model}`}
                    >
                      <span>
                        Attempt activity: {entry.provider} / {entry.model}
                      </span>
                      <strong>{formatLatency(entry.averageLatencyMs)}</strong>
                      <small>
                        {formatAdminOpsCountLabel(entry.attemptCount, "attempt")}{" "}
                        · {formatCurrency(entry.estimatedCostTotal)} estimated
                      </small>
                    </div>
                  ))}

                  {latencyRows.length === 0 &&
                  attemptLatencyRows.length === 0 ? (
                    <p className="admin-ops-muted">
                      No latency or cost telemetry is available yet.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}

            {activeTab === "VALIDATION" ? (
              <>
                <div className="admin-ops-insight-card__header">
                  <span>Reliability</span>
                  <p>
                    Overall call completion, contract validation, fallback
                    behavior and individual provider-attempt results.
                  </p>
                </div>

                <div className="admin-ops-insight-list">
                  <div className="admin-ops-insight-row">
                    <span>Execution success rate</span>
                    <strong>{modelExecutions.executionSuccessRate}%</strong>
                    <small>
                      {modelExecutions.succeededCalls} succeeded /{" "}
                      {modelExecutions.failedCalls} failed
                    </small>
                  </div>

                  <div className="admin-ops-insight-row">
                    <span>Contract validation pass rate</span>
                    <strong>
                      {modelExecutions.validationTrackedCalls > 0
                        ? `${modelExecutions.validationPassRate}%`
                        : "Not tracked"}
                    </strong>
                    <small>
                      {modelExecutions.validationPassedCalls} passed /{" "}
                      {modelExecutions.validationFailedCalls} failed across
                      tracked validation calls
                    </small>
                  </div>

                  <div className="admin-ops-insight-row">
                    <span>Fallback rate</span>
                    <strong>{modelExecutions.fallbackRate}%</strong>
                    <small>
                      {formatAdminOpsCountLabel(
                        modelExecutions.fallbackCount,
                        "call",
                      )}{" "}
                      with fallback or non-success attempt signals
                    </small>
                  </div>

                  <div className="admin-ops-insight-row">
                    <span>Provider attempt success rate</span>
                    <strong>
                      {modelExecutions.attempts.totalAttempts > 0
                        ? `${modelExecutions.attempts.attemptSuccessRate}%`
                        : "Not tracked"}
                    </strong>
                    <small>
                      {modelExecutions.attempts.successfulAttempts} successful /{" "}
                      {modelExecutions.attempts.nonSuccessfulAttempts}{" "}
                      non-successful across{" "}
                      {formatAdminOpsCountLabel(
                        modelExecutions.attempts.totalAttempts,
                        "attempt",
                      )}
                    </small>
                  </div>

                  {attemptReliabilityRows.map((entry) => (
                    <div
                      className="admin-ops-insight-row"
                      key={`attempt-reliability-${entry.provider}-${entry.model}`}
                    >
                      <span>
                        Provider attempts: {entry.provider} / {entry.model}
                      </span>
                      <strong>
                        {entry.successfulAttemptCount}/{entry.attemptCount}{" "}
                        successful
                      </strong>
                      <small>
                        {entry.nonSuccessfulAttemptCount} non-successful ·{" "}
                        {formatLatency(entry.averageLatencyMs)} average
                        {entry.latestFailureMessage
                          ? ` · Latest failure: ${entry.latestFailureMessage}`
                          : ""}
                      </small>
                    </div>
                  ))}

                  {validationRows.slice(0, 5).map((entry) => (
                    <div
                      className="admin-ops-insight-row"
                      key={`${entry.provider}-${entry.model}`}
                    >
                      <span>
                        Final call: {entry.provider} / {entry.model}
                      </span>
                      <strong>
                        {entry.validationTrackedCallCount > 0
                          ? `${entry.validationPassRate}% validated`
                          : `${formatAdminOpsPercent(
                              entry.callCount - entry.failedCallCount,
                              entry.callCount,
                            )} executed`}
                      </strong>
                      <small>
                        {entry.failedCallCount} execution failed /{" "}
                        {entry.fallbackCount} fallback ·{" "}
                        {entry.validationPassedCallCount}/
                        {entry.validationTrackedCallCount} contract valid
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
                      tone={
                        modelCall.status === "SUCCEEDED" ? "success" : "warning"
                      }
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
