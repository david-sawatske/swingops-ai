import { useEffect, useMemo, useState } from "react";

import {
  getAdminOpsNormalizationMatrix,
  listAiReadyIntakeRecords,
} from "../../api/workflows";
import type {
  AdminOpsNormalizationMatrixEntry,
  AiReadyIntakeRecord,
  GlobalWorkflowRunSummary,
} from "../../types/workflow";
import { WorkflowQualityChecksPage } from "../workflow-evals/WorkflowQualityChecksPage";

type AdminOpsMetric = {
  label: string;
  value: string | number;
  detail: string;
};

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
    id: "admin-ops-config-title",
    title: "Workflow config",
    body: "Read-only execution and safety policy.",
  },
  {
    id: "admin-ops-knowledge-title",
    title: "Knowledge grounding",
    body: "Seed data and grounding coverage.",
  },
] as const;

const WORKFLOW_CONFIG_ITEMS = [
  {
    label: "Model output authority",
    value: "Secondary",
    detail:
      "Model repair can suggest values, but deterministic parsing, reference data, grounding, and review decisions stay higher authority.",
  },
  {
    label: "Fallback behavior",
    value: "MOCK available",
    detail:
      "Provider execution can fall back to deterministic mock behavior when real providers are disabled or fail validation.",
  },
  {
    label: "Mutation policy",
    value: "Read-only tools",
    detail:
      "Admin visibility does not allow unsafe tool mutation or bypass human review requirements.",
  },
  {
    label: "Review routing",
    value: "Always active",
    detail:
      "Missing, ambiguous, low-confidence, or blocked repair evidence stays review-facing.",
  },
] as const;

const KNOWLEDGE_STATUS_ITEMS = [
  {
    label: "Seed knowledge",
    value: "Visible through workflow grounding",
    detail:
      "Grounding supports matching and explanation, but does not replace deterministic normalization rules.",
  },
  {
    label: "Ingestion",
    value: "Demo-managed",
    detail:
      "Knowledge ingestion remains handled by existing demo routes and workflow setup.",
  },
  {
    label: "Future expansion",
    value: "Golf term coverage",
    detail:
      "Admin Ops can later show seed coverage for utility woods, mini drivers, fairway woods, hybrids, and wedge lofts.",
  },
] as const;

