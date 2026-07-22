import type { ModelCallLog } from "@prisma/client";

import type { ModelRouteDecision } from "../ai/model-router.js";
import type {
  ModelProviderFetch,
  ModelProviderRuntimeConfig,
} from "../ai/model-provider-runtime-config.js";
import {
  buildDeterministicPolicyFieldRepairAdvisoryCandidates,
  buildPriorReviewFieldRepairAdvisoryCandidates,
  mergeFieldRepairAdvisoryCandidates,
} from "./field-repair-advisory-candidates.js";
import { isShaftFlexApplicable } from "./golf-field-applicability.js";
import {
  MAIN_RUN_FIELD_REPAIR_AGENT_NAME,
  MAIN_RUN_FIELD_REPAIR_MAX_RECORDS,
  MAIN_RUN_FIELD_REPAIR_OUTPUT_SCHEMA,
  MAIN_RUN_FIELD_REPAIR_POLICY_KEY,
  MAIN_RUN_FIELD_REPAIR_PROVIDER_ATTEMPT_TIMEOUT_MS,
  MAIN_RUN_FIELD_REPAIR_PROVIDER_WORKFLOW_TIMEOUT_MS,
  MAIN_RUN_FIELD_REPAIR_TASK_TYPE,
  buildMainRunFieldRepairExecutionInput,
  validateMainRunFieldRepairModelOutput,
  type MainRunFieldRepairRecordInput,
} from "./main-run-field-repair.js";
import type { ParsedTradeInDemoItem } from "./trade-in-demo-parser.js";
import type { TradeInDemoEvidenceBundle } from "./trade-in-demo-evidence.js";
import { createModelExecutionLogForWorkflowRun } from "./workflow-model-logging.js";

export type TradeInDemoModelAssistanceScope = {
  eligibleRecordCount: number;
  selectedRecordCount: number;
  deferredRecordCount: number;
  maxSelectedRecordCount: number;
};

export type TradeInDemoModelAssistanceSelection = {
  selectedFieldRepairItems: ParsedTradeInDemoItem[];
  modelAssistanceScope: TradeInDemoModelAssistanceScope;
};

export type TradeInDemoModelAssistanceResult = {
  fieldRepairRecords: MainRunFieldRepairRecordInput[];
  modelCallLog: ModelCallLog;
  modelRoutingDecision: ModelRouteDecision;
};

function buildProviderFallbackDemonstrationOptions(enabled: boolean): {
  runtimeConfig?: ModelProviderRuntimeConfig;
  fetchFn?: ModelProviderFetch;
} {
  if (!enabled) {
    return {};
  }

  return {
    runtimeConfig: {
      enableRealModelCalls: true,
      openAiApiKey: "provider-fallback-demonstration",
    },
    fetchFn: async () => ({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      async json() {
        return {
          error: "Deterministic provider availability demonstration.",
        };
      },
    }),
  };
}

export function getTradeInDemoFieldRepairMissingFields(
  item: ParsedTradeInDemoItem,
): string[] {
  return [
    item.brand ? null : "brand",
    item.productLine ? null : "productLine",
    item.category ? null : "category",
    isShaftFlexApplicable(item.category) && !item.shaftFlex
      ? "shaftFlex"
      : null,
    item.conditionGrade ? null : "conditionGrade",
    item.tradeInValue === null ? "tradeInValue" : null,
  ].filter((field): field is string => Boolean(field));
}

export function shouldRunTradeInDemoFieldRepair(
  item: ParsedTradeInDemoItem,
): boolean {
  const missingFields = getTradeInDemoFieldRepairMissingFields(item);

  return (
    item.confidence < 0.72 ||
    missingFields.length > 0 ||
    item.uncertaintyNotes.length > 0
  );
}

export function selectTradeInDemoModelAssistanceItems(
  parsedItems: ParsedTradeInDemoItem[],
): TradeInDemoModelAssistanceSelection {
  const eligibleFieldRepairItems = parsedItems.filter(
    shouldRunTradeInDemoFieldRepair,
  );
  const selectedFieldRepairItems = eligibleFieldRepairItems.slice(
    0,
    MAIN_RUN_FIELD_REPAIR_MAX_RECORDS,
  );

  return {
    selectedFieldRepairItems,
    modelAssistanceScope: {
      eligibleRecordCount: eligibleFieldRepairItems.length,
      selectedRecordCount: selectedFieldRepairItems.length,
      deferredRecordCount:
        eligibleFieldRepairItems.length - selectedFieldRepairItems.length,
      maxSelectedRecordCount: MAIN_RUN_FIELD_REPAIR_MAX_RECORDS,
    },
  };
}

function getModelRoutingDecisionFromLog(
  modelCallLog: ModelCallLog,
): ModelRouteDecision {
  const responseJson = modelCallLog.responseJson as
    | {
        routingDecision?: ModelRouteDecision;
      }
    | null
    | undefined;

  if (!responseJson?.routingDecision) {
    throw new Error("Model call log is missing routing decision metadata.");
  }

  return responseJson.routingDecision;
}

