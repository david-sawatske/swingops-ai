import { useState } from "react";

import { PassedGatesSection } from "./PassedGatesSection";
import {
  RecordReviewCardView,
  buildCorrectionDraft,
  buildCorrectedRecord,
  buildLearningEvents,
} from "./RecordReviewCardView";
import { ReviewSummaryCards } from "./ReviewSummaryCards";
import { RunLevelAuditSection } from "./RunLevelAuditSection";
import type {
  GuidedValidationReviewStepProps,
  RecordReviewCard,
  ReviewCorrectionDraft,
} from "./validationReviewTypes";
import {
  buildRecordReviewCards,
  isActionableRunLevelValidationCheck,
} from "./validationReviewUtils";

export function GuidedValidationReviewStep({
  actionError,
  actionSuccess,
  activeReviewQueueItemId,
  currentRunReviewQueueItems,
  onContinue,
  onOpenReviewQueue,
  onReviewQueueNotesChange,
  onResolveReviewQueueItemWithCorrections,
  result,
  reviewQueueNotesById,
}: GuidedValidationReviewStepProps) {
  const [editingReviewQueueItemId, setEditingReviewQueueItemId] = useState<string | null>(null);
  const [correctionDraftsByReviewQueueItemId, setCorrectionDraftsByReviewQueueItemId] =
    useState<Record<string, ReviewCorrectionDraft>>({});

  const validationChecks = result?.validationChecks ?? [];
  const retryEvents = result?.retryEvents ?? [];
  const qualitySummary = result?.workflowQualitySummary ?? null;

  const reviewRequiredChecks = validationChecks.filter((check) => check.reviewRequired);
  const unresolvedRetries = retryEvents.filter((event) => event.status === "UNRESOLVED");
  const recordReviewData = result
    ? buildRecordReviewCards(result, currentRunReviewQueueItems)
    : null;
  const recordCards = recordReviewData?.cards ?? [];
  const recordsStillNeedingAttention = recordCards.filter(
    (card) => card.status === "needs-review",
  );
  const recordsResolvedByReview = recordCards.filter(
    (card) => card.status === "resolved",
  );
  const recordsAutoPassed = recordCards.filter((card) => card.status === "ready");
  const activeRecordCards = recordsStillNeedingAttention;
  const reviewedRecordCards = recordsResolvedByReview;
  const passedGateRecordCards = recordsAutoPassed;
  const visibleReviewRecordCards = [...activeRecordCards, ...reviewedRecordCards];
  const shouldOpenPassedGateRecords = activeRecordCards.length === 0;
  const unmappedActionableValidationChecks =
    recordReviewData?.unassignedValidationChecks.filter(
      isActionableRunLevelValidationCheck,
    ) ?? [];
  const unmappedActionableRetryEvents =
    recordReviewData?.unassignedRetryEvents.filter((event) => event.status === "UNRESOLVED") ?? [];
  const unassignedRunLevelSignalCount =
    unmappedActionableValidationChecks.length + unmappedActionableRetryEvents.length;
  const reviewItemsCreatedCount = result?.reviewQueueItemsCreated.length ?? 0;

  function getDraftForCard(card: RecordReviewCard) {
    if (!card.reviewItem) {
      return buildCorrectionDraft(card);
    }

    return (
      correctionDraftsByReviewQueueItemId[card.reviewItem.id] ??
      buildCorrectionDraft(card)
    );
  }

  function setDraftForCard(card: RecordReviewCard, draft: ReviewCorrectionDraft) {
    if (!card.reviewItem) {
      return;
    }

    setCorrectionDraftsByReviewQueueItemId((current) => ({
      ...current,
      [card.reviewItem!.id]: draft,
    }));

    onReviewQueueNotesChange(card.reviewItem.id, draft.reviewerNotes);
  }

  function startEditingCard(card: RecordReviewCard) {
    if (!card.reviewItem) {
      return;
    }

    setCorrectionDraftsByReviewQueueItemId((current) => ({
      ...current,
      [card.reviewItem!.id]:
        current[card.reviewItem!.id] ?? {
          ...buildCorrectionDraft(card),
          reviewerNotes:
            reviewQueueNotesById[card.reviewItem!.id] ??
            buildCorrectionDraft(card).reviewerNotes,
        },
    }));
    setEditingReviewQueueItemId(card.reviewItem.id);
  }

  function submitCorrectionForCard(card: RecordReviewCard) {
    const reviewItem = card.reviewItem;

    if (!result || !reviewItem) {
      return;
    }

    const draft = getDraftForCard(card);
    const correctedRecord = buildCorrectedRecord(draft);
    const learningEvents = buildLearningEvents(card, draft);

    onResolveReviewQueueItemWithCorrections({
      reviewQueueItemId: reviewItem.id,
      request: {
        reviewerNotes: draft.reviewerNotes.trim() || undefined,
        correctedRecord,
        learningEvents,
      },
      workflowRunId: reviewItem.workflowRunId ?? result.persisted.workflowRunId,
      intakeBatchId: result.persisted.intakeBatchId,
    });

    setEditingReviewQueueItemId(null);
  }

  function renderRecordReviewCard(card: RecordReviewCard) {
    return (
      <RecordReviewCardView
        activeReviewQueueItemId={activeReviewQueueItemId}
        card={card}
        correctionDraft={getDraftForCard(card)}
        isEditing={
          card.reviewItem
            ? editingReviewQueueItemId === card.reviewItem.id
            : false
        }
        key={card.id}
        onCancelEditing={() => setEditingReviewQueueItemId(null)}
        onDraftChange={(draft) => setDraftForCard(card, draft)}
        onStartEditing={() => startEditingCard(card)}
        onSubmitCorrection={() => submitCorrectionForCard(card)}
      />
    );
  }

  return (
    <article className="guided-workflow-card guided-workflow-card--validation-review">
      <section className="guided-step-orientation">
        <span className="model-route-card__eyebrow">
          Step 4 · Validation and Human Review
        </span>
        <h3>Which records need attention before the final report?</h3>
        <p>
          This step organizes the workflow evidence by record so you can see what
          passed, what still needs review, and which records need a human decision
          before final output. Deterministic validation identifies the issue.
          Model-assisted and prior-review suggestions remain proposals until a reviewer
          saves a correction.
        </p>

        <div className="guided-step-mini-list" aria-label="Validation and review explanation">
          <article>
            <strong>Input</strong>
            <p>Parsed records, source evidence, tool results, validation checks, retry events, and review items.</p>
          </article>

          <article>
            <strong>Action</strong>
            <p>
              Group evidence by record, identify deterministic validation issues, and
              present suggestions without treating them as approval.
            </p>
          </article>

          <article>
            <strong>Output</strong>
            <p>
              A run-scoped checkpoint showing what can move forward, what needs human
              attention, and which saved corrections became authoritative.
            </p>
          </article>
        </div>
      </section>

      <section className="guided-step-workspace">
        <div className="guided-step-workspace__header">
          <div>
            <span className="model-route-card__eyebrow">Do the work</span>
            <h4>Review the current run by record</h4>
            <p>
              This checkpoint separates records that passed from records that need
              confirmation, correction, or review before the final run report.
            </p>
          </div>
        </div>

        {result && qualitySummary && recordReviewData ? (
          <>
            <ReviewSummaryCards
              qualityStatus={qualitySummary.status}
              recordsResolvedByReviewCount={recordsResolvedByReview.length}
              recordsStillNeedingAttentionCount={recordsStillNeedingAttention.length}
              reviewItemsCreatedCount={reviewItemsCreatedCount}
            />

            {actionSuccess ? (
              <p className="form-message form-message--success">{actionSuccess}</p>
            ) : null}

            {actionError ? (
              <p className="form-message form-message--error">{actionError}</p>
            ) : null}

            <section className="guided-review-checkpoint">
              <div>
                <span className="model-route-card__eyebrow">Review checkpoint</span>
                <h4>
                  {recordsStillNeedingAttention.length === 0
                    ? "All current review work has been handled"
                    : `${recordsStillNeedingAttention.length} record(s) still need review before final reporting`}
                </h4>
                <p>
                  {recordsStillNeedingAttention.length === 0
                    ? "Human review has resolved the current run's review items. The original validation trace remains available for audit context."
                    : `Workflow completed with ${reviewItemsCreatedCount} review item(s). ${recordsResolvedByReview.length} have been resolved and ${recordsStillNeedingAttention.length} still need attention.`}
                </p>
              </div>

              <dl className="guided-review-checkpoint__facts">
                <div>
                  <dt>Still needs attention</dt>
                  <dd>{recordsStillNeedingAttention.length}</dd>
                </div>
                <div>
                  <dt>Resolved by review</dt>
                  <dd>{recordsResolvedByReview.length}</dd>
                </div>
                <div>
                  <dt>Auto-passed records</dt>
                  <dd>{recordsAutoPassed.length}</dd>
                </div>
                <div>
                  <dt>Review items created</dt>
                  <dd>{reviewItemsCreatedCount}</dd>
                </div>
              </dl>

              <div className="guided-original-validation-trace">
                <span className="model-route-card__eyebrow">Original validation trace</span>
                <dl className="guided-review-checkpoint__facts">
                  <div>
                    <dt>Passed checks</dt>
                    <dd>{qualitySummary.validationPassed}</dd>
                  </div>
                  <div>
                    <dt>Warnings</dt>
                    <dd>{qualitySummary.validationWarnings}</dd>
                  </div>
                  <div>
                    <dt>Review-required checks</dt>
                    <dd>{reviewRequiredChecks.length}</dd>
                  </div>
                  <div>
                    <dt>Unresolved retries</dt>
                    <dd>{unresolvedRetries.length}</dd>
                  </div>
                </dl>

                <small>Evidence coverage: {qualitySummary.evidenceCoverage}</small>
              </div>
            </section>

            <section className="guided-validation-section">
              <div className="guided-validation-section__header">
                <div>
                  <h4>Current run review records</h4>
                  <p>
                    Each card shows the normalized record, current review state, source
                    evidence, warning signals, retry outcome, and suggested next action.
                  </p>
                </div>
                <span>{recordsStillNeedingAttention.length} active</span>
              </div>

              <div className="guided-record-review-list">
                {activeRecordCards.length > 0 ? (
                  <div className="guided-record-review-group-label">
                    <span>Needs review</span>
                    <strong>{activeRecordCards.length} active</strong>
                  </div>
                ) : null}

                {visibleReviewRecordCards.map(renderRecordReviewCard)}

                <PassedGatesSection
                  passedGateRecordCards={passedGateRecordCards}
                  renderRecordReviewCard={renderRecordReviewCard}
                  shouldOpenPassedGateRecords={shouldOpenPassedGateRecords}
                />
              </div>
            </section>

            <RunLevelAuditSection
              unassignedRunLevelSignalCount={unassignedRunLevelSignalCount}
              unmappedActionableRetryEvents={unmappedActionableRetryEvents}
              unmappedActionableValidationChecks={unmappedActionableValidationChecks}
            />

            <section className="guided-validation-section">
              <div className="guided-validation-section__header">
                <div>
                  <h4>Current review handoff</h4>
                  <p>
                    The record cards make review work visible before final reporting.
                    Records requiring human approval are resolved through the controlled
                    correction flow. Suggestions remain proposals. Only a saved human
                    correction becomes authoritative and writes reusable learning
                    evidence.
                  </p>
                </div>
                <span>
                  {recordsStillNeedingAttention.length} open ·{" "}
                  {recordsResolvedByReview.length} resolved
                </span>
              </div>

              <div className="guided-review-action-row">
                <button
                  className="guided-step-primary-action"
                  onClick={onContinue}
                  type="button"
                >
                  Continue to Final Run Report
                </button>

                <button
                  className="guided-review-secondary-action"
                  onClick={onOpenReviewQueue}
                  type="button"
                >
                  Open Review Queue
                </button>
              </div>
            </section>
          </>
        ) : (
          <p>Run Step 3 first so this step has workflow evidence to explain.</p>
        )}
      </section>
    </article>
  );
}
