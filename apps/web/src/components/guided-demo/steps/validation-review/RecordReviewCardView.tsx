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
  getAppliedCorrectionSummaries,
  getBlockingCorrectionFields,
  getInventoryProductLineCandidates,
  getOpenPriorReviewSuggestions,
  getRecordCardSummary,
  isPriorReviewSuggestionLoadedInDraft,
} from "./recordReviewCorrectionUtils";

export function RecordReviewCardView({
  activeReviewQueueItemId,
  card,
  correctionDraft,
  isEditing,
  onCancelEditing,
  onDraftChange,
  onStartEditing,
  onSubmitCorrection,
}: {
  activeReviewQueueItemId: string | null;
  card: RecordReviewCard;
  correctionDraft: ReviewCorrectionDraft;
  isEditing: boolean;
  onCancelEditing: () => void;
  onDraftChange: (draft: ReviewCorrectionDraft) => void;
  onStartEditing: () => void;
  onSubmitCorrection: () => void;
}) {
  function handleApplyModelSuggestion(suggestion: ModelReviewSuggestion) {
    if (!canApplyModelReviewSuggestion(card)) {
      return;
    }

    onDraftChange(
      applyModelReviewSuggestionToDraft(correctionDraft, suggestion),
    );

    if (!isEditing) {
      onStartEditing();
    }
  }

  return (
    <details
      aria-label={`${card.label} review record`}
      className="guided-record-review-card"
      open={isEditing}
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
            onApplySuggestion={
              canApplyModelReviewSuggestion(card)
                ? handleApplyModelSuggestion
                : null
            }
            outcome={card.modelReviewOutcome}
          />
        ) : null}

        {card.status === "ready" ? (
          <PassedRecordReviewSummary card={card} />
        ) : (
          <>
            <RecordCorrectionPanel
              activeReviewQueueItemId={activeReviewQueueItemId}
              card={card}
              draft={correctionDraft}
              isEditing={isEditing}
              onCancelEditing={onCancelEditing}
              onDraftChange={onDraftChange}
              onStartEditing={onStartEditing}
              onSubmit={onSubmitCorrection}
            />

            <RecordEvidenceDetails card={card} />
            <RecordReviewSignalDetails card={card} />
            <RecordValidationDetails card={card} />
          </>
        )}
      </div>
    </details>
  );
}
