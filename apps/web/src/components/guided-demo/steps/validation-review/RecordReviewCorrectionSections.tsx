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
  draft,
  handledSuggestionIds,
  onApplySuggestion,
  onRequestManualValue,
  suggestions,
}: {
  draft: ReviewCorrectionDraft;
  handledSuggestionIds: Set<string>;
  onApplySuggestion: (suggestion: PriorReviewLearningSuggestion) => void;
  onRequestManualValue: (suggestion: PriorReviewLearningSuggestion) => void;
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
                disabled={!canApply}
                onClick={() => onApplySuggestion(currentSuggestion)}
                type="button"
              >
                Use prior approved value
              </button>
              <button
                className="guided-review-secondary-action"
                onClick={() => onRequestManualValue(currentSuggestion)}
                type="button"
              >
                Enter different value
              </button>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

export function ModelReviewAssistancePanel({
  onApplySuggestion,
  outcome,
}: {
  onApplySuggestion: ((suggestion: ModelReviewSuggestion) => void) | null;
  outcome: ModelReviewOutcome;
}) {
  const outcomeModifier = outcome.outcomeType.toLowerCase().replace(/_/g, "-");

  return (
    <section
      aria-label="Model review assistance for this record"
      className={`guided-record-model-assistance guided-record-model-assistance--${outcomeModifier}`}
    >
      <div className="guided-record-model-assistance__header">
        <div>
          <span className="model-route-card__eyebrow">Advisory evidence</span>
          <strong>Model review assistance</strong>
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

              {onApplySuggestion ? (
                <div className="guided-prior-review-suggestion__actions">
                  <button
                    className="guided-step-primary-action"
                    onClick={() => onApplySuggestion(suggestion)}
                    type="button"
                  >
                    Review and save correction
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {outcome.outcomeType === "CANDIDATE_COMPARISON" ? (
        <div className="guided-record-model-assistance__candidate-list">
          <strong>Supplied product candidates</strong>
          <div>
            {outcome.candidateProductIds.map((candidateId) => (
              <code key={candidateId}>{candidateId}</code>
            ))}
          </div>
        </div>
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
  onStartEditing,
  onCancelEditing,
  onSubmit,
}: {
  activeReviewQueueItemId: string | null;
  card: RecordReviewCard;
  draft: ReviewCorrectionDraft;
  isEditing: boolean;
  onDraftChange: (draft: ReviewCorrectionDraft) => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSubmit: () => void;
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

  function handleRequestManualValue(suggestion: PriorReviewLearningSuggestion) {
    markSuggestionHandled(suggestion);

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

  for (const fieldName of getLoadedPriorReviewSuggestionFieldNames(
    draft,
    card.priorReviewSuggestions,
  )) {
    appliedSuggestionFieldNames.add(fieldName);
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
          draft={draft}
          handledSuggestionIds={handledSuggestionIds}
          onApplySuggestion={handleApplySuggestion}
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

  const isSaving = activeReviewQueueItemId === card.reviewItem.id;
  const blockingCorrectionFields = getBlockingCorrectionFields(card, draft);

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
          draft={draft}
          handledSuggestionIds={handledSuggestionIds}
          onApplySuggestion={handleApplySuggestion}
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
            {isCatalogIdentityConfirmation
              ? "Confirm catalog identity"
              : "Confirm correction"}
          </strong>
          <p>
            {isCatalogIdentityConfirmation
              ? "Keep the source-supported product line or select a verified catalog candidate, then resolve."
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
          <strong>Complete the required correction before resolving</strong>
          <p>
            Choose or enter a corrected value for:{" "}
            {blockingCorrectionFields.map(getCorrectionFieldLabel).join(", ")}.
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
      <SourceTextMatchEditor
        appliedSuggestionFieldNames={appliedSuggestionFieldNames}
        card={card}
        draft={draft}
        onDraftChange={onDraftChange}
      />

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
          onClick={onSubmit}
          type="button"
        >
          {isSaving ? "Saving correction…" : "Save correction and resolve"}
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
