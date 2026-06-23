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
import { GuidedAiReadyRecordsStep } from "./steps/GuidedAiReadyRecordsStep";
import { GuidedGuardedAgentExecutionStep } from "./steps/GuidedGuardedAgentExecutionStep";
import { GuidedMessySourceIntakeStep } from "./steps/GuidedMessySourceIntakeStep";
import { GuidedRunSetupStep } from "./steps/GuidedRunSetupStep";
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
            <GuidedRunSetupStep onContinue={() => setActiveStep("MESSY_SOURCE_INTAKE")} />
          ) : null}

          {activeStep === "MESSY_SOURCE_INTAKE" ? (
            <GuidedMessySourceIntakeStep
              error={sourceIntakeError}
              isRunning={isRunningSourceIntake}
              onRunSources={handleRunSourceIntake}
              result={sourceIntakeResult}
              success={sourceIntakeSuccess}
            />
          ) : null}

          {activeStep === "AI_READY_RECORDS" ? (
            <GuidedAiReadyRecordsStep
              onContinue={() => setActiveStep("GUARDED_AGENT_EXECUTION")}
              persistedRecords={sourceIntakePersistedRecords}
              result={sourceIntakeResult}
            />
          ) : null}

          {activeStep === "GUARDED_AGENT_EXECUTION" ? (
            <GuidedGuardedAgentExecutionStep
              error={tradeInError}
              generatedWorkflowInput={generatedWorkflowInput}
              isRunning={isRunningTradeInWorkflow}
              onContinue={() => setActiveStep("VALIDATION_REVIEW")}
              onRawInputChange={onTradeInRawInputChange}
              onRunWorkflow={onRunTradeInWorkflow}
              rawInput={tradeInRawInput}
              result={tradeInResult}
              success={tradeInSuccess}
            />
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
