import type { CorrectionSummary } from "./finalRunReportTypes";

type GroupedCorrectionSummary = {
  recordLabel: string;
  corrections: CorrectionSummary[];
};

export function ReviewChangesSummary({
  correctionSummaries,
  groupedCorrectionSummaries,
  learningEventCount,
  reviewedRecordCount,
}: {
  correctionSummaries: CorrectionSummary[];
  groupedCorrectionSummaries: GroupedCorrectionSummary[];
  learningEventCount: number;
  reviewedRecordCount: number;
}) {
  return (
    <section className="guided-final-section">
      <div className="guided-final-section__header">
        <h4>Review changes written</h4>
        <p>
          Human review changes are summarized here so the report stays readable
          even when many records are corrected. The finalized records table above
          is the primary output.
        </p>
      </div>

      <div className="guided-final-review-write-summary">
        <article>
          <strong>{reviewedRecordCount}</strong>
          <span>record(s) updated by review</span>
        </article>
        <article>
          <strong>{correctionSummaries.length}</strong>
          <span>field correction(s) captured</span>
        </article>
        <article>
          <strong>{learningEventCount}</strong>
          <span>learning event(s) written</span>
        </article>
      </div>

      {correctionSummaries.length > 0 ? (
        <details className="guided-workflow-details guided-workflow-details--compact guided-final-correction-details">
          <summary>View correction details</summary>
          <div className="guided-final-correction-record-list">
            {groupedCorrectionSummaries.slice(0, 8).map((group) => (
              <article
                className="guided-final-correction-record"
                key={group.recordLabel}
              >
                <h5>{group.recordLabel}</h5>
                <dl>
                  {group.corrections.map((correction) => (
                    <div key={`${correction.fieldName}-${correction.afterValue}`}>
                      <dt>{correction.label}</dt>
                      <dd>
                        <span>{correction.beforeValue}</span>
                        <strong>→</strong>
                        <span>{correction.afterValue}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
          {groupedCorrectionSummaries.length > 8 ? (
            <p className="guided-validation-empty-note">
              Showing 8 of {groupedCorrectionSummaries.length} corrected records.
            </p>
          ) : null}
        </details>
      ) : (
        <div className="guided-final-review-callout">
          <strong>
            {reviewedRecordCount === 0 && learningEventCount === 0
              ? "No review writes were needed for this run"
              : "No field-level review corrections captured"}
          </strong>
          <p>
            {reviewedRecordCount === 0 && learningEventCount === 0
              ? "The records either cleared validation or still need review. No correction or learning-event writes were captured."
              : "Review actions were recorded, but no field-level correction details were written."}
          </p>
        </div>
      )}
    </section>
  );
}
