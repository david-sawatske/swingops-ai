import { FormEvent, useEffect, useState } from "react";

import type { AppView } from "../../constants/appNav";
import type {
  AiReadyIntakeRecord,
  ExecuteEndToEndAgenticTradeInDemoResponse,
  ExecuteMultiSourceIntakeDemoRequest,
  ExecuteMultiSourceIntakeDemoResponse,
  GlobalReviewQueueItem,
  GlobalWorkflowRunSummary,
  ResolveReviewQueueItemWithCorrectionsRequest,
} from "../../types/workflow";
import { GuidedSourceIntakeBuilder } from "./GuidedSourceIntakeBuilder";
import { GuidedWorkflowStepper } from "./GuidedWorkflowStepper";

export type GuidedStep =
  | "RUN_SETUP"
  | "MESSY_SOURCE_INTAKE"
  | "AI_READY_RECORDS"
  | "GUARDED_AGENT_EXECUTION"
  | "VALIDATION_REVIEW"
  | "FINAL_RUN_REPORT";

const GUIDED_STEPS: {
  id: GuidedStep;
  label: string;
  eyebrow: string;
  description: string;
}[] = [
  {
    id: "RUN_SETUP",
    label: "Run Setup",
    eyebrow: "1",
    description: "Understand the business workflow before running anything.",
  },
  {
    id: "MESSY_SOURCE_INTAKE",
    label: "Messy Source Intake",
    eyebrow: "2",
    description: "Normalize messy operational source text into candidate records.",
  },
  {
    id: "AI_READY_RECORDS",
    label: "AI-Ready Record Creation",
    eyebrow: "3",
    description: "Inspect the structured records created by intake.",
  },
  {
    id: "GUARDED_AGENT_EXECUTION",
    label: "Guarded Agent Execution",
    eyebrow: "4",
    description: "Run a controlled workflow from the AI-ready records.",
  },
  {
    id: "VALIDATION_REVIEW",
    label: "Validation and Review",
    eyebrow: "5",
    description: "Understand what the workflow trusted and what it escalated.",
  },
  {
    id: "FINAL_RUN_REPORT",
    label: "Final Run Report",
    eyebrow: "6",
    description: "Summarize what happened in plain business language.",
  },
];

type GuidedDemoPathPageProps = {
  activeStep: GuidedStep;
  onActiveStepChange: (step: GuidedStep) => void;
  sourceIntakeResult: ExecuteMultiSourceIntakeDemoResponse | null;
  sourceIntakeError: string | null;
  sourceIntakeSuccess: string | null;
  sourceIntakePersistedRecords: AiReadyIntakeRecord[];
  isRunningSourceIntake: boolean;
  tradeInRawInput: string;
  tradeInResult: ExecuteEndToEndAgenticTradeInDemoResponse | null;
  tradeInError: string | null;
  tradeInSuccess: string | null;
  isRunningTradeInWorkflow: boolean;
  workflowRuns: GlobalWorkflowRunSummary[];
  reviewQueueItems: GlobalReviewQueueItem[];
  openReviewQueueItemCount: number;
  toolCallLogCount: number;
  onTradeInRawInputChange: (rawInput: string) => void;
  onRunSourceIntake: (request?: ExecuteMultiSourceIntakeDemoRequest) => void;
  onRunTradeInWorkflow: (event: FormEvent<HTMLFormElement>) => void;
  onViewChange: (view: AppView) => void;
  activeReviewQueueItemId: string | null;
  reviewQueueNotesById: Record<string, string>;
  onReviewQueueNotesChange: (reviewQueueItemId: string, reviewerNotes: string) => void;
  onReviewQueueItemAction: (input: {
    reviewQueueItemId: string;
    action: "resolve" | "dismiss";
    workflowRunId?: string | null;
    intakeBatchId?: string | null;
  }) => void;
  onResolveReviewQueueItemWithCorrections: (input: {
    reviewQueueItemId: string;
    request: ResolveReviewQueueItemWithCorrectionsRequest;
    workflowRunId?: string | null;
    intakeBatchId?: string | null;
  }) => void;
};

function getStepIndex(step: GuidedStep) {
  return GUIDED_STEPS.findIndex((item) => item.id === step);
}

function formatGeneratedWorkflowInput(
  result: ExecuteMultiSourceIntakeDemoResponse,
) {
  return result.cleanedDatasetPreview
    .map((record, index) => {
      const identity = [record.brand, record.productLine, record.category]
        .filter(Boolean)
        .join(" ");

      const details = [
        record.shaftFlex ? "shaft flex " + record.shaftFlex : null,
        record.conditionGrade ? "condition " + record.conditionGrade : null,
        record.tradeInValue === null ? null : "trade value $" + record.tradeInValue,
        record.storeId ? "store " + record.storeId : null,
        record.reviewNeeded ? "review needed" : "review clear",
      ].filter(Boolean);

      return (
        String(index + 1) +
        ". " +
        (identity || "Unknown equipment") +
        (details.length > 0 ? " — " + details.join("; ") : "")
      );
    })
    .join("\n");
}

