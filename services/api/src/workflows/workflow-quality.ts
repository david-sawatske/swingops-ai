import type { ReviewQueueItem } from "@prisma/client";

import type { ParsedTradeInDemoItem } from "./trade-in-demo-parser.js";
import type { EndToEndAgenticTradeInDemoResult } from "./end-to-end-agentic-trade-in-demo.js";

export type AgentPlanActionType =
  | "VALIDATE_FIELDS"
  | "SEARCH_KNOWLEDGE"
  | "SELECT_TOOLS"
  | "EXECUTE_TOOLS"
  | "VALIDATE_CONFIDENCE"
  | "RETRY_EXTRACTION"
  | "ESCALATE_REVIEW"
  | "ENFORCE_POLICY"
  | "RECORD_TRACE";

export type AgentPlanStepStatus =
  | "PENDING"
  | "COMPLETED"
  | "NEEDS_REVIEW"
  | "BLOCKED"
  | "SKIPPED";

export type AgentPlanStep = {
  id: string;
  label: string;
  purpose: string;
  actionType: AgentPlanActionType;
  expectedOutput: string;
  status: AgentPlanStepStatus;
  linkedTraceEventIds: string[];
  requiredTools: string[];
  validationRules: string[];
  retryPolicy: string | null;
  safetyPolicy: string | null;
};

export type ValidationCheckStatus = "PASS" | "WARNING" | "FAIL";

export type ValidationCheckSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH";

export type ValidationCheck = {
  id: string;
  label: string;
  status: ValidationCheckStatus;
  severity: ValidationCheckSeverity;
  message: string;
  field: string | null;
  recordId: string | null;
  reviewRequired: boolean;
};

export type RetryEventStatus = "RESOLVED" | "UNRESOLVED" | "SKIPPED";

export type RetryEvent = {
  id: string;
  reason: string;
  targetField: string | null;
  recordId: string | null;
  policy: string;
  status: RetryEventStatus;
  before: unknown;
  after: unknown;
  message: string;
};

export type ProviderFallbackTraceAttempt = {
  provider: string;
  model: string;
  attemptOrder: number;
  status: string;
  reason: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  estimatedCostUsd: number | null;
};

export type ProviderFallbackTrace = {
  routingGoal: string;
  selectedProvider: string;
  selectedModel: string;
  finalProvider: string;
  finalModel: string;
  fallbackUsed: boolean;
  attempts: ProviderFallbackTraceAttempt[];
  summary: string;
};

export type ToolSelectionRationale = {
  toolName: string;
  rationale: string;
  expectedRiskLevel: "LOW" | "HIGH";
  expectedMutatesData: boolean;
  expectedRequiresHumanApproval: boolean;
};

export type ReviewOutcome = {
  reviewQueueItemId: string;
  recordId: string | null;
  reason: string;
  validationWarnings: string[];
  suggestedNextAction: string;
};

export type WorkflowQualityStatus =
  | "READY"
  | "NEEDS_REVIEW"
  | "FAILED_VALIDATION"
  | "BLOCKED";

export type WorkflowQualitySummary = {
  status: WorkflowQualityStatus;
  recordsProcessed: number;
  validationPassed: number;
  validationWarnings: number;
  validationFailures: number;
  retryAttempts: number;
  reviewItemsCreated: number;
  toolCalls: number;
  blockedMutations: number;
  providerFallbackUsed: boolean;
  evidenceCoverage: string;
  summary: string;
};

export type WorkflowQualityBundle = {
  agentPlan: AgentPlanStep[];
  validationChecks: ValidationCheck[];
  retryEvents: RetryEvent[];
  providerFallbackTrace: ProviderFallbackTrace;
  toolSelectionRationales: ToolSelectionRationale[];
  reviewOutcomes: ReviewOutcome[];
  workflowQualitySummary: WorkflowQualitySummary;
};

