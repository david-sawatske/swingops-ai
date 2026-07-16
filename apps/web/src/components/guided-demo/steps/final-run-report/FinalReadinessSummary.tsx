export function FinalReadinessSummary({
  finalRecordsStillNeedingReviewCount,
  mergedRecordCount,
  openReviewItemCount,
}: {
  finalRecordsStillNeedingReviewCount: number;
  mergedRecordCount: number;
  openReviewItemCount: number;
}) {
  const title =
    mergedRecordCount === 0
      ? "No current records were loaded for this run"
      : openReviewItemCount === 0
        ? "No current-run review items remain open"
        : `${openReviewItemCount} item(s) still need human review`;

  const detail =
    mergedRecordCount === 0
      ? "Step 5 has a workflow result, but no Step 2 candidate records were available to merge into final output."
      : openReviewItemCount === 0
        ? finalRecordsStillNeedingReviewCount === 0
          ? "The merged final output is ready for RAG or downstream use."
          : `${finalRecordsStillNeedingReviewCount} merged record(s) are still flagged for review.`
        : "Return to Step 4 to resolve the remaining review items before treating the run as complete.";

  return (
    <section className="guided-final-section">
      <div className="guided-final-section__header">
        <h4>Ready now / still needs attention</h4>
      </div>

      <div className="guided-final-review-callout">
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </section>
  );
}
