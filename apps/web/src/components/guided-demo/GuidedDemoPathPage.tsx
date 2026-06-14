import { FormEvent, useEffect, useMemo, useState } from "react";

import type { AppView } from "../../constants/appNav";
import type {
  AiReadyIntakeRecord,
  ExecuteEndToEndAgenticTradeInDemoResponse,
  ExecuteMultiSourceIntakeDemoRequest,
  ExecuteMultiSourceIntakeDemoResponse,
  GlobalReviewQueueItem,
  GlobalWorkflowRunSummary,
  HumanReviewLearningEvent,
  ResolveReviewQueueItemWithCorrectionsRequest,
  ReviewConditionGrade,
  ReviewCorrectionCategory,
  ReviewCorrectionShaftFlex,
  ReviewedTradeInRecord,
} from "../../types/workflow";
import { EmptyState } from "../EmptyState";
import { getReviewQueueEvidenceSummary } from "../../utils/reviewQueueDisplay";
import { GuidedSourceIntakeBuilder } from "./GuidedSourceIntakeBuilder";

export type GuidedStep =
  | "SCENARIO"
  | "SOURCE_INTAKE"
  | "AI_READY_OUTPUT"
  | "TRADE_IN_WORKFLOW"
  | "EXECUTION_TRACE"
  | "HUMAN_REVIEW"
  | "QUALITY_SUMMARY";

const GUIDED_STEPS: {
  id: GuidedStep;
  label: string;
  eyebrow: string;
  description: string;
}[] = [
  {
    id: "SCENARIO",
    label: "Scenario",
    eyebrow: "Business context",
    description: "What problem this workflow solves.",
  },
  {
    id: "SOURCE_INTAKE",
    label: "Source Intake",
    eyebrow: "Messy inputs",
    description: "Stage customer email, store notes, broken CSV rows, and logs.",
  },
  {
    id: "AI_READY_OUTPUT",
    label: "AI-Ready Output",
    eyebrow: "Normalized assets",
    description: "Review extracted records, schema, metadata, and RAG readiness.",
  },
  {
    id: "TRADE_IN_WORKFLOW",
    label: "Trade-In Workflow",
    eyebrow: "Agent plan",
    description: "Run the safe golf trade-in workflow.",
  },
  {
    id: "EXECUTION_TRACE",
    label: "Execution Trace",
    eyebrow: "Audit trail",
    description: "Inspect routing, tools, evidence, validation, and blocked mutations.",
  },
  {
    id: "HUMAN_REVIEW",
    label: "Human Review",
    eyebrow: "Control point",
    description: "See what uncertainty was routed to review.",
  },
  {
    id: "QUALITY_SUMMARY",
    label: "Quality Summary",
    eyebrow: "Outcome",
    description: "Summarize the current guided run.",
  },
];

const AGENT_PLAN = [
  "Validate extracted trade-in fields.",
  "Search product knowledge.",
  "Match parsed records to seeded internal inventory products.",
  "Estimate demo valuation ranges with condition and accessory adjustments.",
  "Use approved internal tools.",
  "Validate confidence and evidence.",
  "Escalate uncertainty to human review.",
  "Block unsafe mutations unless approved.",
];

const REVIEW_CATEGORY_OPTIONS = [
  { label: "Driver", value: "DRIVER" },
  { label: "Fairway Wood", value: "FAIRWAY_WOOD" },
  { label: "Hybrid", value: "HYBRID" },
  { label: "Iron Set", value: "IRON_SET" },
  { label: "Wedge", value: "WEDGE" },
  { label: "Putter", value: "PUTTER" },
];

const REVIEW_CONDITION_GRADE_OPTIONS: { label: string; value: ReviewConditionGrade }[] = [
  { label: "9.5 Mint", value: "9.5 Mint" },
  { label: "9.0 Above Average", value: "9.0 Above Average" },
  { label: "8.0 Average", value: "8.0 Average" },
  { label: "7.0 Below Average", value: "7.0 Below Average" },
  { label: "6.0 Poor", value: "6.0 Poor" },
];

type GuidedInventoryMatchDecision =
  | "CONFIRM_CURRENT_MATCH"
  | "CORRECT_MATCHED_PRODUCT"
  | "NO_RELIABLE_MATCH";

type GuidedDemoValuationDecision =
  | "CONFIRM_CURRENT_RANGE"
  | "ENTER_REVIEWED_VALUE"
  | "VALUATION_NOT_READY";

const REVIEW_INVENTORY_MATCH_DECISION_OPTIONS: {
  label: string;
  value: GuidedInventoryMatchDecision;
}[] = [
  {
    label: "Confirm current match",
    value: "CONFIRM_CURRENT_MATCH",
  },
  {
    label: "Correct matched product",
    value: "CORRECT_MATCHED_PRODUCT",
  },
  {
    label: "No reliable match",
    value: "NO_RELIABLE_MATCH",
  },
];

function getInventoryMatchDecisionLabel(
  value: GuidedInventoryMatchDecision | "",
) {
  return (
    REVIEW_INVENTORY_MATCH_DECISION_OPTIONS.find(
      (option) => option.value === value,
    )?.label ?? ""
  );
}

const REVIEW_SHAFT_FLEX_OPTIONS: Array<{
  value: ReviewCorrectionShaftFlex;
  label: string;
}> = [
  { value: "STIFF", label: "Stiff" },
  { value: "REGULAR", label: "Regular" },
  { value: "SENIOR", label: "Senior" },
  { value: "X_STIFF", label: "X-Stiff" },
  { value: "LADIES", label: "Ladies" },
  { value: "TOUR_X_STIFF", label: "Tour X-Stiff" },
];

const REVIEW_DEMO_VALUATION_DECISION_OPTIONS: {
  label: string;
  value: GuidedDemoValuationDecision;
}[] = [
  {
    label: "Confirm current demo range",
    value: "CONFIRM_CURRENT_RANGE",
  },
  {
    label: "Enter reviewed demo value",
    value: "ENTER_REVIEWED_VALUE",
  },
  {
    label: "Valuation not ready",
    value: "VALUATION_NOT_READY",
  },
];

function getDemoValuationDecisionLabel(
  value: GuidedDemoValuationDecision | "",
) {
  return (
    REVIEW_DEMO_VALUATION_DECISION_OPTIONS.find(
      (option) => option.value === value,
    )?.label ?? ""
  );
}

function formatLearningEventFieldName(fieldName: string) {
  const knownLabels: Record<string, string> = {
    category: "Category",
    conditionGrade: "Condition grade",
    demoValuationRange: "Demo valuation range",
    inventoryMatchConfidence: "Inventory match confidence",
  };

  return (
    knownLabels[fieldName] ??
    fieldName
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (first) => first.toUpperCase())
  );
}