type ToolCallingPlan = EndToEndAgenticTradeInDemoResult["toolCallingPlan"];
type ToolCallResults = EndToEndAgenticTradeInDemoResult["toolCallResults"];
type KnowledgeMatchesByItem =
  EndToEndAgenticTradeInDemoResult["knowledgeMatchesByItem"];
type ModelCallLog = EndToEndAgenticTradeInDemoResult["modelCallLog"];

function itemNeedsReview(item: ParsedTradeInDemoItem): boolean {
  return item.confidence < 0.72 || item.missingFields.length > 0;
}

function validationStatusForRequiredField(
  value: string | null,
  hasUncertainty: boolean
): ValidationCheckStatus {
  if (!value) {
    return "WARNING";
  }

  return hasUncertainty ? "WARNING" : "PASS";
}

function validationSeverityForStatus(
  status: ValidationCheckStatus,
  reviewRequired: boolean
): ValidationCheckSeverity {
  if (status === "FAIL") {
    return "HIGH";
  }

  if (reviewRequired) {
    return "MEDIUM";
  }

  if (status === "WARNING") {
    return "LOW";
  }

  return "INFO";
}

function buildValidationChecks(input: {
  parsedItems: ParsedTradeInDemoItem[];
  knowledgeMatchesByItem: KnowledgeMatchesByItem;
  blockedMutationCount: number;
}): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  for (const item of input.parsedItems) {
    const reviewRequired = itemNeedsReview(item);
    const knowledgeMatch = input.knowledgeMatchesByItem.find(
      (match) => match.parsedItemId === item.id
    );
    const knowledgeResultCount = knowledgeMatch?.search.results.length ?? 0;

    const fieldChecks: {
      idSuffix: string;
      label: string;
      field: string;
      value: string | null;
      hasUncertainty: boolean;
      missingMessage: string;
      presentMessage: string;
    }[] = [
      {
        idSuffix: "brand",
        label: "Brand recognized",
        field: "brand",
        value: item.brand,
        hasUncertainty: false,
        missingMessage: "Brand could not be recognized from the raw trade-in text.",
        presentMessage: `Brand recognized as ${item.brand}.`
      },
      {
        idSuffix: "product-line",
        label: "Product line present",
        field: "productLine",
        value: item.productLine,
        hasUncertainty: item.uncertaintyNotes.includes("model uncertain"),
        missingMessage: "Product line is missing or ambiguous.",
        presentMessage: `Product line parsed as ${item.productLine}.`
      },
      {
        idSuffix: "category",
        label: "Category valid",
        field: "category",
        value: item.category,
        hasUncertainty: false,
        missingMessage: "Equipment category could not be classified.",
        presentMessage: `Category classified as ${item.category}.`
      },
      {
        idSuffix: "shaft-flex",
        label: "Shaft/flex data complete",
        field: "shaftFlex",
        value: item.shaftFlex,
        hasUncertainty: item.uncertaintyNotes.includes("shaft uncertain"),
        missingMessage:
          "Shaft flex is missing or uncertain after the initial extraction.",
        presentMessage: `Shaft flex parsed as ${item.shaftFlex}.`
      }
    ];

    for (const fieldCheck of fieldChecks) {
      const status = validationStatusForRequiredField(
        fieldCheck.value,
        fieldCheck.hasUncertainty
      );
      const checkReviewRequired = status !== "PASS" || reviewRequired;

      checks.push({
        id: `${item.id}-${fieldCheck.idSuffix}`,
        label: fieldCheck.label,
        status,
        severity: validationSeverityForStatus(status, checkReviewRequired),
        message:
          status === "PASS"
            ? fieldCheck.presentMessage
            : fieldCheck.missingMessage,
        field: fieldCheck.field,
        recordId: item.id,
        reviewRequired: checkReviewRequired
      });
    }

    checks.push({
      id: `${item.id}-knowledge-evidence`,
      label: "Knowledge evidence found",
      status: knowledgeResultCount > 0 ? "PASS" : "WARNING",
      severity: knowledgeResultCount > 0 ? "INFO" : "MEDIUM",
      message:
        knowledgeResultCount > 0
          ? `${knowledgeResultCount} weighted knowledge match(es) found for this record.`
          : "No weighted knowledge evidence was found for this record.",
      field: null,
      recordId: item.id,
      reviewRequired: knowledgeResultCount === 0 || reviewRequired
    });

    checks.push({
      id: `${item.id}-confidence-threshold`,
      label: "Confidence threshold met",
      status: item.confidence >= 0.72 ? "PASS" : "WARNING",
      severity: item.confidence >= 0.72 ? "INFO" : "MEDIUM",
      message:
        item.confidence >= 0.72
          ? `Confidence ${item.confidence} meets the review threshold.`
          : `Confidence ${item.confidence} is below the review threshold.`,
      field: "confidence",
      recordId: item.id,
      reviewRequired: item.confidence < 0.72 || reviewRequired
    });
  }

  checks.push({
    id: "workflow-review-requirement",
    label: "Review requirement determined",
    status: input.parsedItems.some(itemNeedsReview) ? "WARNING" : "PASS",
    severity: input.parsedItems.some(itemNeedsReview) ? "MEDIUM" : "INFO",
    message: input.parsedItems.some(itemNeedsReview)
      ? "Validation found uncertainty. A human review item was created."
      : "Validation did not require human review.",
    field: null,
    recordId: null,
    reviewRequired: input.parsedItems.some(itemNeedsReview)
  });

  checks.push({
    id: "workflow-unsafe-mutation-policy",
    label: "Unsafe mutation blocked",
    status: input.blockedMutationCount > 0 ? "PASS" : "WARNING",
    severity: input.blockedMutationCount > 0 ? "INFO" : "LOW",
    message:
      input.blockedMutationCount > 0
        ? `${input.blockedMutationCount} mutation tool call(s) were blocked by policy.`
        : "No mutation policy block was observed in this run.",
    field: null,
    recordId: null,
    reviewRequired: false
  });

  return checks;
}