export function GuidedDemoPathPage({
  activeStep,
  onActiveStepChange,
  sourceIntakeResult,
  sourceIntakeError,
  sourceIntakeSuccess,
  sourceIntakePersistedRecords,
  isRunningSourceIntake,
  tradeInRawInput,
  tradeInResult,
  tradeInError,
  tradeInSuccess,
  isRunningTradeInWorkflow,
  workflowRuns,
  reviewQueueItems,
  openReviewQueueItemCount,
  toolCallLogCount,
  onTradeInRawInputChange,
  onRunSourceIntake,
  onRunTradeInWorkflow,
  onViewChange,
  activeReviewQueueItemId,
  reviewQueueNotesById,
  onReviewQueueNotesChange,
  onReviewQueueItemAction,
  onResolveReviewQueueItemWithCorrections,
}: GuidedDemoPathPageProps) {
  const [generatedWorkflowInput, setGeneratedWorkflowInput] = useState("");

  void workflowRuns;
  void reviewQueueItems;
  void openReviewQueueItemCount;
  void toolCallLogCount;
  void activeReviewQueueItemId;
  void reviewQueueNotesById;
  void onReviewQueueNotesChange;
  void onReviewQueueItemAction;
  void onResolveReviewQueueItemWithCorrections;

  useEffect(() => {
    if (!sourceIntakeResult) {
      return;
    }

    const nextGeneratedInput = formatGeneratedWorkflowInput(sourceIntakeResult);
    setGeneratedWorkflowInput(nextGeneratedInput);

    if (!tradeInRawInput.trim()) {
      onTradeInRawInputChange(nextGeneratedInput);
    }
  }, [onTradeInRawInputChange, sourceIntakeResult, tradeInRawInput]);

  function setActiveStep(step: GuidedStep) {
    onActiveStepChange(step);
  }

  function canOpenStep(step: GuidedStep) {
    if (step === "RUN_SETUP" || step === "MESSY_SOURCE_INTAKE") {
      return true;
    }

    if (step === "AI_READY_RECORDS" || step === "GUARDED_AGENT_EXECUTION") {
      return Boolean(sourceIntakeResult);
    }

    return Boolean(tradeInResult);
  }

  function isStepComplete(step: GuidedStep) {
    const stepIndex = getStepIndex(step);
    const currentStepIndex = getStepIndex(activeStep);

    if (stepIndex >= currentStepIndex) {
      return false;
    }

    if (step === "RUN_SETUP") {
      return true;
    }

    if (step === "MESSY_SOURCE_INTAKE" || step === "AI_READY_RECORDS") {
      return Boolean(sourceIntakeResult);
    }

    return Boolean(tradeInResult);
  }

  function getStepStatus(step: GuidedStep, index: number) {
    if (isStepComplete(step)) {
      return "Done";
    }

    if (index === getStepIndex(activeStep)) {
      return "Current";
    }

    if (!canOpenStep(step)) {
      return "Locked";
    }

    return "Ready";
  }

  function handleRunSourceIntake(request?: ExecuteMultiSourceIntakeDemoRequest) {
    onRunSourceIntake(request);
    setActiveStep("AI_READY_RECORDS");
  }

  function handleResetGuidedDemo() {
    setGeneratedWorkflowInput("");
    onTradeInRawInputChange("");
    setActiveStep("RUN_SETUP");
  }

  return (
    <div className="guided-workflow-page">
      <header className="guided-workflow-page-hero">
        <div>
          <span className="model-route-card__eyebrow">Guided operations run</span>
          <h2>Build the workflow one step at a time.</h2>
          <p>
            This page is intentionally bare. Each step explains what is happening before
            adding more technical detail.
          </p>
        </div>

        <div className="guided-workflow-page-hero__outcome">
          <span>Current phase</span>
          <strong>{GUIDED_STEPS[getStepIndex(activeStep)]?.label ?? "Run Setup"}</strong>
          <p>{GUIDED_STEPS[getStepIndex(activeStep)]?.description}</p>
        </div>
      </header>

      <div className="guided-workflow-shell">
        <GuidedWorkflowStepper
          activeStep={activeStep}
          canOpenStep={canOpenStep}
          getStepStatus={getStepStatus}
          onStepChange={setActiveStep}
          steps={GUIDED_STEPS}
        />

        <section className="guided-workflow-panel">
          {activeStep === "RUN_SETUP" ? (
            <article className="guided-workflow-card guided-workflow-card--hero">
              <span className="model-route-card__eyebrow">Step 1 · Run Setup</span>
              <h3>What operational job is this run supposed to complete?</h3>
              <p>
                A golf retail team receives trade-in details through messy customer
                messages, counter notes, malformed CSV rows, and system logs. The goal of
                this run is to turn those signals into reviewed AI-ready records and a clear
                explanation of what happened.
              </p>

              <section className="guided-flow-overview">
                <div className="guided-flow-overview__header">
                  <h4>Run overview</h4>
                  <p>
                    This is the path the guided demo will follow. Each phase adds one
                    layer of operational context before showing the technical evidence.
                  </p>
                </div>

                <div className="guided-workflow-flowline" aria-label="Guided workflow phases">
                  <span>Messy inputs</span>
                  <span>Structured records</span>
                  <span>Guarded workflow</span>
                  <span>System evidence</span>
                  <span>Review gate</span>
                  <span>Run report</span>
                </div>
              </section>

              <section className="guided-explainer-list" aria-label="Run setup explanation">
                <article>
                  <strong>Business trigger</strong>
                  <p>
                    Trade-in data is incomplete, inconsistent, and spread across several
                    operational sources.
                  </p>
                </article>

                <article>
                  <strong>Workflow objective</strong>
                  <p>
                    Normalize the source data, prepare durable records, run controlled AI
                    steps, and preserve evidence for review.
                  </p>
                </article>

                <article>
                  <strong>Why it matters</strong>
                  <p>
                    The system should not silently guess. It should show what was extracted,
                    what systems were used, and what still needs review.
                  </p>
                </article>
              </section>

              <details className="guided-workflow-details">
                <summary>View the technical layers this run will demonstrate</summary>
                <p className="guided-workflow-details__intro">
                  These are the layers you will see as the guided demo progresses. They
                  explain how the workflow moves from messy source data to controlled,
                  reviewable output.
                </p>

                <div className="guided-explainer-list">
                  <article>
                    <strong>Source layer</strong>
                    <p>
                      Messy trade-in text is normalized into structured records with
                      required fields, missing-field signals, and review flags.
                    </p>
                  </article>

                  <article>
                    <strong>System layer</strong>
                    <p>
                      The workflow can use knowledge retrieval, inventory matching,
                      valuation estimates, model routing, read-only tools, and audit logs.
                    </p>
                  </article>

                  <article>
                    <strong>Control layer</strong>
                    <p>
                      The workflow should not silently guess or write unsafe changes.
                      Low-confidence output is routed to review, and unsafe mutation
                      requests are blocked.
                    </p>
                  </article>
                </div>
              </details>

              <section className="guided-next-step-note">
                <h4>What to look for as you continue</h4>
                <p>
                  Each following step should answer one question: what changed, which
                  system was involved, and why that output can or cannot be trusted yet.
                </p>
              </section>

              <button onClick={() => setActiveStep("MESSY_SOURCE_INTAKE")} type="button">
                Continue to Step 2
              </button>
            </article>
          ) : null}

          {activeStep === "MESSY_SOURCE_INTAKE" ? (
            <article className="guided-workflow-card">
              <span className="model-route-card__eyebrow">Step 2 · Messy Source Intake</span>
              <h3>What happens in this step?</h3>
              <p>
                We provide messy source text. The intake workflow extracts candidate golf
                trade-in records and identifies missing or uncertain fields.
              </p>

              <h4>Live part of this step</h4>
              <p>
                Use the source intake builder below. After it runs, the next step will show
                the structured records it produced.
              </p>

              <GuidedSourceIntakeBuilder
                error={sourceIntakeError}
                isRunning={isRunningSourceIntake}
                onRunSources={handleRunSourceIntake}
                result={sourceIntakeResult}
                success={sourceIntakeSuccess}
              />
            </article>
          ) : null}

          {activeStep === "AI_READY_RECORDS" ? (
            <article className="guided-workflow-card">
              <span className="model-route-card__eyebrow">Step 3 · AI-Ready Record Creation</span>
              <h3>What did intake create?</h3>
              <p>
                The messy source text becomes normalized records with fields like brand,
                product, category, shaft flex, condition grade, value, store, and review
                status.
              </p>

              {sourceIntakeResult ? (
                <>
                  <h4>Cleaned record preview</h4>
                  <div className="multi-source-intake-table-wrap">
                    <table className="multi-source-intake-table">
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th>Brand</th>
                          <th>Product</th>
                          <th>Category</th>
                          <th>Flex</th>
                          <th>Condition grade</th>
                          <th>Value</th>
                          <th>Review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sourceIntakeResult.cleanedDatasetPreview.slice(0, 6).map((record) => (
                          <tr key={record.id}>
                            <td>{record.sourceType.replace(/_/g, " ")}</td>
                            <td>{record.brand ?? "—"}</td>
                            <td>{record.productLine ?? "—"}</td>
                            <td>{record.category ?? "—"}</td>
                            <td>{record.shaftFlex ?? "—"}</td>
                            <td>{record.conditionGrade ?? "—"}</td>
                            <td>{record.tradeInValue === null ? "—" : record.tradeInValue}</td>
                            <td>{record.reviewNeeded ? "Needed" : "Clear"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p>
                    Persisted AI-ready records loaded: {sourceIntakePersistedRecords.length}.
                    We will expand this later after the basic story is clear.
                  </p>

                  <button onClick={() => setActiveStep("GUARDED_AGENT_EXECUTION")} type="button">
                    Continue to Step 4
                  </button>
                </>
              ) : (
                <p>Run Step 2 first so this step has records to show.</p>
              )}
            </article>
          ) : null}

          {activeStep === "GUARDED_AGENT_EXECUTION" ? (
            <article className="guided-workflow-card">
              <span className="model-route-card__eyebrow">Step 4 · Guarded Agent Execution</span>
              <h3>What happens after records are AI-ready?</h3>
              <p>
                The structured records become input for the guarded trade-in workflow. This
                workflow can use model routing, knowledge search, internal read-only tools,
                validation, review routing, and audit logging.
              </p>

              <h4>Generated workflow input</h4>
              <p>
                This is generated from the records created in Step 3. For now, we only show
                the handoff text and a run button.
              </p>

              <form className="agentic-demo-form guided-workflow-run-form" onSubmit={onRunTradeInWorkflow}>
                <textarea
                  onChange={(event) => onTradeInRawInputChange(event.target.value)}
                  rows={7}
                  value={tradeInRawInput || generatedWorkflowInput}
                />

                <button
                  disabled={isRunningTradeInWorkflow || !(tradeInRawInput || generatedWorkflowInput).trim()}
                  type="submit"
                >
                  {isRunningTradeInWorkflow ? "Running…" : "Run Guarded Workflow"}
                </button>
              </form>

              {tradeInError ? <p>{tradeInError}</p> : null}
              {tradeInSuccess ? <p>{tradeInSuccess}</p> : null}

              {tradeInResult ? (
                <button onClick={() => setActiveStep("VALIDATION_REVIEW")} type="button">
                  Continue to Step 5
                </button>
              ) : null}
            </article>
          ) : null}

          {activeStep === "VALIDATION_REVIEW" ? (
            <article className="guided-workflow-card">
              <span className="model-route-card__eyebrow">Step 5 · Validation and Review</span>
              <h3>What did the workflow trust, retry, or escalate?</h3>
              <p>
                This step will eventually show validation checks, retry behavior, review
                items, and correction controls. For now, it only confirms that the guarded
                workflow produced evidence.
              </p>

              {tradeInResult ? (
                <>
                  <p>
                    Workflow created {tradeInResult.reviewQueueItemsCreated.length} review
                    item(s). We will build this section carefully in a later pass.
                  </p>

                  <button onClick={() => onViewChange("REVIEW_QUEUE")} type="button">
                    Open Review Queue
                  </button>

                  <button onClick={() => setActiveStep("FINAL_RUN_REPORT")} type="button">
                    Continue to Step 6
                  </button>
                </>
              ) : (
                <p>Run Step 4 first so this step has workflow evidence to explain.</p>
              )}
            </article>
          ) : null}

          {activeStep === "FINAL_RUN_REPORT" ? (
            <article className="guided-workflow-card">
              <span className="model-route-card__eyebrow">Step 6 · Final Run Report</span>
              <h3>What happened in this run?</h3>
              <p>
                The final report should translate technical workflow evidence into a clear
                business outcome. For now, we keep it plain and minimal.
              </p>

              {tradeInResult ? (
                <>
                  <p>
                    The run parsed {tradeInResult.finalSummary.parsedItemCount} item(s),
                    found {tradeInResult.finalSummary.knowledgeMatchCount} knowledge
                    match(es), created {tradeInResult.reviewQueueItemsCreated.length} review
                    item(s), and blocked{" "}
                    {tradeInResult.finalSummary.blockedMutationToolCallCount} unsafe
                    mutation request(s).
                  </p>

                  <button onClick={handleResetGuidedDemo} type="button">
                    Start over
                  </button>
                </>
              ) : (
                <p>Run Step 4 first so this report has a workflow result.</p>
              )}
            </article>
          ) : null}
        </section>
      </div>
    </div>
  );
}
