import { useState } from "react";

import type {
  ReviewConditionGrade,
  ReviewCorrectionCategory,
  ReviewCorrectionShaftFlex,
} from "../../../../types/workflow";
import {
  CATEGORY_OPTIONS,
  CONDITION_GRADE_OPTIONS,
  SHAFT_FLEX_OPTIONS,
} from "./validationReviewOptions";
import type {
  ModelReviewOutcome,
  PriorReviewLearningSuggestion,
  RecordReviewCard,
  ReviewCorrectionDraft,
  ReviewQueueItem,
} from "./validationReviewTypes";
import { getModelReviewOutcomeLabel } from "../GuidedModelReviewAssistance";
import {
  applyPriorReviewSuggestionToDraft,
  canResolveReviewItem,
  canResolveWithPriorReviewSuggestion,
  getActionablePriorReviewSuggestions,
  getAppliedCorrectionSummaries,
  getAppliedSuggestionFieldNames,
  getBlockingCorrectionFields,
  getCorrectedValueForField,
  getCorrectionFieldLabel,
  getCorrectionFocusFields,
  getCurrentValueForField,
  getInventoryProductLineCandidates,
  getLoadedPriorReviewSuggestionFieldNames,
  getOpenPriorReviewSuggestions,
  getPriorReviewSuggestionKey,
  getSecondaryCorrectionFields,
  getSourceMatchFieldsForForm,
  getSourceTextMatchSuggestion,
  getSuggestionDraftFieldName,
  getVisibleCorrectionFieldsAfterAppliedSuggestions,
  isPriorReviewSuggestionLoadedInDraft,
  isSourceSupportedProductCatalogConfirmation,
  isStoreInspectionRequired,
  markPriorReviewSuggestionsHandled,
  type CorrectionFormFieldName,
  type ModelReviewSuggestion,
  type ReviewLearningSourceMatchField,
} from "./recordReviewCorrectionUtils";
import {
  formatDisplayValue,
  formatEnumLabel,
  formatFieldLabel,
  formatStatusLabel,
  getParserEvidenceForField,
  normalizeComparable,
} from "./validationReviewUtils";

function getReviewItemStatusLabel(reviewItem: ReviewQueueItem | null) {
  if (!reviewItem) {
    return "No review item";
  }

  return formatStatusLabel(reviewItem.status);
}

function CorrectionFocusCallout({
  card,
  focusFieldsOverride,
}: {
  card: RecordReviewCard;
  focusFieldsOverride?: string[];
}) {
  const focusFields = focusFieldsOverride ?? getCorrectionFocusFields(card);

  if (
    isSourceSupportedProductCatalogConfirmation(card) &&
    focusFields.includes("productLine")
  ) {
    const currentProductLine = getCurrentValueForField(card, "productLine");

    return (
      <div className="guided-correction-focus">
        <strong>Catalog identity to confirm</strong>
        <p>
          The source-supported product line is {currentProductLine}. Keep this
          value unless the available evidence verifies a more specific catalog
          product.
        </p>
      </div>
    );
  }

  if (focusFields.length === 0) {
    return (
      <div className="guided-correction-focus">
        <strong>Fields needing attention</strong>
        <p>Review the applied correction below before saving.</p>
      </div>
    );
  }

  return (
    <div className="guided-correction-focus">
      <strong>Fields needing attention</strong>
      <ul>
        {focusFields.map((field) => (
          <li key={field}>{getCorrectionFieldLabel(field)}</li>
        ))}
      </ul>
    </div>
  );
}

