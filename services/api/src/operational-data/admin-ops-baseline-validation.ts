import type { AdminOpsBaselineFixtures } from "./admin-ops-baseline-types.js";

export type AdminOpsBaselineReconciliation = {
  aiReadyRecords: {
    total: number;
    active: number;
    superseded: number;
    readyForRag: number;
    needsReview: number;
    last24Hours: number;
  };
  workflowRuns: {
    total: number;
    completed: number;
    needsReview: number;
    failed: number;
  };
  reviewQueueItems: {
    total: number;
    open: number;
    inReview: number;
    resolved: number;
    superseded: number;
  };
  modelTelemetry: {
    logicalCalls: number;
    providerAttempts: number;
    successfulAttempts: number;
    nonSuccessfulAttempts: number;
    fallbackCalls: number;
    selectedRecords: number;
    recordOutcomes: number;
    repairSuggestions: number;
    candidateComparisons: number;
    noSafeRepairOutcomes: number;
    totalTokens: number;
    estimatedCostUsd: number;
    averageLatencyMs: number;
  };
};

function countBy<T>(values: T[], getKey: (value: T) => string) {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = getKey(value);
    counts[key] = (counts[key] ?? 0) + 1;

    return counts;
  }, {});
}

function expectCount(
  errors: string[],
  label: string,
  actual: number | undefined,
  expected: number,
) {
  if ((actual ?? 0) !== expected) {
    errors.push(`${label}: expected ${expected}, received ${actual ?? 0}.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getOutcomeTypes(responseJson: Record<string, unknown>): string[] {
  const providerExecution = responseJson.providerExecution;

  if (!isRecord(providerExecution)) {
    return [];
  }

  const outputJson = providerExecution.outputJson;

  if (!isRecord(outputJson) || !isRecord(outputJson.parsedJson)) {
    return [];
  }

  const outcomes = outputJson.parsedJson.recordOutcomes;

  if (!Array.isArray(outcomes)) {
    return [];
  }

  return outcomes.flatMap((outcome) =>
    isRecord(outcome) && typeof outcome.outcomeType === "string"
      ? [outcome.outcomeType]
      : [],
  );
}

function getSelectedRecordCount(requestJson: Record<string, unknown>): number {
  if (!isRecord(requestJson.inputJson)) {
    return 0;
  }

  return Array.isArray(requestJson.inputJson.records)
    ? requestJson.inputJson.records.length
    : 0;
}

export function validateAdminOpsBaselineFixtures(
  fixtures: AdminOpsBaselineFixtures,
): AdminOpsBaselineReconciliation {
  const errors: string[] = [];
  const allIds = [
    ...fixtures.intakeBatches,
    ...fixtures.intakeItems,
    ...fixtures.workflowRuns,
    ...fixtures.workflowSteps,
    ...fixtures.aiReadyRecords,
    ...fixtures.reviewQueueItems,
    ...fixtures.reviewedTradeInRecords,
    ...fixtures.modelCalls,
    ...fixtures.modelCallAttempts,
    ...fixtures.toolCalls,
  ].map((fixture) => fixture.id);
  const duplicateIds = allIds.filter(
    (fixtureId, index) => allIds.indexOf(fixtureId) !== index,
  );

  if (duplicateIds.length > 0) {
    errors.push(
      `Fixture IDs must be unique: ${[...new Set(duplicateIds)].join(", ")}.`,
    );
  }

  const activeRecords = fixtures.aiReadyRecords.filter(
    (record) => record.status !== "SUPERSEDED",
  );
  const supersededRecords = fixtures.aiReadyRecords.filter(
    (record) => record.status === "SUPERSEDED",
  );
  const recordStatuses = countBy(
    fixtures.aiReadyRecords,
    (record) => record.status,
  );
  const sourceTypes = countBy(
    fixtures.aiReadyRecords,
    (record) => record.sourceType,
  );
  const activeSourceTypes = countBy(
    activeRecords,
    (record) => record.sourceType,
  );
  const supersededSourceTypes = countBy(
    supersededRecords,
    (record) => record.sourceType,
  );
  const stores = countBy(activeRecords, (record) =>
    String(record.normalizedJson.storeId ?? "Blank"),
  );
  const supersededStores = countBy(supersededRecords, (record) =>
    String(record.normalizedJson.storeId ?? "Blank"),
  );
  const categories = countBy(activeRecords, (record) =>
    typeof record.normalizedJson.category === "string"
      ? record.normalizedJson.category
      : "Blank",
  );
  const missingFields = activeRecords.reduce<Record<string, number>>(
    (counts, record) => {
      const fields = record.normalizedJson.missingFields;

      if (Array.isArray(fields)) {
        for (const field of fields) {
          if (typeof field === "string") {
            counts[field] = (counts[field] ?? 0) + 1;
          }
        }
      }

      return counts;
    },
    {},
  );
  const oneDayBeforeAnchor = fixtures.anchor.getTime() - 24 * 60 * 60 * 1_000;
  const last24Hours = fixtures.aiReadyRecords.filter(
    (record) => record.createdAt.getTime() >= oneDayBeforeAnchor,
  ).length;

  expectCount(errors, "AI-ready total", fixtures.aiReadyRecords.length, 56);
  expectCount(errors, "AI-ready active", activeRecords.length, 48);
  expectCount(errors, "AI-ready superseded", supersededRecords.length, 8);
  expectCount(errors, "READY_FOR_RAG", recordStatuses.READY_FOR_RAG, 31);
  expectCount(errors, "NEEDS_REVIEW", recordStatuses.NEEDS_REVIEW, 17);
  expectCount(errors, "SUPERSEDED", recordStatuses.SUPERSEDED, 8);
  expectCount(errors, "Records in last 24 hours", last24Hours, 9);

  for (const [sourceType, expected] of Object.entries({
    FREE_TEXT: [21, 18, 3, 12, 6],
    POORLY_FORMED_CSV: [14, 12, 2, 9, 3],
    EMAIL: [11, 10, 1, 8, 2],
    LOG: [10, 8, 2, 2, 6],
  })) {
    expectCount(
      errors,
      `${sourceType} total`,
      sourceTypes[sourceType],
      expected[0] ?? 0,
    );
    expectCount(
      errors,
      `${sourceType} active`,
      activeSourceTypes[sourceType],
      expected[1] ?? 0,
    );
    expectCount(
      errors,
      `${sourceType} superseded`,
      supersededSourceTypes[sourceType],
      expected[2] ?? 0,
    );
    expectCount(
      errors,
      `${sourceType} grounding-ready`,
      activeRecords.filter(
        (record) =>
          record.sourceType === sourceType && record.status === "READY_FOR_RAG",
      ).length,
      expected[3] ?? 0,
    );
    expectCount(
      errors,
      `${sourceType} needs review`,
      activeRecords.filter(
        (record) =>
          record.sourceType === sourceType && record.status === "NEEDS_REVIEW",
      ).length,
      expected[4] ?? 0,
    );
  }

  for (const [storeId, expected] of Object.entries({
    "104": [21, 3],
    "207": [16, 3],
    "312": [11, 2],
  })) {
    expectCount(
      errors,
      `Store ${storeId} active`,
      stores[storeId],
      expected[0] ?? 0,
    );
    expectCount(
      errors,
      `Store ${storeId} superseded`,
      supersededStores[storeId],
      expected[1] ?? 0,
    );
  }

  for (const [category, expected] of Object.entries({
    DRIVER: 14,
    PUTTER: 8,
    WEDGE: 8,
    FAIRWAY_WOOD: 7,
    IRON_SET: 6,
    HYBRID: 4,
    Blank: 1,
  })) {
    expectCount(errors, `${category} category`, categories[category], expected);
  }

  for (const [field, expected] of Object.entries({
    conditionGrade: 10,
    shaftFlex: 8,
    tradeInValue: 7,
    productLine: 4,
    category: 2,
    brand: 1,
  })) {
    expectCount(errors, `${field} missing`, missingFields[field], expected);
  }

  for (const record of activeRecords) {
    if (
      record.status === "READY_FOR_RAG" &&
      (record.reviewNeeded || !record.ragReady)
    ) {
      errors.push(`${record.id} has inconsistent grounding-ready flags.`);
    }

    if (
      record.status === "NEEDS_REVIEW" &&
      (!record.reviewNeeded || record.ragReady)
    ) {
      errors.push(`${record.id} has inconsistent review flags.`);
    }
  }

  const activeRecordIds = new Set(activeRecords.map((record) => record.id));

  for (const record of supersededRecords) {
    if (
      !record.supersededByAiReadyIntakeRecordId ||
      !activeRecordIds.has(record.supersededByAiReadyIntakeRecordId)
    ) {
      errors.push(
        `${record.id} does not link to an active replacement record.`,
      );
    }
  }

  const sevenDaysBeforeAnchor =
    fixtures.anchor.getTime() - 7 * 24 * 60 * 60 * 1_000;

  for (const record of fixtures.aiReadyRecords) {
    if (
      record.createdAt.getTime() < sevenDaysBeforeAnchor ||
      record.createdAt.getTime() > fixtures.anchor.getTime()
    ) {
      errors.push(`${record.id} falls outside the seven-day reporting window.`);
    }
  }

  const workflowStatuses = countBy(fixtures.workflowRuns, (run) => run.status);
  expectCount(errors, "Workflow run total", fixtures.workflowRuns.length, 14);
  expectCount(errors, "Completed workflow runs", workflowStatuses.COMPLETED, 8);
  expectCount(errors, "Review workflow runs", workflowStatuses.NEEDS_REVIEW, 5);
  expectCount(errors, "Failed workflow runs", workflowStatuses.FAILED, 1);

  const batchIds = new Set(fixtures.intakeBatches.map((batch) => batch.id));
  const intakeItemIds = new Set(fixtures.intakeItems.map((item) => item.id));
  const workflowRunIds = new Set(fixtures.workflowRuns.map((run) => run.id));
  const workflowStepIds = new Set(
    fixtures.workflowSteps.map((step) => step.id),
  );

  for (const item of fixtures.intakeItems) {
    if (!batchIds.has(item.intakeBatchId)) {
      errors.push(`${item.id} does not link to a fixture intake batch.`);
    }
  }

  for (const run of fixtures.workflowRuns) {
    if (!batchIds.has(run.intakeBatchId)) {
      errors.push(`${run.id} does not link to a fixture intake batch.`);
    }
  }

  for (const step of fixtures.workflowSteps) {
    if (!workflowRunIds.has(step.workflowRunId)) {
      errors.push(`${step.id} does not link to a fixture workflow run.`);
    }
  }

  for (const record of fixtures.aiReadyRecords) {
    if (
      !batchIds.has(record.intakeBatchId) ||
      !intakeItemIds.has(record.intakeItemId) ||
      !workflowRunIds.has(record.workflowRunId)
    ) {
      errors.push(
        `${record.id} has an invalid intake or workflow relationship.`,
      );
    }
  }

  const reviewStatuses = countBy(
    fixtures.reviewQueueItems,
    (item) => item.status,
  );
  expectCount(
    errors,
    "Review item total",
    fixtures.reviewQueueItems.length,
    34,
  );
  expectCount(errors, "Open review items", reviewStatuses.OPEN, 10);
  expectCount(errors, "In-review items", reviewStatuses.IN_REVIEW, 7);
  expectCount(errors, "Resolved review items", reviewStatuses.RESOLVED, 9);
  expectCount(errors, "Superseded review items", reviewStatuses.SUPERSEDED, 8);
  expectCount(
    errors,
    "Reviewed trade-in records",
    fixtures.reviewedTradeInRecords.length,
    9,
  );
  expectCount(
    errors,
    "Human review learning events",
    fixtures.humanReviewLearningEvents.length,
    0,
  );

  const reviewRequiredRecordIds = new Set(
    activeRecords
      .filter((record) => record.reviewNeeded)
      .map((record) => record.id),
  );
  const activeReviewRecordIds = new Set(
    fixtures.reviewQueueItems
      .filter((item) => item.status === "OPEN" || item.status === "IN_REVIEW")
      .flatMap((item) => {
        const recordId = activeRecords.find(
          (record) => record.intakeItemId === item.intakeItemId,
        )?.id;

        return recordId ? [recordId] : [];
      }),
  );

  if (
    reviewRequiredRecordIds.size !== activeReviewRecordIds.size ||
    [...reviewRequiredRecordIds].some(
      (recordId) => !activeReviewRecordIds.has(recordId),
    )
  ) {
    errors.push(
      "Active review items do not map one-to-one to review-required records.",
    );
  }

  const reviewItemIds = new Set(
    fixtures.reviewQueueItems.map((item) => item.id),
  );

  for (const item of fixtures.reviewQueueItems.filter(
    (reviewItem) => reviewItem.status === "SUPERSEDED",
  )) {
    if (
      !item.supersededByReviewQueueItemId ||
      !reviewItemIds.has(item.supersededByReviewQueueItemId)
    ) {
      errors.push(`${item.id} does not link to a replacement review item.`);
    }
  }

  for (const item of fixtures.reviewQueueItems) {
    if (
      !intakeItemIds.has(item.intakeItemId) ||
      !workflowRunIds.has(item.workflowRunId)
    ) {
      errors.push(`${item.id} has an invalid intake or workflow relationship.`);
    }
  }

  for (const record of fixtures.reviewedTradeInRecords) {
    if (
      !reviewItemIds.has(record.reviewQueueItemId) ||
      !intakeItemIds.has(record.intakeItemId) ||
      !workflowRunIds.has(record.workflowRunId)
    ) {
      errors.push(`${record.id} has an invalid reviewed-record relationship.`);
    }
  }

  const attemptsByCall = new Map<string, number>();

  for (const attempt of fixtures.modelCallAttempts) {
    attemptsByCall.set(
      attempt.modelCallLogId,
      (attemptsByCall.get(attempt.modelCallLogId) ?? 0) + 1,
    );
  }

  const successfulAttempts = fixtures.modelCallAttempts.filter(
    (attempt) => attempt.status === "SUCCESS",
  ).length;
  const fallbackCalls = fixtures.modelCalls.filter(
    (call) => (attemptsByCall.get(call.id) ?? 0) > 1,
  ).length;
  const selectedRecords = fixtures.modelCalls.reduce(
    (total, call) => total + getSelectedRecordCount(call.requestJson),
    0,
  );
  const outcomeTypes = fixtures.modelCalls.flatMap((call) =>
    getOutcomeTypes(call.responseJson),
  );
  const outcomesByType = countBy(outcomeTypes, (outcomeType) => outcomeType);
  const totalTokens = fixtures.modelCalls.reduce(
    (total, call) => total + call.totalTokens,
    0,
  );
  const estimatedCostUsd =
    Math.round(
      fixtures.modelCalls.reduce(
        (total, call) => total + call.estimatedCostUsd,
        0,
      ) * 1_000_000,
    ) / 1_000_000;
  const averageLatencyMs = Math.round(
    fixtures.modelCalls.reduce((total, call) => total + call.latencyMs, 0) /
      fixtures.modelCalls.length,
  );

  expectCount(errors, "Logical model calls", fixtures.modelCalls.length, 20);
  expectCount(
    errors,
    "Provider attempts",
    fixtures.modelCallAttempts.length,
    22,
  );
  expectCount(errors, "Successful attempts", successfulAttempts, 20);
  expectCount(
    errors,
    "Non-successful attempts",
    fixtures.modelCallAttempts.length - successfulAttempts,
    2,
  );
  expectCount(errors, "Fallback calls", fallbackCalls, 2);
  expectCount(
    errors,
    "Direct OpenAI successes",
    fixtures.modelCallAttempts.filter(
      (attempt) =>
        attempt.provider === "OPENAI" && attempt.status === "SUCCESS",
    ).length,
    18,
  );
  expectCount(
    errors,
    "Mock fallback successes",
    fixtures.modelCallAttempts.filter(
      (attempt) => attempt.provider === "MOCK" && attempt.status === "SUCCESS",
    ).length,
    2,
  );
  expectCount(
    errors,
    "Provider timeouts",
    fixtures.modelCallAttempts.filter((attempt) => attempt.status === "TIMEOUT")
      .length,
    1,
  );
  expectCount(
    errors,
    "Provider rate limits",
    fixtures.modelCallAttempts.filter(
      (attempt) => attempt.status === "RATE_LIMITED",
    ).length,
    1,
  );
  expectCount(errors, "Selected model records", selectedRecords, 58);
  expectCount(errors, "Model record outcomes", outcomeTypes.length, 58);
  expectCount(
    errors,
    "Repair suggestions",
    outcomesByType.REPAIR_SUGGESTED,
    32,
  );
  expectCount(
    errors,
    "Candidate comparisons",
    outcomesByType.CANDIDATE_COMPARISON,
    14,
  );
  expectCount(
    errors,
    "No-safe-repair outcomes",
    outcomesByType.NO_SAFE_REPAIR,
    12,
  );
  expectCount(errors, "Model tokens", totalTokens, 28_600);

  if (estimatedCostUsd !== 0.0614) {
    errors.push(
      `Estimated model cost: expected 0.0614, received ${estimatedCostUsd}.`,
    );
  }

  expectCount(errors, "Average model latency", averageLatencyMs, 7_886);

  for (const call of fixtures.modelCalls) {
    if (
      !workflowRunIds.has(call.workflowRunId) ||
      !workflowStepIds.has(call.workflowStepId)
    ) {
      errors.push(`${call.id} has an invalid workflow relationship.`);
    }

    if (
      !isRecord(call.responseJson.validation) ||
      call.responseJson.validation.validationPassed !== true
    ) {
      errors.push(
        `${call.id} does not contain a successful validation result.`,
      );
    }
  }

  const modelCallIds = new Set(fixtures.modelCalls.map((call) => call.id));

  for (const attempt of fixtures.modelCallAttempts) {
    if (!modelCallIds.has(attempt.modelCallLogId)) {
      errors.push(`${attempt.id} does not link to a fixture model call.`);
    }
  }

  const toolCounts = countBy(fixtures.toolCalls, (call) => call.toolName);
  expectCount(
    errors,
    "Knowledge searches",
    toolCounts["swingops.knowledgeBase.search"],
    44,
  );
  expectCount(
    errors,
    "Catalog lookups",
    toolCounts["swingops.inventory.lookupProduct"],
    42,
  );
  expectCount(
    errors,
    "Valuation lookups",
    toolCounts["swingops.tradeInValuation.estimate"],
    38,
  );
  expectCount(
    errors,
    "Blocked mutations",
    fixtures.toolCalls.filter(
      (call) =>
        call.toolName === "swingops.inventory.createSku" &&
        call.status === "BLOCKED",
    ).length,
    2,
  );

  for (const call of fixtures.toolCalls) {
    if (
      !workflowRunIds.has(call.workflowRunId) ||
      !workflowStepIds.has(call.workflowStepId)
    ) {
      errors.push(`${call.id} has an invalid workflow relationship.`);
    }
  }

  for (const collection of [
    fixtures.intakeBatches,
    fixtures.workflowRuns,
    fixtures.aiReadyRecords,
    fixtures.reviewQueueItems,
    fixtures.reviewedTradeInRecords,
    fixtures.modelCalls,
    fixtures.toolCalls,
  ]) {
    for (const fixture of collection) {
      if (fixture.dataOrigin !== "SEEDED_BASELINE") {
        errors.push(`${fixture.id} is not isolated as SEEDED_BASELINE.`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid Admin Ops baseline fixtures:\n- ${errors.join("\n- ")}`,
    );
  }

  return {
    aiReadyRecords: {
      total: fixtures.aiReadyRecords.length,
      active: activeRecords.length,
      superseded: supersededRecords.length,
      readyForRag: recordStatuses.READY_FOR_RAG ?? 0,
      needsReview: recordStatuses.NEEDS_REVIEW ?? 0,
      last24Hours,
    },
    workflowRuns: {
      total: fixtures.workflowRuns.length,
      completed: workflowStatuses.COMPLETED ?? 0,
      needsReview: workflowStatuses.NEEDS_REVIEW ?? 0,
      failed: workflowStatuses.FAILED ?? 0,
    },
    reviewQueueItems: {
      total: fixtures.reviewQueueItems.length,
      open: reviewStatuses.OPEN ?? 0,
      inReview: reviewStatuses.IN_REVIEW ?? 0,
      resolved: reviewStatuses.RESOLVED ?? 0,
      superseded: reviewStatuses.SUPERSEDED ?? 0,
    },
    modelTelemetry: {
      logicalCalls: fixtures.modelCalls.length,
      providerAttempts: fixtures.modelCallAttempts.length,
      successfulAttempts,
      nonSuccessfulAttempts:
        fixtures.modelCallAttempts.length - successfulAttempts,
      fallbackCalls,
      selectedRecords,
      recordOutcomes: outcomeTypes.length,
      repairSuggestions: outcomesByType.REPAIR_SUGGESTED ?? 0,
      candidateComparisons: outcomesByType.CANDIDATE_COMPARISON ?? 0,
      noSafeRepairOutcomes: outcomesByType.NO_SAFE_REPAIR ?? 0,
      totalTokens,
      estimatedCostUsd,
      averageLatencyMs,
    },
  };
}
