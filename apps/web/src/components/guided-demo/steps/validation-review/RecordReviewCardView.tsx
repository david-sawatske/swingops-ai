import { useEffect, useRef } from "react";

import {
  ModelReviewAssistancePanel,
  RecordCorrectionPanel,
} from "./RecordReviewCorrectionSections";
import {
  PassedRecordReviewSummary,
  RecordEvidenceDetails,
  RecordReviewSignalDetails,
  RecordValidationDetails,
} from "./RecordReviewEvidenceSections";
import {
  applyModelReviewSuggestionToDraft,
  canApplyModelReviewSuggestion,
  canResolveWithModelReviewSuggestion,
  getRecordCardSummary,
  type ModelReviewSuggestion,
} from "./recordReviewCorrectionUtils";
import type {
  RecordReviewCard,
  ReviewCorrectionDraft,
} from "./validationReviewTypes";
import { getRecordStatusClassName } from "./validationReviewUtils";

export {
  applyModelReviewSuggestionToDraft,
  buildCorrectedRecord,
  buildCorrectionDraft,
  buildLearningEvents,
  canApplyModelReviewSuggestion,
  canResolveWithModelReviewSuggestion,
  canResolveWithPriorReviewSuggestion,
  getAppliedCorrectionSummaries,
  getBlockingCorrectionFields,
  getInventoryProductLineCandidates,
  getOpenPriorReviewSuggestions,
  getRecordCardSummary,
  isPriorReviewSuggestionLoadedInDraft,
  isSourceSupportedProductCatalogConfirmation,
  isStoreInspectionRequired,
} from "./recordReviewCorrectionUtils";

export function RecordReviewCardView({
  activeReviewQueueItemId,
  card,
  correctionDraft,
  isEditing,
  onCancelEditing,
  onDraftChange,
  onRouteForInspection,
  onStartEditing,
  onSubmitCorrection,
}: {
  activeReviewQueueItemId: string | null;
  card: RecordReviewCard;
  correctionDraft: ReviewCorrectionDraft;
  isEditing: boolean;
  onCancelEditing: () => void;
  onDraftChange: (draft: ReviewCorrectionDraft) => void;
  onRouteForInspection: () => void;
  onStartEditing: () => void;
  onSubmitCorrection: (draftOverride?: ReviewCorrectionDraft) => void;
}) {
  const canApplyModelSuggestion = canApplyModelReviewSuggestion(card);
  const isSaving = activeReviewQueueItemId === card.reviewItem?.id;
  const cardDetailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    if (card.status === "resolved" && cardDetailsRef.current) {
      cardDetailsRef.current.open = false;
    }
  }, [card.status]);

  function getModelSuggestionDraft(suggestion: ModelReviewSuggestion) {
    return applyModelReviewSuggestionToDraft(correctionDraft, suggestion);
  }

  function handleAcceptModelSuggestion(suggestion: ModelReviewSuggestion) {
    if (
      !canApplyModelSuggestion ||
      !canResolveWithModelReviewSuggestion(card, correctionDraft, suggestion)
    ) {
      return;
    }

    const nextDraft = getModelSuggestionDraft(suggestion);
    onDraftChange(nextDraft);
    onSubmitCorrection(nextDraft);
  }

  function handleEditModelSuggestion(suggestion: ModelReviewSuggestion) {
    if (!canApplyModelReviewSuggestion(card)) {
      return;
    }

    onDraftChange(getModelSuggestionDraft(suggestion));

    if (!isEditing) {
      onStartEditing();
    }
  }

  return (
    <details
      aria-label={`${card.label} review record`}
      className="guided-record-review-card"
      open={isEditing}
      ref={cardDetailsRef}
    >
      <summary className="guided-record-review-card__header">
        <div>
          <span className="model-route-card__eyebrow">
            Record {card.index + 1}
          </span>
          <h4>{card.label}</h4>
          <p className="guided-record-review-card__summary-line">
            {getRecordCardSummary(card)}
          </p>
        </div>
        <span className={getRecordStatusClassName(card.status)}>
          {card.statusLabel}
        </span>
      </summary>

      <div className="guided-record-review-card__content">
        {card.modelReviewOutcome ? (
          <ModelReviewAssistancePanel
            canResolveSuggestion={
              canApplyModelSuggestion
                ? (suggestion) =>
                    canResolveWithModelReviewSuggestion(
                      card,
                      correctionDraft,
                      suggestion,
                    )
                : null
            }
            isSaving={isSaving}
            onAcceptAndResolve={
              canApplyModelSuggestion ? handleAcceptModelSuggestion : null
            }
            onEditSuggestion={
              canApplyModelSuggestion ? handleEditModelSuggestion : null
            }
            onRequestManualCorrection={
              canApplyModelSuggestion ? onStartEditing : null
            }
            outcome={card.modelReviewOutcome}
          />
        ) : null}

        {card.status === "ready" ? (
          <PassedRecordReviewSummary card={card} />
        ) : (
          <>
            {isEditing || !canApplyModelSuggestion ? (
              <RecordCorrectionPanel
                activeReviewQueueItemId={activeReviewQueueItemId}
                card={card}
                draft={correctionDraft}
                isEditing={isEditing}
                onCancelEditing={onCancelEditing}
                onDraftChange={onDraftChange}
                onRouteForInspection={onRouteForInspection}
                onStartEditing={onStartEditing}
                onSubmit={onSubmitCorrection}
              />
            ) : null}

            <RecordEvidenceDetails card={card} />
            <RecordReviewSignalDetails card={card} />
            <RecordValidationDetails card={card} />
          </>
        )}
      </div>
    </details>
  );
}
