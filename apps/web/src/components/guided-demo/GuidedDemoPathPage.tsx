import { FormEvent, useEffect, useRef, useState } from "react";

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
import { GuidedFinalRunReportStep } from "./steps/GuidedFinalRunReportStep";
import { GuidedGuardedAgentExecutionStep } from "./steps/GuidedGuardedAgentExecutionStep";
import { GuidedValidationReviewStep } from "./steps/GuidedValidationReviewStep";
import { GuidedMessySourceIntakeStep } from "./steps/GuidedMessySourceIntakeStep";
import { GuidedRunSetupStep } from "./steps/GuidedRunSetupStep";
import { GuidedWorkflowStepper } from "./GuidedWorkflowStepper";

export type GuidedStep =
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
    id: "MESSY_SOURCE_INTAKE",
    label: "Messy Source Intake",
    eyebrow: "Step 1",
    description: "Normalize messy operational source text into candidate records.",
  },
  {
    id: "AI_READY_RECORDS",
    label: "AI-Ready Record Creation",
    eyebrow: "Step 2",
    description: "Inspect the structured records created by intake.",
  },
  {
    id: "GUARDED_AGENT_EXECUTION",
    label: "Guarded Agent Execution",
    eyebrow: "Step 3",
    description: "Run a controlled workflow from the AI-ready records.",
  },
  {
    id: "VALIDATION_REVIEW",
    label: "Validation and Human Review",
    eyebrow: "Step 4",
    description: "Understand what the workflow trusted and what it escalated.",
  },
  {
    id: "FINAL_RUN_REPORT",
    label: "Final Run Report",
    eyebrow: "Step 5",
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
  currentRunAiReadyRecords: AiReadyIntakeRecord[];
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
  reviewQueueActionSuccess: string | null;
  reviewQueueActionError: string | null;
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
  onResetGuidedRun: () => void;
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
  currentRunAiReadyRecords,
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
  reviewQueueActionSuccess,
  reviewQueueActionError,
  activeReviewQueueItemId,
  reviewQueueNotesById,
  onReviewQueueNotesChange,
  onReviewQueueItemAction,
  onResolveReviewQueueItemWithCorrections,
  onResetGuidedRun,
}: GuidedDemoPathPageProps) {
  const [generatedWorkflowInput, setGeneratedWorkflowInput] = useState("");
  const [isOverviewActive, setIsOverviewActive] = useState(true);
  const [shouldAdvanceAfterSourceIntake, setShouldAdvanceAfterSourceIntake] =
    useState(false);
  const activeStepPanelRef = useRef<HTMLElement | null>(null);
  const hasMountedStepScrollRef = useRef(false);

  void workflowRuns;
  void openReviewQueueItemCount;
  void toolCallLogCount;
  void onReviewQueueItemAction;

  const activeStepIndex = getStepIndex(activeStep);
  const currentStep = GUIDED_STEPS[activeStepIndex] ?? GUIDED_STEPS[0];

  const currentTradeInWorkflowRunId = tradeInResult?.persisted.workflowRunId ?? null;
  const currentRunReviewQueueItems = currentTradeInWorkflowRunId
    ? reviewQueueItems.filter(
        (item) => item.workflowRunId === currentTradeInWorkflowRunId,
      )
    : [];

  function scrollToStepPanel() {
    window.requestAnimationFrame(() => {
      activeStepPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

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

  useEffect(() => {
    if (!hasMountedStepScrollRef.current) {
      hasMountedStepScrollRef.current = true;
      return;
    }

    scrollToStepPanel();
  }, [activeStep]);

  useEffect(() => {
    if (!shouldAdvanceAfterSourceIntake || isRunningSourceIntake) {
      return;
    }

    if (sourceIntakeResult) {
      setShouldAdvanceAfterSourceIntake(false);
      setActiveStep("AI_READY_RECORDS");
      return;
    }

    if (sourceIntakeError) {
      setShouldAdvanceAfterSourceIntake(false);
    }
  }, [
    isRunningSourceIntake,
    shouldAdvanceAfterSourceIntake,
    sourceIntakeError,
    sourceIntakeResult,
  ]);

  function setActiveStep(step: GuidedStep) {
    onActiveStepChange(step);

    if (step === activeStep) {
      scrollToStepPanel();
    }
  }

  function canOpenStep(step: GuidedStep) {
    if (step === "MESSY_SOURCE_INTAKE") {
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
    setShouldAdvanceAfterSourceIntake(true);
    onRunSourceIntake(request);
  }

  function handleStartGuidedSteps() {
    setIsOverviewActive(false);
    setActiveStep("MESSY_SOURCE_INTAKE");
  }

  function handleResetGuidedDemo() {
    setGeneratedWorkflowInput("");
    setIsOverviewActive(true);
    setShouldAdvanceAfterSourceIntake(false);
    onResetGuidedRun();
  }

  return (
    <div className="guided-workflow-page">

      {isOverviewActive ? (
        <GuidedRunSetupStep onContinue={handleStartGuidedSteps} />
      ) : (
        <div className="guided-workflow-shell">
          <GuidedWorkflowStepper
            activeStep={activeStep}
            canOpenStep={canOpenStep}
            getStepStatus={getStepStatus}
            onStepChange={setActiveStep}
            steps={GUIDED_STEPS}
          />

          <section
            aria-label="Active guided workflow step"
            className="guided-workflow-panel"
            ref={activeStepPanelRef}
          >
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
            <GuidedValidationReviewStep
              actionError={reviewQueueActionError}
              actionSuccess={reviewQueueActionSuccess}
              activeReviewQueueItemId={activeReviewQueueItemId}
              currentRunReviewQueueItems={currentRunReviewQueueItems}
              onContinue={() => setActiveStep("FINAL_RUN_REPORT")}
              onOpenReviewQueue={() => onViewChange("REVIEW_QUEUE")}
              onReviewQueueNotesChange={onReviewQueueNotesChange}
              onResolveReviewQueueItemWithCorrections={
                onResolveReviewQueueItemWithCorrections
              }
              result={tradeInResult}
              reviewQueueNotesById={reviewQueueNotesById}
            />
          ) : null}

          {activeStep === "FINAL_RUN_REPORT" ? (
            <GuidedFinalRunReportStep
              currentRunAiReadyRecords={currentRunAiReadyRecords}
              currentRunReviewQueueItems={currentRunReviewQueueItems}
              onReset={handleResetGuidedDemo}
              result={tradeInResult}
              sourceIntakePersistedRecords={sourceIntakePersistedRecords}
            />
          ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
