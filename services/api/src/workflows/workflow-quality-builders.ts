import { isShaftFlexApplicable } from "./golf-field-applicability.js";
import type { ReviewQueueItem } from "@prisma/client";

import type { ParsedTradeInDemoItem } from "./trade-in-demo-parser.js";
import type { EndToEndAgenticTradeInDemoResult } from "./end-to-end-agentic-trade-in-demo.js";
import type {
  AgentPlanStep,
  ProviderFallbackTrace,
  ProviderFallbackTraceAttempt,
  RetryEvent,
  ToolSelectionRationale,
  ReviewOutcome,
  ValidationCheck,
  ValidationCheckSeverity,
  ValidationCheckStatus,
  WorkflowQualityStatus,
  WorkflowQualitySummary
} from "./workflow-quality-types.js";

type ToolCallingPlan = EndToEndAgenticTradeInDemoResult["toolCallingPlan"];
type ToolCallResults = EndToEndAgenticTradeInDemoResult["toolCallResults"];
type KnowledgeMatchesByItem =
  EndToEndAgenticTradeInDemoResult["knowledgeMatchesByItem"];
type InventoryMatchesByItem =
  EndToEndAgenticTradeInDemoResult["inventoryMatchesByItem"];
type ValuationEvidenceByItem =
  EndToEndAgenticTradeInDemoResult["valuationEvidenceByItem"];
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

