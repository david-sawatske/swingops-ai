import { getNeedsReviewWorkflowRunSummary } from "../../utils/workflowDisplay";

export function OverviewPage({
  intakeBatchCount,
  workflowRunCount,
  openReviewQueueItemCount,
  toolCallLogCount,
  needsReviewWorkflowRunCount,
}: {
  intakeBatchCount: number;
  workflowRunCount: number;
  openReviewQueueItemCount: number;
  toolCallLogCount: number;
  needsReviewWorkflowRunCount: number;
}) {
  return (
    <section className="overview-page" aria-labelledby="overview-heading">
      <div className="overview-hero-card">
        <span className="model-route-card__eyebrow">Portfolio Demo</span>
        <h2 id="overview-heading">
          From messy trade-in notes to governed AI workflow execution
        </h2>
        <p>
          This demo shows how an agentic operations system can ingest
          inconsistent golf retail notes, start auditable workflow runs,
          route model work across providers, create human review tasks, and
          expose internal tools through a guarded MCP-compatible connector layer.
        </p>
      </div>

      <div className="overview-metric-grid">
        <article>
          <span>{intakeBatchCount}</span>
          <strong>Intake Batches</strong>
          <p>Messy golf trade-in inputs ready for workflow processing.</p>
        </article>

        <article>
          <span>{workflowRunCount}</span>
          <strong>Workflow Runs</strong>
          <p>Queued, completed, failed, and review-needed orchestration runs.</p>
        </article>

        <article>
          <span>{openReviewQueueItemCount}</span>
          <strong>Open Review Items</strong>
          <p>Human-in-the-loop checkpoints for uncertain structured output.</p>
        </article>

        <article>
          <span>{toolCallLogCount}</span>
          <strong>Tool Audit Logs</strong>
          <p>Persisted records for planned or executed connector/tool calls.</p>
        </article>
      </div>

      <div className="overview-story-grid">
        <article>
          <span>01</span>
          <h3>Messy Intake</h3>
          <p>Import raw golf trade-in notes, CSV-like rows, email text, or manual entries.</p>
        </article>

        <article>
          <span>02</span>
          <h3>Workflow Orchestration</h3>
          <p>Start workflow runs, simulate execution paths, and inspect step-level outcomes.</p>
        </article>

        <article>
          <span>03</span>
          <h3>Model Routing</h3>
          <p>Route model work based on cost, latency, quality, JSON support, and provider availability.</p>
        </article>

        <article>
          <span>04</span>
          <h3>Human Review</h3>
          <p>Send uncertain outputs to a review queue before operational data is trusted.</p>
        </article>

        <article>
          <span>05</span>
          <h3>MCP-compatible Tool Safety</h3>
          <p>Expose internal data through read-only tools with policy checks before execution.</p>
        </article>

        <article>
          <span>06</span>
          <h3>Audit Trail</h3>
          <p>Persist model route logs and tool invocation logs for explainability and review.</p>
        </article>
      </div>

      <div className="overview-callout">
        <strong>{getNeedsReviewWorkflowRunSummary(needsReviewWorkflowRunCount)}</strong>
        <p>
          Use the Intake, Workflow Runs, Review Queue, Model Routing, and MCP
          Connectors tabs to walk through the system like a product demo
          instead of a developer test harness.
        </p>
      </div>
    </section>
  );
}
