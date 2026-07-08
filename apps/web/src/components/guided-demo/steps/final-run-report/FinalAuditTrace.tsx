import type { ExecuteEndToEndAgenticTradeInDemoResponse } from "../../../../types/workflow";
import {
  formatCostEstimate,
  formatFieldRepairValue,
  formatLatencyMs,
  formatProvider,
  formatQualityStatus,
  getModelExecutionValidationLabel,
  getProviderAttemptLabel,
} from "./finalRunReportUtils";

export function FinalAuditTrace({
  candidateRecordCount,
  createdReviewItemCount,
  finalRecordCount,
  finalSummary,
  openReviewItemCount,
  qualitySummary,
  result,
  reviewStatusSummary,
}: {
  candidateRecordCount: number;
  createdReviewItemCount: number;
  finalRecordCount: number;
  finalSummary: ExecuteEndToEndAgenticTradeInDemoResponse["finalSummary"];
  openReviewItemCount: number;
  qualitySummary: ExecuteEndToEndAgenticTradeInDemoResponse["workflowQualitySummary"];
  result: ExecuteEndToEndAgenticTradeInDemoResponse;
  reviewStatusSummary: string;
}) {
  const priorReviewSuggestions = result.priorReviewLearningSuggestionsByItem.flatMap(
    (item) => item.suggestions,
  );
  const fieldRepairSuggestions = result.fieldRepairExecution.suggestions;
  const finalProviderAttempt = result.providerFallbackTrace.attempts.at(-1) ?? null;

  return (
    <details className="guided-final-section guided-run-validation-detail guided-final-audit-trace">
      <summary className="guided-final-audit-trace__summary">
        <div className="guided-final-section__header">
          <span className="model-route-card__eyebrow">Audit trace</span>
          <h4>Systems, safety, and identifiers</h4>
          <p>
            Technical trace data is kept for auditability, but it is secondary to
            the five-step workflow recap above.
          </p>
        </div>
      </summary>

      <div className="guided-run-validation-detail__body">
        <div className="guided-final-system-list">
          <article>
            <strong>Model router</strong>
            <p>{formatProvider(finalSummary.selectedProvider, finalSummary.selectedModel)}</p>
          </article>
          <article>
            <strong>Provider execution</strong>
            <p>
              {formatProvider(result.providerFallbackTrace.finalProvider, result.providerFallbackTrace.finalModel)}
              {" · "}
              {getModelExecutionValidationLabel(result.fieldRepairExecution)}
            </p>
          </article>
          <article>
            <strong>Field repair</strong>
            <p>
              {fieldRepairSuggestions.length > 0
                ? `${fieldRepairSuggestions.length} review-facing suggestion(s) generated.`
                : "No model field-repair suggestions were needed."}
            </p>
          </article>
          <article>
            <strong>Knowledge / RAG</strong>
            <p>{finalSummary.knowledgeMatchCount} grounded match(es) returned.</p>
          </article>
          <article>
            <strong>Inventory system</strong>
            <p>{finalSummary.inventoryMatchCount} inventory match(es) found.</p>
          </article>
          <article>
            <strong>Valuation system</strong>
            <p>{finalSummary.valuationRangeCount} valuation range(s) generated.</p>
          </article>
          <article>
            <strong>Review queue</strong>
            <p>{reviewStatusSummary}</p>
          </article>
          <article>
            <strong>Prior review learning</strong>
            <p>
              {priorReviewSuggestions.length > 0
                ? `${priorReviewSuggestions.length} prior review suggestion(s) surfaced.`
                : "No prior correction evidence matched this run."}
            </p>
          </article>
          <article>
            <strong>AI-ready record store</strong>
            <p>
              {candidateRecordCount} candidate record(s); {finalRecordCount} run-scoped final record(s).
            </p>
          </article>
          <article>
            <strong>Safety policy</strong>
            <p>{finalSummary.blockedMutationToolCallCount} unsafe mutation request(s) blocked.</p>
          </article>
          <article>
            <strong>Quality status</strong>
            <p>
              {openReviewItemCount === 0 && createdReviewItemCount > 0
                ? "review resolved"
                : formatQualityStatus(qualitySummary.status)}
            </p>
          </article>
        </div>

        <dl className="guided-final-trace-list">
          <div>
            <dt>Workflow run</dt>
            <dd>{result.persisted.workflowRunId}</dd>
          </div>
          <div>
            <dt>Model call log</dt>
            <dd>{result.persisted.modelCallLogId}</dd>
          </div>
          <div>
            <dt>Provider fallback</dt>
            <dd>{result.providerFallbackTrace.fallbackUsed ? "Used" : "Not used"}</dd>
          </div>
          <div>
            <dt>Provider attempts</dt>
            <dd>{result.providerFallbackTrace.attempts.length}</dd>
          </div>
          <div>
            <dt>Final attempt</dt>
            <dd>
              {finalProviderAttempt
                ? getProviderAttemptLabel(finalProviderAttempt.status)
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Latency</dt>
            <dd>{formatLatencyMs(finalProviderAttempt?.latencyMs ?? null)}</dd>
          </div>
          <div>
            <dt>Est. model cost</dt>
            <dd>{formatCostEstimate(finalProviderAttempt?.estimatedCostUsd ?? null)}</dd>
          </div>
          <div>
            <dt>Field repair validation</dt>
            <dd>{getModelExecutionValidationLabel(result.fieldRepairExecution)}</dd>
          </div>
          <div>
            <dt>Tool logs</dt>
            <dd>{result.persisted.toolCallLogIds.length}</dd>
          </div>
          <div>
            <dt>Audit events</dt>
            <dd>{result.auditTrail.length}</dd>
          </div>
          <div>
            <dt>Evidence coverage</dt>
            <dd>{qualitySummary.evidenceCoverage}</dd>
          </div>
          <div>
            <dt>Prior review suggestions</dt>
            <dd>{priorReviewSuggestions.length}</dd>
          </div>
        </dl>

        <div className="guided-final-review-callout guided-model-execution-note">
          <strong>Model output is secondary to validation and review</strong>
          <p>
            Deterministic parsing, reference data, internal tools, and prior approved corrections remain
            the stronger evidence sources. Model output is only displayed here after the field-repair
            contract validates it, and low-confidence suggestions remain review-facing.
          </p>
        </div>

        {fieldRepairSuggestions.length > 0 ? (
          <div className="guided-final-review-callout">
            <strong>Field repair suggestions generated for review</strong>
            <ol className="guided-field-repair-suggestion-list">
              {fieldRepairSuggestions.slice(0, 4).map((suggestion, index) => (
                <li key={`${suggestion.recordId ?? "record"}-${suggestion.fieldName}-${suggestion.sourcePhrase}-${index}`}>
                  <strong>
                    {suggestion.fieldName}: {formatFieldRepairValue(suggestion.candidateValue)}
                  </strong>
                  <p>
                    Source phrase “{suggestion.sourcePhrase}” · confidence{" "}
                    {Math.round(suggestion.confidence * 100)}% ·{" "}
                    {suggestion.reviewRequired ? "review required" : "review optional"}
                  </p>
                </li>
              ))}
            </ol>
            {fieldRepairSuggestions.length > 4 ? (
              <p className="guided-validation-empty-note">
                Showing 4 of {fieldRepairSuggestions.length} field repair suggestion(s).
              </p>
            ) : null}
          </div>
        ) : null}

        {result.fieldRepairExecution.validationErrors.length > 0 ? (
          <div className="guided-final-review-callout">
            <strong>Field repair validation errors</strong>
            {result.fieldRepairExecution.validationErrors.slice(0, 4).map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}

        {priorReviewSuggestions.length > 0 ? (
          <div className="guided-final-review-callout">
            <strong>Prior review suggestions surfaced for review</strong>
            {priorReviewSuggestions.slice(0, 4).map((suggestion) => (
              <p key={suggestion.sourceLearningEventId}>{suggestion.summary}</p>
            ))}
            {priorReviewSuggestions.length > 4 ? (
              <p className="guided-validation-empty-note">
                Showing 4 of {priorReviewSuggestions.length} prior review suggestion(s).
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}
