import { LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE } from "../intake/legacy-intake-source-types.js";
import type {
  ModelCallLog,
  Prisma,
  ReviewQueueItem,
  ToolCallLog,
} from "@prisma/client";

import type { ModelRouteDecision } from "../ai/model-router.js";
import type {
  ModelProviderFetch,
  ModelProviderRuntimeConfig,
} from "../ai/model-provider-runtime-config.js";
import type { ProductReferenceProvider } from "../product-reference/product-reference-provider.js";
import type { TradeInValuationResult } from "../internal-systems/trade-in-valuation-service.js";
import { prisma } from "../lib/prisma.js";
import {
  executeReadOnlyToolInvocation,
  type ReadOnlyToolInvocationResult,
} from "../tools/read-only-tool-invocation.js";
import {
  buildDeterministicPolicyFieldRepairAdvisoryCandidates,
  buildPriorReviewFieldRepairAdvisoryCandidates,
  mergeFieldRepairAdvisoryCandidates,
} from "./field-repair-advisory-candidates.js";
import { isShaftFlexApplicable } from "./golf-field-applicability.js";
import { createModelExecutionLogForWorkflowRun } from "./workflow-model-logging.js";
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
import { buildWorkflowQualityBundle } from "./workflow-quality.js";
import {
  executePersistedWorkflowStep,
  markPersistedWorkflowStepRetrying,
  requireWorkflowStep,
} from "./workflow-step-persistence.js";
import {
  TRADE_IN_WORKFLOW_STEP_NAMES,
  buildTradeInWorkflowOrchestrationTrace,
} from "./workflow-orchestration-trace.js";
import { failIntakeBatchAfterWorkflowSetupError } from "./workflow-run-failure.js";
import { buildEndToEndAgenticTradeInDemoAuditTrail } from "./end-to-end-agentic-trade-in-demo-audit.js";
import type {
  AgenticTradeInToolCallResult,
  EndToEndAgenticTradeInDemoResult,
} from "./end-to-end-agentic-trade-in-demo.types.js";
import { resolveSupersededIntakeReviewMarkers } from "./review-queue-supersession.js";
import {
  parseTradeInDemoText,
  type ParsedTradeInDemoItem,
} from "./trade-in-demo-parser.js";
import {
  TARGETED_FIELD_RETRY_MAX_ATTEMPTS,
  TARGETED_FIELD_RETRY_POLICY,
  buildSkippedTargetedFieldRetry,
  completeTargetedFieldRetry,
  findTargetedFieldRetryCandidate,
} from "./targeted-field-retry.js";
import {
  TRADE_IN_DEMO_MAX_KNOWLEDGE_RESULTS_PER_ITEM,
  buildTradeInDemoEvidenceStepOutput,
  buildTradeInInventoryLookupInput,
  collectTradeInDemoEvidence,
} from "./trade-in-demo-evidence.js";

export type {
  EndToEndAgenticTradeInDemoAuditEvent,
  EndToEndAgenticTradeInDemoResult,
} from "./end-to-end-agentic-trade-in-demo.types.js";

export const DEFAULT_AGENTIC_TRADE_IN_DEMO_INPUT = [
  "TM stealth2 drv 10.5 Ventus stiff, no hc, sky mark on crown",
  "Titleist TSR maybe TS2 3w 15 deg Tensei s flex, face wear, hc included",
  "Cally Rogue ST Max driver 9 Project X HZRDUS x-stiff, paint wear, no wrench",
  "PING G425 irons 5-PW reg, worn grips, condition unclear",
].join("\n");

export const AGENTIC_TRADE_IN_DEMO_MAX_INPUT_CHARACTERS = 20_000;

const NON_RECORD_DEMO_HEADER_PATTERNS = [
  /^store associate pasted trade-in notes:?$/i,
  /^store associate trade-in notes:?$/i,
  /^pasted trade-in notes:?$/i,
  /^trade-in notes:?$/i,
];

function stripNonRecordDemoHeaderLines(rawInput: string): string {
  const recordLines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !NON_RECORD_DEMO_HEADER_PATTERNS.some((pattern) => pattern.test(line)),
    );

  return recordLines.join("\n") || rawInput.trim();
}

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

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function needsReview(item: ParsedTradeInDemoItem): boolean {
  return item.confidence < 0.72 || item.missingFields.length > 0;
}