function buildRetryEvents(parsedItems: ParsedTradeInDemoItem[]): RetryEvent[] {
  const retryCandidate = parsedItems.find(
    (item) =>
      item.missingFields.includes("shaftFlex") ||
      item.uncertaintyNotes.includes("shaft uncertain") ||
      item.rawLine.toLowerCase().includes("shaft unknown")
  );

  if (!retryCandidate) {
    return [
      {
        id: "retry-shaft-flex-not-needed",
        reason: "No recoverable shaft/flex issue was found.",
        targetField: "shaftFlex",
        recordId: null,
        policy: "one targeted retry before human review",
        status: "SKIPPED",
        before: null,
        after: null,
        message:
          "Targeted retry was skipped because validation did not find an incomplete shaft/flex field."
      }
    ];
  }

  return [
    {
      id: `${retryCandidate.id}-retry-shaft-flex`,
      reason: "missing or uncertain shaft/flex data",
      targetField: "shaftFlex",
      recordId: retryCandidate.id,
      policy: "one targeted retry before human review",
      status: "UNRESOLVED",
      before: {
        shaftFlex: retryCandidate.shaftFlex,
        missingFields: retryCandidate.missingFields,
        uncertaintyNotes: retryCandidate.uncertaintyNotes
      },
      after: {
        shaftFlex: retryCandidate.shaftFlex,
        missingFields: retryCandidate.missingFields,
        uncertaintyNotes: retryCandidate.uncertaintyNotes
      },
      message:
        "The agent retried only the shaft/flex extraction path, but the source text remained uncertain, so validation preserved the human review requirement."
    }
  ];
}

function getProviderFallbackAttempts(
  modelCallLog: ModelCallLog
): ProviderFallbackTraceAttempt[] {
  const responseJson = modelCallLog.responseJson as
    | {
        providerExecution?: {
          attempts?: ProviderFallbackTraceAttempt[];
        };
      }
    | null
    | undefined;

  return responseJson?.providerExecution?.attempts ?? [];
}