function AppliedCorrectionSummary({
  appliedSuggestionFieldNames,
  draft,
}: {
  appliedSuggestionFieldNames: ReadonlySet<string>;
  draft: ReviewCorrectionDraft;
}) {
  const summaries = getAppliedCorrectionSummaries(
    draft,
    appliedSuggestionFieldNames,
  );

  if (summaries.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Applied corrections"
      className="guided-applied-correction-summary"
    >
      <span className="guided-applied-correction-summary__label">
        {summaries.length === 1 ? "Applied correction" : "Applied corrections"}
      </span>

      <dl>
        {summaries.map((summary) => (
          <div key={summary.fieldName}>
            <dt>{summary.label}</dt>
            <dd>{summary.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PriorReviewSuggestionsPanel({
  canResolveSuggestion,
  draft,
  handledSuggestionIds,
  isSaving,
  onAcceptAndResolve,
  onApplySuggestion,
  onEditSuggestion,
  onRequestManualValue,
  suggestions,
}: {
  canResolveSuggestion: (suggestion: PriorReviewLearningSuggestion) => boolean;
  draft: ReviewCorrectionDraft;
  handledSuggestionIds: Set<string>;
  isSaving: boolean;
  onAcceptAndResolve: (suggestion: PriorReviewLearningSuggestion) => void;
  onApplySuggestion: (suggestion: PriorReviewLearningSuggestion) => void;
  onEditSuggestion: (suggestion: PriorReviewLearningSuggestion) => void;
  onRequestManualValue: () => void;
  suggestions: PriorReviewLearningSuggestion[];
}) {
  const actionableSuggestions =
    getActionablePriorReviewSuggestions(suggestions);
  const openSuggestions = getOpenPriorReviewSuggestions(
    suggestions,
    handledSuggestionIds,
    draft,
  );
  const currentSuggestion = openSuggestions[0] ?? null;

  if (!currentSuggestion) {
    return null;
  }

  const currentStep = actionableSuggestions.length - openSuggestions.length + 1;
  const fieldName = getSuggestionDraftFieldName(currentSuggestion.fieldName);
  const suggestedValue = String(currentSuggestion.suggestedValue ?? "").trim();
  const canApply = Boolean(fieldName && suggestedValue);
  const draftValue = fieldName
    ? getCorrectedValueForField(draft, fieldName)
    : "";
  const suggestionIsLoaded = isPriorReviewSuggestionLoadedInDraft(
    draft,
    currentSuggestion,
  );
  const resolvesReview = canApply && canResolveSuggestion(currentSuggestion);

  return (
    <div className="guided-prior-review-suggestions">
      <div className="guided-prior-review-suggestions__header">
        <div>
          <strong>Prior review suggestion</strong>
          <p>
            Review this prior approved correction before moving to the remaining
            unresolved fields.
          </p>
        </div>
        <span>
          {currentStep} of {actionableSuggestions.length}
        </span>
      </div>

      <div className="guided-prior-review-suggestions__list">
        <article
          className="guided-prior-review-suggestion"
          key={getPriorReviewSuggestionKey(currentSuggestion)}
        >
          <dl>
            <div>
              <dt>Field</dt>
              <dd>{formatFieldLabel(currentSuggestion.fieldName)}</dd>
            </div>
            <div>
              <dt>Source phrase</dt>
              <dd>
                {currentSuggestion.rawTextMatch
                  ? '"' + currentSuggestion.rawTextMatch + '"'
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Previously approved value</dt>
              <dd>{formatDisplayValue(currentSuggestion.suggestedValue)}</dd>
            </div>
            <div>
              <dt>Strength</dt>
              <dd>{formatEnumLabel(currentSuggestion.strength)}</dd>
            </div>
          </dl>

          <p>{currentSuggestion.confidenceImpact}</p>

          {draftValue ? (
            <small>Current correction form value: {draftValue}</small>
          ) : null}

          {suggestionIsLoaded ? (
            <p className="form-message form-message--success">
              Suggested correction loaded. Review the prefilled value below,
              then save the correction or enter a different value.
            </p>
          ) : (
            <div className="guided-prior-review-suggestion__actions">
              <button
                className="guided-step-primary-action"
                disabled={!canApply || isSaving}
                onClick={() =>
                  resolvesReview
                    ? onAcceptAndResolve(currentSuggestion)
                    : onApplySuggestion(currentSuggestion)
                }
                type="button"
              >
                {isSaving
                  ? "Resolving…"
                  : resolvesReview
                    ? `Accept ${formatDisplayValue(currentSuggestion.suggestedValue)} and resolve`
                    : "Apply suggestion and continue"}
              </button>
              <button
                className="guided-review-secondary-action"
                disabled={isSaving}
                onClick={() =>
                  resolvesReview
                    ? onEditSuggestion(currentSuggestion)
                    : onRequestManualValue()
                }
                type="button"
              >
                {resolvesReview
                  ? "Edit before resolving"
                  : "Enter different value"}
              </button>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

export function ModelReviewAssistancePanel({
  canResolveSuggestion,
  isSaving,
  onAcceptAndResolve,
  onEditSuggestion,
  onRequestManualCorrection,
  outcome,
}: {
  canResolveSuggestion: ((suggestion: ModelReviewSuggestion) => boolean) | null;
  isSaving: boolean;
  onAcceptAndResolve: ((suggestion: ModelReviewSuggestion) => void) | null;
  onEditSuggestion: ((suggestion: ModelReviewSuggestion) => void) | null;
  onRequestManualCorrection: (() => void) | null;
  outcome: ModelReviewOutcome;
}) {
  const outcomeModifier = outcome.outcomeType.toLowerCase().replace(/_/g, "-");
  const heading =
    outcome.outcomeType === "REPAIR_SUGGESTED"
      ? "Suggested correction"
      : outcome.outcomeType === "CANDIDATE_COMPARISON"
        ? "Product match needs confirmation"
        : "Insufficient evidence";

  return (
    <section
      aria-label="Review guidance for this record"
      className={`guided-record-model-assistance guided-record-model-assistance--${outcomeModifier}`}
    >
      <div className="guided-record-model-assistance__header">
        <div>
          <span className="model-route-card__eyebrow">
            Model-assisted review
          </span>
          <strong>{heading}</strong>
        </div>

        <span className="guided-record-model-assistance__outcome">
          {getModelReviewOutcomeLabel(outcome.outcomeType)}
        </span>
      </div>

      <p className="guided-record-model-assistance__summary">
        {outcome.summary}
      </p>

      {outcome.outcomeType === "REPAIR_SUGGESTED" ? (
        <div className="guided-record-model-assistance__items">
          {outcome.suggestions.map((suggestion, index) => (
            <article
              key={`${suggestion.fieldName}-${suggestion.sourcePhrase}-${index}`}
            >
              <dl>
                <div>
                  <dt>Field</dt>
                  <dd>{formatFieldLabel(suggestion.fieldName)}</dd>
                </div>
                <div>
                  <dt>Suggested value</dt>
                  <dd>
                    {formatDisplayValue(suggestion.candidateValue, {
                      currency: suggestion.fieldName === "tradeInValue",
                    })}
                  </dd>
                </div>
                <div>
                  <dt>Source phrase</dt>
                  <dd>“{suggestion.sourcePhrase}”</dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{Math.round(suggestion.confidence * 100)}%</dd>
                </div>
              </dl>

              <p>{suggestion.reason}</p>

              {onEditSuggestion ? (
                <div className="guided-prior-review-suggestion__actions">
                  <button
                    className="guided-step-primary-action"
                    disabled={isSaving}
                    onClick={() =>
                      canResolveSuggestion?.(suggestion)
                        ? onAcceptAndResolve?.(suggestion)
                        : onEditSuggestion(suggestion)
                    }
                    type="button"
                  >
                    {isSaving
                      ? "Resolving…"
                      : canResolveSuggestion?.(suggestion)
                        ? `Accept ${formatDisplayValue(
                            suggestion.candidateValue,
                            {
                              currency: suggestion.fieldName === "tradeInValue",
                            },
                          )} and resolve`
                        : "Apply suggestion and continue"}
                  </button>
                  <button
                    className="guided-review-secondary-action"
                    disabled={isSaving}
                    onClick={() =>
                      canResolveSuggestion?.(suggestion)
                        ? onEditSuggestion(suggestion)
                        : onRequestManualCorrection?.()
                    }
                    type="button"
                  >
                    {canResolveSuggestion?.(suggestion)
                      ? "Edit before resolving"
                      : "Enter different value"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {outcome.outcomeType === "CANDIDATE_COMPARISON" ? (
        <details className="guided-record-model-assistance__candidate-list">
          <summary>
            Technical candidate references ({outcome.candidateProductIds.length}
            )
          </summary>
          <div>
            {outcome.candidateProductIds.map((candidateId) => (
              <code key={candidateId}>{candidateId}</code>
            ))}
          </div>
        </details>
      ) : null}

      {outcome.outcomeType === "NO_SAFE_REPAIR" ? (
        <div className="guided-record-model-assistance__reason-list">
          <strong>Why the model withheld a repair</strong>
          <ul>
            {outcome.reasonCodes.map((reasonCode) => (
              <li key={reasonCode}>{formatEnumLabel(reasonCode)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="guided-record-model-assistance__question">
        <strong>Reviewer question</strong>
        <p>{outcome.reviewerQuestion}</p>
      </div>

      <details className="guided-record-model-assistance__evidence">
        <summary>Cited evidence</summary>
        <div>
          {outcome.evidenceIds.map((evidenceId) => (
            <code key={evidenceId}>{evidenceId}</code>
          ))}
        </div>
      </details>

      <small className="guided-record-model-assistance__advisory">
        Advisory only. Deterministic systems, approved reference data and saved
        human corrections remain authoritative.
      </small>
    </section>
  );
}

export function RecordCorrectionPanel({
  activeReviewQueueItemId,
  card,
  draft,
  isEditing,
  onDraftChange,
  onRouteForInspection,
  onStartEditing,
  onCancelEditing,
  onSubmit,
}: {
  activeReviewQueueItemId: string | null;
  card: RecordReviewCard;
  draft: ReviewCorrectionDraft;
  isEditing: boolean;
  onDraftChange: (draft: ReviewCorrectionDraft) => void;
  onRouteForInspection: () => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSubmit: (draftOverride?: ReviewCorrectionDraft) => void;
}) {
  const [handledSuggestionIds, setHandledSuggestionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [appliedSuggestionIds, setAppliedSuggestionIds] = useState<Set<string>>(
    () => new Set(),
  );

  function markSuggestionHandled(suggestion: PriorReviewLearningSuggestion) {
    setHandledSuggestionIds((current) => {
      const next = new Set(current);
      next.add(getPriorReviewSuggestionKey(suggestion));

      return next;
    });
  }

  function handleRequestManualValue() {
    setHandledSuggestionIds((current) =>
      markPriorReviewSuggestionsHandled(current, card.priorReviewSuggestions),
    );

    if (!isEditing) {
      onStartEditing();
    }
  }

  function handleApplySuggestion(suggestion: PriorReviewLearningSuggestion) {
    onDraftChange(applyPriorReviewSuggestionToDraft(draft, suggestion));
    markSuggestionHandled(suggestion);
    setAppliedSuggestionIds((current) => {
      const next = new Set(current);
      next.add(getPriorReviewSuggestionKey(suggestion));

      return next;
    });

    if (!isEditing) {
      onStartEditing();
    }
  }

  function handleEditSuggestion(suggestion: PriorReviewLearningSuggestion) {
    onDraftChange(applyPriorReviewSuggestionToDraft(draft, suggestion));
    markSuggestionHandled(suggestion);

    if (!isEditing) {
      onStartEditing();
    }
  }

  function handleAcceptSuggestion(suggestion: PriorReviewLearningSuggestion) {
    if (!canResolveWithPriorReviewSuggestion(card, draft, suggestion)) {
      return;
    }

    const nextDraft = applyPriorReviewSuggestionToDraft(draft, suggestion);

    onDraftChange(nextDraft);
    markSuggestionHandled(suggestion);
    setAppliedSuggestionIds((current) => {
      const next = new Set(current);
      next.add(getPriorReviewSuggestionKey(suggestion));

      return next;
    });
    onSubmit(nextDraft);
  }

  if (!card.reviewItem) {
    return (
      <div className="guided-record-correction-panel guided-record-correction-panel--muted">
        <strong>No review queue item</strong>
        <p>
          This record has no persisted review item to resolve from this
          checkpoint.
        </p>
      </div>
    );
  }

  if (!canResolveReviewItem(card.reviewItem)) {
    return (
      <div className="guided-record-correction-panel guided-record-correction-panel--resolved">
        <strong>
          Review status: {getReviewItemStatusLabel(card.reviewItem)}
        </strong>
        <p>This review item has already been handled.</p>
      </div>
    );
  }

  const appliedSuggestionFieldNames = getAppliedSuggestionFieldNames(
    card.priorReviewSuggestions,
    appliedSuggestionIds,
  );

  if (!isEditing) {
    for (const fieldName of getLoadedPriorReviewSuggestionFieldNames(
      draft,
      card.priorReviewSuggestions,
    )) {
      appliedSuggestionFieldNames.add(fieldName);
    }
  }

  const visibleFields = getVisibleCorrectionFieldsAfterAppliedSuggestions(
    card,
    appliedSuggestionFieldNames,
  );
  const secondaryFields = getSecondaryCorrectionFields(visibleFields);
  const inventoryProductLineCandidates =
    getInventoryProductLineCandidates(card);
  const isCatalogIdentityConfirmation =
    isSourceSupportedProductCatalogConfirmation(card);
  const hasOpenPriorReviewSuggestions =
    getOpenPriorReviewSuggestions(
      card.priorReviewSuggestions,
      handledSuggestionIds,
      draft,
    ).length > 0;
  const hasPriorReviewSuggestions =
    getActionablePriorReviewSuggestions(card.priorReviewSuggestions).length > 0;
  const isSaving = activeReviewQueueItemId === card.reviewItem.id;
  const storeInspectionRequired = isStoreInspectionRequired(card);
  const inspectionRequested =
    card.reviewItem.status === "IN_REVIEW" &&
    card.reviewItem.reviewerNotes
      ?.toLowerCase()
      .includes("store inspection required");

  function handleCatalogCandidate(candidateProductLine: string) {
    const nextDraft = {
      ...draft,
      productLine: candidateProductLine,
    };

    onDraftChange(nextDraft);

    if (getBlockingCorrectionFields(card, nextDraft).length === 0) {
      onSubmit(nextDraft);
      return;
    }

    if (!isEditing) {
      onStartEditing();
    }
  }

  if (!isEditing && storeInspectionRequired) {
    const verifiedBrand = getCurrentValueForField(card, "brand");
    const verifiedCategory = getCurrentValueForField(card, "category");
    const inspectionFields = [
      "productLine",
      "shaftFlex",
      "conditionGrade",
      "demoValue",
    ].filter((fieldName) =>
      visibleFields.includes(fieldName as CorrectionFormFieldName),
    );

    return (
      <div className="guided-record-correction-panel guided-review-decision-panel guided-review-decision-panel--inspection">
        <div className="guided-review-decision-panel__header">
          <div>
            <strong>
              {inspectionRequested
                ? "Store inspection requested"
                : "Store inspection required"}
            </strong>
            <p>
              The source confirms {verifiedBrand} · {verifiedCategory}, but it
              does not provide enough evidence to approve a catalog product or
              the remaining trade-in details.
            </p>
          </div>
          <span className="guided-review-decision-panel__status">
            {inspectionRequested ? "In review" : "Evidence insufficient"}
          </span>
        </div>

        <dl className="guided-review-decision-summary">
          <div>
            <dt>Verified from source</dt>
            <dd>
              {verifiedBrand} · {verifiedCategory}
            </dd>
          </div>
          <div>
            <dt>Still needs verification</dt>
            <dd>{inspectionFields.map(getCorrectionFieldLabel).join(", ")}</dd>
          </div>
        </dl>

        <p className="guided-review-decision-panel__guidance">
          Do not infer these values from the current record. Route the item for
          physical inspection, or enter details only after they have been
          verified from an approved source.
        </p>

        <div className="guided-review-decision-panel__actions">
          {inspectionRequested ? null : (
            <button
              className="guided-step-primary-action"
              disabled={isSaving}
              onClick={onRouteForInspection}
              type="button"
            >
              {isSaving ? "Requesting inspection…" : "Send to store inspection"}
            </button>
          )}
          <button
            className="guided-review-secondary-action"
            disabled={isSaving}
            onClick={onStartEditing}
            type="button"
          >
            Enter verified details
          </button>
        </div>
      </div>
    );
  }

  if (!isEditing && isCatalogIdentityConfirmation) {
    const currentProductLine = getCurrentValueForField(card, "productLine");

    return (
      <div className="guided-record-correction-panel guided-review-decision-panel guided-review-decision-panel--catalog">
        <div className="guided-review-decision-panel__header">
          <div>
            <strong>Choose the catalog product</strong>
            <p>
              The source identifies {currentProductLine}, but not the exact
              catalog generation. Confirm only a candidate supported by the
              available evidence.
            </p>
          </div>
          <span className="guided-review-decision-panel__status">
            Human decision
          </span>
        </div>

        <div className="guided-review-source-value">
          <span>Source product text</span>
          <strong>{currentProductLine}</strong>
        </div>

        {inventoryProductLineCandidates.length > 0 ? (
          <section
            aria-label="Catalog identity candidates"
            className="guided-inventory-candidate-suggestions"
          >
            <div className="guided-inventory-candidate-suggestions__header">
              <strong>Matching catalog candidates</strong>
              <p>Selecting a candidate records the reviewer decision.</p>
            </div>
            <div className="guided-inventory-candidate-suggestions__list">
              {inventoryProductLineCandidates.map((candidate) => (
                <button
                  className="guided-inventory-candidate"
                  disabled={isSaving}
                  key={
                    candidate.productId ??
                    candidate.sku ??
                    candidate.productLine
                  }
                  onClick={() => handleCatalogCandidate(candidate.productLine)}
                  type="button"
                >
                  <span>Confirm {candidate.productLine} and resolve</span>
                  <small>
                    {Math.round(candidate.confidence * 100)}% catalog match
                    {candidate.reason ? ` · ${candidate.reason}` : ""}
                  </small>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <p className="guided-review-decision-panel__guidance">
            No eligible catalog candidates were returned for this record.
          </p>
        )}

        <div className="guided-review-decision-panel__actions">
          <button
            className="guided-review-secondary-action"
            disabled={isSaving}
            onClick={onStartEditing}
            type="button"
          >
            Enter another product
          </button>
          <button
            className="guided-review-secondary-action"
            disabled={isSaving}
            onClick={onRouteForInspection}
            type="button"
          >
            Cannot determine · send to inspection
          </button>
        </div>
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className="guided-record-correction-panel">
        <div>
          <strong>
            {isCatalogIdentityConfirmation
              ? "Ready for catalog confirmation"
              : "Ready for human correction"}
          </strong>
          <p>
            {isCatalogIdentityConfirmation
              ? "Confirm the preserved source product line or select a catalog candidate only when the evidence supports it."
              : `Focus on ${visibleFields.map(getCorrectionFieldLabel).join(", ")}.`}
          </p>
        </div>
        {hasOpenPriorReviewSuggestions ? null : (
          <CorrectionFocusCallout
            card={card}
            focusFieldsOverride={visibleFields}
          />
        )}
        <PriorReviewSuggestionsPanel
          canResolveSuggestion={(suggestion) =>
            canResolveWithPriorReviewSuggestion(card, draft, suggestion)
          }
          draft={draft}
          handledSuggestionIds={handledSuggestionIds}
          isSaving={isSaving}
          onAcceptAndResolve={handleAcceptSuggestion}
          onApplySuggestion={handleApplySuggestion}
          onEditSuggestion={handleEditSuggestion}
          onRequestManualValue={handleRequestManualValue}
          suggestions={card.priorReviewSuggestions}
        />
        {hasOpenPriorReviewSuggestions ? null : (
          <button
            className="guided-step-primary-action"
            onClick={onStartEditing}
            type="button"
          >
            {hasPriorReviewSuggestions
              ? "Review remaining fields"
              : isCatalogIdentityConfirmation
                ? "Review catalog identity"
                : "Review and correct"}
          </button>
        )}
      </div>
    );
  }

  const blockingCorrectionFields = getBlockingCorrectionFields(card, draft);
  const displayedBlockingCorrectionFields = storeInspectionRequired
    ? (
        ["productLine", "shaftFlex", "conditionGrade", "demoValue"] as const
      ).filter((fieldName) => blockingCorrectionFields.includes(fieldName))
    : blockingCorrectionFields;

  if (hasOpenPriorReviewSuggestions) {
    return (
      <div className="guided-record-correction-form">
        <div className="guided-record-correction-form__header">
          <div>
            <strong>Review prior suggestions first</strong>
            <p>
              Apply a surfaced suggestion or enter a different value before
              resolving the remaining fields.
            </p>
          </div>
          <button disabled={isSaving} onClick={onCancelEditing} type="button">
            Cancel
          </button>
        </div>

        <PriorReviewSuggestionsPanel
          canResolveSuggestion={(suggestion) =>
            canResolveWithPriorReviewSuggestion(card, draft, suggestion)
          }
          draft={draft}
          handledSuggestionIds={handledSuggestionIds}
          isSaving={isSaving}
          onAcceptAndResolve={handleAcceptSuggestion}
          onApplySuggestion={handleApplySuggestion}
          onEditSuggestion={handleEditSuggestion}
          onRequestManualValue={handleRequestManualValue}
          suggestions={card.priorReviewSuggestions}
        />
      </div>
    );
  }

  return (
    <div className="guided-record-correction-form">
      <div className="guided-record-correction-form__header">
        <div>
          <strong>
            {storeInspectionRequired
              ? "Enter verified inspection details"
              : isCatalogIdentityConfirmation
                ? "Enter another catalog product"
                : "Confirm correction"}
          </strong>
          <p>
            {storeInspectionRequired
              ? "Use only details verified from the physical item or another approved source."
              : isCatalogIdentityConfirmation
                ? "Enter a catalog product only when the available evidence verifies it."
                : "Review the corrected value, add a note if needed, then resolve."}
          </p>
        </div>
        <button disabled={isSaving} onClick={onCancelEditing} type="button">
          Cancel
        </button>
      </div>

      {visibleFields.length > 0 ? (
        <CorrectionFocusCallout
          card={card}
          focusFieldsOverride={visibleFields}
        />
      ) : null}

      <AppliedCorrectionSummary
        appliedSuggestionFieldNames={appliedSuggestionFieldNames}
        draft={draft}
      />

      {blockingCorrectionFields.length > 0 ? (
        <div
          className="guided-correction-focus guided-correction-focus--warning"
          role="alert"
        >
          <strong>
            {storeInspectionRequired
              ? "Complete the verified inspection details before resolving"
              : "Complete the required correction before resolving"}
          </strong>
          <p>
            Choose or enter a corrected value for:{" "}
            {displayedBlockingCorrectionFields
              .map(getCorrectionFieldLabel)
              .join(", ")}
            .
          </p>
        </div>
      ) : null}

      <div className="guided-record-correction-grid guided-record-correction-grid--focused">
        {visibleFields.includes("brand") ? (
          <label>
            Brand
            <input
              onChange={(event) =>
                onDraftChange({ ...draft, brand: event.target.value })
              }
              value={draft.brand}
            />
          </label>
        ) : null}

        {visibleFields.includes("productLine") ? (
          <label className="guided-product-line-correction-field">
            Product line
            <input
              onChange={(event) =>
                onDraftChange({ ...draft, productLine: event.target.value })
              }
              value={draft.productLine}
            />
          </label>
        ) : null}

        {visibleFields.includes("productLine") &&
        inventoryProductLineCandidates.length > 0 ? (
          <section
            aria-label="Inventory product-line candidates"
            className="guided-inventory-candidate-suggestions"
          >
            <div className="guided-inventory-candidate-suggestions__header">
              <strong>Matching catalog candidates</strong>
              <p>
                {isCatalogIdentityConfirmation
                  ? "Keep the source-supported value unless a candidate is verified by the available evidence."
                  : "Select the verified generation. Manual entry remains available."}
              </p>
            </div>

            <div className="guided-inventory-candidate-suggestions__list">
              {inventoryProductLineCandidates.map((candidate) => {
                const isSelected =
                  normalizeComparable(draft.productLine) ===
                  normalizeComparable(candidate.productLine);

                return (
                  <button
                    aria-pressed={isSelected}
                    className={
                      isSelected
                        ? "guided-inventory-candidate guided-inventory-candidate--selected"
                        : "guided-inventory-candidate"
                    }
                    key={
                      candidate.productId ??
                      candidate.sku ??
                      candidate.productLine
                    }
                    onClick={() =>
                      onDraftChange({
                        ...draft,
                        productLine: candidate.productLine,
                      })
                    }
                    title={
                      candidate.sku
                        ? candidate.productLine + " · " + candidate.sku
                        : candidate.productLine
                    }
                    type="button"
                  >
                    <span>{candidate.productLine}</span>
                    <small>
                      {Math.round(candidate.confidence * 100)}% catalog match
                    </small>
                  </button>
                );
              })}
            </div>

            <small className="guided-inventory-candidate-suggestions__note">
              Selecting a candidate fills the Product line field above.
            </small>
          </section>
        ) : null}

        {visibleFields.includes("category") ? (
          <label>
            Category
            <select
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  category: event.target.value as ReviewCorrectionCategory | "",
                })
              }
              value={draft.category}
            >
              <option value="">Select category</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {visibleFields.includes("shaftFlex") ? (
          <label>
            Shaft flex
            <select
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  shaftFlex: event.target.value as
                    ReviewCorrectionShaftFlex | "",
                })
              }
              value={draft.shaftFlex}
            >
              <option value="">Select shaft flex</option>
              {SHAFT_FLEX_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {visibleFields.includes("conditionGrade") ? (
          <label>
            Condition grade
            <select
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  conditionGrade: event.target.value as
                    ReviewConditionGrade | "",
                })
              }
              value={draft.conditionGrade}
            >
              <option value="">Select condition</option>
              {CONDITION_GRADE_OPTIONS.map((conditionGrade) => (
                <option key={conditionGrade} value={conditionGrade}>
                  {conditionGrade}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {visibleFields.includes("demoValue") ? (
          <label>
            Trade-in value
            <input
              min="0"
              onChange={(event) =>
                onDraftChange({ ...draft, demoValue: event.target.value })
              }
              type="number"
              value={draft.demoValue}
            />
          </label>
        ) : null}
      </div>

      {secondaryFields.length > 0 ? (
        <details className="guided-record-secondary-fields">
          <summary>Other normalized fields</summary>
          <dl>
            {secondaryFields.map((field) => {
              const parserEvidence = getParserEvidenceForField(
                card.parsedRecord,
                field === "demoValue"
                  ? ["tradeInValue", "demoValue", "value"]
                  : [field],
              );

              return (
                <div key={field}>
                  <dt>{getCorrectionFieldLabel(field)}</dt>
                  <dd>
                    <span>
                      {getCorrectedValueForField(draft, field) || "—"}
                    </span>
                    {parserEvidence ? (
                      <small className="guided-parser-field-evidence">
                        Parsed from “{parserEvidence.sourceText}”
                      </small>
                    ) : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        </details>
      ) : null}
      {storeInspectionRequired ? null : (
        <SourceTextMatchEditor
          appliedSuggestionFieldNames={appliedSuggestionFieldNames}
          card={card}
          draft={draft}
          onDraftChange={onDraftChange}
        />
      )}

      {visibleFields.includes("demoValue") ||
      appliedSuggestionFieldNames.has("demoValue") ? (
        <label>
          Valuation note
          <input
            onChange={(event) =>
              onDraftChange({
                ...draft,
                demoValuationNote: event.target.value,
              })
            }
            placeholder="Optional note about the corrected value."
            value={draft.demoValuationNote}
          />
        </label>
      ) : null}

      <label>
        Reviewer note
        <textarea
          onChange={(event) =>
            onDraftChange({ ...draft, reviewerNotes: event.target.value })
          }
          placeholder="Optional note about the review decision."
          rows={2}
          value={draft.reviewerNotes}
        />
      </label>

      <div className="guided-record-correction-form__actions">
        <button
          className="guided-step-primary-action"
          disabled={isSaving || blockingCorrectionFields.length > 0}
          onClick={() => onSubmit()}
          type="button"
        >
          {isSaving
            ? "Saving correction…"
            : storeInspectionRequired
              ? "Save verified details and resolve"
              : "Save correction and resolve"}
        </button>
      </div>
    </div>
  );
}

function SourceTextMatchEditor({
  appliedSuggestionFieldNames,
  card,
  draft,
  onDraftChange,
}: {
  appliedSuggestionFieldNames: Set<CorrectionFormFieldName>;
  card: RecordReviewCard;
  draft: ReviewCorrectionDraft;
  onDraftChange: (draft: ReviewCorrectionDraft) => void;
}) {
  const fieldNames = getSourceMatchFieldsForForm(
    card,
    appliedSuggestionFieldNames,
  );

  if (fieldNames.length === 0) {
    return null;
  }

  return (
    <section className="guided-review-source-match-editor">
      <div>
        <strong>Matching source text</strong>
        <p>
          Tie each correction to the exact phrase in the original record. This
          is what future runs can safely use as prior review evidence.
        </p>
      </div>

      <div className="guided-review-source-match-original">
        <span>Original record</span>
        <p>{card.sourceEvidence}</p>
      </div>

      <div className="guided-review-source-match-grid">
        {fieldNames.map((fieldName) => {
          const suggestion = getSourceTextMatchSuggestion(
            card,
            fieldName as ReviewLearningSourceMatchField,
          );

          return (
            <label key={fieldName}>
              {formatFieldLabel(fieldName)}
              <input
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    sourceTextMatches: {
                      ...draft.sourceTextMatches,
                      [fieldName]: event.target.value,
                    },
                  })
                }
                placeholder={
                  suggestion
                    ? `Suggested: ${suggestion}`
                    : "Exact source phrase, or leave blank if reviewer judgment only"
                }
                type="text"
                value={draft.sourceTextMatches[fieldName] ?? ""}
              />
              <small>
                {suggestion
                  ? `Suggested source match: ${suggestion}`
                  : "Leave blank only when no exact source phrase exists."}
              </small>
            </label>
          );
        })}
      </div>
    </section>
  );
}
