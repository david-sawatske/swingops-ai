import type {
  AiReadyIntakeRecord,
  ExecuteEndToEndAgenticTradeInDemoResponse,
  GlobalReviewQueueItem,
  ReviewedTradeInRecord,
} from "../../../../types/workflow";

import { FinalAuditTrace } from "./FinalAuditTrace";
import { FinalReadinessSummary } from "./FinalReadinessSummary";
import { FinalizedRecordsTable } from "./FinalizedRecordsTable";
import { FinalWorkflowRecap } from "./FinalWorkflowRecap";
import { ReviewChangesSummary } from "./ReviewChangesSummary";
import {
  buildMergedRecord,
  getCorrectionSummaries,
  getGroupedCorrectionSummaries,
  getRecordSummary,
  getRunSummaryText,
} from "./finalRunReportUtils";

type GuidedFinalRunReportStepProps = {
  currentRunAiReadyRecords: AiReadyIntakeRecord[];
  currentRunReviewQueueItems: GlobalReviewQueueItem[];
  onReset: () => void;
  result: ExecuteEndToEndAgenticTradeInDemoResponse | null;
  sourceIntakePersistedRecords: AiReadyIntakeRecord[];
};

export function GuidedFinalRunReportStep({
  currentRunAiReadyRecords,
  currentRunReviewQueueItems,
  onReset,
  result,
  sourceIntakePersistedRecords,
}: GuidedFinalRunReportStepProps) {
  const finalSummary = result?.finalSummary ?? null;
  const qualitySummary = result?.workflowQualitySummary ?? null;
  const candidateRecords = sourceIntakePersistedRecords.map(getRecordSummary);
  const finalRecords = currentRunAiReadyRecords.map(getRecordSummary);
  const mergedRecords =
    result && candidateRecords.length > 0
      ? candidateRecords.map((candidateRecord, index) =>
          buildMergedRecord({
            candidateRecord,
            index,
            result,
            reviewItems: currentRunReviewQueueItems,
          }),
        )
      : [];
  const createdReviewItemCount = finalSummary?.reviewQueueItemCount ?? 0;
  const openReviewItemCount =
    currentRunReviewQueueItems.length > 0
      ? currentRunReviewQueueItems.filter(
          (item) => item.status === "OPEN" || item.status === "IN_REVIEW",
        ).length
      : createdReviewItemCount;
  const resolvedReviewItemCount = currentRunReviewQueueItems.filter(
    (item) => item.status === "RESOLVED",
  ).length;
  const dismissedReviewItemCount = currentRunReviewQueueItems.filter(
    (item) => item.status === "DISMISSED",
  ).length;
  const reviewedRecords = currentRunReviewQueueItems
    .map((item) => item.reviewedTradeInRecord)
    .filter((record): record is ReviewedTradeInRecord => Boolean(record));
  const learningEvents = currentRunReviewQueueItems.flatMap(
    (item) => item.humanReviewLearningEvents,
  );
  const correctionSummaries = getCorrectionSummaries(currentRunReviewQueueItems);
  const groupedCorrectionSummaries = getGroupedCorrectionSummaries(correctionSummaries);
  const ragReadyRecordCount = mergedRecords.filter((record) => record.ragReady).length;
  const finalRecordsStillNeedingReviewCount = mergedRecords.filter(
    (record) => record.status === "NEEDS_REVIEW" || record.reviewNeeded,
  ).length;
  const reviewStatusSummary =
    createdReviewItemCount === 0
      ? "No review items created."
      : [
          `${createdReviewItemCount} created`,
          `${openReviewItemCount} open`,
          `${resolvedReviewItemCount} resolved`,
          dismissedReviewItemCount > 0 ? `${dismissedReviewItemCount} dismissed` : null,
        ]
          .filter(Boolean)
          .join("; ");

  const outcomeTitle =
    mergedRecords.length === 0
      ? "Workflow result loaded, but no finalized records were available."
      : openReviewItemCount > 0
        ? "Workflow completed with review work still open."
        : "Workflow completed and final output is ready.";

  const summaryText =
    finalSummary && qualitySummary
      ? getRunSummaryText({
          candidateRecordCount: candidateRecords.length,
          currentRunFinalRecordCount: finalRecords.length,
          learningEventCount: learningEvents.length,
          openReviewItemCount,
          parsedItemCount: finalSummary.parsedItemCount,
          ragReadyRecordCount,
          resolvedReviewItemCount,
          reviewedRecordCount: reviewedRecords.length,
          reviewItemCount: createdReviewItemCount,
        })
      : "";

  return (
    <article className="guided-workflow-card">
      <section className="guided-step-orientation">
        <span className="model-route-card__eyebrow">
          Step 6 · Final Run Report
        </span>
        <h3>What happened across the six-step workflow?</h3>
        <p>
          The final report mirrors the workflow you just walked through: setup, messy
          intake, AI-ready records, guarded execution, validation review, and final
          written output.
        </p>

        <div className="guided-step-mini-list" aria-label="Final report explanation">
          <article>
            <strong>Input</strong>
            <p>Source intake records, workflow trace, review decisions, and persisted output records.</p>
          </article>

          <article>
            <strong>Action</strong>
            <p>Summarize what each guided workflow step did to the data.</p>
          </article>

          <article>
            <strong>Output</strong>
            <p>A final report showing merged final records, review changes, final writes, and readiness.</p>
          </article>
        </div>
      </section>

      <section className="guided-step-workspace">
        <div className="guided-step-workspace__header">
          <div>
            <span className="model-route-card__eyebrow">Do the work</span>
            <h4>Read the workflow from intake to final output</h4>
            <p>
              This report uses the same six steps as the guided run and shows the merged
              final state first.
            </p>
          </div>
        </div>

        {result && finalSummary && qualitySummary ? (
          <>
            <section className="guided-final-outcome-card guided-final-outcome-card--story">
              <span className="model-route-card__eyebrow">Run outcome</span>
              <h4>{outcomeTitle}</h4>
              <p>{summaryText}</p>
            </section>

            <FinalWorkflowRecap
              candidateRecordCount={candidateRecords.length}
              createdReviewItemCount={createdReviewItemCount}
              finalSummary={finalSummary}
              learningEventCount={learningEvents.length}
              mergedRecordCount={mergedRecords.length}
              openReviewItemCount={openReviewItemCount}
              ragReadyRecordCount={ragReadyRecordCount}
              resolvedReviewItemCount={resolvedReviewItemCount}
              reviewedRecordCount={reviewedRecords.length}
            />

            <section className="guided-final-section">
              <div className="guided-final-section__header">
                <h4>Finalized records</h4>
                <p>
                  This table shows the final form of each record after intake cleanup,
                  guarded enrichment, valuation evidence, and human review corrections.
                  The preview uses the same columns and layout as the Step 3 snapshot.
                  Open the full table to see value ranges and how each record was finalized.
                </p>
              </div>

              <FinalizedRecordsTable records={mergedRecords} />
            </section>

            <ReviewChangesSummary
              correctionSummaries={correctionSummaries}
              groupedCorrectionSummaries={groupedCorrectionSummaries}
              learningEventCount={learningEvents.length}
              reviewedRecordCount={reviewedRecords.length}
            />

            <FinalReadinessSummary
              finalRecordsStillNeedingReviewCount={finalRecordsStillNeedingReviewCount}
              mergedRecordCount={mergedRecords.length}
              openReviewItemCount={openReviewItemCount}
            />

            <FinalAuditTrace
              candidateRecordCount={candidateRecords.length}
              createdReviewItemCount={createdReviewItemCount}
              finalRecordCount={finalRecords.length}
              finalSummary={finalSummary}
              openReviewItemCount={openReviewItemCount}
              qualitySummary={qualitySummary}
              result={result}
              reviewStatusSummary={reviewStatusSummary}
            />

            <button className="guided-step-primary-action" onClick={onReset} type="button">
              Start over
            </button>
          </>
        ) : (
          <div className="guided-final-review-callout">
            <strong>Final report waiting for a workflow result</strong>
            <p>
              Run Step 4 first. If Step 4 failed before final output, fix the error
              shown there and rerun the guarded workflow.
            </p>
          </div>
        )}
      </section>
    </article>
  );
}
