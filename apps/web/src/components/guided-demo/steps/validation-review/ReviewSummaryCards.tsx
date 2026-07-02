import { formatStatusLabel } from "./validationReviewUtils";

type ReviewSummaryCardsProps = {
  qualityStatus: string;
  recordsResolvedByReviewCount: number;
  recordsStillNeedingAttentionCount: number;
  reviewItemsCreatedCount: number;
};

export function ReviewSummaryCards({
  qualityStatus,
  recordsResolvedByReviewCount,
  recordsStillNeedingAttentionCount,
  reviewItemsCreatedCount,
}: ReviewSummaryCardsProps) {
  return (
    <div className="guided-validation-summary-grid">
      <article>
        <strong>{formatStatusLabel(qualityStatus)}</strong>
        <span>quality status</span>
      </article>
      <article>
        <strong>{recordsStillNeedingAttentionCount}</strong>
        <span>still needs attention</span>
      </article>
      <article>
        <strong>{recordsResolvedByReviewCount}</strong>
        <span>resolved by review</span>
      </article>
      <article>
        <strong>{reviewItemsCreatedCount}</strong>
        <span>review items created</span>
      </article>
    </div>
  );
}
