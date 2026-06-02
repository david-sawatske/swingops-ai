import type { GlobalReviewQueueItem, ReviewQueueItem } from "../../types/workflow";
import { DashboardSection } from "../DashboardSection";
import { EmptyState } from "../EmptyState";
import { formatJson } from "../../utils/formatting";
import {
  getGlobalReviewQueueDisplayText,
  getGroundingMatchNamesFromReviewItem,
  getGroundingSummaryFromReviewItem,
  getReviewQueueItemBatchId,
} from "../../utils/reviewQueueDisplay";

export function ReviewQueuePage({
  items,
  openReviewQueueItemCount,
  isLoading,
  error,
  actionSuccess,
  actionError,
  activeReviewQueueItemId,
  reviewQueueNotesById,
  onNotesChange,
  onReviewQueueItemAction,
}: {
  items: GlobalReviewQueueItem[];
  openReviewQueueItemCount: number;
  isLoading: boolean;
  error: string | null;
  actionSuccess: string | null;
  actionError: string | null;
  activeReviewQueueItemId: string | null;
  reviewQueueNotesById: Record<string, string>;
  onNotesChange: (reviewQueueItemId: string, reviewerNotes: string) => void;
  onReviewQueueItemAction: (input: {
    reviewQueueItemId: string;
    action: "resolve" | "dismiss";
    workflowRunId?: string | null;
    intakeBatchId?: string | null;
  }) => void;
}) {
  function renderReviewQueueActionControls(input: {
    item: ReviewQueueItem;
    workflowRunId?: string | null;
    intakeBatchId?: string | null;
  }) {
    if (input.item.status !== "OPEN") {
      return null;
    }

    return (
      <div className="review-queue-card__review-actions">
        <label>
          Reviewer Notes
          <textarea
            onChange={(event) =>
              onNotesChange(input.item.id, event.target.value)
            }
            placeholder="Add reviewer notes before resolving or dismissing."
            rows={3}
            value={reviewQueueNotesById[input.item.id] ?? ""}
          />
        </label>

        <div className="workflow-run-card__actions">
          <button
            disabled={activeReviewQueueItemId === input.item.id}
            onClick={() =>
              onReviewQueueItemAction({
                reviewQueueItemId: input.item.id,
                action: "resolve",
                workflowRunId: input.workflowRunId ?? input.item.workflowRunId,
                intakeBatchId: input.intakeBatchId ?? null,
              })
            }
            type="button"
          >
            {activeReviewQueueItemId === input.item.id
              ? "Updating…"
              : "Resolve"}
          </button>

          <button
            disabled={activeReviewQueueItemId === input.item.id}
            onClick={() =>
              onReviewQueueItemAction({
                reviewQueueItemId: input.item.id,
                action: "dismiss",
                workflowRunId: input.workflowRunId ?? input.item.workflowRunId,
                intakeBatchId: input.intakeBatchId ?? null,
              })
            }
            type="button"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <DashboardSection
      title="Global Review Queue"
      description="All human-in-the-loop review work across workflow runs."
    >
      {!isLoading && !error ? (
        <p className="section-summary">
          {openReviewQueueItemCount} open review{" "}
          {openReviewQueueItemCount === 1 ? "item" : "items"} /{" "}
          {items.length} total
        </p>
      ) : null}

      {actionSuccess ? (
        <p className="form-message form-message--success">
          {actionSuccess}
        </p>
      ) : null}

      {actionError ? (
        <p className="form-message form-message--error">
          {actionError}
        </p>
      ) : null}

      {isLoading ? <p>Loading review queue…</p> : null}

      {error ? (
        <EmptyState title="Unable to load review queue" message={error} />
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <EmptyState
          title="No review work queued"
          message="Run a needs-review workflow simulation to create human review items."
        />
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <div className="review-queue-list">
          {items.map((item) => (
            <article className="review-queue-card" key={item.id}>
              <div className="review-queue-card__header">
                <div>
                  <span className="model-route-card__eyebrow">
                    {item.status}
                  </span>
                  <h3>{item.reason}</h3>
                  <p>
                    <strong>Source:</strong>{" "}
                    {getGlobalReviewQueueDisplayText(item)}
                  </p>
                </div>

                <span className="review-queue-card__status">
                  {item.status}
                </span>
              </div>

              <dl className="review-queue-card__context">
                <div>
                  <dt>Reason</dt>
                  <dd>{item.reason}</dd>
                </div>

                <div>
                  <dt>Grounding</dt>
                  <dd>{getGroundingSummaryFromReviewItem(item) ?? "—"}</dd>
                </div>

                <div>
                  <dt>Possible Matches</dt>
                  <dd>{getGroundingMatchNamesFromReviewItem(item)}</dd>
                </div>

                <div>
                  <dt>Batch</dt>
                  <dd>{item.intakeBatch?.name ?? "—"}</dd>
                </div>

                <div>
                  <dt>Workflow</dt>
                  <dd>{item.workflowRun?.workflowName ?? "—"}</dd>
                </div>

                <div>
                  <dt>Run Status</dt>
                  <dd>{item.workflowRun?.status ?? "—"}</dd>
                </div>
              </dl>

              <details className="workflow-audit-log-details">
                <summary>
                  Proposed Golf Club JSON
                  <span>collapsed</span>
                </summary>
                <div className="review-queue-card__json">
                  <pre>{formatJson(item.proposedGolfClubJson)}</pre>
                </div>
              </details>

              {item.reviewerNotes ? (
                <p className="review-queue-card__meta">
                  Reviewer notes: {item.reviewerNotes}
                </p>
              ) : null}

              {item.resolvedAt ? (
                <p className="review-queue-card__meta">
                  Resolved at: {item.resolvedAt}
                </p>
              ) : null}

              {renderReviewQueueActionControls({
                item,
                workflowRunId: item.workflowRunId,
                intakeBatchId: getReviewQueueItemBatchId(item),
              })}
            </article>
          ))}
        </div>
      ) : null}
    </DashboardSection>
  );
}
