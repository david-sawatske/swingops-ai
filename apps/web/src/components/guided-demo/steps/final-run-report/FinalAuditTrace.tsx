import type { ExecuteEndToEndAgenticTradeInDemoResponse } from "../../../../types/workflow";
import {
  formatProvider,
  formatQualityStatus,
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
  const priorReviewEvidence = result.priorReviewLearningEvidenceByItem.flatMap(
    (item) => item.evidence,
  );

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
              {priorReviewEvidence.length > 0
                ? `${priorReviewEvidence.length} prior correction evidence item(s) found.`
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
            <dt>Tool logs</dt>
            <dd>{result.persisted.toolCallLogIds.length}</dd>
          </div>
          <div>
            <dt>Audit events</dt>
            <dd>{result.auditTrail.length}</dd>
          </div>
          <div>
            <dt>Provider fallback</dt>
            <dd>{result.providerFallbackTrace.fallbackUsed ? "Used" : "Not used"}</dd>
          </div>
          <div>
            <dt>Evidence coverage</dt>
            <dd>{qualitySummary.evidenceCoverage}</dd>
          </div>
          <div>
            <dt>Prior review evidence</dt>
            <dd>{priorReviewEvidence.length}</dd>
          </div>
        </dl>

        {priorReviewEvidence.length > 0 ? (
          <div className="guided-final-review-callout">
            <strong>Prior review evidence used as run evidence</strong>
            {priorReviewEvidence.slice(0, 4).map((evidence) => (
              <p key={evidence.learningEventId}>{evidence.summary}</p>
            ))}
            {priorReviewEvidence.length > 4 ? (
              <p className="guided-validation-empty-note">
                Showing 4 of {priorReviewEvidence.length} prior review evidence item(s).
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}
