type AdminOpsMetric = {
  label: string;
  value: string | number;
  detail: string;
};

function AdminOpsMetricCard({ metric }: { metric: AdminOpsMetric }) {
  return (
    <article className="admin-ops-metric-card">
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      <p>{metric.detail}</p>
    </article>
  );
}

const ADMIN_OPS_SECTIONS = [
  {
    title: "AI-ready records",
    body:
      "Review created records, source intake candidates, run-scoped records, missing fields, and review status.",
  },
  {
    title: "Validation & Quality Checks",
    body:
      "Keep parser, repair, review routing, and protected workflow behaviors visible from one operations surface.",
  },
  {
    title: "Model telemetry",
    body:
      "Compare provider execution, fallback, latency, estimated cost, validation status, and repair outcomes.",
  },
  {
    title: "Normalization matrix",
    body:
      "Show deterministic golf term aliases, negative evidence, and blocked repair rules before model output is trusted.",
  },
  {
    title: "Workflow configuration",
    body:
      "Display confidence thresholds, provider routing policy, validation rules, fallback behavior, and mutation safety.",
  },
  {
    title: "Knowledge grounding",
    body:
      "Inspect seed knowledge, ingestion status, and grounding coverage without replacing deterministic normalization.",
  },
] as const;

export function AdminOpsDashboardPage({
  workflowRunCount,
  openReviewQueueItemCount,
  toolCallLogCount,
}: {
  workflowRunCount: number;
  openReviewQueueItemCount: number;
  toolCallLogCount: number;
}) {
  const metrics: AdminOpsMetric[] = [
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
  ];

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

      <section
        className="admin-ops-section-grid"
        aria-label="Admin Ops dashboard sections"
      >
        {ADMIN_OPS_SECTIONS.map((section) => (
          <article className="admin-ops-section-card" key={section.title}>
            <h3>{section.title}</h3>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
