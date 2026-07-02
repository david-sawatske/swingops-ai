import type { ReactNode } from "react";

import type { RecordReviewCard } from "./validationReviewTypes";

type PassedGatesSectionProps = {
  passedGateRecordCards: RecordReviewCard[];
  renderRecordReviewCard: (card: RecordReviewCard) => ReactNode;
  shouldOpenPassedGateRecords: boolean;
};

export function PassedGatesSection({
  passedGateRecordCards,
  renderRecordReviewCard,
  shouldOpenPassedGateRecords,
}: PassedGatesSectionProps) {
  if (passedGateRecordCards.length === 0) {
    return null;
  }

  return (
    <section className="guided-passed-gates-section">
      <div className="guided-passed-gates-section__header">
        <span>Passed gates</span>
      </div>

      <details
        className="guided-passed-gates-records"
        open={shouldOpenPassedGateRecords}
      >
        <summary>
          <div>
            <strong>
              {passedGateRecordCards.length} record
              {passedGateRecordCards.length === 1 ? "" : "s"} passed review gates
            </strong>
          </div>

        </summary>

        <div className="guided-record-review-list guided-record-review-list--passed-gates">
          {passedGateRecordCards.map(renderRecordReviewCard)}
        </div>
      </details>
    </section>
  );
}
