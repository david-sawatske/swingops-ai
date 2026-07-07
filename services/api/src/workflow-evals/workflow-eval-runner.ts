import { LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE } from "../intake/legacy-intake-source-types.js";
import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { executeEndToEndAgenticTradeInDemo } from "../workflows/end-to-end-agentic-trade-in-demo.js";
import { executeMultiSourceIntakeDemo } from "../workflows/multi-source-intake-demo.js";
import type { ParserEvidence } from "../workflows/parser-evidence.js";
import type {
  WorkflowEvalFailure,
  WorkflowEvalFieldName,
  WorkflowEvalObserved,
  WorkflowEvalPriorReviewLearningEventSeed,
  WorkflowEvalResult,
  WorkflowEvalRunResult,
  WorkflowEvalScenario
} from "./workflow-eval-types.js";
import {
  WORKFLOW_EVAL_SCENARIOS,
  listWorkflowEvalScenarioSummaries
} from "./workflow-eval-scenarios.js";

export { listWorkflowEvalScenarioSummaries };

type PersistedEvalIds = {
  intakeBatchId: string;
  workflowRunId: string;
};

type SeededPriorReviewLearningEventIds = PersistedEvalIds & {
  reviewQueueItemId: string;
};

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function getRecordField(
  record: WorkflowEvalObserved["records"][number],
  fieldName: WorkflowEvalFieldName
) {
  return record[fieldName];
}

function getParserEvidenceField(
  parserEvidence: ParserEvidence | undefined,
  fieldName: WorkflowEvalFieldName
) {
  return parserEvidence?.[fieldName];
}

function addFailure(
  failures: WorkflowEvalFailure[],
  expectation: string,
  message: string
) {
  failures.push({
    expectation,
    message
  });
}

async function cleanupEvalArtifacts(ids: PersistedEvalIds) {
  await prisma.intakeBatch
    .delete({
      where: {
        id: ids.intakeBatchId
      }
    })
    .catch(() => undefined);

  await prisma.workflowRun
    .delete({
      where: {
        id: ids.workflowRunId
      }
    })
    .catch(() => undefined);
}

async function cleanupSeededPriorReviewLearningEvent(
  ids: SeededPriorReviewLearningEventIds
) {
  await prisma.reviewQueueItem
    .delete({
      where: {
        id: ids.reviewQueueItemId
      }
    })
    .catch(() => undefined);

  await cleanupEvalArtifacts(ids);
}

async function seedPriorReviewLearningEvent(
  event: WorkflowEvalPriorReviewLearningEventSeed
): Promise<SeededPriorReviewLearningEventIds> {
  const intakeBatch = await prisma.intakeBatch.create({
    data: {
      name: "Workflow Eval Prior Review Seed",
      description:
        "Temporary prior review correction used by the workflow quality check runner.",
      sourceType: LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE,
      status: "NEEDS_REVIEW",
      itemCount: 1,
      items: {
        create: [
          {
            rawText: event.evidenceText,
            sourceRowNumber: 1,
            status: "NEEDS_REVIEW"
          }
        ]
      }
    },
    include: {
      items: {
        orderBy: {
          sourceRowNumber: "asc"
        }
      }
    }
  });

  const workflowRun = await prisma.workflowRun.create({
    data: {
      intakeBatchId: intakeBatch.id,
      workflowName: "workflow-eval-prior-review-seed",
      status: "NEEDS_REVIEW",
      startedAt: new Date()
    }
  });

  const intakeItem = intakeBatch.items[0];

  const reviewQueueItem = await prisma.reviewQueueItem.create({
    data: {
      workflowRunId: workflowRun.id,
      intakeItemId: intakeItem?.id ?? null,
      reason: "MISSING_REQUIRED_FIELDS",
      status: "RESOLVED",
      originalText: event.evidenceText,
      proposedGolfClubJson: toInputJson({
        fieldName: event.fieldName,
        proposedValue: event.proposedValue ?? null
      })
    }
  });

  const reviewedTradeInRecord = await prisma.reviewedTradeInRecord.create({
    data: {
      reviewQueueItemId: reviewQueueItem.id,
      workflowRunId: workflowRun.id,
      intakeItemId: intakeItem?.id ?? null,
      originalText: event.evidenceText,
      correctedShaftFlex:
        event.fieldName === "shaftFlex" ? event.correctedValue : null,
      correctedConditionGrade:
        event.fieldName === "conditionGrade" ? event.correctedValue : null,
      correctedDemoValue:
        event.fieldName === "tradeInValue"
          ? Number(event.correctedValue)
          : null,
      reviewerNotes:
        "Temporary reviewed correction created for workflow quality checks."
    }
  });

  await prisma.humanReviewLearningEvent.create({
    data: {
      reviewedTradeInRecordId: reviewedTradeInRecord.id,
      reviewQueueItemId: reviewQueueItem.id,
      workflowRunId: workflowRun.id,
      intakeItemId: intakeItem?.id ?? null,
      fieldName: event.fieldName,
      rawTextMatch: event.rawTextMatch,
      proposedValue: event.proposedValue ?? null,
      correctedValue: event.correctedValue,
      evidenceText: event.evidenceText,
      confidenceImpact: event.confidenceImpact ?? null,
      reviewerNotes:
        "Temporary learning event created for workflow quality checks."
    }
  });

  return {
    intakeBatchId: intakeBatch.id,
    workflowRunId: workflowRun.id,
    reviewQueueItemId: reviewQueueItem.id
  };
}