function AdminOpsMetricCard({ metric }: { metric: AdminOpsMetric }) {
  return (
    <article className="admin-ops-metric-card">
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      <p>{metric.detail}</p>
    </article>
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

function AdminOpsAiReadyRecordsPanel() {
  const [records, setRecords] = useState<AiReadyIntakeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadRecords() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await listAiReadyIntakeRecords({ limit: 12 });

      setRecords(response.records);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load AI-ready records.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords();
  }, []);

  const reviewNeededCount = records.filter((record) => record.reviewNeeded).length;
  const ragReadyCount = records.filter((record) => record.ragReady).length;

  return (
    <section className="admin-ops-panel" aria-labelledby="admin-ops-records-title">
      <div className="admin-ops-panel-heading">
        <span className="model-route-card__eyebrow">AI-ready records</span>
        <h3 id="admin-ops-records-title">Created record visibility</h3>
        <p>
          Shows the latest structured records created by source intake and run-scoped
          workflow output, including review state, RAG readiness, missing fields, and
          source references.
        </p>
      </div>

      <div className="admin-ops-mini-metric-grid">
        <AdminOpsMetricCard
          metric={{
            detail: "Most recent records returned from the current record API.",
            label: "Displayed records",
            value: records.length,
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Records that should not move forward without review.",
            label: "Need review",
            value: reviewNeededCount,
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Records marked ready for grounding workflows.",
            label: "RAG-ready",
            value: ragReadyCount,
          }}
        />
      </div>

      {isLoading ? (
        <p className="admin-ops-muted">Loading AI-ready records...</p>
      ) : null}

      {error ? <p className="admin-ops-error">{error}</p> : null}

      {!isLoading && !error && records.length === 0 ? (
        <p className="admin-ops-muted">
          No AI-ready records found yet. Run the main workflow to create records.
        </p>
      ) : null}

      {records.length > 0 ? (
        <div className="admin-ops-table-wrap">
          <table className="admin-ops-table admin-ops-table--dense">
            <thead>
              <tr>
                <th>Status</th>
                <th>Record</th>
                <th>Source</th>
                <th>Missing fields</th>
                <th>References</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const normalized = record.normalizedJson;
                const missingFields = normalized.missingFields ?? [];

                return (
                  <tr key={record.id} className="admin-ops-table-row-card">
                    <td>
                      <div className="admin-ops-table-stack">
                        <AdminOpsStatusBadge
                          tone={record.reviewNeeded ? "warning" : "success"}
                        >
                          {record.status}
                        </AdminOpsStatusBadge>
                        <small>
                          Review: {record.reviewNeeded ? "Yes" : "No"} · RAG:{" "}
                          {record.ragReady ? "Ready" : "Not ready"}
                        </small>
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
                          {formatNullable(normalized.shaftFlex)} · Condition{" "}
                          {formatNullable(normalized.conditionGrade)}
                        </small>
                      </div>
                    </td>
                    <td>
                      <div className="admin-ops-table-stack">
                        <strong>{record.sourceType}</strong>
                        <small>{record.sourceName}</small>
                      </div>
                    </td>
                    <td>
                      {missingFields.length > 0
                        ? missingFields.join(", ")
                        : "None"}
                    </td>
                    <td>
                      <div className="admin-ops-reference-list">
                        <small title={record.workflowRunId ?? undefined}>
                          run: {formatShortId(record.workflowRunId)}
                        </small>
                        <small title={record.intakeBatchId ?? undefined}>
                          batch: {formatShortId(record.intakeBatchId)}
                        </small>
                        <small title={record.intakeItemId ?? undefined}>
                          item: {formatShortId(record.intakeItemId)}
                        </small>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
  const modelCalls = workflowRuns
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
    } => entry !== null);

  const totalCost = modelCalls.reduce(
    (sum, entry) => sum + (entry.modelCall.estimatedCostUsd ?? 0),
    0,
  );
  const trackedLatencyCalls = modelCalls.filter(
    (entry) => entry.modelCall.latencyMs !== null,
  );
  const averageLatency =
    trackedLatencyCalls.length > 0
      ? Math.round(
          trackedLatencyCalls.reduce(
            (sum, entry) => sum + (entry.modelCall.latencyMs ?? 0),
            0,
          ) / trackedLatencyCalls.length,
        )
      : null;
  const failedCalls = modelCalls.filter(
    (entry) => entry.modelCall.status === "FAILED",
  ).length;
  const fallbackAttemptCount = modelCalls.reduce(
    (count, entry) =>
      count +
      (entry.modelCall.attemptLogs?.filter(
        (attempt) => attempt.status !== "SUCCESS" && attempt.status !== "SUCCEEDED",
      ).length ?? 0),
    0,
  );

  return (
    <section className="admin-ops-panel" aria-labelledby="admin-ops-model-title">
      <div className="admin-ops-panel-heading">
        <span className="model-route-card__eyebrow">Model telemetry</span>
        <h3 id="admin-ops-model-title">Cost, latency, fallback, and status</h3>
        <p>
          Uses the latest model call attached to each workflow run so provider
          execution remains visible before adding deeper aggregate admin routes.
        </p>
      </div>

      <div className="admin-ops-mini-metric-grid">
        <AdminOpsMetricCard
          metric={{
            detail: "Runs with a latest persisted model call.",
            label: "Visible calls",
            value: modelCalls.length,
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Average across calls with tracked latency.",
            label: "Avg latency",
            value: averageLatency === null ? "Not tracked" : `${averageLatency} ms`,
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Estimated provider cost across visible calls.",
            label: "Estimated cost",
            value: formatCurrency(totalCost),
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Failed latest calls across displayed workflow runs.",
            label: "Failed calls",
            value: failedCalls,
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Non-success attempts captured inside visible model calls.",
            label: "Fallback signals",
            value: fallbackAttemptCount,
          }}
        />
      </div>

      {modelCalls.length === 0 ? (
        <p className="admin-ops-muted">
          No model telemetry found yet. Run the main workflow with field repair
          enabled to capture provider execution evidence.
        </p>
      ) : (
        <div className="admin-ops-table-wrap">
          <table className="admin-ops-table admin-ops-table--dense">
            <thead>
              <tr>
                <th>Run</th>
                <th>Provider / model</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Cost</th>
                <th>Tokens</th>
              </tr>
            </thead>
            <tbody>
              {modelCalls.slice(0, 10).map(({ run, modelCall }) => (
                <tr key={modelCall.id} className="admin-ops-table-row-card">
                  <td>
                    <div className="admin-ops-table-stack">
                      <strong>{run.workflowName}</strong>
                      <small title={run.id}>{formatShortId(run.id)}</small>
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
  const [entries, setEntries] = useState<AdminOpsNormalizationMatrixEntry[]>([]);
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

  return (
    <section className="admin-ops-panel" aria-labelledby="admin-ops-normalization-title">
      <div className="admin-ops-panel-heading">
        <span className="model-route-card__eyebrow">Normalization matrix</span>
        <h3 id="admin-ops-normalization-title">
          Structured golf term controls
        </h3>
        <p>
          Displays deterministic aliases, negative evidence, context requirements,
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
      </div>

      {isLoading ? (
        <p className="admin-ops-muted">Loading normalization matrix...</p>
      ) : null}

      {error ? <p className="admin-ops-error">{error}</p> : null}

      {entries.length > 0 ? (
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
              {entries.map((entry) => (
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

function AdminOpsConfigPanel() {
  return (
    <section className="admin-ops-panel" aria-labelledby="admin-ops-config-title">
      <div className="admin-ops-panel-heading">
        <span className="model-route-card__eyebrow">Workflow configuration</span>
        <h3 id="admin-ops-config-title">Read-only guarded workflow policy</h3>
        <p>
          This first admin slice displays active safety posture without allowing
          free-form configuration changes that could bypass review, validation, or
          tool safety.
        </p>
      </div>

      <div className="admin-ops-config-grid">
        {WORKFLOW_CONFIG_ITEMS.map((item) => (
          <article className="admin-ops-config-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminOpsKnowledgePanel() {
  return (
    <section
      className="admin-ops-panel"
      aria-labelledby="admin-ops-knowledge-title"
    >
      <div className="admin-ops-panel-heading">
        <span className="model-route-card__eyebrow">Knowledge grounding</span>
        <h3 id="admin-ops-knowledge-title">Seed data and grounding visibility</h3>
        <p>
          Grounding should support evidence and explanations while deterministic
          normalization and review routing keep final structured values controlled.
        </p>
      </div>

      <div className="admin-ops-config-grid">
        {KNOWLEDGE_STATUS_ITEMS.map((item) => (
          <article className="admin-ops-config-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
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
          workflow configuration, grounding, review routing, and auditability
          from one read-only control surface.
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
            Run scenario checks from the Admin Ops surface so parser behavior,
            review routing, prior correction suggestions, and workflow quality
            stay connected to the broader control view.
          </p>
        </div>

        <WorkflowQualityChecksPage />
      </section>

      <AdminOpsModelTelemetryPanel workflowRuns={workflowRuns} />

      <AdminOpsNormalizationMatrixPanel />

      <AdminOpsConfigPanel />

      <AdminOpsKnowledgePanel />
    </section>
  );
}