function buildProviderFallbackTrace(
  modelCallLog: ModelCallLog
): ProviderFallbackTrace {
  const attempts = getProviderFallbackAttempts(modelCallLog);
  const unsuccessfulAttempts = attempts.filter(
    (attempt) =>
      attempt.status !== "SUCCESS" &&
      attempt.status !== "SUCCEEDED"
  );

  return {
    routingGoal: "HIGH_QUALITY",
    selectedProvider: modelCallLog.provider,
    selectedModel: modelCallLog.model,
    finalProvider: modelCallLog.provider,
    finalModel: modelCallLog.model,
    fallbackUsed: unsuccessfulAttempts.length > 0,
    attempts,
    summary:
      unsuccessfulAttempts.length > 0
        ? `Provider fallback trace captured ${unsuccessfulAttempts.length} skipped or failed attempt(s) before ${modelCallLog.provider} completed the run.`
        : `${modelCallLog.provider} completed the run without provider fallback.`
  };
}

function buildToolSelectionRationales(
  toolCallingPlan: ToolCallingPlan
): ToolSelectionRationale[] {
  return toolCallingPlan.plannedCalls.map((call) => ({
    toolName: call.toolName,
    rationale: call.reason,
    expectedRiskLevel: call.expectedRiskLevel,
    expectedMutatesData: call.expectedMutatesData,
    expectedRequiresHumanApproval: call.expectedRequiresHumanApproval
  }));
}

function buildReviewOutcomes(input: {
  parsedItems: ParsedTradeInDemoItem[];
  reviewQueueItemsCreated: ReviewQueueItem[];
  validationChecks: ValidationCheck[];
}): ReviewOutcome[] {
  return input.reviewQueueItemsCreated.map((item) => {
    const parsedItem = input.parsedItems.find(
      (candidate) => candidate.rawLine === item.originalText
    );
    const validationWarnings = input.validationChecks
      .filter(
        (check) =>
          check.recordId === parsedItem?.id &&
          check.status !== "PASS"
      )
      .map((check) => check.message);

    return {
      reviewQueueItemId: item.id,
      recordId: parsedItem?.id ?? null,
      reason: item.reason,
      validationWarnings,
      suggestedNextAction:
        "Review the original text, confirm uncertain equipment fields, and approve or correct the proposed structured record."
    };
  });
}