function formatLearningEventSummary(input: {
  rawTextMatch: string | null;
  correctedValue: string | null;
  confidenceImpact: string | null;
}) {
  return [
    input.rawTextMatch ? "Raw text: " + input.rawTextMatch : null,
    input.correctedValue ? "Decision: " + input.correctedValue : null,
    input.confidenceImpact,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatScore(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : value.toFixed(2);
}

function formatList(values: string[] | undefined) {
  return values && values.length > 0 ? values.join(", ") : "—";
}

function getStatusClassName(status: string) {
  return `agentic-demo-audit-event__status agentic-demo-audit-event__status--${status.toLowerCase().replace(/_/g, "-")}`;
}

function getStepIndex(step: GuidedStep) {
  return GUIDED_STEPS.findIndex((item) => item.id === step);
}

function getInitialCurrentRunReviewItems(
  tradeInResult: ExecuteEndToEndAgenticTradeInDemoResponse | null,
) {
  return tradeInResult?.reviewQueueItemsCreated ?? [];
}

function getReviewedTradeInRecord(
  item: unknown,
): ReviewedTradeInRecord | null {
  if (
    item &&
    typeof item === "object" &&
    "reviewedTradeInRecord" in item
  ) {
    return item.reviewedTradeInRecord as ReviewedTradeInRecord | null;
  }

  return null;
}

function getHumanReviewLearningEvents(
  item: unknown,
): HumanReviewLearningEvent[] {
  if (
    item &&
    typeof item === "object" &&
    "humanReviewLearningEvents" in item &&
    Array.isArray(item.humanReviewLearningEvents)
  ) {
    return item.humanReviewLearningEvents as HumanReviewLearningEvent[];
  }

  return [];
}


function formatGeneratedWorkflowInput(
  result: ExecuteMultiSourceIntakeDemoResponse,
) {
  if (result.cleanedDatasetPreview.length === 0) {
    return "";
  }

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
        record.missingFields.length > 0
          ? "missing " + record.missingFields.join(", ")
          : null,
      ].filter(Boolean);

      return String(index + 1) + ". " + (identity || "Unknown equipment") +
        (details.length > 0 ? " — " + details.join("; ") : "");
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
}: {
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
}) {
  const setActiveStep = onActiveStepChange;
  const [workflowInputBaseline, setWorkflowInputBaseline] = useState("");
  const [activeGuidedReviewIssueKey, setActiveGuidedReviewIssueKey] =
    useState<string | null>(null);
  const [guidedReviewIssueCorrections, setGuidedReviewIssueCorrections] =
    useState<Record<string, string>>({});
  const [guidedReviewCategorySelections, setGuidedReviewCategorySelections] =
    useState<Record<string, string>>({});
  const [guidedReviewRawTextMatches, setGuidedReviewRawTextMatches] =
    useState<Record<string, string>>({});
  const [guidedReviewConditionGradeSelections, setGuidedReviewConditionGradeSelections] =
    useState<Record<string, ReviewConditionGrade | "">>({});
  const [guidedReviewShaftFlexSelections, setGuidedReviewShaftFlexSelections] =
    useState<Record<string, ReviewCorrectionShaftFlex | "">>({});
  const [guidedReviewInventoryMatchDecisions, setGuidedReviewInventoryMatchDecisions] =
    useState<Record<string, GuidedInventoryMatchDecision | "">>({});
  const [guidedReviewDemoValuationDecisions, setGuidedReviewDemoValuationDecisions] =
    useState<Record<string, GuidedDemoValuationDecision | "">>({});
  const [guidedReviewDemoValues, setGuidedReviewDemoValues] =
    useState<Record<string, string>>({});
  const [resolvedGuidedReviewIssueKeys, setResolvedGuidedReviewIssueKeys] =
    useState<Record<string, boolean>>({});

  const currentRunWorkflow = useMemo(() => {
    const workflowRunId =
      tradeInResult?.persisted.workflowRunId ?? sourceIntakeResult?.persistedIds.workflowRunId;

    if (!workflowRunId) {
      return null;
    }

    return workflowRuns.find((run) => run.id === workflowRunId) ?? null;
  }, [sourceIntakeResult, tradeInResult, workflowRuns]);

  const currentRunReviewItems = useMemo(() => {
    const initialItems = getInitialCurrentRunReviewItems(tradeInResult);

    if (initialItems.length === 0) {
      return [];
    }

    const refreshedItemsById = new Map(
      reviewQueueItems.map((item) => [item.id, item]),
    );

    return initialItems.map((item) => refreshedItemsById.get(item.id) ?? item);
  }, [reviewQueueItems, tradeInResult]);

  const blockedMutation = tradeInResult?.blockedToolCallResult ?? null;
  const providerFallbackUsed = Boolean(
    tradeInResult?.modelRoutingDecision.fallbackProvider ||
      tradeInResult?.modelCallLog.attemptLogs?.some((attempt) => attempt.status === "SKIPPED"),
  );
  const currentStepIndex = getStepIndex(activeStep);
  const hasEditedGeneratedInput =
    Boolean(workflowInputBaseline) && tradeInRawInput !== workflowInputBaseline;

  const currentRunReviewItemCount = currentRunReviewItems.length;
  const currentRunClosedReviewItemCount = currentRunReviewItems.filter(
    (item) => item.status === "RESOLVED" || item.status === "DISMISSED",
  ).length;
  const currentRunOpenReviewItemCount = currentRunReviewItems.filter(
    (item) => item.status === "OPEN" || item.status === "IN_REVIEW",
  ).length;
  const currentRunHumanApprovedCorrectionCount = currentRunReviewItems.filter(
    (item) => item.reviewerNotes && item.reviewerNotes.trim().length > 0,
  ).length;
  const currentRunReviewLoopComplete =
    currentRunReviewItemCount > 0 && currentRunOpenReviewItemCount === 0;

  function getGuidedReviewIssueKey(reviewQueueItemId: string, issueId: string) {
    return reviewQueueItemId + "::" + issueId;
  }

  function handleGuidedReviewIssueCorrectionChange(
    issueKey: string,
    value: string,
  ) {
    setGuidedReviewIssueCorrections((current) => ({
      ...current,
      [issueKey]: value,
    }));
  }

  function handleGuidedReviewCategorySelectionChange(
    issueKey: string,
    value: string,
  ) {
    setGuidedReviewCategorySelections((current) => ({
      ...current,
      [issueKey]: value,
    }));
  }

  function handleGuidedReviewRawTextMatchChange(
    issueKey: string,
    value: string,
  ) {
    setGuidedReviewRawTextMatches((current) => ({
      ...current,
      [issueKey]: value,
    }));
  }

  function handleGuidedReviewConditionGradeChange(
    issueKey: string,
    value: ReviewConditionGrade | "",
  ) {
    setGuidedReviewConditionGradeSelections((current) => ({
      ...current,
      [issueKey]: value,
    }));
  }

  function handleGuidedReviewShaftFlexChange(
    issueKey: string,
    value: ReviewCorrectionShaftFlex | "",
  ) {
    setGuidedReviewShaftFlexSelections((current) => ({
      ...current,
      [issueKey]: value,
    }));
  }

  function handleGuidedReviewInventoryMatchDecisionChange(
    issueKey: string,
    value: GuidedInventoryMatchDecision | "",
  ) {
    setGuidedReviewInventoryMatchDecisions((current) => ({
      ...current,
      [issueKey]: value,
    }));
  }

  function handleGuidedReviewDemoValuationDecisionChange(
    issueKey: string,
    value: GuidedDemoValuationDecision | "",
  ) {
    setGuidedReviewDemoValuationDecisions((current) => ({
      ...current,
      [issueKey]: value,
    }));
  }

  function handleGuidedReviewDemoValueChange(
    issueKey: string,
    value: string,
  ) {
    setGuidedReviewDemoValues((current) => ({
      ...current,
      [issueKey]: value,
    }));
  }

  function handleApplyGuidedReviewIssueCorrection(input: {
    reviewQueueItemId: string;
    issueKey: string;
    issueLabel: string;
    correctionOverride?: string;
  }) {
    const correction =
      input.correctionOverride?.trim() ??
      guidedReviewIssueCorrections[input.issueKey]?.trim();
    const existingNotes = reviewQueueNotesById[input.reviewQueueItemId]?.trim();

    const correctionLine = correction
      ? `Addressed issue: ${input.issueLabel}. Correction: ${correction}`
      : `Addressed issue: ${input.issueLabel}.`;

    const nextNotes = existingNotes
      ? existingNotes + "\n" + correctionLine
      : correctionLine;

    onReviewQueueNotesChange(input.reviewQueueItemId, nextNotes);
    setResolvedGuidedReviewIssueKeys((current) => ({
      ...current,
      [input.issueKey]: true,
    }));
    setActiveGuidedReviewIssueKey(null);
  }

  function isReviewCorrectionCategory(
    value: string | undefined,
  ): value is ReviewCorrectionCategory {
    return REVIEW_CATEGORY_OPTIONS.some((option) => option.value === value);
  }

  function isConditionReviewIssue(issueId: string) {
    return issueId.toLowerCase().includes("condition");
  }

  function isShaftFlexReviewIssue(issueId: string) {
    return issueId.toLowerCase().includes("shaft");
  }

  function isInventoryMatchConfidenceIssue(issueLabel: string) {
    return issueLabel === "Review inventory match confidence";
  }

  function isDemoValuationRangeIssue(issueLabel: string) {
    return issueLabel === "Review demo valuation range";
  }

  function buildGuidedStructuredReviewRequest(input: {
    item: { id: string; };
    evidence: ReturnType<typeof getReviewQueueEvidenceSummary>;
  }): ResolveReviewQueueItemWithCorrectionsRequest {
    const reviewerNotes =
      reviewQueueNotesById[input.item.id]?.trim() ||
      "Human approved guided review corrections.";
    const correctedRecord: ResolveReviewQueueItemWithCorrectionsRequest["correctedRecord"] =
      {};
    const learningEvents: ResolveReviewQueueItemWithCorrectionsRequest["learningEvents"] =
      [];

    for (const issue of input.evidence.reviewIssues) {
      const issueKey = getGuidedReviewIssueKey(input.item.id, issue.id);
      const isIssueResolved =
        resolvedGuidedReviewIssueKeys[issueKey] === true;

      if (!isIssueResolved) {
        continue;
      }

      if (issue.id === "missing-category") {
        const selectedCategory = guidedReviewCategorySelections[issueKey];

        if (isReviewCorrectionCategory(selectedCategory)) {
          correctedRecord.category = selectedCategory;
          learningEvents.push({
            fieldName: "category",
            rawTextMatch:
              guidedReviewRawTextMatches[issueKey]?.trim() || undefined,
            proposedValue: "UNKNOWN",
            correctedValue: selectedCategory,
            evidenceText: input.evidence.rawText,
            confidenceImpact:
              "Human-approved category mapping can improve future matching.",
          });
        }

        continue;
      }

      if (isConditionReviewIssue(issue.id)) {
        const selectedConditionGrade =
          guidedReviewConditionGradeSelections[issueKey] || undefined;
        if (selectedConditionGrade) {
          correctedRecord.conditionGrade = selectedConditionGrade;

          learningEvents.push({
            fieldName: "conditionGrade",
            rawTextMatch: input.evidence.rawText,
            proposedValue: issue.detail,
            correctedValue: selectedConditionGrade,
            evidenceText: input.evidence.rawText,
            confidenceImpact:
              "Human-approved condition grade can improve future condition handling.",
          });
        }

        continue;
      }

      if (isShaftFlexReviewIssue(issue.id)) {
        const selectedShaftFlex =
          guidedReviewShaftFlexSelections[issueKey] || undefined;

        if (selectedShaftFlex) {
          correctedRecord.shaftFlex = selectedShaftFlex;

          learningEvents.push({
            fieldName: "shaftFlex",
            rawTextMatch:
              guidedReviewRawTextMatches[issueKey]?.trim() || undefined,
            proposedValue: issue.detail,
            correctedValue: selectedShaftFlex,
            evidenceText: input.evidence.rawText,
            confidenceImpact:
              "Human-approved raw text to shaft flex mapping can improve future shaft flex handling.",
          });
        }

        continue;
      }

      if (isInventoryMatchConfidenceIssue(issue.label)) {
        const decision = guidedReviewInventoryMatchDecisions[issueKey] || "";
        const correction =
          guidedReviewIssueCorrections[issueKey]?.trim() || undefined;
        const decisionLabel = getInventoryMatchDecisionLabel(decision);

        if (decision || correction) {
          learningEvents.push({
            fieldName: "inventoryMatchConfidence",
            rawTextMatch: input.evidence.rawText,
            proposedValue: issue.detail,
            correctedValue: [decisionLabel, correction].filter(Boolean).join(": "),
            evidenceText: correction,
            confidenceImpact:
              "Human-approved inventory match decision can improve future product matching.",
          });
        }

        continue;
      }

      if (isDemoValuationRangeIssue(issue.label)) {
        const decision = guidedReviewDemoValuationDecisions[issueKey] || "";
        const reviewedDemoValueText = guidedReviewDemoValues[issueKey]?.trim();
        const reviewedDemoValue = reviewedDemoValueText
          ? Number(reviewedDemoValueText)
          : Number.NaN;
        const valuationNote =
          guidedReviewIssueCorrections[issueKey]?.trim() || undefined;
        const decisionLabel = getDemoValuationDecisionLabel(decision);

        if (
          decision === "ENTER_REVIEWED_VALUE" &&
          Number.isFinite(reviewedDemoValue)
        ) {
          correctedRecord.demoValue = reviewedDemoValue;
        }

        if (decision || valuationNote) {
          learningEvents.push({
            fieldName: "demoValuationRange",
            rawTextMatch: input.evidence.demoValuationRangeSummary ?? undefined,
            proposedValue: issue.detail,
            correctedValue: [
              decisionLabel,
              Number.isFinite(reviewedDemoValue)
                ? "reviewed demo value " + reviewedDemoValue
                : null,
              valuationNote,
            ]
              .filter(Boolean)
              .join(": "),
            evidenceText: valuationNote,
            confidenceImpact:
              "Human-approved valuation decision can improve future demo valuation handling.",
          });
        }

        continue;
      }

      const correction =
        guidedReviewIssueCorrections[issueKey]?.trim() || undefined;

      if (correction) {
        learningEvents.push({
          fieldName: issue.id,
          rawTextMatch: input.evidence.rawText,
          proposedValue: issue.detail,
          correctedValue: correction,
          evidenceText: correction,
          confidenceImpact:
            "Human review captured an approved correction for future matching.",
        });
      }
    }

    if (Object.keys(correctedRecord).length === 0) {
      correctedRecord.conditionGrade = "8.0 Average";
    }

    return {
      reviewerNotes,
      correctedRecord,
      learningEvents,
    };
  }



  function isStepComplete(step: GuidedStep) {
    const stepIndex = getStepIndex(step);

    if (stepIndex >= currentStepIndex) {
      return false;
    }

    if (step === "SCENARIO") {
      return true;
    }

    if (step === "SOURCE_INTAKE" || step === "AI_READY_OUTPUT") {
      return Boolean(sourceIntakeResult);
    }

    return Boolean(tradeInResult);
  }

  function canOpenStep(step: GuidedStep) {
    if (step === "SCENARIO" || step === "SOURCE_INTAKE") {
      return true;
    }

    if (step === "AI_READY_OUTPUT" || step === "TRADE_IN_WORKFLOW") {
      return Boolean(sourceIntakeResult);
    }

    return Boolean(tradeInResult);
  }

  function handleGuidedSourceIntakeRun(
    request?: ExecuteMultiSourceIntakeDemoRequest,
  ) {
    onRunSourceIntake(request);
    setActiveStep("AI_READY_OUTPUT");
  }

  function restoreGeneratedWorkflowInput() {
    if (!workflowInputBaseline) {
      return;
    }

    onTradeInRawInputChange(workflowInputBaseline);
  }

  useEffect(() => {
    if (activeStep !== "TRADE_IN_WORKFLOW") {
      return;
    }

    if (!tradeInRawInput || workflowInputBaseline) {
      return;
    }

    setWorkflowInputBaseline(tradeInRawInput);
  }, [activeStep, tradeInRawInput, workflowInputBaseline]);

  function renderStepStatus(step: GuidedStep, index: number) {
    if (isStepComplete(step)) {
      return "Done";
    }

    if (index === currentStepIndex) {
      return "Current";
    }

    if (!canOpenStep(step)) {
      return "Locked";
    }

    return "Ready";
  }

  return (
    <div className="guided-workflow-page">
      <div className="guided-workflow-shell">
        <aside className="guided-workflow-stepper" aria-label="Guided workflow steps">
          {GUIDED_STEPS.map((step, index) => {
            const status = renderStepStatus(step.id, index);

            return (
              <button
                className={
                  step.id === activeStep
                    ? "guided-workflow-stepper__item guided-workflow-stepper__item--active"
                    : "guided-workflow-stepper__item"
                }
                disabled={!canOpenStep(step.id)}
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                type="button"
              >
                <span>{index + 1}</span>
                <div>
                  <small>{step.eyebrow}</small>
                  <strong>{step.label}</strong>
                  <em>{status}</em>
                </div>
              </button>
            );
          })}
        </aside>

        <section className="guided-workflow-panel">
          {activeStep === "SCENARIO" ? (
            <article className="guided-workflow-card guided-workflow-card--hero">
              <span className="model-route-card__eyebrow">Scenario</span>
              <h3>Messy trade-in data should become controlled workflow output.</h3>
              <p>
                Golf retail trade-in information arrives through customer emails,
                counter notes, malformed CSV exports, and operations logs. SwingOps AI
                normalizes the data, prepares AI-ready assets, runs a safe workflow,
                validates confidence and evidence, escalates uncertainty, and preserves
                an execution trail.
              </p>

              <div className="guided-workflow-flowline">
                <span>Source Intake</span>
                <span>AI-Ready Output</span>
                <span>Trade-In Workflow</span>
                <span>Execution Trace</span>
                <span>Human Review</span>
                <span>Quality Summary</span>
              </div>

              <button onClick={() => setActiveStep("SOURCE_INTAKE")} type="button">
                Continue to Source Intake
              </button>

              <details className="guided-workflow-details">
                <summary>View more: what this workflow demonstrates</summary>
                <div className="guided-workflow-proof-grid">
                  <article>
                    <strong>Data readiness</strong>
                    <p>Raw operational inputs become records, schema, metadata, quality signals, and RAG readiness.</p>
                  </article>
                  <article>
                    <strong>Controlled execution</strong>
                    <p>Model routing, approved tools, policy checks, blocked mutations, and audit logs stay connected to the run.</p>
                  </article>
                  <article>
                    <strong>Human review</strong>
                    <p>Ambiguous equipment details are routed for review instead of being silently accepted.</p>
                  </article>
                </div>
              </details>
            </article>
          ) : null}

          {activeStep === "SOURCE_INTAKE" ? (
            <article className="guided-workflow-card guided-workflow-card--intake">
              <div className="guided-workflow-card__header">
                <div>
                  <span className="model-route-card__eyebrow">Source Intake</span>
                  <h3>Build the messy source set that starts the workflow.</h3>
                  <p>
                    Name each source, choose paste or upload, select the source type,
                    then provide content or populate sample data. Normalize sources when
                    the intake set is ready.
                  </p>
                </div>
              </div>

              <GuidedSourceIntakeBuilder
                error={sourceIntakeError}
                isRunning={isRunningSourceIntake}
                onRunSources={handleGuidedSourceIntakeRun}
                result={sourceIntakeResult}
                success={sourceIntakeSuccess}
              />
            </article>
          ) : null}

          {activeStep === "AI_READY_OUTPUT" ? (
            <article className="guided-workflow-card">
              <div className="guided-workflow-card__header guided-workflow-card__header--ai-ready">
                <div>
                  <span className="model-route-card__eyebrow">AI-Ready Output</span>
                  <h3>Raw source data becomes workflow-ready assets.</h3>
                </div>
                <button disabled={!sourceIntakeResult} onClick={() => setActiveStep("TRADE_IN_WORKFLOW")} type="button">
                  Continue to Trade-In Workflow
                </button>
                <p>
                  Review the structured output before running the trade-in workflow.
                </p>
              </div>

              {sourceIntakeResult ? (
                <>
                  <div className="guided-workflow-metrics">
                    <article>
                      <strong>{sourceIntakeResult.recordsExtracted}</strong>
                      <span>Records extracted</span>
                    </article>
                    <article>
                      <strong>{sourceIntakeResult.inferredDatasetSchema.length}</strong>
                      <span>Dataset schema fields</span>
                    </article>
                    <article>
                      <strong>{sourceIntakeResult.reviewNeeded}</strong>
                      <span>Review signals</span>
                    </article>
                    <article>
                      <strong>
                        {sourceIntakeResult.ragReadinessSummary.ragIndexReady ? "Ready" : "Partial"}
                      </strong>
                      <span>RAG readiness</span>
                    </article>
                  </div>

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
                          <th>Store</th>
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
                            <td>{record.tradeInValue === null ? "—" : `${record.tradeInValue}`}</td>
                            <td>{record.storeId ?? "—"}</td>
                            <td>{record.reviewNeeded ? "Needed" : "Clear"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <section className="guided-workflow-details guided-workflow-details--ai-ready">
                    <div className="guided-workflow-section-heading">
                      <div>
                        <span className="model-route-card__eyebrow">Durable handoff</span>
                        <h4>Persisted AI-ready records</h4>
                        <p>
                          These are normalized operational records persisted by the intake workflow.
                          They are ready for downstream review and RAG preparation, but they are not final inventory writes.
                        </p>
                      </div>
                      <span className="agentic-demo-pill agentic-demo-pill--success">
                        {sourceIntakePersistedRecords.length} persisted
                      </span>
                    </div>

                    {sourceIntakePersistedRecords.length > 0 ? (
                      <div className="guided-ai-ready-evidence-grid">
                        {sourceIntakePersistedRecords.map((persistedRecord) => (
                          <article className="guided-ai-ready-evidence-card" key={persistedRecord.id}>
                            <div className="guided-ai-ready-evidence-card__header">
                              <div>
                                <span className="model-route-card__eyebrow">
                                  {persistedRecord.sourceType.replace(/_/g, " ")} · {persistedRecord.status}
                                </span>
                                <h4>
                                  {persistedRecord.normalizedJson.brand ?? "Unknown brand"}{" "}
                                  {persistedRecord.normalizedJson.productLine ?? "Unknown product"}
                                </h4>
                              </div>
                              <span
                                className={
                                  persistedRecord.reviewNeeded
                                    ? "agentic-demo-pill agentic-demo-pill--warning"
                                    : "agentic-demo-pill agentic-demo-pill--success"
                                }
                              >
                                {persistedRecord.reviewNeeded ? "Needs review" : "Ready"}
                              </span>
                            </div>

                            <dl className="agentic-demo-metadata">
                              <div>
                                <dt>Record ID</dt>
                                <dd>{persistedRecord.id}</dd>
                              </div>
                              <div>
                                <dt>Source</dt>
                                <dd>{persistedRecord.sourceName}</dd>
                              </div>
                              <div>
                                <dt>Workflow run</dt>
                                <dd>{persistedRecord.workflowRunId ?? "—"}</dd>
                              </div>
                              <div>
                                <dt>Intake item</dt>
                                <dd>{persistedRecord.intakeItemId ?? "—"}</dd>
                              </div>
                              <div>
                                <dt>Condition grade</dt>
                                <dd>{persistedRecord.normalizedJson.conditionGrade ?? "—"}</dd>
                              </div>
                              <div>
                                <dt>RAG ready</dt>
                                <dd>{persistedRecord.ragReady ? "Yes" : "Not yet"}</dd>
                              </div>
                            </dl>

                            <details className="multi-source-intake-details">
                              <summary>Normalized record JSON</summary>
                              <pre>{JSON.stringify(persistedRecord.normalizedJson, null, 2)}</pre>
                            </details>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No persisted AI-ready records loaded"
                        message="Normalize sources to create durable AI-ready records."
                      />
                    )}
                  </section>

                  <details className="guided-workflow-details guided-workflow-details--ai-ready">
                    <summary>
                      <span>Cleaned source text</span>
                    </summary>
                    <div className="guided-ai-ready-evidence-grid">
                      {sourceIntakeResult.sourceResults.map((sourceResult) => (
                        <article className="guided-ai-ready-evidence-card" key={sourceResult.id}>
                          <div className="guided-ai-ready-evidence-card__header">
                            <div>
                              <span className="model-route-card__eyebrow">
                                {sourceResult.sourceType.replace(/_/g, " ")}
                              </span>
                              <h4>{sourceResult.sourceName}</h4>
                            </div>
                            <span className="agentic-demo-pill agentic-demo-pill--success">
                              {formatScore(sourceResult.confidence)}
                            </span>
                          </div>

                          <dl className="agentic-demo-metadata">
                            <div>
                              <dt>Records</dt>
                              <dd>{sourceResult.extractedRecords.length}</dd>
                            </div>
                            <div>
                              <dt>Brands</dt>
                              <dd>{formatList(sourceResult.metadata.detectedBrands)}</dd>
                            </div>
                            <div>
                              <dt>Source metadata fields</dt>
                              <dd>{sourceResult.ragIndexReadiness.metadataFields.length}</dd>
                            </div>
                            <div>
                              <dt>Chunks</dt>
                              <dd>{sourceResult.embeddingReadiness.chunkCount}</dd>
                            </div>
                          </dl>

                          <pre>{sourceResult.cleanedText}</pre>
                        </article>
                      ))}
                    </div>
                  </details>
                </>
              ) : (
                <EmptyState
                  title="Normalize sources first"
                  message="The workflow needs AI-ready records before it can run."
                />
              )}
            </article>
          ) : null}

          {activeStep === "TRADE_IN_WORKFLOW" ? (
            <article className="guided-workflow-card guided-workflow-card--launch">
              <div className="guided-workflow-card__header">
                <div>
                  <span className="model-route-card__eyebrow">Trade-In Workflow</span>
                  <h3>Review and launch the controlled agent workflow.</h3>
                  <p>
                    The workflow input is generated from the AI-ready records, then
                    kept editable so store context, corrections, or edge cases can be
                    added before execution.
                  </p>
                </div>
              </div>

              <div className="guided-workflow-launch-grid">
                <section className="guided-workflow-input-card">
                  <div className="guided-workflow-input-card__header">
                    <div>
                      <span className="model-route-card__eyebrow">
                        Workflow input source
                      </span>
                      <h4>Workflow input</h4>
                      <p>
                        This text is the handoff passed into the trade-in workflow. It
                        can be edited before launch to simulate corrected store notes or
                        additional associate context.
                      </p>
                    </div>

                  </div>

                  <form
                    className="agentic-demo-form guided-workflow-run-form"
                    onSubmit={onRunTradeInWorkflow}
                  >
                    <div className="guided-workflow-generated-input-header">
                      <label htmlFor="guided-trade-in-input">
                        Workflow input
                      </label>
                      <button
                        disabled={isRunningTradeInWorkflow || !workflowInputBaseline}
                        onClick={(event) => {
                          event.preventDefault();
                          restoreGeneratedWorkflowInput();
                        }}
                        type="button"
                      >
                        Reset to AI-ready output
                      </button>
                    </div>

                    <textarea
                      id="guided-trade-in-input"
                      onChange={(event) =>
                        onTradeInRawInputChange(event.target.value)
                      }
                      rows={7}
                      value={tradeInRawInput}
                    />
                    <p className="guided-workflow-generated-input-state">
                      {hasEditedGeneratedInput
                        ? "Edited from AI-ready output"
                        : "Showing AI-ready output"}
                    </p>

                    <div className="guided-workflow-launch-callout">
                      <span className="model-route-card__eyebrow">Start will run</span>
                      <ul>
                        <li>model routing and fallback logging</li>
                        <li>knowledge search for product evidence</li>
                        <li>inventory product lookup and demo valuation range estimation</li>
                        <li>approved read-only tool calls</li>
                        <li>validation, blocked mutation checks, and review creation</li>
                      </ul>
                    </div>

                    <div className="guided-workflow-run-actions">
                      {tradeInSuccess ? (
                        <>
                          <button
                            className="guided-workflow-run-actions__secondary"
                            disabled={isRunningTradeInWorkflow}
                            type="submit"
                          >
                            {isRunningTradeInWorkflow ? "Running…" : "Run Again"}
                          </button>
                          <button
                            onClick={() => setActiveStep("EXECUTION_TRACE")}
                            type="button"
                          >
                            Continue to Execution Trace
                          </button>
                        </>
                      ) : (
                        <button disabled={isRunningTradeInWorkflow} type="submit">
                          {isRunningTradeInWorkflow
                            ? "Running…"
                            : "Start Trade-In Workflow"}
                        </button>
                      )}
                    </div>

                    {tradeInError ? (
                      <EmptyState title="Unable to run trade-in workflow" message={tradeInError} />
                    ) : null}
                    {tradeInSuccess ? (
                      <div className="guided-workflow-run-complete">
                        <span className="model-route-card__eyebrow">Workflow run complete</span>
                        <p>{tradeInSuccess}</p>
                        <p>
                          The run has created an execution trace, captured model routing,
                          checked product knowledge, matched inventory, estimated demo
                          valuation ranges, executed approved read-only tools, and
                          prepared review work where needed.
                        </p>
                      </div>
                    ) : null}
                  </form>
                </section>

                <aside className="guided-workflow-policy-panel">
                  <span className="model-route-card__eyebrow">Run setup</span>
                  <h4>Controls applied to this workflow run</h4>

                  <div className="guided-workflow-policy-grid">
                    <article className="guided-workflow-policy-card">
                      <span>Validation</span>
                      <strong>Strict field checks</strong>
                      <p>Missing shaft, model, condition, or confidence gaps stay visible.</p>
                    </article>
                    <article className="guided-workflow-policy-card">
                      <span>Grounding</span>
                      <strong>Knowledge search enabled</strong>
                      <p>Product evidence is checked before workflow output is trusted.</p>
                    </article>
                    <article className="guided-workflow-policy-card">
                      <span>Tool safety</span>
                      <strong>Read-only first</strong>
                      <p>Approved internal tools can run. Unsafe mutations are blocked.</p>
                    </article>
                    <article className="guided-workflow-policy-card">
                      <span>Human review</span>
                      <strong>Escalate uncertainty</strong>
                      <p>Low-confidence or incomplete records create review work.</p>
                    </article>
                  </div>
                </aside>
              </div>

              <section className="guided-workflow-preview-panel">
                <div>
                  <span className="model-route-card__eyebrow">Execution preview</span>
                  <h4>What will happen when this workflow starts</h4>
                </div>

                <div className="guided-workflow-preview-list">
                  {AGENT_PLAN.map((planStep, index) => (
                    <article key={planStep}>
                      <span>{index + 1}</span>
                      <p>{planStep}</p>
                    </article>
                  ))}
                </div>
              </section>

              <details className="guided-workflow-details">
                <summary>View more: policy detail</summary>
                <div className="guided-workflow-proof-grid">
                  <article>
                    <strong>Tool-selection policy</strong>
                    <p>Use read-only internal tools by default and evaluate policy before every call.</p>
                  </article>
                  <article>
                    <strong>Validation policy</strong>
                    <p>Low confidence, missing shaft data, and weak product evidence stay visible for review.</p>
                  </article>
                  <article>
                    <strong>Fallback policy</strong>
                    <p>Model calls keep provider attempt logs so routing decisions can be audited.</p>
                  </article>
                </div>
              </details>
            </article>
          ) : null}

          {activeStep === "EXECUTION_TRACE" ? (
            <article className="guided-workflow-card">
              <div className="guided-workflow-card__header">
                <div>
                  <span className="model-route-card__eyebrow">Execution Trace</span>
                  <h3>Technical proof for the current run.</h3>
                  <p>
                    This trace only appears after the guided workflow creates evidence for
                    the current run.
                  </p>
                </div>
                <button onClick={() => onViewChange("WORKFLOW_RUNS")} type="button">
                  Inspect Full Audit Trail
                </button>
              </div>

              {tradeInResult ? (
                <>
                  <div className="guided-execution-evidence-grid">
                    <article className="guided-execution-evidence-card guided-execution-evidence-card--wide">
                      <span className="model-route-card__eyebrow">Agent plan</span>
                      <strong>
                        {tradeInResult.agentPlan.length} planned step(s)
                      </strong>
                      <p>
                        The agent planned validation, knowledge grounding, approved
                        tool selection, targeted retry, review handoff, policy
                        enforcement, and audit recording before summarizing the run.
                      </p>

                    </article>

                    <article className="guided-execution-evidence-card">
                      <span className="model-route-card__eyebrow">Validation checks</span>
                      <strong>
                        {tradeInResult.workflowQualitySummary.validationPassed} passed,{" "}
                        {tradeInResult.workflowQualitySummary.validationWarnings} warning(s)
                      </strong>
                      <p>
                        Field completeness, confidence, evidence, review routing,
                        and mutation policy checks are structured as first-class
                        validation output.
                      </p>
                      <details className="guided-workflow-inline-details">
                        <summary>View validation checks</summary>
                        <ol className="guided-workflow-check-list">
                          {tradeInResult.parsedItems.map((item) => {
                            const itemChecks = tradeInResult.validationChecks.filter(
                              (check) => check.recordId === item.id,
                            );
                            const warningCount = itemChecks.filter(
                              (check) => check.status === "WARNING",
                            ).length;
                            const failCount = itemChecks.filter(
                              (check) => check.status === "FAIL",
                            ).length;
                            const rowStatus =
                              failCount > 0 ? "FAIL" : warningCount > 0 ? "WARNING" : "PASS";
                            const clubLabel = [
                              item.brand,
                              item.productLine,
                              item.category,
                              item.shaftFlex,
                            ]
                              .filter(Boolean)
                              .join(" · ");

                            return (
                              <li key={item.id}>
                                <details className="guided-workflow-club-details">
                                  <summary>
                                    <span className={`guided-workflow-check-status guided-workflow-check-status--${rowStatus.toLowerCase()}`}>
                                      {rowStatus}
                                    </span>
                                    <span>{clubLabel || item.rawLine}</span>
                                    <small>
                                      confidence {item.confidence} · {warningCount} warning(s)
                                    </small>
                                  </summary>
                                  <dl className="agentic-demo-metadata">
                                    <div>
                                      <dt>Raw input</dt>
                                      <dd>{item.rawLine}</dd>
                                    </div>
                                    <div>
                                      <dt>Parsed club</dt>
                                      <dd>{clubLabel || "Unresolved club details"}</dd>
                                    </div>
                                    <div>
                                      <dt>Missing fields</dt>
                                      <dd>{item.missingFields.length > 0 ? item.missingFields.join(", ") : "None"}</dd>
                                    </div>
                                    <div>
                                      <dt>Uncertainty</dt>
                                      <dd>{item.uncertaintyNotes.length > 0 ? item.uncertaintyNotes.join(", ") : "None"}</dd>
                                    </div>
                                  </dl>
                                  <ol className="guided-workflow-club-checks">
                                    {itemChecks.map((check) => (
                                      <li key={check.id}>
                                        <span className={`guided-workflow-check-status guided-workflow-check-status--${check.status.toLowerCase()}`}>
                                          {check.status}
                                        </span>
                                        <span>{check.label}</span>
                                        <small>{check.message}</small>
                                      </li>
                                    ))}
                                  </ol>
                                </details>
                              </li>
                            );
                          })}

                        </ol>

                        <aside className="guided-workflow-policy-footnote">
                          <div>
                            <span className="model-route-card__eyebrow">
                              Workflow-level checks
                            </span>
                            <p>
                              These checks apply to the full run, not a single club
                              record. They confirm evidence coverage, review routing,
                              and mutation safety.
                            </p>
                          </div>

                          <ol className="guided-workflow-policy-checks">
                            {tradeInResult.validationChecks
                              .filter((check) => check.recordId === null)
                              .map((check) => (
                                <li key={check.id}>
                                  <span className={`guided-workflow-check-status guided-workflow-check-status--${check.status.toLowerCase()}`}>
                                    {check.status}
                                  </span>
                                  <strong>{check.label}</strong>
                                  <small>{check.message}</small>
                                </li>
                              ))}
                          </ol>
                        </aside>
                      </details>
                    </article>

                    <article className="guided-execution-evidence-card">
                      <span className="model-route-card__eyebrow">Targeted retry</span>
                      <strong>
                        {tradeInResult.workflowQualitySummary.retryAttempts} retry attempt(s)
                      </strong>
                      <p>
                        Retry behavior is tracked separately from provider fallback
                        and focuses only on recoverable extraction uncertainty.
                      </p>
                      <details className="guided-workflow-inline-details">
                        <summary>View retry details</summary>
                        <ol className="guided-workflow-compact-list">
                          {tradeInResult.retryEvents.map((event) => (
                            <li key={event.id}>
                              <span>{event.reason}</span>
                              <small>
                                {event.status} · {event.message}
                              </small>
                            </li>
                          ))}
                        </ol>
                      </details>
                    </article>
                    <article className="guided-execution-evidence-card">
                      <span className="model-route-card__eyebrow">Model routing</span>
                      <strong>
                        {tradeInResult.modelRoutingDecision.selectedProvider} /{" "}
                        {tradeInResult.modelRoutingDecision.selectedModel}
                      </strong>
                      <dl className="agentic-demo-metadata">
                        <div>
                          <dt>Fallback used</dt>
                          <dd>{tradeInResult.providerFallbackTrace.fallbackUsed ? "Yes" : "No"}</dd>
                        </div>
                        <div>
                          <dt>Provider attempts</dt>
                          <dd>{tradeInResult.providerFallbackTrace.attempts.length}</dd>
                        </div>
                      </dl>
                      <details className="guided-workflow-inline-details">
                        <summary>View provider attempts</summary>
                        <ol className="guided-workflow-compact-list">
                          {tradeInResult.providerFallbackTrace.attempts.map((attempt) => (
                            <li key={`${attempt.attemptOrder}-${attempt.provider}-${attempt.model}`}>
                              <span>
                                {attempt.provider} / {attempt.model}
                              </span>
                              <small>
                                {attempt.status}
                                {attempt.reason ? ` · ${attempt.reason}` : ""}
                              </small>
                            </li>
                          ))}
                        </ol>
                      </details>
                    </article>

                    <article className="guided-execution-evidence-card">
                      <span className="model-route-card__eyebrow">Knowledge grounding</span>
                      <strong>
                        {tradeInResult.finalSummary.knowledgeMatchCount} weighted match(es)
                      </strong>
                      <p>
                        Product knowledge search was attempted and logged before
                        workflow output was trusted.
                      </p>
                      <details className="guided-workflow-inline-details">
                        <summary>View knowledge evidence</summary>
                        <dl className="agentic-demo-metadata">
                          <div>
                            <dt>Matches</dt>
                            <dd>{tradeInResult.finalSummary.knowledgeMatchCount}</dd>
                          </div>
                          <div>
                            <dt>Top query</dt>
                            <dd>{tradeInResult.knowledgeMatchesByItem[0]?.query ?? "—"}</dd>
                          </div>
                        </dl>
                      </details>
                    </article>

                    <article className="guided-execution-evidence-card">
                      <span className="model-route-card__eyebrow">Internal systems</span>
                      <strong>
                        {tradeInResult.finalSummary.inventoryMatchCount} inventory match(es),{" "}
                        {tradeInResult.finalSummary.valuationRangeCount} demo valuation range(s)
                      </strong>
                      <p>
                        The workflow connected parsed records to seeded internal product
                        matches and demo valuation ranges without creating SKUs or offers.
                      </p>
                      <details className="guided-workflow-inline-details">
                        <summary>View internal system evidence</summary>
                        <dl className="agentic-demo-metadata">
                          <div>
                            <dt>Inventory matches</dt>
                            <dd>{tradeInResult.workflowQualitySummary.inventoryMatches}</dd>
                          </div>
                          <div>
                            <dt>Valuation ranges</dt>
                            <dd>{tradeInResult.workflowQualitySummary.valuationRangesGenerated}</dd>
                          </div>
                          <div>
                            <dt>Valuation review</dt>
                            <dd>{tradeInResult.workflowQualitySummary.valuationReviewRequired}</dd>
                          </div>
                          <div>
                            <dt>Top SKU</dt>
                            <dd>{tradeInResult.inventoryMatchesByItem[0]?.lookup.sku ?? "—"}</dd>
                          </div>
                          <div>
                            <dt>Top demo range</dt>
                            <dd>
                              {tradeInResult.valuationEvidenceByItem[0]
                                ? "$" +
                                  tradeInResult.valuationEvidenceByItem[0].estimate.lowValue +
                                  "–$" +
                                  tradeInResult.valuationEvidenceByItem[0].estimate.highValue
                                : "—"}
                            </dd>
                          </div>
                        </dl>
                      </details>
                    </article>

                    <article className="guided-execution-evidence-card">
                      <span className="model-route-card__eyebrow">Tool safety</span>
                      <strong>
                        {tradeInResult.finalSummary.successfulReadOnlyToolCallCount} read-only call(s),{" "}
                        {tradeInResult.finalSummary.blockedMutationToolCallCount} blocked mutation(s)
                      </strong>
                      <p>
                        Approved read-only tools executed. Unsafe mutation requests
                        were blocked before execution.
                      </p>
                      <details className="guided-workflow-inline-details">
                        <summary>View tool rationale</summary>
                        <ol className="guided-workflow-compact-list">
                          {tradeInResult.toolSelectionRationales.map((tool) => (
                            <li key={tool.toolName}>
                              <span>{tool.toolName}</span>
                              <small>{tool.rationale}</small>
                            </li>
                          ))}
                        </ol>
                      </details>
                    </article>

                    <article className="guided-execution-evidence-card">
                      <span className="model-route-card__eyebrow">Human review</span>
                      <strong>
                        {tradeInResult.reviewQueueItemsCreated.length} review item(s) created
                      </strong>
                      <p>
                        Validation found uncertainty. A human review item was created
                        instead of silently accepting the record.
                      </p>
                    </article>

                    <article className="guided-execution-evidence-card guided-execution-evidence-card--wide">
                      <span className="model-route-card__eyebrow">Audit proof</span>
                      <strong>{tradeInResult.auditTrail.length} audit event(s) captured</strong>
                      <p>
                        The run includes ordered evidence for planning, validation,
                        retry behavior, routing, tool execution, blocked mutation
                        checks, and review creation.
                      </p>
                    </article>

                    {blockedMutation ? (
                      <article className="guided-execution-evidence-card guided-execution-evidence-card--blocked">
                        <span className="agentic-demo-audit-event__status agentic-demo-audit-event__status--blocked">
                          BLOCKED
                        </span>
                        <strong>Unsafe mutation blocked</strong>
                        <p>{blockedMutation.policyReason}</p>
                      </article>
                    ) : null}
                  </div>

                  <button onClick={() => setActiveStep("HUMAN_REVIEW")} type="button">
                    Continue to Human Review
                  </button>

                </>
              ) : (
                <EmptyState
                  title="Run the trade-in workflow first"
                  message="The execution trace is intentionally locked until the current workflow creates model, tool, evidence, and review logs."
                />
              )}
            </article>
          ) : null}

          {activeStep === "HUMAN_REVIEW" ? (
            <article className="guided-workflow-card">
              <div className="guided-workflow-card__header">
                <div>
                  <span className="model-route-card__eyebrow">Human Review</span>
                  <h3>Review work created by this workflow.</h3>
                  <p>
                    The primary view focuses on review items from the current guided run.
                    Global queue depth stays secondary.
                  </p>
                </div>
                <button onClick={() => onViewChange("REVIEW_QUEUE")} type="button">
                  Inspect Full Review Queue
                </button>
              </div>

              {tradeInResult ? (
                <>
                  <div className="guided-workflow-metrics">
                    <article>
                      <strong>{currentRunReviewItems.length}</strong>
                      <span>Current-run review items</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.reviewOutcomes.length}</strong>
                      <span>Validation-linked outcomes</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.finalSummary.lowConfidenceItemCount}</strong>
                      <span>Low-confidence records</span>
                    </article>
                    <article>
                      <strong>{openReviewQueueItemCount}</strong>
                      <span>Global open queue</span>
                    </article>
                    <article>
                      <strong>Captured</strong>
                      <span>Source evidence</span>
                    </article>
                  </div>

                  {currentRunReviewItems.length > 0 ? (
                    <div className="agentic-demo-card-list">
                      {currentRunReviewItems.map((item) => {
                        const evidence = getReviewQueueEvidenceSummary(item);
                        const reviewOutcome = tradeInResult.reviewOutcomes.find(
                          (outcome) => outcome.reviewQueueItemId === item.id,
                        );
                        const isClosed =
                          item.status === "RESOLVED" || item.status === "DISMISSED";
                        const aiReadyRecord = sourceIntakePersistedRecords.find(
                          (record) =>
                            (item.intakeItemId &&
                              record.intakeItemId === item.intakeItemId) ||
                            (item.workflowRunId &&
                              record.workflowRunId === item.workflowRunId),
                        );

                        return (
                          <article className="agentic-demo-card" key={item.id}>
                            <div className="agentic-demo-card__header">
                              <div>
                                <span className="model-route-card__eyebrow">
                                  {isClosed ? "Human review recorded" : "Human review needed"}
                                </span>
                                <h4>{item.reason}</h4>
                              </div>
                              <span
                                className={
                                  isClosed
                                    ? "agentic-demo-pill"
                                    : "agentic-demo-pill agentic-demo-pill--warning"
                                }
                              >
                                {item.status}
                              </span>
                            </div>

                            <p>
                              {isClosed
                                ? "A human review action has been recorded for this item. The workflow can now show the uncertainty loop as reviewed."
                                : "Validation found uncertainty. Inspect the evidence, confirm or correct the normalized trade-in record, then resolve as a controlled human action."}
                            </p>

                            <section className="guided-review-walkthrough">
                              <div className="guided-review-context">
                                <span className="model-route-card__eyebrow">
                                  Review context
                                </span>
                                <p>
                                  Low parse confidence explains why this record was routed
                                  to human review. The checklist below only shows the
                                  actionable record issues to confirm or correct.
                                </p>
                              </div>

                              <div className="guided-review-walkthrough__header">
                                <span className="model-route-card__eyebrow">
                                  What to do in this step
                                </span>
                                <strong>
                                  Turn uncertain AI output into a human-approved record.
                                </strong>
                              </div>

                              <div className="guided-review-context">
                                <p>
                                  For each issue, make a specific review decision. Confirm or
                                  correct the category, choose one fixed condition grade, and
                                  decide whether the low-confidence inventory match should be
                                  accepted, corrected, or rejected. These choices are saved as
                                  reviewed record fields and learning events.
                                </p>
                              </div>

                              <div className="guided-review-walkthrough__header">
                                <span className="model-route-card__eyebrow">
                                  Issue checklist
                                </span>
                                <strong>
                                  {evidence.reviewIssues.length} actionable{" "}
                                  {evidence.reviewIssues.length === 1 ? "issue" : "issues"} to confirm
                                </strong>
                              </div>

                              {evidence.reviewIssues.length > 0 ? (
                                <ol className="guided-review-issue-list">
                                  {evidence.reviewIssues.map((issue, index) => {
                                    const issueKey = getGuidedReviewIssueKey(
                                      item.id,
                                      issue.id,
                                    );
                                    const isIssueActive =
                                      activeGuidedReviewIssueKey === issueKey;
                                    const isIssueResolved =
                                      isClosed ||
                                      resolvedGuidedReviewIssueKeys[issueKey] === true;

                                    return (
                                      <li
                                        className={
                                          isIssueResolved
                                            ? "guided-review-issue-list__item guided-review-issue-list__item--resolved"
                                            : isIssueActive
                                              ? "guided-review-issue-list__item guided-review-issue-list__item--active"
                                              : "guided-review-issue-list__item"
                                        }
                                        key={issueKey}
                                      >
                                        <button
                                          className="guided-review-issue-button"
                                          onClick={() =>
                                            setActiveGuidedReviewIssueKey(
                                              isIssueActive ? null : issueKey,
                                            )
                                          }
                                          type="button"
                                        >
                                          <span>{index + 1}</span>
                                          <div>
                                            <strong>{issue.label}</strong>
                                            <p>{issue.detail}</p>
                                          </div>
                                          <em>
                                            {isIssueResolved ? "Addressed" : issue.severity}
                                          </em>
                                        </button>

                                        {isIssueActive ? (
                                          <div className="guided-review-issue-editor">
                                            {issue.id === "missing-category" ? (
                                              <div className="guided-review-category-correction">
                                                <label>
                                                  Choose category
                                                  <select
                                                    onChange={(event) =>
                                                      handleGuidedReviewCategorySelectionChange(
                                                        issueKey,
                                                        event.target.value,
                                                      )
                                                    }
                                                    value={guidedReviewCategorySelections[issueKey] ?? ""}
                                                  >
                                                    <option value="">Select a category…</option>
                                                    {REVIEW_CATEGORY_OPTIONS.map((option) => (
                                                      <option key={option.value} value={option.value}>
                                                        {option.label}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </label>

                                                <label>
                                                  Matching raw text from original input
                                                  <input
                                                    onChange={(event) =>
                                                      handleGuidedReviewRawTextMatchChange(
                                                        issueKey,
                                                        event.target.value,
                                                      )
                                                    }
                                                    placeholder="Copy the phrase from Original raw text, for example IRON_SET"
                                                    type="text"
                                                    value={guidedReviewRawTextMatches[issueKey] ?? ""}
                                                  />
                                                </label>

                                                <p className="review-queue-card__meta">
                                                  Reference the Original raw text evidence below. This
                                                  records a structured human-approved learning event
                                                  when this review item is resolved.
                                                </p>
                                              </div>
                                            ) : isConditionReviewIssue(issue.id) ? (
                                              <div className="guided-review-category-correction">
                                                <label>
                                                  Condition grade
                                                  <select
                                                    onChange={(event) =>
                                                      handleGuidedReviewConditionGradeChange(
                                                        issueKey,
                                                        event.target.value as ReviewConditionGrade | "",
                                                      )
                                                    }
                                                    value={guidedReviewConditionGradeSelections[issueKey] ?? ""}
                                                  >
                                                    <option value="">Select condition grade…</option>
                                                    {REVIEW_CONDITION_GRADE_OPTIONS.map((option) => (
                                                      <option key={option.value} value={option.value}>
                                                        {option.label}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </label>

                                                <p className="review-queue-card__meta">
                                                  Choose one fixed condition grade supplied by the intake source.
                                                </p>
                                              </div>
                                            ) : isShaftFlexReviewIssue(issue.id) ? (
                                              <div className="guided-review-category-correction">
                                                <label>
                                                  Shaft flex
                                                  <select
                                                    onChange={(event) =>
                                                      handleGuidedReviewShaftFlexChange(
                                                        issueKey,
                                                        event.target.value as ReviewCorrectionShaftFlex | "",
                                                      )
                                                    }
                                                    value={guidedReviewShaftFlexSelections[issueKey] ?? ""}
                                                  >
                                                    <option value="">Select shaft flex…</option>
                                                    {REVIEW_SHAFT_FLEX_OPTIONS.map((option) => (
                                                      <option key={option.value} value={option.value}>
                                                        {option.label}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </label>

                                                <label>
                                                  Matching raw text from original input
                                                  <input
                                                    onChange={(event) =>
                                                      handleGuidedReviewRawTextMatchChange(
                                                        issueKey,
                                                        event.target.value,
                                                      )
                                                    }
                                                    placeholder="Copy the phrase from Original raw text, for example X-Stiff"
                                                    type="text"
                                                    value={guidedReviewRawTextMatches[issueKey] ?? ""}
                                                  />
                                                </label>

                                                <p className="review-queue-card__meta">
                                                  Choose one fixed shaft flex value, then map the
                                                  exact raw text phrase that should improve future
                                                  shaft flex matching.
                                                </p>
                                              </div>
                                            ) : isDemoValuationRangeIssue(issue.label) ? (
                                              <div className="guided-review-category-correction">
                                                <label>
                                                  Demo valuation decision
                                                  <select
                                                    onChange={(event) =>
                                                      handleGuidedReviewDemoValuationDecisionChange(
                                                        issueKey,
                                                        event.target.value as GuidedDemoValuationDecision | "",
                                                      )
                                                    }
                                                    value={guidedReviewDemoValuationDecisions[issueKey] ?? ""}
                                                  >
                                                    <option value="">Select valuation decision…</option>
                                                    {REVIEW_DEMO_VALUATION_DECISION_OPTIONS.map((option) => (
                                                      <option key={option.value} value={option.value}>
                                                        {option.label}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </label>

                                                <label>
                                                  Reviewed demo value
                                                  <input
                                                    disabled={
                                                      guidedReviewDemoValuationDecisions[issueKey] !==
                                                      "ENTER_REVIEWED_VALUE"
                                                    }
                                                    min="0"
                                                    onChange={(event) =>
                                                      handleGuidedReviewDemoValueChange(
                                                        issueKey,
                                                        event.target.value,
                                                      )
                                                    }
                                                    placeholder="Example: 250"
                                                    type="number"
                                                    value={guidedReviewDemoValues[issueKey] ?? ""}
                                                  />
                                                </label>

                                                <label>
                                                  Valuation note
                                                  <textarea
                                                    onChange={(event) =>
                                                      handleGuidedReviewIssueCorrectionChange(
                                                        issueKey,
                                                        event.target.value,
                                                      )
                                                    }
                                                    placeholder="Example: current range is acceptable after condition grade review."
                                                    rows={3}
                                                    value={
                                                      guidedReviewIssueCorrections[issueKey] ?? ""
                                                    }
                                                  />
                                                </label>

                                                <p className="review-queue-card__meta">
                                                  Confirm the current demo range, enter a reviewed
                                                  demo value, or mark valuation as not ready. This
                                                  keeps valuation review explicit whenever confidence
                                                  is low or review is required.
                                                </p>
                                              </div>
                                            ) : isInventoryMatchConfidenceIssue(issue.label) ? (
                                              <div className="guided-review-category-correction">
                                                <label>
                                                  Inventory match decision
                                                  <select
                                                    onChange={(event) =>
                                                      handleGuidedReviewInventoryMatchDecisionChange(
                                                        issueKey,
                                                        event.target.value as GuidedInventoryMatchDecision | "",
                                                      )
                                                    }
                                                    value={guidedReviewInventoryMatchDecisions[issueKey] ?? ""}
                                                  >
                                                    <option value="">Select match decision…</option>
                                                    {REVIEW_INVENTORY_MATCH_DECISION_OPTIONS.map((option) => (
                                                      <option key={option.value} value={option.value}>
                                                        {option.label}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </label>

                                                <label>
                                                  Match evidence or corrected product
                                                  <textarea
                                                    onChange={(event) =>
                                                      handleGuidedReviewIssueCorrectionChange(
                                                        issueKey,
                                                        event.target.value,
                                                      )
                                                    }
                                                    placeholder="Example: raw text PING G425 irons confirms PING G425 iron set, even though confidence was low."
                                                    rows={3}
                                                    value={
                                                      guidedReviewIssueCorrections[issueKey] ?? ""
                                                    }
                                                  />
                                                </label>

                                                <p className="review-queue-card__meta">
                                                  Use this to approve the proposed inventory match,
                                                  correct the matched product, or say no reliable
                                                  product match exists. The decision becomes a
                                                  structured learning event for future matching.
                                                </p>
                                              </div>
                                            ) : (
                                              <label>
                                                Correction note
                                                <textarea
                                                  onChange={(event) =>
                                                    handleGuidedReviewIssueCorrectionChange(
                                                      issueKey,
                                                      event.target.value,
                                                    )
                                                  }
                                                  placeholder="Add a short correction note for this review issue."
                                                  rows={3}
                                                  value={
                                                    guidedReviewIssueCorrections[issueKey] ?? ""
                                                  }
                                                />
                                              </label>
                                            )}

                                            <div className="workflow-run-card__actions">
                                              <button
                                                disabled={
                                                  (issue.id === "missing-category" &&
                                                    !guidedReviewCategorySelections[issueKey]) ||
                                                  (isConditionReviewIssue(issue.id) &&
                                                    !guidedReviewConditionGradeSelections[issueKey]) ||
                                                  (isShaftFlexReviewIssue(issue.id) &&
                                                    !guidedReviewShaftFlexSelections[issueKey]) ||
                                                  (isInventoryMatchConfidenceIssue(issue.label) &&
                                                    !guidedReviewInventoryMatchDecisions[issueKey]) ||
                                                  (isDemoValuationRangeIssue(issue.label) &&
                                                    !guidedReviewDemoValuationDecisions[issueKey]) ||
                                                  (isDemoValuationRangeIssue(issue.label) &&
                                                    guidedReviewDemoValuationDecisions[issueKey] ===
                                                      "ENTER_REVIEWED_VALUE" &&
                                                    !guidedReviewDemoValues[issueKey])
                                                }
                                                onClick={() => {
                                                  const selectedCategory =
                                                    guidedReviewCategorySelections[issueKey];
                                                  const rawTextMatch =
                                                    guidedReviewRawTextMatches[issueKey]?.trim();
                                                  const selectedConditionGrade =
                                                    guidedReviewConditionGradeSelections[issueKey];
                                                  const selectedShaftFlex =
                                                    guidedReviewShaftFlexSelections[issueKey];
                                                  const correctionNote =
                                                    guidedReviewIssueCorrections[issueKey]?.trim();
                                                  const inventoryDecision =
                                                    guidedReviewInventoryMatchDecisions[issueKey];
                                                  const demoValuationDecision =
                                                    guidedReviewDemoValuationDecisions[issueKey];
                                                  const reviewedDemoValue =
                                                    guidedReviewDemoValues[issueKey]?.trim();

                                                  handleApplyGuidedReviewIssueCorrection({
                                                    reviewQueueItemId: item.id,
                                                    issueKey,
                                                    issueLabel: issue.label,
                                                    correctionOverride:
                                                      issue.id === "missing-category" &&
                                                      selectedCategory
                                                        ? "category=" +
                                                          selectedCategory +
                                                          (rawTextMatch
                                                            ? '. Review learning candidate: raw text "' +
                                                              rawTextMatch +
                                                              '" maps to category ' +
                                                              selectedCategory +
                                                              "."
                                                            : ".")
                                                        : isConditionReviewIssue(issue.id) &&
                                                            selectedConditionGrade
                                                          ? "conditionGrade=" +
                                                            selectedConditionGrade +
                                                            "."
                                                          : isShaftFlexReviewIssue(issue.id) &&
                                                              selectedShaftFlex
                                                            ? "shaftFlex=" +
                                                              selectedShaftFlex +
                                                              (rawTextMatch
                                                                ? '. Review learning candidate: raw text "' +
                                                                  rawTextMatch +
                                                                  '" maps to shaft flex ' +
                                                                  selectedShaftFlex +
                                                                  "."
                                                                : ".")
                                                            : isInventoryMatchConfidenceIssue(issue.label) &&
                                                              inventoryDecision
                                                            ? "inventoryMatchDecision=" +
                                                              getInventoryMatchDecisionLabel(inventoryDecision) +
                                                              (correctionNote
                                                                ? '. Evidence: "' +
                                                                  correctionNote +
                                                                  '".'
                                                                : ".")
                                                            : isDemoValuationRangeIssue(issue.label) &&
                                                                demoValuationDecision
                                                              ? "demoValuationDecision=" +
                                                                getDemoValuationDecisionLabel(
                                                                  demoValuationDecision,
                                                                ) +
                                                                (reviewedDemoValue
                                                                  ? ". Reviewed demo value: " +
                                                                    reviewedDemoValue +
                                                                    "."
                                                                  : ".")
                                                              : undefined,
                                                  });
                                                }}
                                                type="button"
                                              >
                                                Mark issue addressed
                                              </button>
                                            </div>
                                          </div>
                                        ) : null}
                                      </li>
                                    );
                                  })}
                                </ol>
                              ) : (
                                <p className="review-queue-card__meta">
                                  No structured review issues were extracted. Inspect the
                                  evidence before resolving.
                                </p>
                              )}

                              <div className="guided-review-evidence-grid">
                                <article>
                                  <span className="model-route-card__eyebrow">
                                    Original raw text
                                  </span>
                                  <p>{evidence.rawText}</p>
                                </article>

                                <article>
                                  <span className="model-route-card__eyebrow">
                                    Proposed club
                                  </span>
                                  <p>{evidence.parsedClubLabel}</p>
                                </article>

                                <article>
                                  <span className="model-route-card__eyebrow">
                                    Inventory match
                                  </span>
                                  <p>
                                    {evidence.inventoryMatchSummary ??
                                      "No inventory match captured."}
                                  </p>
                                </article>

                                <article>
                                  <span className="model-route-card__eyebrow">
                                    Demo valuation range
                                  </span>
                                  <p>
                                    {evidence.demoValuationRangeSummary ??
                                      "No demo valuation range captured."}
                                  </p>
                                </article>

                                <article>
                                  <span className="model-route-card__eyebrow">
                                    Review outcome
                                  </span>
                                  <p>
                                    {item.resolvedAt
                                      ? "Resolved at " + item.resolvedAt
                                      : "Awaiting controlled human action"}
                                  </p>
                                </article>

                              </div>

                              {getReviewedTradeInRecord(item) ? (
                                <div className="guided-review-evidence-grid">
                                  <article>
                                    <span className="model-route-card__eyebrow">
                                      Reviewed record
                                    </span>
                                    <p>
                                      {[
                                        getReviewedTradeInRecord(item)?.correctedBrand,
                                        getReviewedTradeInRecord(item)?.correctedProductLine,
                                        getReviewedTradeInRecord(item)?.correctedCategory,
                                        getReviewedTradeInRecord(item)?.correctedShaftFlex,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ") || "No corrected fields captured."}
                                    </p>
                                  </article>

                                  <article>
                                    <span className="model-route-card__eyebrow">
                                      Condition grade
                                    </span>
                                    <p>
                                      {getReviewedTradeInRecord(item)?.correctedConditionGrade ??
                                        "No fixed condition grade captured."}
                                    </p>
                                  </article>

                                  <article>
                                    <span className="model-route-card__eyebrow">
                                      Demo value
                                    </span>
                                    <p>
                                      {getReviewedTradeInRecord(item)?.correctedDemoValue ??
                                        "No reviewed demo value captured."}
                                    </p>
                                  </article>

                                  <article>
                                    <span className="model-route-card__eyebrow">
                                      AI-ready record status
                                    </span>
                                    <p>
                                      {aiReadyRecord
                                        ? aiReadyRecord.status +
                                          " · RAG ready: " +
                                          (aiReadyRecord.ragReady ? "Yes" : "Not yet")
                                        : "No linked AI-ready record found."}
                                    </p>
                                  </article>
                                </div>
                              ) : null}

                              {getHumanReviewLearningEvents(item).length > 0 ? (
                                <article className="guided-execution-evidence-card guided-execution-evidence-card--wide">
                                  <span className="model-route-card__eyebrow">
                                    Learning events
                                  </span>
                                  <strong>
                                    {getHumanReviewLearningEvents(item).length} human-approved{" "}
                                    {getHumanReviewLearningEvents(item).length === 1
                                      ? "signal"
                                      : "signals"} captured
                                  </strong>
                                  <div className="guided-review-evidence-grid">
                                    {getHumanReviewLearningEvents(item).map((event) => (
                                      <article key={event.id}>
                                        <span className="model-route-card__eyebrow">
                                          {formatLearningEventFieldName(event.fieldName)}
                                        </span>
                                        <p>
                                          {formatLearningEventSummary({
                                            rawTextMatch: event.rawTextMatch,
                                            correctedValue: event.correctedValue,
                                            confidenceImpact: event.confidenceImpact,
                                          })}
                                        </p>
                                      </article>
                                    ))}
                                  </div>
                                </article>
                              ) : null}
                            </section>

                            <article className="guided-execution-evidence-card guided-execution-evidence-card--wide">
                              <span className="model-route-card__eyebrow">
                                Review lifecycle
                              </span>
                              <strong>
                                {isClosed
                                  ? "After: human review updated the AI-ready record"
                                  : "Before: workflow paused for human review"}
                              </strong>
                              <p>
                                {isClosed && aiReadyRecord
                                  ? "The durable AI-ready record now reflects reviewed fields and can be used for downstream RAG preparation."
                                  : evidence.suggestedNextAction}
                              </p>
                            </article>

                            {!isClosed ? (
                              <div className="review-queue-card__review-actions">
                                <p className="review-queue-card__meta">
                                  Controlled human action. Address every checklist issue, then
                                  resolve to save reviewer notes, final reviewed fields and
                                  learning events.
                                </p>

                                <label>
                                  Reviewer Notes
                                  <textarea
                                    onChange={(event) =>
                                      onReviewQueueNotesChange(item.id, event.target.value)
                                    }
                                    placeholder="Add approval context, corrections, or reviewer notes before resolving."
                                    rows={3}
                                    value={reviewQueueNotesById[item.id] ?? ""}
                                  />
                                </label>

                                <div className="workflow-run-card__actions">
                                  <button
                                    title={
                                      evidence.reviewIssues.some((issue) => {
                                        const issueKey = getGuidedReviewIssueKey(
                                          item.id,
                                          issue.id,
                                        );

                                        return (
                                          resolvedGuidedReviewIssueKeys[issueKey] !== true
                                        );
                                      })
                                        ? "Address every checklist issue before resolving."
                                        : undefined
                                    }
                                    disabled={
                                      activeReviewQueueItemId === item.id ||
                                      evidence.reviewIssues.some((issue) => {
                                        const issueKey = getGuidedReviewIssueKey(
                                          item.id,
                                          issue.id,
                                        );

                                        return (
                                          resolvedGuidedReviewIssueKeys[issueKey] !== true
                                        );
                                      })
                                    }
                                    onClick={() =>
                                      onResolveReviewQueueItemWithCorrections({
                                        reviewQueueItemId: item.id,
                                        request: buildGuidedStructuredReviewRequest({
                                          item,
                                          evidence,
                                        }),
                                        workflowRunId: item.workflowRunId,
                                      })
                                    }
                                    type="button"
                                  >
                                    {activeReviewQueueItemId === item.id
                                      ? "Updating…"
                                      : "Resolve with reviewed record"}
                                  </button>

                                  <button
                                    onClick={() => onViewChange("REVIEW_QUEUE")}
                                    type="button"
                                  >
                                    Open Full Review Queue
                                  </button>
                                </div>
                              </div>
                            ) : null}

                            <details className="guided-workflow-details">
                              <summary>View more: validation warnings and extracted fields</summary>
                              <div className="guided-review-evidence-grid">
                                <article>
                                  <span className="model-route-card__eyebrow">
                                    Reviewer notes
                                  </span>
                                  <p>{item.reviewerNotes ?? "Not recorded yet."}</p>
                                </article>
                              </div>

                              <pre>
                                {JSON.stringify(
                                  {
                                    reviewOutcome,
                                    proposedGolfClubJson: item.proposedGolfClubJson,
                                  },
                                  null,
                                  2,
                                )}
                              </pre>
                            </details>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      title="No current-run review item"
                      message="This run did not create a review item."
                    />
                  )}

                  <button onClick={() => setActiveStep("QUALITY_SUMMARY")} type="button">
                    Continue to Quality Summary
                  </button>
                </>
              ) : (
                <EmptyState
                  title="Run the trade-in workflow first"
                  message="Human review is intentionally locked until the workflow creates current-run results."
                />
              )}
            </article>
          ) : null}

          {activeStep === "QUALITY_SUMMARY" ? (
            <article className="guided-workflow-card">
              <div className="guided-workflow-card__header">
                <div>
                  <span className="model-route-card__eyebrow">Quality Summary</span>
                  <h3>Current guided run outcome.</h3>
                  <p>
                    The final summary reports only supported data from the guided run.
                  </p>
                </div>
                <button onClick={() => onViewChange("MCP_CONNECTORS")} type="button">
                  Inspect Tool Connectors
                </button>
              </div>

              {tradeInResult ? (
                <>
                  <div className="guided-workflow-metrics">
                    <article>
                      <strong>
                        {currentRunReviewLoopComplete ? "REVIEW_COMPLETED" : "REVIEW_OPEN"}
                      </strong>
                      <span>Final review status</span>
                    </article>
                    <article>
                      <strong>{currentRunWorkflow?.status ?? "Created"}</strong>
                      <span>Workflow lifecycle status</span>
                    </article>
                    <article>
                      <strong>{currentRunOpenReviewItemCount}</strong>
                      <span>Unresolved review items</span>
                    </article>
                    <article>
                      <strong>{currentRunHumanApprovedCorrectionCount}</strong>
                      <span>Human-approved corrections</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.workflowQualitySummary.recordsProcessed}</strong>
                      <span>Records processed</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.workflowQualitySummary.inventoryMatches}</strong>
                      <span>Inventory matches</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.workflowQualitySummary.valuationRangesGenerated}</strong>
                      <span>Demo valuation ranges</span>
                    </article>
                    <article>
                      <strong>{tradeInResult.workflowQualitySummary.blockedMutations}</strong>
                      <span>Blocked unsafe mutations</span>
                    </article>
                  </div>

                  <article className="guided-execution-evidence-card guided-execution-evidence-card--wide guided-outcome-card">
                    <span className="model-route-card__eyebrow">Outcome</span>
                    <strong>
                      {currentRunReviewLoopComplete
                        ? "Human review completed the workflow loop"
                        : "Human review still needs attention"}
                    </strong>
                    <p>
                      {currentRunReviewLoopComplete
                        ? "The workflow found uncertainty, created a review item, and a human resolved it. The workflow lifecycle is now complete."
                        : "The workflow found uncertainty and created review work. Resolve the open review item before treating this run as complete."}
                    </p>
                  </article>

                  <article className="guided-execution-evidence-card guided-execution-evidence-card--wide guided-outcome-card">
                    <span className="model-route-card__eyebrow">
                      Human-approved record
                    </span>
                    <strong>
                      {currentRunHumanApprovedCorrectionCount > 0
                        ? "Reviewer corrections are attached to the record"
                        : "No reviewer corrections attached yet"}
                    </strong>
                    <p>
                      The reviewed trade-in record now carries reviewer notes with
                      corrections, confirmations, and any raw-text category mapping
                      candidates captured during Human Review.
                    </p>
                    {currentRunReviewItems.length > 0 ? (
                      <ul className="guided-outcome-list">
                        {currentRunReviewItems.map((item) => (
                          <li key={item.id}>
                            <strong>{item.status}</strong>
                            <span>{item.reviewerNotes ?? "No reviewer notes recorded."}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>

                  <article className="guided-execution-evidence-card guided-execution-evidence-card--wide guided-outcome-card">
                    <span className="model-route-card__eyebrow">
                      Downstream readiness
                    </span>
                    <strong>
                      {currentRunReviewLoopComplete
                        ? "Ready for the next controlled workflow step"
                        : "Not ready until review is resolved"}
                    </strong>
                    <p>
                      For this slice, the improved output is represented by the resolved
                      review item and reviewer notes. A later learning-events slice can
                      persist reusable mappings, increase future parse confidence, and
                      write finalized normalized records to a dedicated output table.
                    </p>
                  </article>

                  <details className="guided-workflow-details">
                    <summary>View more: quality summary and persisted audit identifiers</summary>
                    <pre>
                      {JSON.stringify(
                        {
                          workflowQualitySummary: tradeInResult.workflowQualitySummary,
                          workflowRunId: tradeInResult.persisted.workflowRunId,
                          modelCallLogId: tradeInResult.persisted.modelCallLogId,
                          toolCallLogIds: tradeInResult.persisted.toolCallLogIds,
                          reviewQueueItemIds: tradeInResult.persisted.reviewQueueItemIds,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </>
              ) : (
                <EmptyState
                  title="No final summary yet"
                  message="Complete the trade-in workflow to produce a current-run quality summary."
                />
              )}
            </article>
          ) : null}
        </section>
      </div>
    </div>
  );
}