function getFieldRepairMissingFields(item: ParsedTradeInDemoItem): string[] {
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

function shouldRunFieldRepair(item: ParsedTradeInDemoItem): boolean {
  const fieldRepairMissingFields = getFieldRepairMissingFields(item);

  return (
    item.confidence < 0.72 ||
    fieldRepairMissingFields.length > 0 ||
    item.uncertaintyNotes.length > 0
  );
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

function getProviderExecutionOutputJson(
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

function valuationNeedsReview(estimate: TradeInValuationResult): boolean {
  return estimate.reviewRequired || estimate.confidence === "LOW";
}

function getReviewReason(
  item: ParsedTradeInDemoItem,
): "LOW_CONFIDENCE" | "MISSING_REQUIRED_FIELDS" | "AMBIGUOUS_INPUT" {
  if (getFieldRepairMissingFields(item).length > 0) {
    return "MISSING_REQUIRED_FIELDS";
  }

  if (item.uncertaintyNotes.length > 0) {
    return "AMBIGUOUS_INPUT";
  }

  return "LOW_CONFIDENCE";
}

function summarizeReviewReason(input: {
  item: ParsedTradeInDemoItem;
  valuationEstimate?: TradeInValuationResult;
}): string {
  const missingFields = getFieldRepairMissingFields(input.item);
  const reasons = [
    input.item.confidence < 0.72 ? `confidence ${input.item.confidence}` : null,
    missingFields.length > 0 ? `missing ${missingFields.join(", ")}` : null,
    input.item.uncertaintyNotes.length > 0
      ? `uncertainty: ${input.item.uncertaintyNotes.join(", ")}`
      : null,
    input.valuationEstimate?.reviewRequired
      ? `valuation review: ${input.valuationEstimate.reviewReasons.join(", ")}`
      : null,
  ].filter(Boolean);

  return reasons.join("; ");
}

function toToolResult(
  result: ReadOnlyToolInvocationResult,
): AgenticTradeInToolCallResult {
  return {
    toolName: result.invocation.toolName,
    status: result.invocation.status,
    policyDecision: result.policyEvaluation.decision,
    policyReason: result.policyEvaluation.reason,
    executionAttempted: result.invocation.executionAttempted,
    toolCallLogId: result.invocation.toolCallLogId,
    outputPreview: result.connectorResult?.data ?? null,
    errorMessage: result.toolCallLog.errorMessage,
  };
}

export async function executeEndToEndAgenticTradeInDemo(input: {
  rawInput: string;
  productReferenceProvider?: ProductReferenceProvider;
  demonstrateProviderFallback?: boolean;
  signal?: AbortSignal;
}): Promise<EndToEndAgenticTradeInDemoResult> {
  if (input.signal?.aborted) {
    throw new Error("Workflow execution was cancelled by the caller.");
  }

  const rawInput = input.rawInput.trim() || DEFAULT_AGENTIC_TRADE_IN_DEMO_INPUT;
  const parseReadyInput = stripNonRecordDemoHeaderLines(rawInput);
  const parseStartedAt = new Date();
  const parsedItems = parseTradeInDemoText(
    parseReadyInput,
    input.productReferenceProvider,
  );

  const intakeBatch = await prisma.intakeBatch.create({
    data: {
      name: "Agentic Trade-In Demo",
      description:
        "End-to-end demo intake batch created from messy golf trade-in text.",
      sourceType: LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE,
      status: "PROCESSING",
      itemCount: parsedItems.length,
      items: {
        create: parsedItems.map((item, index) => ({
          rawText: item.rawLine,
          sourceRowNumber: index + 1,
          status: needsReview(item) ? "NEEDS_REVIEW" : "STRUCTURED",
        })),
      },
    },
    include: {
      items: {
        orderBy: {
          sourceRowNumber: "asc",
        },
      },
    },
  });
  const parseCompletedAt = new Date();

  const workflowRun = await prisma.workflowRun
    .create({
      data: {
        intakeBatchId: intakeBatch.id,
        workflowName: "end-to-end-agentic-trade-in-demo",
        status: "RUNNING",
        startedAt: parseStartedAt,
        steps: {
          create: [
            {
              stepName: TRADE_IN_WORKFLOW_STEP_NAMES.parseInput,
              stepType: "PARSE_INPUT",
              status: "COMPLETED",
              orderIndex: 1,
              inputJson: {
                sourceType: "FREE_TEXT",
                characterCount: parseReadyInput.length,
                nonEmptyLineCount: parseReadyInput
                  .split(/\r?\n/)
                  .filter(Boolean).length,
              },
              outputJson: {
                parsedItemCount: parsedItems.length,
                intakeBatchId: intakeBatch.id,
                intakeItemIds: intakeBatch.items.map((item) => item.id),
              },
              startedAt: parseStartedAt,
              completedAt: parseCompletedAt,
            },
            {
              stepName: TRADE_IN_WORKFLOW_STEP_NAMES.retrieveEvidence,
              stepType: "RETRIEVE_EVIDENCE",
              orderIndex: 2,
            },
            {
              stepName: TRADE_IN_WORKFLOW_STEP_NAMES.modelAssistance,
              stepType: "EXTRACT_GOLF_CLUB_FIELDS",
              orderIndex: 3,
            },
            {
              stepName: TRADE_IN_WORKFLOW_STEP_NAMES.validateOutput,
              stepType: "VALIDATE_STRUCTURED_OUTPUT",
              orderIndex: 4,
            },
            {
              stepName: TRADE_IN_WORKFLOW_STEP_NAMES.targetedRetry,
              stepType: "EXTRACT_GOLF_CLUB_FIELDS",
              orderIndex: 5,
            },
            {
              stepName: TRADE_IN_WORKFLOW_STEP_NAMES.createReviewItems,
              stepType: "CREATE_REVIEW_ITEM",
              orderIndex: 6,
            },
            {
              stepName: TRADE_IN_WORKFLOW_STEP_NAMES.executeTools,
              stepType: "EXECUTE_TOOL_CALLS",
              orderIndex: 7,
            },
            {
              stepName: TRADE_IN_WORKFLOW_STEP_NAMES.finalize,
              stepType: "FINALIZE_WORKFLOW",
              orderIndex: 8,
            },
          ],
        },
      },
      include: {
        steps: {
          orderBy: {
            orderIndex: "asc",
          },
        },
      },
    })
    .catch(async (error) => {
      await failIntakeBatchAfterWorkflowSetupError(intakeBatch.id).catch(
        () => undefined,
      );
      throw error;
    });

  const evidenceResult = await executePersistedWorkflowStep({
    step: requireWorkflowStep(
      workflowRun.steps,
      TRADE_IN_WORKFLOW_STEP_NAMES.retrieveEvidence,
    ),
    inputJson: {
      parsedItemIds: parsedItems.map((item) => item.id),
      maxKnowledgeResultsPerItem: TRADE_IN_DEMO_MAX_KNOWLEDGE_RESULTS_PER_ITEM,
    },
    execute() {
      return collectTradeInDemoEvidence({
        parsedItems,
        workflowRunId: workflowRun.id,
        maxKnowledgeResultsPerItem:
          TRADE_IN_DEMO_MAX_KNOWLEDGE_RESULTS_PER_ITEM,
      });
    },
    buildOutputJson(result) {
      return buildTradeInDemoEvidenceStepOutput(result, parsedItems.length);
    },
  });
  const {
    priorReviewLearningEvidenceByItem,
    priorReviewLearningSuggestionsByItem,
    knowledgeMatchesByItem,
    inventoryMatchesByItem,
    valuationEvidenceByItem,
  } = evidenceResult;

  const eligibleFieldRepairItems = parsedItems.filter(shouldRunFieldRepair);
  const selectedFieldRepairItems = eligibleFieldRepairItems.slice(
    0,
    MAIN_RUN_FIELD_REPAIR_MAX_RECORDS,
  );
  const modelAssistanceScope = {
    eligibleRecordCount: eligibleFieldRepairItems.length,
    selectedRecordCount: selectedFieldRepairItems.length,
    deferredRecordCount:
      eligibleFieldRepairItems.length - selectedFieldRepairItems.length,
    maxSelectedRecordCount: MAIN_RUN_FIELD_REPAIR_MAX_RECORDS,
  };

  const modelAssistanceResult = await executePersistedWorkflowStep({
    step: requireWorkflowStep(
      workflowRun.steps,
      TRADE_IN_WORKFLOW_STEP_NAMES.modelAssistance,
    ),
    inputJson: {
      candidateRecordIds: selectedFieldRepairItems.map((item) => item.id),
      modelAssistanceScope,
      taskType: MAIN_RUN_FIELD_REPAIR_TASK_TYPE,
      policyKey: MAIN_RUN_FIELD_REPAIR_POLICY_KEY,
      demonstrateProviderFallback: input.demonstrateProviderFallback === true,
    },
    async execute(step) {
      const fieldRepairRecords: MainRunFieldRepairRecordInput[] =
        selectedFieldRepairItems.map((item) => {
          const knowledgeEvidence = knowledgeMatchesByItem.find(
            (evidence) => evidence.parsedItemId === item.id,
          );
          const inventoryEvidence = inventoryMatchesByItem.find(
            (evidence) => evidence.parsedItemId === item.id,
          );
          const valuationEvidence = valuationEvidenceByItem.find(
            (evidence) => evidence.parsedItemId === item.id,
          );
          const priorReviewEvidence = priorReviewLearningEvidenceByItem.find(
            (evidence) => evidence.parsedItemId === item.id,
          );
          const priorReviewSuggestions =
            priorReviewLearningSuggestionsByItem.find(
              (suggestions) => suggestions.parsedItemId === item.id,
            );
          const fieldRepairMissingFields = getFieldRepairMissingFields(item);
          const fieldApplicability = {
            shaftFlex: isShaftFlexApplicable(item.category)
              ? ("REQUIRED" as const)
              : ("NOT_APPLICABLE" as const),
          };
          const deterministicPolicyAdvisoryCandidates =
            buildDeterministicPolicyFieldRepairAdvisoryCandidates({
              recordId: item.id,
              sourceText: item.rawLine,
              missingFields: fieldRepairMissingFields,
              fieldApplicability,
              productResolutionStatus: item.productResolution.status,
              sourceEvidenceId: `${item.id}:deterministic-policy`,
            });
          const priorReviewAdvisoryCandidates =
            buildPriorReviewFieldRepairAdvisoryCandidates({
              recordId: item.id,
              sourceText: item.rawLine,
              missingFields: fieldRepairMissingFields,
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
            fieldRepairMissingFields.length > 0
              ? "MISSING_REQUIRED_FIELDS"
              : null,
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
          const evidence: MainRunFieldRepairRecordInput["evidence"] = [
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
            missingFields: fieldRepairMissingFields,
            confidence: item.confidence,
            selectionReason: {
              lowConfidence: item.confidence < 0.72,
              confidence: item.confidence,
              missingFields: fieldRepairMissingFields,
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
            evidence,
          };
        });

      const fieldRepairInputJson = buildMainRunFieldRepairExecutionInput({
        workflowRunId: workflowRun.id,
        records: fieldRepairRecords,
      });
      const providerFallbackDemonstrationOptions =
        buildProviderFallbackDemonstrationOptions(
          input.demonstrateProviderFallback === true,
        );

      const modelCallLog = await createModelExecutionLogForWorkflowRun({
        workflowRunId: workflowRun.id,
        workflowStepId: step.id,
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
      const modelRoutingDecision = getModelRoutingDecisionFromLog(modelCallLog);

      return {
        fieldRepairRecords,
        modelCallLog,
        modelRoutingDecision,
      };
    },
    buildOutputJson(result) {
      return {
        modelCallLogId: result.modelCallLog.id,
        selectedRecordCount: result.fieldRepairRecords.length,
        provider: result.modelCallLog.provider,
        model: result.modelCallLog.model,
        status: result.modelCallLog.status,
      };
    },
  });
  const { fieldRepairRecords, modelCallLog, modelRoutingDecision } =
    modelAssistanceResult;

  const fieldRepairExecution = await executePersistedWorkflowStep({
    step: requireWorkflowStep(
      workflowRun.steps,
      TRADE_IN_WORKFLOW_STEP_NAMES.validateOutput,
    ),
    inputJson: {
      modelCallLogId: modelCallLog.id,
      selectedRecordCount: fieldRepairRecords.length,
    },
    execute() {
      const fieldRepairValidation = validateMainRunFieldRepairModelOutput(
        getProviderExecutionOutputJson(modelCallLog),
        {
          records: fieldRepairRecords,
        },
      );

      return {
        modelCallLogId: modelCallLog.id,
        recordOutcomes: fieldRepairValidation.output?.recordOutcomes ?? [],
        suggestions: fieldRepairValidation.output?.suggestions ?? [],
        jsonValid: fieldRepairValidation.jsonValid,
        validationPassed: fieldRepairValidation.validationPassed,
        validationErrors: fieldRepairValidation.validationErrors,
      };
    },
    buildOutputJson(result) {
      return {
        modelCallLogId: result.modelCallLogId,
        jsonValid: result.jsonValid,
        validationPassed: result.validationPassed,
        validationErrors: result.validationErrors,
        recordOutcomeCount: result.recordOutcomes.length,
        suggestionCount: result.suggestions.length,
      };
    },
  });

  const retryCandidate = findTargetedFieldRetryCandidate(
    selectedFieldRepairItems,
  );
  const targetedFieldRetry = await executePersistedWorkflowStep({
    step: requireWorkflowStep(
      workflowRun.steps,
      TRADE_IN_WORKFLOW_STEP_NAMES.targetedRetry,
    ),
    inputJson: {
      policy: TARGETED_FIELD_RETRY_POLICY,
      targetField: "shaftFlex",
      candidateRecordId: retryCandidate?.id ?? null,
      maxAttempts: TARGETED_FIELD_RETRY_MAX_ATTEMPTS,
    },
    async execute(step) {
      if (!retryCandidate) {
        return buildSkippedTargetedFieldRetry(parsedItems);
      }

      const retryRecord = fieldRepairRecords.find(
        (record) => record.recordId === retryCandidate.id,
      );

      if (!retryRecord) {
        throw new Error(
          `Field-repair context is missing for retry candidate: ${retryCandidate.id}.`,
        );
      }

      const targetedRetryRecord: MainRunFieldRepairRecordInput = {
        ...retryRecord,
        missingFields: ["shaftFlex"],
        selectionReason: {
          ...retryRecord.selectionReason,
          missingFields: ["shaftFlex"],
          uncertaintyNotes: retryRecord.selectionReason.uncertaintyNotes.filter(
            (note) => /\bshaft\b/i.test(note),
          ),
        },
        advisoryCandidates:
          retryRecord.advisoryCandidates?.filter(
            (candidate) => candidate.suggestion.fieldName === "shaftFlex",
          ) ?? [],
      };

      await markPersistedWorkflowStepRetrying(step);

      const retryInputJson = {
        ...buildMainRunFieldRepairExecutionInput({
          workflowRunId: workflowRun.id,
          records: [targetedRetryRecord],
        }),
        retry: {
          attempt: 1,
          maxAttempts: TARGETED_FIELD_RETRY_MAX_ATTEMPTS,
          targetField: "shaftFlex",
          recordId: retryCandidate.id,
          policy: TARGETED_FIELD_RETRY_POLICY,
        },
      };
      const retryModelCallLog = await createModelExecutionLogForWorkflowRun({
        workflowRunId: workflowRun.id,
        workflowStepId: step.id,
        taskType: MAIN_RUN_FIELD_REPAIR_TASK_TYPE,
        goal: "HIGH_QUALITY",
        policyKey: MAIN_RUN_FIELD_REPAIR_POLICY_KEY,
        agentName: MAIN_RUN_FIELD_REPAIR_AGENT_NAME,
        workflowName: "main-run",
        workflowStep: "targeted-field-retry",
        requireJson: true,
        allowDisabledProvidersForSimulation: false,
        inputJson: retryInputJson,
        outputSchema: MAIN_RUN_FIELD_REPAIR_OUTPUT_SCHEMA,
        ...(input.signal ? { signal: input.signal } : {}),
        validateOutput(outputJson) {
          const validation = validateMainRunFieldRepairModelOutput(outputJson, {
            records: [targetedRetryRecord],
          });

          return {
            jsonValid: validation.jsonValid,
            validationPassed: validation.validationPassed,
            validationErrors: validation.validationErrors,
          };
        },
      });
      const retryValidation = validateMainRunFieldRepairModelOutput(
        getProviderExecutionOutputJson(retryModelCallLog),
        {
          records: [targetedRetryRecord],
        },
      );

      return completeTargetedFieldRetry({
        parsedItems,
        recordId: retryCandidate.id,
        modelCallLogId: retryModelCallLog.id,
        validationPassed: retryValidation.validationPassed,
        validationErrors: retryValidation.validationErrors,
        suggestions: retryValidation.output?.suggestions ?? [],
      });
    },
    buildOutputJson(result) {
      return {
        retryEventId: result.retryEvent.id,
        status: result.retryEvent.status,
        recordId: result.retryEvent.recordId,
        targetField: result.retryEvent.targetField,
        attemptCount: result.retryEvent.attemptCount,
        maxAttempts: result.retryEvent.maxAttempts,
        modelCallLogId: result.retryEvent.modelCallLogId,
      };
    },
    getTerminalStatus(result) {
      return result.retryEvent.status === "SKIPPED" ? "SKIPPED" : "COMPLETED";
    },
    async onCompleted({ transaction, result }) {
      for (const [index, item] of result.parsedItems.entries()) {
        const intakeItem = intakeBatch.items[index];

        if (!intakeItem) {
          continue;
        }

        await transaction.intakeItem.update({
          where: {
            id: intakeItem.id,
          },
          data: {
            status: needsReview(item) ? "NEEDS_REVIEW" : "STRUCTURED",
          },
        });
      }
    },
  });
  const finalParsedItems = targetedFieldRetry.parsedItems;
  const retryEvents = [targetedFieldRetry.retryEvent];

  const reviewQueueItemsCreated = await executePersistedWorkflowStep({
    step: requireWorkflowStep(
      workflowRun.steps,
      TRADE_IN_WORKFLOW_STEP_NAMES.createReviewItems,
    ),
    inputJson: {
      parsedItemCount: finalParsedItems.length,
      modelSuggestionCount: fieldRepairExecution.suggestions.length,
    },
    async execute() {
      const createdItems: ReviewQueueItem[] = [];

      for (const [index, item] of finalParsedItems.entries()) {
        const valuationEvidence = valuationEvidenceByItem.find(
          (evidence) => evidence.parsedItemId === item.id,
        );
        const inventoryEvidence = inventoryMatchesByItem.find(
          (evidence) => evidence.parsedItemId === item.id,
        );
        const fieldRepairMissingFields = getFieldRepairMissingFields(item);
        const requiresFieldRepairReview = shouldRunFieldRepair(item);

        if (
          !needsReview(item) &&
          !requiresFieldRepairReview &&
          !valuationNeedsReview(valuationEvidence!.estimate)
        ) {
          continue;
        }

        const intakeItem = intakeBatch.items[index];

        const reviewQueueItem = await prisma.reviewQueueItem.create({
          data: {
            workflowRunId: workflowRun.id,
            intakeItemId: intakeItem?.id ?? null,
            reason: getReviewReason(item),
            status: "OPEN",
            originalText: item.rawLine,
            proposedGolfClubJson: toInputJson({
              ...item,
              missingFields: fieldRepairMissingFields,
              reviewReasonSummary: summarizeReviewReason({
                item,
                valuationEstimate: valuationEvidence!.estimate,
              }),
              knowledgeMatches:
                knowledgeMatchesByItem
                  .find((match) => match.parsedItemId === item.id)
                  ?.search.results.slice(0, 2) ?? [],
              inventoryMatch: inventoryEvidence?.lookup ?? null,
              demoValuationRange: valuationEvidence?.estimate ?? null,
            }),
          },
        });

        await resolveSupersededIntakeReviewMarkers({
          authoritativeReviewQueueItemId: reviewQueueItem.id,
          currentWorkflowRunId: workflowRun.id,
          item,
          sourceRowNumber: index + 1,
        });

        createdItems.push(reviewQueueItem);
      }

      return createdItems;
    },
    buildOutputJson(createdItems) {
      return {
        reviewQueueItemCount: createdItems.length,
        reviewQueueItemIds: createdItems.map((item) => item.id),
        openReviewQueueItemCount: createdItems.filter(
          (item) => item.status === "OPEN" || item.status === "IN_REVIEW",
        ).length,
      };
    },
  });

  const toolExecutionResult = await executePersistedWorkflowStep({
    step: requireWorkflowStep(
      workflowRun.steps,
      TRADE_IN_WORKFLOW_STEP_NAMES.executeTools,
    ),
    inputJson: {
      executionMode: "AGENT_AUTONOMOUS",
      mutationToolsEnabled: false,
      humanApprovalGranted: false,
    },
    async execute(step) {
      const firstParsedItem = finalParsedItems[0]!;
      const canExecuteDemoInventoryTools =
        input.productReferenceProvider === undefined &&
        firstParsedItem.productResolution.status === "MATCHED";

      const plannedCalls: EndToEndAgenticTradeInDemoResult["toolCallingPlan"]["plannedCalls"] =
        [
          {
            orderIndex: 1,
            toolName: "swingops.workflowRuns.get",
            reason:
              "Inspect the persisted workflow run context before the agent explains the audit trail.",
            inputJson: {
              id: workflowRun.id,
            },
            expectedRiskLevel: "LOW",
            expectedMutatesData: false,
            expectedRequiresHumanApproval: false,
          },
          {
            orderIndex: 2,
            toolName: "swingops.knowledgeBase.search",
            reason:
              "Run a read-only grounded search using the first parsed trade-in record.",
            inputJson: {
              query: knowledgeMatchesByItem[0]?.query ?? rawInput,
              maxResults: 5,
            },
            expectedRiskLevel: "LOW",
            expectedMutatesData: false,
            expectedRequiresHumanApproval: false,
          },
          ...(canExecuteDemoInventoryTools
            ? [
                {
                  orderIndex: 3,
                  toolName: "swingops.inventory.lookupProduct",
                  reason:
                    "Use a read-only internal inventory lookup to corroborate the default reference-provider match for the first parsed record.",
                  inputJson: buildTradeInInventoryLookupInput(firstParsedItem),
                  expectedRiskLevel: "LOW" as const,
                  expectedMutatesData: false,
                  expectedRequiresHumanApproval: false,
                },
                {
                  orderIndex: 4,
                  toolName: "swingops.tradeInValuation.estimate",
                  reason:
                    "Use a read-only valuation lookup after the default reference provider authoritatively identified the first parsed record.",
                  inputJson: {
                    ...buildTradeInInventoryLookupInput(firstParsedItem),
                    conditionNotes: firstParsedItem.conditionNotes.join("|"),
                    accessoriesNotes:
                      firstParsedItem.accessoriesNotes.join("|"),
                  },
                  expectedRiskLevel: "LOW" as const,
                  expectedMutatesData: false,
                  expectedRequiresHumanApproval: false,
                },
              ]
            : []),
          {
            orderIndex: 5,
            toolName: "swingops.reviewQueueItems.list",
            reason:
              "Inspect open human-review work created by low-confidence parsing or valuation uncertainty.",
            inputJson: {
              status: "OPEN",
            },
            expectedRiskLevel: "LOW",
            expectedMutatesData: false,
            expectedRequiresHumanApproval: false,
          },
          {
            orderIndex: 6,
            toolName: "swingops.inventory.createSku",
            reason:
              "Demonstrate that the agent can see a mutation-style inventory tool but cannot create SKUs without approval.",
            inputJson: {
              productId:
                inventoryMatchesByItem[0]?.lookup.productId ??
                "blocked-demo-product",
            },
            expectedRiskLevel: "HIGH",
            expectedMutatesData: true,
            expectedRequiresHumanApproval: true,
          },
        ];

      const toolCallResults: AgenticTradeInToolCallResult[] = [];
      const toolCallLogs: ToolCallLog[] = [];

      for (const plannedCall of plannedCalls) {
        const invocationResult = await executeReadOnlyToolInvocation({
          toolName: plannedCall.toolName,
          inputJson: plannedCall.inputJson,
          requestedBy: "agent.end-to-end-trade-in-demo",
          workflowRunId: workflowRun.id,
          workflowStepId: step.id,
          executionMode: "AGENT_AUTONOMOUS",
          humanApprovalGranted: false,
        });

        toolCallResults.push(toToolResult(invocationResult));
        toolCallLogs.push(invocationResult.toolCallLog);
      }

      return {
        plannedCalls,
        toolCallResults,
        toolCallLogs,
      };
    },
    buildOutputJson(result) {
      return {
        plannedCallCount: result.plannedCalls.length,
        toolCallLogIds: result.toolCallLogs.map((log) => log.id),
        succeededCount: result.toolCallResults.filter(
          (item) => item.status === "SUCCEEDED",
        ).length,
        blockedCount: result.toolCallResults.filter(
          (item) => item.status === "BLOCKED",
        ).length,
        failedCount: result.toolCallResults.filter(
          (item) => item.status === "FAILED",
        ).length,
      };
    },
  });
  const { plannedCalls, toolCallResults, toolCallLogs } = toolExecutionResult;

  const workflowStatus =
    reviewQueueItemsCreated.length > 0 ? "NEEDS_REVIEW" : "COMPLETED";

  await executePersistedWorkflowStep({
    step: requireWorkflowStep(
      workflowRun.steps,
      TRADE_IN_WORKFLOW_STEP_NAMES.finalize,
    ),
    inputJson: {
      reviewQueueItemCount: reviewQueueItemsCreated.length,
      proposedWorkflowStatus: workflowStatus,
    },
    execute() {
      return {
        workflowStatus,
        intakeBatchStatus:
          workflowStatus === "COMPLETED" ? "COMPLETED" : "NEEDS_REVIEW",
      } as const;
    },
    buildOutputJson(result) {
      return result;
    },
    async onCompleted({ transaction, result, completedAt }) {
      await transaction.workflowRun.update({
        where: {
          id: workflowRun.id,
        },
        data: {
          status: result.workflowStatus,
          completedAt:
            result.workflowStatus === "COMPLETED" ? completedAt : null,
          errorMessage: null,
        },
      });

      await transaction.intakeBatch.update({
        where: {
          id: intakeBatch.id,
        },
        data: {
          status: result.intakeBatchStatus,
        },
      });
    },
  });

  const successfulReadOnlyToolCallCount = toolCallResults.filter(
    (result) => result.status === "SUCCEEDED",
  ).length;
  const blockedMutationToolCallCount = toolCallResults.filter(
    (result) => result.status === "BLOCKED",
  ).length;
  const knowledgeMatchCount = knowledgeMatchesByItem.reduce(
    (count, item) => count + item.search.results.length,
    0,
  );
  const inventoryMatchCount = inventoryMatchesByItem.filter(
    (match) => match.lookup.productId !== null,
  ).length;
  const valuationRangeCount = valuationEvidenceByItem.filter(
    (evidence) => evidence.estimate.highValue > 0,
  ).length;
  const valuationReviewRequiredCount = valuationEvidenceByItem.filter(
    (evidence) => evidence.estimate.reviewRequired,
  ).length;
  const priorReviewEvidenceCount = priorReviewLearningEvidenceByItem.reduce(
    (count, item) => count + item.evidence.length,
    0,
  );
  const priorReviewSuggestionCount =
    priorReviewLearningSuggestionsByItem.reduce(
      (count, item) => count + item.suggestions.length,
      0,
    );
  const finalSummary = {
    parsedItemCount: finalParsedItems.length,
    knowledgeMatchCount,
    lowConfidenceItemCount: finalParsedItems.filter(needsReview).length,
    reviewQueueItemCount: reviewQueueItemsCreated.length,
    successfulReadOnlyToolCallCount,
    blockedMutationToolCallCount,
    inventoryMatchCount,
    valuationRangeCount,
    valuationReviewRequiredCount,
    priorReviewEvidenceCount,
    priorReviewSuggestionCount,
    selectedProvider: modelRoutingDecision.selectedProvider,
    selectedModel: modelRoutingDecision.selectedModel,
    productStory:
      "Messy golf trade-in intake became structured, grounded with weighted RAG matches, matched to seeded internal inventory products, assigned demo valuation ranges, routed through provider/cost/quality logic, tool-executed through safe read-only MCP-compatible connectors, policy-guarded against mutation, logged, and reviewable.",
  };

  const toolCallingPlan = {
    planId: `trade_in_workflow_${workflowRun.id}`,
    plannedCalls,
  };
  const blockedToolCallResult =
    toolCallResults.find((result) => result.status === "BLOCKED") ?? null;

  const persistedWorkflowSteps = await prisma.workflowStep.findMany({
    where: {
      workflowRunId: workflowRun.id,
    },
    orderBy: {
      orderIndex: "asc",
    },
  });
  const orchestrationTrace = buildTradeInWorkflowOrchestrationTrace(
    persistedWorkflowSteps,
  );

  const workflowQualityBundle = buildWorkflowQualityBundle({
    parsedItems: finalParsedItems,
    knowledgeMatchesByItem,
    inventoryMatchesByItem,
    valuationEvidenceByItem,
    modelCallLog,
    providerFallbackSimulationRequested:
      input.demonstrateProviderFallback === true,
    retryEvents,
    toolCallingPlan,
    toolCallResults,
    reviewQueueItemsCreated,
  });

  const resultWithoutAuditTrail = {
    rawInput,
    parsedItems: finalParsedItems,
    knowledgeMatchesByItem,
    inventoryMatchesByItem,
    valuationEvidenceByItem,
    priorReviewLearningEvidenceByItem,
    priorReviewLearningSuggestionsByItem,
    modelAssistanceScope,
    modelRoutingDecision,
    modelCallLog,
    fieldRepairExecution,
    orchestrationTrace,
    toolCallingPlan,
    toolCallResults,
    blockedToolCallResult,
    reviewQueueItemsCreated,
    persisted: {
      intakeBatchId: intakeBatch.id,
      intakeItemIds: intakeBatch.items.map((item) => item.id),
      workflowRunId: workflowRun.id,
      modelCallLogId: modelCallLog.id,
      toolCallLogIds: toolCallLogs.map((log) => log.id),
      reviewQueueItemIds: reviewQueueItemsCreated.map((item) => item.id),
    },
    finalSummary,
    ...workflowQualityBundle,
  };

  return {
    ...resultWithoutAuditTrail,
    auditTrail: buildEndToEndAgenticTradeInDemoAuditTrail(
      resultWithoutAuditTrail,
    ),
  };
}