async function seedScenarioSetup(scenario: WorkflowEvalScenario) {
  const seededPriorReviewLearningEventIds: SeededPriorReviewLearningEventIds[] = [];

  for (const event of scenario.setup?.priorReviewLearningEvents ?? []) {
    seededPriorReviewLearningEventIds.push(await seedPriorReviewLearningEvent(event));
  }

  return seededPriorReviewLearningEventIds;
}

async function cleanupScenarioSetup(ids: SeededPriorReviewLearningEventIds[]) {
  for (const idSet of ids) {
    await cleanupSeededPriorReviewLearningEvent(idSet);
  }
}

function assertCount(input: {
  failures: WorkflowEvalFailure[];
  label: string;
  expected: number | undefined;
  observed: number;
}) {
  if (input.expected === undefined) {
    return;
  }

  if (input.observed !== input.expected) {
    addFailure(
      input.failures,
      input.label,
      `Expected ${input.expected}, observed ${input.observed}.`
    );
  }
}

function assertMissingFields(input: {
  scenario: WorkflowEvalScenario;
  observed: WorkflowEvalObserved;
  failures: WorkflowEvalFailure[];
}) {
  for (const expectation of input.scenario.expectations.missingFields ?? []) {
    const record = input.observed.records[expectation.recordIndex];

    if (!record) {
      addFailure(
        input.failures,
        `record ${expectation.recordIndex} missing-field expectations`,
        "Expected record was not present."
      );
      continue;
    }

    for (const fieldName of expectation.includes ?? []) {
      if (!record.missingFields.includes(fieldName)) {
        addFailure(
          input.failures,
          `${fieldName} missing-field presence`,
          `Expected ${fieldName} to be listed as missing.`
        );
      }
    }

    for (const fieldName of expectation.excludes ?? []) {
      if (record.missingFields.includes(fieldName)) {
        addFailure(
          input.failures,
          `${fieldName} missing-field absence`,
          `Expected ${fieldName} not to be listed as missing.`
        );
      }
    }
  }
}

function assertNoInventedValues(input: {
  scenario: WorkflowEvalScenario;
  observed: WorkflowEvalObserved;
  failures: WorkflowEvalFailure[];
}) {
  for (const expectation of input.scenario.expectations.noInventedValues ?? []) {
    const record = input.observed.records[expectation.recordIndex];

    if (!record) {
      addFailure(
        input.failures,
        `record ${expectation.recordIndex} no-invented-value expectation`,
        "Expected record was not present."
      );
      continue;
    }

    const observedValue = getRecordField(record, expectation.fieldName);
    const evidence = getParserEvidenceField(record.parserEvidence, expectation.fieldName);

    if (observedValue !== null) {
      addFailure(
        input.failures,
        `${expectation.fieldName} remains blank`,
        `Expected ${expectation.fieldName} to remain blank, observed ${String(observedValue)}.`
      );
    }

    if (evidence) {
      addFailure(
        input.failures,
        `${expectation.fieldName} has no parser evidence`,
        `Expected no parser evidence for ${expectation.fieldName}, observed ${evidence.sourceText}.`
      );
    }
  }
}

