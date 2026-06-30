import type { ExecuteEndToEndAgenticTradeInDemoResponse } from "../../../../types/workflow";

function WorkflowRecapStep({
  body,
  eyebrow,
  metric,
  title,
}: {
  body: string;
  eyebrow: string;
  metric: string;
  title: string;
}) {
  return (
    <article className="guided-final-workflow-step-card">
      <span className="model-route-card__eyebrow">{eyebrow}</span>
      <div>
        <strong>{metric}</strong>
        <h5>{title}</h5>
      </div>
      <p>{body}</p>
    </article>
  );
}

export function FinalWorkflowRecap({
  candidateRecordCount,
  createdReviewItemCount,
  finalSummary,
  learningEventCount,
  mergedRecordCount,
  openReviewItemCount,
  ragReadyRecordCount,
  resolvedReviewItemCount,
  reviewedRecordCount,
}: {
  candidateRecordCount: number;
  createdReviewItemCount: number;
  finalSummary: ExecuteEndToEndAgenticTradeInDemoResponse["finalSummary"];
  learningEventCount: number;
  mergedRecordCount: number;
  openReviewItemCount: number;
  ragReadyRecordCount: number;
  resolvedReviewItemCount: number;
  reviewedRecordCount: number;
}) {
  return (
    <section className="guided-final-section">
      <div className="guided-final-section__header">
        <h4>Workflow recap</h4>
        <p>These cards match the same numbered workflow shown in the left rail.</p>
      </div>

      <div className="guided-final-workflow-recap">
        <WorkflowRecapStep
          body="Guarded trade-in run with review gates, read-only tools, and audit logging."
          eyebrow="1 · Run Setup"
          metric="Ready"
          title="Configured"
        />
        <WorkflowRecapStep
          body="Messy trade-in notes were submitted and prepared for normalization."
          eyebrow="2 · Messy Source Intake"
          metric={String(finalSummary.parsedItemCount)}
          title="Records processed"
        />
        <WorkflowRecapStep
          body={`${candidateRecordCount} candidate AI-ready record(s) were persisted from intake.`}
          eyebrow="3 · AI-Ready Record Creation"
          metric={String(candidateRecordCount)}
          title="Candidates created"
        />
        <WorkflowRecapStep
          body={`${finalSummary.knowledgeMatchCount} RAG match(es), ${finalSummary.inventoryMatchCount} inventory match(es), ${finalSummary.valuationRangeCount} valuation range(s), ${finalSummary.blockedMutationToolCallCount} blocked action(s).`}
          eyebrow="4 · Guarded Agent Execution"
          metric={`${finalSummary.successfulReadOnlyToolCallCount}`}
          title="Tool calls"
        />
        <WorkflowRecapStep
          body={`${createdReviewItemCount} review item(s) created. ${resolvedReviewItemCount} resolved and ${openReviewItemCount} open.`}
          eyebrow="5 · Validation and Review"
          metric={`${openReviewItemCount}`}
          title="Open review"
        />
        <WorkflowRecapStep
          body={`${mergedRecordCount} merged final record(s), ${reviewedRecordCount} reviewed write(s), ${learningEventCount} learning event(s).`}
          eyebrow="6 · Final Run Report"
          metric={String(ragReadyRecordCount)}
          title="Ready records"
        />
      </div>
    </section>
  );
}
