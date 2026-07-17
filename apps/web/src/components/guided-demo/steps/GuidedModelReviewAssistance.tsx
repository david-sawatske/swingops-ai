import type {
  FieldRepairRecordOutcome,
} from "../../../types/workflow";
import {
  formatFieldRepairValue,
} from "./final-run-report/finalRunReportUtils";

type GuidedModelReviewAssistanceProps = {
  outcomes: FieldRepairRecordOutcome[];
  visibleOutcomeLimit?: number;
};

export function getModelReviewOutcomeLabel(
  outcomeType: FieldRepairRecordOutcome["outcomeType"],
) {
  if (outcomeType === "REPAIR_SUGGESTED") {
    return "Repair suggested";
  }

  if (outcomeType === "CANDIDATE_COMPARISON") {
    return "Candidate comparison";
  }

  return "No safe repair";
}

export function getModelReviewAssistanceSummary(
  outcomes: FieldRepairRecordOutcome[],
) {
  if (outcomes.length === 0) {
    return "No records met the model-assistance selection rules for this run.";
  }

  const repairCount = outcomes.filter(
    (outcome) => outcome.outcomeType === "REPAIR_SUGGESTED",
  ).length;
  const comparisonCount = outcomes.filter(
    (outcome) => outcome.outcomeType === "CANDIDATE_COMPARISON",
  ).length;
  const noSafeRepairCount = outcomes.filter(
    (outcome) => outcome.outcomeType === "NO_SAFE_REPAIR",
  ).length;

  return [
    `${outcomes.length} selected ${pluralize("record", outcomes.length)} assessed`,
    `${repairCount} ${pluralize("repair outcome", repairCount)}`,
    `${comparisonCount} ${pluralize("candidate comparison", comparisonCount)}`,
    `${noSafeRepairCount} ${pluralize("no-safe-repair outcome", noSafeRepairCount)}`,
  ].join(" · ");
}

export function GuidedModelReviewAssistance({
  outcomes,
  visibleOutcomeLimit = 4,
}: GuidedModelReviewAssistanceProps) {
  if (outcomes.length === 0) {
    return (
      <p className="guided-validation-empty-note">
        No records met the model-assistance selection rules for this run. The
        provider was not asked to invent work for records already supported by
        deterministic evidence.
      </p>
    );
  }

  const visibleOutcomes = outcomes.slice(0, visibleOutcomeLimit);

  return (
    <section
      aria-label="Model review assistance by record"
      className="guided-model-assistance"
    >
      <div className="guided-model-assistance__header">
        <div>
          <strong>Validated assistance by selected record</strong>
          <p>{getModelReviewAssistanceSummary(outcomes)}</p>
        </div>
        <span>{outcomes.length} assessed</span>
      </div>

      <div className="guided-model-assistance__list">
        {visibleOutcomes.map((outcome, index) => (
          <article
            className={`guided-model-assistance-card guided-model-assistance-card--${getOutcomeModifier(
              outcome.outcomeType,
            )}`}
            key={`${outcome.recordId}-${outcome.outcomeType}`}
          >
            <div className="guided-model-assistance-card__heading">
              <div>
                <span>Selected record {index + 1}</span>
                <strong>{getModelReviewOutcomeLabel(outcome.outcomeType)}</strong>
              </div>
              <code>{outcome.recordId}</code>
            </div>

            <p className="guided-model-assistance-card__summary">
              {outcome.summary}
            </p>

            {outcome.outcomeType === "REPAIR_SUGGESTED" ? (
              <ul className="guided-model-assistance-card__items">
                {outcome.suggestions.map((suggestion, suggestionIndex) => (
                  <li
                    key={`${suggestion.fieldName}-${suggestion.sourcePhrase}-${suggestionIndex}`}
                  >
                    <strong>
                      {suggestion.fieldName}:{" "}
                      {formatFieldRepairValue(suggestion.candidateValue)}
                    </strong>
                    <span>
                      Source phrase “{suggestion.sourcePhrase}” · confidence{" "}
                      {Math.round(suggestion.confidence * 100)}% ·{" "}
                      {suggestion.reviewRequired
                        ? "review required"
                        : "review optional"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {outcome.outcomeType === "CANDIDATE_COMPARISON" ? (
              <div className="guided-model-assistance-card__detail">
                <span>Supplied deterministic candidates</span>
                <ul>
                  {outcome.candidateProductIds.map((candidateProductId) => (
                    <li key={candidateProductId}>
                      <code>{candidateProductId}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {outcome.outcomeType === "NO_SAFE_REPAIR" ? (
              <div className="guided-model-assistance-card__detail">
                <span>Why repair was withheld</span>
                <ul>
                  {outcome.reasonCodes.map((reasonCode) => (
                    <li key={reasonCode}>{formatReasonCode(reasonCode)}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="guided-model-assistance-card__question">
              <span>Reviewer question</span>
              <strong>{outcome.reviewerQuestion}</strong>
            </div>

            <details className="guided-model-assistance-card__evidence">
              <summary>
                Evidence cited ({outcome.evidenceIds.length})
              </summary>
              {outcome.evidenceIds.length > 0 ? (
                <ul>
                  {outcome.evidenceIds.map((evidenceId) => (
                    <li key={evidenceId}>
                      <code>{evidenceId}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No evidence identifiers were cited.</p>
              )}
            </details>
          </article>
        ))}
      </div>

      {outcomes.length > visibleOutcomeLimit ? (
        <p className="guided-validation-empty-note">
          Showing {visibleOutcomeLimit} of {outcomes.length} validated record
          outcomes.
        </p>
      ) : null}
    </section>
  );
}

function pluralize(label: string, count: number) {
  return count === 1 ? label : `${label}s`;
}

function getOutcomeModifier(
  outcomeType: FieldRepairRecordOutcome["outcomeType"],
) {
  return outcomeType.toLowerCase().replace(/_/g, "-");
}

function formatReasonCode(reasonCode: string) {
  const normalized = reasonCode.replace(/_/g, " ").toLowerCase();

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