export function getTradeInDemoProviderExecutionOutputJson(
  modelCallLog: ModelCallLog,
): Record<string, unknown> | null {
  const responseJson = modelCallLog.responseJson as
    | {
        providerExecution?: {
          outputJson?: Record<string, unknown> | null;
        };
      }
    | null
    | undefined;

  return responseJson?.providerExecution?.outputJson ?? null;
}

function buildFieldRepairRecords(
  selectedItems: ParsedTradeInDemoItem[],
  evidence: TradeInDemoEvidenceBundle,
): MainRunFieldRepairRecordInput[] {
  return selectedItems.map((item) => {
    const knowledgeEvidence = evidence.knowledgeMatchesByItem.find(
      (candidate) => candidate.parsedItemId === item.id,
    );
    const inventoryEvidence = evidence.inventoryMatchesByItem.find(
      (candidate) => candidate.parsedItemId === item.id,
    );
    const valuationEvidence = evidence.valuationEvidenceByItem.find(
      (candidate) => candidate.parsedItemId === item.id,
    );
    const priorReviewEvidence = evidence.priorReviewLearningEvidenceByItem.find(
      (candidate) => candidate.parsedItemId === item.id,
    );
    const priorReviewSuggestions =
      evidence.priorReviewLearningSuggestionsByItem.find(
        (candidate) => candidate.parsedItemId === item.id,
      );
    const missingFields = getTradeInDemoFieldRepairMissingFields(item);
    const fieldApplicability = {
      shaftFlex: isShaftFlexApplicable(item.category)
        ? ("REQUIRED" as const)
        : ("NOT_APPLICABLE" as const),
    };
    const deterministicPolicyAdvisoryCandidates =
      buildDeterministicPolicyFieldRepairAdvisoryCandidates({
        recordId: item.id,
        sourceText: item.rawLine,
        missingFields,
        fieldApplicability,
        productResolutionStatus: item.productResolution.status,
        sourceEvidenceId: `${item.id}:deterministic-policy`,
      });
    const priorReviewAdvisoryCandidates =
      buildPriorReviewFieldRepairAdvisoryCandidates({
        recordId: item.id,
        sourceText: item.rawLine,
        missingFields,
        fieldApplicability,
        productResolutionStatus: item.productResolution.status,
        sourceEvidenceId: `${item.id}:prior-review`,
        priorReviewSuggestions: priorReviewSuggestions?.suggestions ?? [],
      });
    const advisoryCandidates = mergeFieldRepairAdvisoryCandidates(
      deterministicPolicyAdvisoryCandidates,
      priorReviewAdvisoryCandidates,
    );
    const reviewReasonCodes = [
      item.confidence < 0.72 ? "LOW_CONFIDENCE" : null,
      missingFields.length > 0 ? "MISSING_REQUIRED_FIELDS" : null,
      item.uncertaintyNotes.length > 0 ? "UNCERTAINTY_NOTES" : null,
      item.productResolution.status === "AMBIGUOUS"
        ? "PRODUCT_AMBIGUOUS"
        : null,
      item.productResolution.status === "UNRESOLVED"
        ? "PRODUCT_UNRESOLVED"
        : null,
      valuationEvidence?.estimate.reviewRequired
        ? "VALUATION_REVIEW_REQUIRED"
        : null,
    ].filter((reasonCode): reasonCode is string => Boolean(reasonCode));
    const recordEvidence: MainRunFieldRepairRecordInput["evidence"] = [
      {
        evidenceId: `${item.id}:parser`,
        evidenceType: "PARSER",
        summary: `Parser evidence captured for ${Object.keys(item.parserEvidence ?? {}).length} field(s).`,
        payload: item.parserEvidence ?? null,
      },
      {
        evidenceId: `${item.id}:product-resolution`,
        evidenceType: "PRODUCT_RESOLUTION",
        summary: `${item.productResolution.status}: ${item.productResolution.reason}`,
        payload: item.productResolution,
      },
      {
        evidenceId: `${item.id}:knowledge`,
        evidenceType: "KNOWLEDGE",
        summary: `${knowledgeEvidence?.search.results.length ?? 0} weighted knowledge result(s) were available.`,
        payload: knowledgeEvidence?.search ?? null,
      },
      {
        evidenceId: `${item.id}:inventory`,
        evidenceType: "INVENTORY",
        summary: inventoryEvidence?.lookup.productId
          ? `Inventory matched product ${inventoryEvidence.lookup.productId}.`
          : "Inventory did not return an authoritative product identity.",
        payload: inventoryEvidence?.lookup ?? null,
      },
      {
        evidenceId: `${item.id}:valuation`,
        evidenceType: "VALUATION",
        summary:
          valuationEvidence && valuationEvidence.estimate.highValue > 0
            ? `Valuation range ${valuationEvidence.estimate.lowValue}-${valuationEvidence.estimate.highValue} was available.`
            : "No authoritative valuation range was available.",
        payload: valuationEvidence?.estimate ?? null,
      },
      {
        evidenceId: `${item.id}:deterministic-policy`,
        evidenceType: "DETERMINISTIC_POLICY",
        summary: `${deterministicPolicyAdvisoryCandidates.length} deterministic policy candidate(s) were available.`,
        payload: deterministicPolicyAdvisoryCandidates,
      },
      {
        evidenceId: `${item.id}:prior-review`,
        evidenceType: "PRIOR_REVIEW",
        summary: `${priorReviewEvidence?.evidence.length ?? 0} prior-review evidence item(s) were available.`,
        payload: priorReviewEvidence?.evidence ?? [],
      },
    ];

    return {
      recordId: item.id,
      sourceText: item.rawLine,
      missingFields,
      confidence: item.confidence,
      selectionReason: {
        lowConfidence: item.confidence < 0.72,
        confidence: item.confidence,
        missingFields,
        uncertaintyNotes: item.uncertaintyNotes,
        reviewReasonCodes,
      },
      currentFields: {
        brand: item.brand,
        productLine: item.productLine,
        category: item.category,
        shaftFlex: item.shaftFlex,
        conditionGrade: item.conditionGrade,
        tradeInValue: item.tradeInValue,
      },
      fieldApplicability,
      parserEvidence: item.parserEvidence ?? null,
      productResolution: {
        status: item.productResolution.status,
        reason: item.productResolution.reason,
        matchedProductId:
          item.productResolution.status === "MATCHED"
            ? item.productResolution.match.productId
            : null,
        matchedSku:
          item.productResolution.status === "MATCHED"
            ? item.productResolution.match.sku
            : null,
        candidateProductIds: item.productResolution.candidates.map(
          (candidate) => candidate.productId,
        ),
      },
      advisoryCandidates,
      evidence: recordEvidence,
    };
  });
}