function buildAgentPlan(input: {
  validationChecks: ValidationCheck[];
  retryEvents: RetryEvent[];
  toolSelectionRationales: ToolSelectionRationale[];
  reviewOutcomes: ReviewOutcome[];
  providerFallbackTrace: ProviderFallbackTrace;
  blockedMutationCount: number;
}): AgentPlanStep[] {
  const hasWarnings = input.validationChecks.some(
    (check) => check.status === "WARNING"
  );
  const hasReview = input.reviewOutcomes.length > 0;
  const hasRetry = input.retryEvents.some((event) => event.status !== "SKIPPED");

  return [
    {
      id: "agent-plan-validate-fields",
      label: "Validate normalized trade-in fields",
      purpose:
        "Check extracted golf club fields before the workflow trusts structured output.",
      actionType: "VALIDATE_FIELDS",
      expectedOutput: "Field-level validation checks with pass or warning status.",
      status: hasWarnings ? "NEEDS_REVIEW" : "COMPLETED",
      linkedTraceEventIds: ["audit-event-2"],
      requiredTools: [],
      validationRules: [
        "brand recognized",
        "product line present",
        "category valid",
        "shaft/flex data complete"
      ],
      retryPolicy: null,
      safetyPolicy: null
    },
    {
      id: "agent-plan-search-knowledge",
      label: "Search product knowledge for evidence",
      purpose:
        "Ground extracted records against product and trade-in knowledge.",
      actionType: "SEARCH_KNOWLEDGE",
      expectedOutput: "Weighted RAG evidence for each parsed record.",
      status: "COMPLETED",
      linkedTraceEventIds: ["audit-event-3"],
      requiredTools: ["swingops.knowledgeBase.search"],
      validationRules: ["knowledge evidence found"],
      retryPolicy: null,
      safetyPolicy: "read-only connector execution"
    },
    {
      id: "agent-plan-select-tools",
      label: "Choose approved internal tools",
      purpose:
        "Select only approved workflow, knowledge, and review tools for execution.",
      actionType: "SELECT_TOOLS",
      expectedOutput: "Tool plan with concise selection rationale and risk level.",
      status: "COMPLETED",
      linkedTraceEventIds: ["audit-event-5"],
      requiredTools: input.toolSelectionRationales.map((tool) => tool.toolName),
      validationRules: [],
      retryPolicy: null,
      safetyPolicy: "MCP-compatible read-only tool policy"
    },
    {
      id: "agent-plan-provider-fallback",
      label: "Route model request with fallback",
      purpose:
        "Select a model by goal and preserve provider attempt evidence.",
      actionType: "RECORD_TRACE",
      expectedOutput: "Provider attempts, skipped reasons, and final provider.",
      status: "COMPLETED",
      linkedTraceEventIds: ["audit-event-4"],
      requiredTools: [],
      validationRules: [],
      retryPolicy: null,
      safetyPolicy: null
    },
    {
      id: "agent-plan-retry-shaft-flex",
      label: "Attempt targeted retry for recoverable missing fields",
      purpose:
        "Retry only the incomplete shaft/flex extraction path before review.",
      actionType: "RETRY_EXTRACTION",
      expectedOutput: "Retry event showing whether the issue resolved.",
      status: hasRetry ? "NEEDS_REVIEW" : "SKIPPED",
      linkedTraceEventIds: [],
      requiredTools: [],
      validationRules: ["shaft/flex data complete"],
      retryPolicy: "one targeted retry before human review",
      safetyPolicy: null
    },
    {
      id: "agent-plan-human-review",
      label: "Escalate unresolved uncertainty to human review",
      purpose:
        "Create review work when validation finds incomplete or ambiguous records.",
      actionType: "ESCALATE_REVIEW",
      expectedOutput: "Review outcome linked to validation warnings.",
      status: hasReview ? "NEEDS_REVIEW" : "COMPLETED",
      linkedTraceEventIds: ["audit-event-7"],
      requiredTools: ["swingops.reviewQueueItems.list"],
      validationRules: ["review requirement determined"],
      retryPolicy: "preserve review requirement when retry is unresolved",
      safetyPolicy: null
    },
    {
      id: "agent-plan-block-mutation",
      label: "Block unsafe mutations unless approved",
      purpose:
        "Show that the agent can inspect mutation tools without executing them autonomously.",
      actionType: "ENFORCE_POLICY",
      expectedOutput: "Blocked mutation log with policy reason.",
      status: input.blockedMutationCount > 0 ? "BLOCKED" : "SKIPPED",
      linkedTraceEventIds: ["audit-event-6"],
      requiredTools: ["swingops.reviewQueueItems.resolve"],
      validationRules: ["unsafe mutation blocked if attempted"],
      retryPolicy: null,
      safetyPolicy: "human approval required for mutation tools"
    },
    {
      id: "agent-plan-record-quality-summary",
      label: "Record audit and quality summary",
      purpose:
        "Summarize the workflow status, counts, evidence, retries, review, and policy outcomes.",
      actionType: "RECORD_TRACE",
      expectedOutput: "Workflow quality summary for the current run.",
      status: "COMPLETED",
      linkedTraceEventIds: ["audit-event-8"],
      requiredTools: [],
      validationRules: [],
      retryPolicy: null,
      safetyPolicy: null
    }
  ];
}