export function buildValidationChecks(input: {
  parsedItems: ParsedTradeInDemoItem[];
  knowledgeMatchesByItem: KnowledgeMatchesByItem;
  inventoryMatchesByItem: InventoryMatchesByItem;
  valuationEvidenceByItem: ValuationEvidenceByItem;
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
      notApplicable?: boolean;
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
        presentMessage: isShaftFlexApplicable(item.category)
          ? `Shaft flex parsed as ${item.shaftFlex}.`
          : "Shaft flex is not applicable to putters.",
        notApplicable: !isShaftFlexApplicable(item.category)
      }
    ];

    for (const fieldCheck of fieldChecks) {
      const status = fieldCheck.notApplicable
        ? "PASS"
        : validationStatusForRequiredField(
            fieldCheck.value,
            fieldCheck.hasUncertainty
          );
      const checkReviewRequired = fieldCheck.notApplicable
        ? false
        : status !== "PASS" || reviewRequired;

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

    const inventoryMatch = input.inventoryMatchesByItem.find(
      (match) => match.parsedItemId === item.id
    );
    const valuationEvidence = input.valuationEvidenceByItem.find(
      (evidence) => evidence.parsedItemId === item.id
    );

    checks.push({
      id: `${item.id}-inventory-product-match`,
      label: "Inventory product match",
      status: inventoryMatch?.lookup.productId ? "PASS" : "WARNING",
      severity: inventoryMatch?.lookup.productId ? "INFO" : "MEDIUM",
      message: inventoryMatch?.lookup.productId
        ? `Matched internal SKU ${inventoryMatch.lookup.sku} with confidence ${inventoryMatch.lookup.confidence}.`
        : "No internal inventory product cleared the match threshold.",
      field: "inventoryMatch",
      recordId: item.id,
      reviewRequired: !inventoryMatch?.lookup.productId
    });

    checks.push({
      id: `${item.id}-demo-valuation-range`,
      label: "Demo valuation range generated",
      status:
        valuationEvidence && valuationEvidence.estimate.highValue > 0
          ? valuationEvidence.estimate.reviewRequired
            ? "WARNING"
            : "PASS"
          : "WARNING",
      severity:
        valuationEvidence?.estimate.reviewRequired ? "MEDIUM" : "INFO",
      message:
        valuationEvidence && valuationEvidence.estimate.highValue > 0
          ? `Demo trade-in range ${valuationEvidence.estimate.lowValue}-${valuationEvidence.estimate.highValue} generated with ${valuationEvidence.estimate.confidence} confidence.`
          : "No demo valuation range was generated.",
      field: "demoValuationRange",
      recordId: item.id,
      reviewRequired: valuationEvidence?.estimate.reviewRequired ?? true
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

  const recordsWithKnowledgeEvidence = input.knowledgeMatchesByItem.filter(
    (match) => match.search.results.length > 0
  ).length;
  const recordsWithInventoryMatches = input.inventoryMatchesByItem.filter(
    (match) => match.lookup.productId !== null
  ).length;
  const recordsWithValuationRanges = input.valuationEvidenceByItem.filter(
    (evidence) => evidence.estimate.highValue > 0
  ).length;
  const evidenceCoverageMessage =
    `${recordsWithKnowledgeEvidence}/${input.parsedItems.length} records had weighted knowledge evidence; ${recordsWithInventoryMatches}/${input.parsedItems.length} had inventory matches; ${recordsWithValuationRanges}/${input.parsedItems.length} had demo valuation ranges.`;

  checks.push({
    id: "workflow-knowledge-evidence-coverage",
    label: "Knowledge evidence coverage",
    status:
      recordsWithKnowledgeEvidence === input.parsedItems.length &&
      recordsWithInventoryMatches === input.parsedItems.length &&
      recordsWithValuationRanges === input.parsedItems.length
        ? "PASS"
        : "WARNING",
    severity:
      recordsWithKnowledgeEvidence === input.parsedItems.length &&
      recordsWithInventoryMatches === input.parsedItems.length &&
      recordsWithValuationRanges === input.parsedItems.length
        ? "INFO"
        : "MEDIUM",
    message: evidenceCoverageMessage,
    field: null,
    recordId: null,
    reviewRequired: recordsWithKnowledgeEvidence === 0
  });

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

export function buildRetryEvents(parsedItems: ParsedTradeInDemoItem[]): RetryEvent[] {
  const retryCandidate = parsedItems.find(
    (item) =>
      isShaftFlexApplicable(item.category) &&
      (
        item.missingFields.includes("shaftFlex") ||
        item.uncertaintyNotes.includes("shaft uncertain") ||
        item.rawLine.toLowerCase().includes("shaft unknown")
      )
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

export function buildProviderFallbackTrace(
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

export function buildToolSelectionRationales(
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

export function buildReviewOutcomes(input: {
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

export function buildAgentPlan(input: {
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
      id: "agent-plan-match-inventory",
      label: "Match parsed records to inventory products",
      purpose:
        "Use internal inventory evidence to connect messy trade-in records to product and SKU candidates.",
      actionType: "MATCH_INVENTORY",
      expectedOutput: "Inventory product match, SKU, confidence, and similar candidates.",
      status: "COMPLETED",
      linkedTraceEventIds: ["audit-event-4"],
      requiredTools: ["swingops.inventory.lookupProduct"],
      validationRules: ["inventory product match"],
      retryPolicy: null,
      safetyPolicy: "read-only inventory lookup"
    },
    {
      id: "agent-plan-estimate-value",
      label: "Estimate demo trade-in range",
      purpose:
        "Use seeded valuation evidence to generate a demo trade-in range with condition and accessory adjustments.",
      actionType: "ESTIMATE_VALUE",
      expectedOutput: "Demo valuation range, confidence, adjustments, and review reasons.",
      status: hasWarnings ? "NEEDS_REVIEW" : "COMPLETED",
      linkedTraceEventIds: ["audit-event-5"],
      requiredTools: ["swingops.tradeInValuation.estimate"],
      validationRules: ["demo valuation range generated"],
      retryPolicy: null,
      safetyPolicy: "read-only valuation lookup"
    },
    {
      id: "agent-plan-select-tools",
      label: "Choose approved internal tools",
      purpose:
        "Select only approved workflow, knowledge, and review tools for execution.",
      actionType: "SELECT_TOOLS",
      expectedOutput: "Tool plan with concise selection rationale and risk level.",
      status: "COMPLETED",
      linkedTraceEventIds: ["audit-event-7"],
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
      linkedTraceEventIds: ["audit-event-6"],
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
      linkedTraceEventIds: ["audit-event-9"],
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
      linkedTraceEventIds: ["audit-event-8"],
      requiredTools: ["swingops.inventory.createSku"],
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
      linkedTraceEventIds: ["audit-event-11"],
      requiredTools: [],
      validationRules: [],
      retryPolicy: null,
      safetyPolicy: null
    }
  ];
}

export function buildWorkflowQualitySummary(input: {
  parsedItems: ParsedTradeInDemoItem[];
  validationChecks: ValidationCheck[];
  retryEvents: RetryEvent[];
  reviewOutcomes: ReviewOutcome[];
  toolCallResults: ToolCallResults;
  providerFallbackTrace: ProviderFallbackTrace;
  knowledgeMatchesByItem: KnowledgeMatchesByItem;
  inventoryMatchesByItem: InventoryMatchesByItem;
  valuationEvidenceByItem: ValuationEvidenceByItem;
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
  const inventoryMatches = input.inventoryMatchesByItem.filter(
    (match) => match.lookup.productId !== null
  ).length;
  const valuationRangesGenerated = input.valuationEvidenceByItem.filter(
    (evidence) => evidence.estimate.highValue > 0
  ).length;
  const valuationReviewRequired = input.valuationEvidenceByItem.filter(
    (evidence) => evidence.estimate.reviewRequired
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
    inventoryMatches,
    valuationRangesGenerated,
    valuationReviewRequired,
    providerFallbackUsed: input.providerFallbackTrace.fallbackUsed,
    evidenceCoverage: `${recordsWithEvidence}/${input.parsedItems.length} records`,
    summary:
      input.reviewOutcomes.length > 0
        ? `Workflow completed with ${input.reviewOutcomes.length} review item(s) because validation found unresolved uncertainty.`
        : "Workflow completed without human review because validation checks passed."
  };
}