export async function executeTradeInDemoModelAssistance(input: {
  workflowRunId: string;
  workflowStepId: string;
  selectedItems: ParsedTradeInDemoItem[];
  evidence: TradeInDemoEvidenceBundle;
  demonstrateProviderFallback: boolean;
  signal?: AbortSignal;
}): Promise<TradeInDemoModelAssistanceResult> {
  const fieldRepairRecords = buildFieldRepairRecords(
    input.selectedItems,
    input.evidence,
  );
  const fieldRepairInputJson = buildMainRunFieldRepairExecutionInput({
    workflowRunId: input.workflowRunId,
    records: fieldRepairRecords,
  });
  const providerFallbackDemonstrationOptions =
    buildProviderFallbackDemonstrationOptions(
      input.demonstrateProviderFallback,
    );

  const modelCallLog = await createModelExecutionLogForWorkflowRun({
    workflowRunId: input.workflowRunId,
    workflowStepId: input.workflowStepId,
    taskType: MAIN_RUN_FIELD_REPAIR_TASK_TYPE,
    goal: "HIGH_QUALITY",
    policyKey: MAIN_RUN_FIELD_REPAIR_POLICY_KEY,
    agentName: MAIN_RUN_FIELD_REPAIR_AGENT_NAME,
    workflowName: "main-run",
    workflowStep: "field-repair",
    requireJson: true,
    allowDisabledProvidersForSimulation: false,
    attemptTimeoutMs: MAIN_RUN_FIELD_REPAIR_PROVIDER_ATTEMPT_TIMEOUT_MS,
    workflowTimeoutMs: MAIN_RUN_FIELD_REPAIR_PROVIDER_WORKFLOW_TIMEOUT_MS,
    inputJson: fieldRepairInputJson,
    outputSchema: MAIN_RUN_FIELD_REPAIR_OUTPUT_SCHEMA,
    ...providerFallbackDemonstrationOptions,
    ...(input.signal ? { signal: input.signal } : {}),
    validateOutput(outputJson) {
      const validation = validateMainRunFieldRepairModelOutput(outputJson, {
        records: fieldRepairRecords,
      });

      return {
        jsonValid: validation.jsonValid,
        validationPassed: validation.validationPassed,
        validationErrors: validation.validationErrors,
      };
    },
  });

  return {
    fieldRepairRecords,
    modelCallLog,
    modelRoutingDecision: getModelRoutingDecisionFromLog(modelCallLog),
  };
}

export function buildTradeInDemoModelAssistanceStepOutput(
  result: TradeInDemoModelAssistanceResult,
) {
  return {
    modelCallLogId: result.modelCallLog.id,
    selectedRecordCount: result.fieldRepairRecords.length,
    provider: result.modelCallLog.provider,
    model: result.modelCallLog.model,
    status: result.modelCallLog.status,
  };
}