function assertFieldEvidence(input: {
  scenario: WorkflowEvalScenario;
  observed: WorkflowEvalObserved;
  failures: WorkflowEvalFailure[];
}) {
  for (const expectation of input.scenario.expectations.fieldEvidence ?? []) {
    const record = input.observed.records[expectation.recordIndex];

    if (!record) {
      addFailure(
        input.failures,
        `record ${expectation.recordIndex} field evidence expectation`,
        "Expected record was not present."
      );
      continue;
    }

    const observedValue = getRecordField(record, expectation.fieldName);
    const evidence = getParserEvidenceField(record.parserEvidence, expectation.fieldName);

    if (
      expectation.expectedValue !== undefined &&
      observedValue !== expectation.expectedValue
    ) {
      addFailure(
        input.failures,
        `${expectation.fieldName} normalized value`,
        `Expected ${String(expectation.expectedValue)}, observed ${String(observedValue)}.`
      );
    }

    if (!evidence) {
      addFailure(
        input.failures,
        `${expectation.fieldName} parser evidence`,
        `Expected parser evidence for ${expectation.fieldName}.`
      );
      continue;
    }

    if (
      expectation.expectedSourceTextIncludes &&
      !evidence.sourceText.includes(expectation.expectedSourceTextIncludes)
    ) {
      addFailure(
        input.failures,
        `${expectation.fieldName} parser evidence source text`,
        `Expected source text to include "${expectation.expectedSourceTextIncludes}", observed "${evidence.sourceText}".`
      );
    }
  }
}

function serializePriorReviewSuggestions(
  result: Awaited<ReturnType<typeof executeEndToEndAgenticTradeInDemo>>
) {
  return result.priorReviewLearningSuggestionsByItem.flatMap((item) =>
    item.suggestions.map((suggestion) => ({
      fieldName: suggestion.fieldName,
      rawTextMatch: suggestion.rawTextMatch,
      suggestedValue: suggestion.suggestedValue,
      previousCorrectedValue: suggestion.previousCorrectedValue,
      proposedValue: suggestion.proposedValue,
      evidenceText: suggestion.evidenceText,
      confidence: suggestion.confidence,
      strength: suggestion.strength,
      confidenceImpact: suggestion.confidenceImpact,
      summary: suggestion.summary,
      whySuggestionExists: suggestion.whySuggestionExists,
      sourceLearningEventId: suggestion.sourceLearningEventId,
      status: suggestion.status
    }))
  );
}

function assertScenarioExpectations(input: {
  scenario: WorkflowEvalScenario;
  observed: WorkflowEvalObserved;
}) {
  const failures: WorkflowEvalFailure[] = [];

  assertCount({
    failures,
    label: "parsed record count",
    expected: input.scenario.expectations.parsedRecordCount,
    observed: input.observed.parsedRecordCount
  });
  assertCount({
    failures,
    label: "AI-ready record count",
    expected: input.scenario.expectations.aiReadyRecordCount,
    observed: input.observed.aiReadyRecordCount
  });
  assertCount({
    failures,
    label: "review item count",
    expected: input.scenario.expectations.reviewItemCount,
    observed: input.observed.reviewItemCount
  });
  assertCount({
    failures,
    label: "prior review suggestion count",
    expected: input.scenario.expectations.priorReviewSuggestionCount,
    observed: input.observed.priorReviewSuggestionCount
  });
  assertMissingFields({
    scenario: input.scenario,
    observed: input.observed,
    failures
  });
  assertNoInventedValues({
    scenario: input.scenario,
    observed: input.observed,
    failures
  });
  assertFieldEvidence({
    scenario: input.scenario,
    observed: input.observed,
    failures
  });

  return failures;
}

