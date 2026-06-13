import type { GlobalReviewQueueItem, ReviewQueueItem } from "../../types/workflow";
import { DashboardSection } from "../DashboardSection";
import { EmptyState } from "../EmptyState";
import { formatJson } from "../../utils/formatting";
import {
  getGlobalReviewQueueDisplayText,
  getGroundingMatchNamesFromReviewItem,
  getGroundingSummaryFromReviewItem,
  getReviewQueueEvidenceSummary,
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
    if (input.item.status !== "OPEN" && input.item.status !== "IN_REVIEW") {
      return (
        <div className="review-queue-card__review-actions">
          <p className="review-queue-card__meta">
            Human review action recorded. This item is no longer open for queue work.
          </p>
        </div>
      );
    }

    return (
      <div className="review-queue-card__review-actions">
        <p className="review-queue-card__meta">
          Controlled human action. Reviewer notes are recorded before the workflow
          lifecycle is updated.
        </p>

        <label>
          Reviewer Notes
          <textarea
            onChange={(event) =>
              onNotesChange(input.item.id, event.target.value)
            }
            placeholder="Add reviewer notes, corrections, or approval context before resolving or dismissing."
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
              : "Resolve as human-approved"}
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
            Dismiss from workflow
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
          {items.map((item) => {
            const evidence = getReviewQueueEvidenceSummary(item);
            const isClosed =
              item.status === "RESOLVED" || item.status === "DISMISSED";

            return (
              <article className="review-queue-card" key={item.id}>
                <div className="review-queue-card__header">
                  <div>
                    <span className="model-route-card__eyebrow">
                      {isClosed ? "Human review recorded" : "Human review needed"}
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
                    <dt>Proposed club</dt>
                    <dd>{evidence.parsedClubLabel}</dd>
                  </div>

                  <div>
                    <dt>Review reason</dt>
                    <dd>{evidence.reviewReasonSummary ?? item.reason}</dd>
                  </div>

                  <div>
                    <dt>Validation warnings</dt>
                    <dd>
                      {evidence.missingFields.length > 0
                        ? evidence.missingFields.join(", ")
                        : "No missing fields captured."}
                    </dd>
                  </div>

                  <div>
                    <dt>Uncertainty</dt>
                    <dd>
                      {evidence.uncertaintyNotes.length > 0
                        ? evidence.uncertaintyNotes.join(", ")
                        : "No extra uncertainty notes captured."}
                    </dd>
                  </div>

                  <div>
                    <dt>Inventory match</dt>
                    <dd>{evidence.inventoryMatchSummary ?? "No inventory match captured."}</dd>
                  </div>

                  <div>
                    <dt>Demo valuation range</dt>
                    <dd>
                      {evidence.demoValuationRangeSummary ??
                        "No demo valuation range captured."}
                    </dd>
                  </div>

                  <div>
                    <dt>Valuation review reasons</dt>
                    <dd>
                      {evidence.valuationReviewReasons.length > 0
                        ? evidence.valuationReviewReasons.join(", ")
                        : "No valuation review reasons captured."}
                    </dd>
                  </div>

                  <div>
                    <dt>Adjustments</dt>
                    <dd>{evidence.adjustmentSummary}</dd>
                  </div>

                  <div>
                    <dt>Grounding</dt>
                    <dd>{getGroundingSummaryFromReviewItem(item) ?? "—"}</dd>
                  </div>

                  <div>
                    <dt>Possible matches</dt>
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

                  <div>
                    <dt>Suggested next action</dt>
                    <dd>{evidence.suggestedNextAction}</dd>
                  </div>
                </dl>

                <details className="workflow-audit-log-details">
                  <summary>
                    Original raw text
                    <span>collapsed</span>
                  </summary>
                  <div className="review-queue-card__json">
                    <pre>{evidence.rawText}</pre>
                  </div>
                </details>

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
                    Resolution timestamp: {item.resolvedAt}
                  </p>
                ) : null}

                {renderReviewQueueActionControls({
                  item,
                  workflowRunId: item.workflowRunId,
                  intakeBatchId: getReviewQueueItemBatchId(item),
                })}
              </article>
            );
          })}
        </div>
      ) : null}
    </DashboardSection>
  );
}