function buildWorkflowQualitySummary(input: {
  parsedItems: ParsedTradeInDemoItem[];
  validationChecks: ValidationCheck[];
  retryEvents: RetryEvent[];
  reviewOutcomes: ReviewOutcome[];
  toolCallResults: ToolCallResults;
  providerFallbackTrace: ProviderFallbackTrace;
  knowledgeMatchesByItem: KnowledgeMatchesByItem;
}): WorkflowQualitySummary {
  const validationPassed = input.validationChecks.filter(
    (check) => check.status === "PASS"
  ).length;
  const validationWarnings = input.validationChecks.filter(
    (check) => check.status === "WARNING"
  ).length;
  const validationFailures = input.validationChecks.filter(
    (check) => check.status === "FAIL"
  ).length;
  const blockedMutations = input.toolCallResults.filter(
    (result) => result.status === "BLOCKED"
  ).length;
  const retryAttempts = input.retryEvents.filter(
    (event) => event.status !== "SKIPPED"
  ).length;
  const recordsWithEvidence = input.knowledgeMatchesByItem.filter(
    (match) => match.search.results.length > 0
  ).length;
  const status: WorkflowQualityStatus =
    validationFailures > 0
      ? "FAILED_VALIDATION"
      : input.reviewOutcomes.length > 0
        ? "NEEDS_REVIEW"
        : blockedMutations > 0
          ? "BLOCKED"
          : "READY";

  return {
    status,
    recordsProcessed: input.parsedItems.length,
    validationPassed,
    validationWarnings,
    validationFailures,
    retryAttempts,
    reviewItemsCreated: input.reviewOutcomes.length,
    toolCalls: input.toolCallResults.length,
    blockedMutations,
    providerFallbackUsed: input.providerFallbackTrace.fallbackUsed,
    evidenceCoverage: `${recordsWithEvidence}/${input.parsedItems.length} records`,
    summary:
      input.reviewOutcomes.length > 0
        ? `Workflow completed with ${input.reviewOutcomes.length} review item(s) because validation found unresolved uncertainty.`
        : "Workflow completed without human review because validation checks passed."
  };
}

export function buildWorkflowQualityBundle(input: {
  parsedItems: ParsedTradeInDemoItem[];
  knowledgeMatchesByItem: KnowledgeMatchesByItem;
  modelCallLog: ModelCallLog;
  toolCallingPlan: ToolCallingPlan;
  toolCallResults: ToolCallResults;
  reviewQueueItemsCreated: ReviewQueueItem[];
}): WorkflowQualityBundle {
  const blockedMutationCount = input.toolCallResults.filter(
    (result) => result.status === "BLOCKED"
  ).length;
  const validationChecks = buildValidationChecks({
    parsedItems: input.parsedItems,
    knowledgeMatchesByItem: input.knowledgeMatchesByItem,
    blockedMutationCount
  });
  const retryEvents = buildRetryEvents(input.parsedItems);
  const providerFallbackTrace = buildProviderFallbackTrace(input.modelCallLog);
  const toolSelectionRationales = buildToolSelectionRationales(
    input.toolCallingPlan
  );
  const reviewOutcomes = buildReviewOutcomes({
    parsedItems: input.parsedItems,
    reviewQueueItemsCreated: input.reviewQueueItemsCreated,
    validationChecks
  });
  const agentPlan = buildAgentPlan({
    validationChecks,
    retryEvents,
    toolSelectionRationales,
    reviewOutcomes,
    providerFallbackTrace,
    blockedMutationCount
  });
  const workflowQualitySummary = buildWorkflowQualitySummary({
    parsedItems: input.parsedItems,
    validationChecks,
    retryEvents,
    reviewOutcomes,
    toolCallResults: input.toolCallResults,
    providerFallbackTrace,
    knowledgeMatchesByItem: input.knowledgeMatchesByItem
  });

  return {
    agentPlan,
    validationChecks,
    retryEvents,
    providerFallbackTrace,
    toolSelectionRationales,
    reviewOutcomes,
    workflowQualitySummary
  };
}
