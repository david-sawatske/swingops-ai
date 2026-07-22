import { LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE } from "../intake/legacy-intake-source-types.js";

import type { ProductReferenceProvider } from "../product-reference/product-reference-provider.js";
import { prisma } from "../lib/prisma.js";
import {
  MAIN_RUN_FIELD_REPAIR_POLICY_KEY,
  MAIN_RUN_FIELD_REPAIR_TASK_TYPE,
  validateMainRunFieldRepairModelOutput,
} from "./main-run-field-repair.js";
import {
  executePersistedWorkflowStep,
  markPersistedWorkflowStepRetrying,
  requireWorkflowStep,
} from "./workflow-step-persistence.js";
import { TRADE_IN_WORKFLOW_STEP_NAMES } from "./workflow-orchestration-trace.js";
import { failIntakeBatchAfterWorkflowSetupError } from "./workflow-run-failure.js";
import type { EndToEndAgenticTradeInDemoResult } from "./end-to-end-agentic-trade-in-demo.types.js";
import { parseTradeInDemoText } from "./trade-in-demo-parser.js";
import {
  TARGETED_FIELD_RETRY_MAX_ATTEMPTS,
  TARGETED_FIELD_RETRY_POLICY,
  buildTargetedFieldRetryStepOutput,
  executeTargetedFieldRetry,
  findTargetedFieldRetryCandidate,
} from "./targeted-field-retry.js";
import {
  TRADE_IN_DEMO_MAX_KNOWLEDGE_RESULTS_PER_ITEM,
  buildTradeInDemoEvidenceStepOutput,
  collectTradeInDemoEvidence,
} from "./trade-in-demo-evidence.js";
import {
  buildTradeInDemoModelAssistanceStepOutput,
  executeTradeInDemoModelAssistance,
  getTradeInDemoProviderExecutionOutputJson,
  selectTradeInDemoModelAssistanceItems,
} from "./trade-in-demo-model-assistance.js";
import {
  buildTradeInDemoReviewQueueStepOutput,
  createTradeInDemoReviewQueueItems,
  tradeInDemoItemNeedsReview,
} from "./trade-in-demo-review-queue.js";
import { buildTradeInDemoResult } from "./trade-in-demo-result.js";
import {
  buildTradeInDemoToolExecutionStepOutput,
  executeTradeInDemoTools,
} from "./trade-in-demo-tool-execution.js";

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
          status: tradeInDemoItemNeedsReview(item)
            ? "NEEDS_REVIEW"
            : "STRUCTURED",
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
  const { selectedFieldRepairItems, modelAssistanceScope } =
    selectTradeInDemoModelAssistanceItems(parsedItems);

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
      return executeTradeInDemoModelAssistance({
        workflowRunId: workflowRun.id,
        workflowStepId: step.id,
        selectedItems: selectedFieldRepairItems,
        evidence: evidenceResult,
        demonstrateProviderFallback: input.demonstrateProviderFallback === true,
        ...(input.signal ? { signal: input.signal } : {}),
      });
    },
    buildOutputJson(result) {
      return buildTradeInDemoModelAssistanceStepOutput(result);
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
        getTradeInDemoProviderExecutionOutputJson(modelCallLog),
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
      return executeTargetedFieldRetry({
        workflowRunId: workflowRun.id,
        workflowStepId: step.id,
        parsedItems,
        retryCandidate,
        fieldRepairRecords,
        onRetrying() {
          return markPersistedWorkflowStepRetrying(step);
        },
        ...(input.signal ? { signal: input.signal } : {}),
      });
    },
    buildOutputJson(result) {
      return buildTargetedFieldRetryStepOutput(result);
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
            status: tradeInDemoItemNeedsReview(item)
              ? "NEEDS_REVIEW"
              : "STRUCTURED",
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
    execute() {
      return createTradeInDemoReviewQueueItems({
        workflowRunId: workflowRun.id,
        parsedItems: finalParsedItems,
        intakeItems: intakeBatch.items,
        evidence: evidenceResult,
      });
    },
    buildOutputJson(createdItems) {
      return buildTradeInDemoReviewQueueStepOutput(createdItems);
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
    execute(step) {
      return executeTradeInDemoTools({
        workflowRunId: workflowRun.id,
        workflowStepId: step.id,
        rawInput,
        parsedItems: finalParsedItems,
        evidence: evidenceResult,
        usingDefaultProductReferenceProvider:
          input.productReferenceProvider === undefined,
      });
    },
    buildOutputJson(result) {
      return buildTradeInDemoToolExecutionStepOutput(result);
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

  const persistedWorkflowSteps = await prisma.workflowStep.findMany({
    where: {
      workflowRunId: workflowRun.id,
    },
    orderBy: {
      orderIndex: "asc",
    },
  });

  return buildTradeInDemoResult({
    rawInput,
    parsedItems: finalParsedItems,
    evidence: evidenceResult,
    modelAssistanceScope,
    modelRoutingDecision,
    modelCallLog,
    fieldRepairExecution,
    workflowSteps: persistedWorkflowSteps,
    plannedCalls,
    toolCallResults,
    reviewQueueItemsCreated,
    retryEvents,
    providerFallbackSimulationRequested:
      input.demonstrateProviderFallback === true,
    persistedIds: {
      intakeBatchId: intakeBatch.id,
      intakeItemIds: intakeBatch.items.map((item) => item.id),
      workflowRunId: workflowRun.id,
      toolCallLogIds: toolCallLogs.map((log) => log.id),
    },
  });
}