async function runMultiSourceIntakeEvalScenario(
  scenario: WorkflowEvalScenario
): Promise<WorkflowEvalObserved> {
  const result = await executeMultiSourceIntakeDemo({
    sources: scenario.sources ?? []
  });

  try {
    return {
      parsedRecordCount: result.recordsExtracted,
      aiReadyRecordCount: result.persistedIds.aiReadyIntakeRecordIds.length,
      reviewItemCount: result.persistedIds.reviewQueueItemIds.length,
      priorReviewSuggestionCount: 0,
      priorReviewSuggestions: [],
      records: result.cleanedDatasetPreview.map((record) => ({
        id: record.id,
        sourceType: record.sourceType,
        brand: record.brand,
        productLine: record.productLine,
        category: record.category,
        shaftFlex: record.shaftFlex,
        conditionGrade: record.conditionGrade,
        tradeInValue: record.tradeInValue,
        missingFields: record.missingFields,
        reviewNeeded: record.reviewNeeded,
        confidence: record.confidence,
        ...(record.parserEvidence ? { parserEvidence: record.parserEvidence } : {})
      }))
    };
  } finally {
    await cleanupEvalArtifacts({
      intakeBatchId: result.persistedIds.intakeBatchId,
      workflowRunId: result.persistedIds.workflowRunId
    });
  }
}

function buildMissingFieldsFromParsedItem(input: {
  shaftFlex: string | null;
  conditionGrade: string | null;
  tradeInValue: number | null;
}) {
  return [
    input.shaftFlex ? null : "shaftFlex",
    input.conditionGrade ? null : "conditionGrade",
    input.tradeInValue === null ? "tradeInValue" : null
  ].filter((fieldName): fieldName is WorkflowEvalFieldName => Boolean(fieldName));
}

async function runGuardedAgentWorkflowEvalScenario(
  scenario: WorkflowEvalScenario
): Promise<WorkflowEvalObserved> {
  const result = await executeEndToEndAgenticTradeInDemo({
    rawInput: scenario.rawInput ?? ""
  });

  try {
    return {
      parsedRecordCount: result.finalSummary.parsedItemCount,
      aiReadyRecordCount: 0,
      reviewItemCount: result.finalSummary.reviewQueueItemCount,
      priorReviewSuggestionCount: result.finalSummary.priorReviewSuggestionCount,
      priorReviewSuggestions: serializePriorReviewSuggestions(result),
      records: result.parsedItems.map((item) => ({
        id: item.id,
        sourceType: scenario.sourceType,
        brand: item.brand,
        productLine: item.productLine,
        category: item.category,
        shaftFlex: item.shaftFlex,
        conditionGrade: item.conditionGrade,
        tradeInValue: item.tradeInValue,
        missingFields: buildMissingFieldsFromParsedItem(item),
        reviewNeeded:
          buildMissingFieldsFromParsedItem(item).length > 0 ||
          item.confidence < 0.72,
        confidence: item.confidence,
        ...(item.parserEvidence ? { parserEvidence: item.parserEvidence } : {})
      }))
    };
  } finally {
    await cleanupEvalArtifacts({
      intakeBatchId: result.persisted.intakeBatchId,
      workflowRunId: result.persisted.workflowRunId
    });
  }
}

async function runWorkflowEvalScenario(
  scenario: WorkflowEvalScenario
): Promise<WorkflowEvalResult> {
  const setupIds = await seedScenarioSetup(scenario);

  try {
    const observed =
      scenario.executionMode === "GUARDED_AGENT_WORKFLOW"
        ? await runGuardedAgentWorkflowEvalScenario(scenario)
        : await runMultiSourceIntakeEvalScenario(scenario);

    const failures = assertScenarioExpectations({
      scenario,
      observed
    });

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      sourceType: scenario.sourceType,
      executionMode: scenario.executionMode,
      status: failures.length > 0 ? "FAILED" : "PASSED",
      observed,
      failures
    };
  } finally {
    await cleanupScenarioSetup(setupIds);
  }
}

export async function runWorkflowEvals(
  scenarios: WorkflowEvalScenario[] = WORKFLOW_EVAL_SCENARIOS
): Promise<WorkflowEvalRunResult> {
  const results: WorkflowEvalResult[] = [];

  for (const scenario of scenarios) {
    results.push(await runWorkflowEvalScenario(scenario));
  }

  const passed = results.filter((result) => result.status === "PASSED").length;
  const failed = results.length - passed;

  return {
    summary: {
      total: results.length,
      passed,
      failed
    },
    results
  };
}
