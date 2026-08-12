import type {
  AdminOpsBaselineFixtures,
  BaselineAiReadyRecordFixture,
  BaselineModelCallAttemptFixture,
  BaselineModelCallFixture,
  BaselineReviewQueueItemFixture,
  BaselineScenario,
  BaselineSourceType,
} from "./admin-ops-baseline-types.js";
import { validateAdminOpsBaselineFixtures } from "./admin-ops-baseline-validation.js";

export const ADMIN_OPS_BASELINE_ID_PREFIX = "admin_ops_baseline";

const HOUR_MS = 60 * 60 * 1_000;
const DATA_ORIGIN = "SEEDED_BASELINE" as const;

const SOURCE_DEFINITIONS = {
  FREE_TEXT: {
    name: "Store counter notes",
    active: 18,
    ready: 12,
  },
  POORLY_FORMED_CSV: {
    name: "Nightly trade-in CSV export",
    active: 12,
    ready: 9,
  },
  EMAIL: {
    name: "Trade-in desk email",
    active: 10,
    ready: 8,
  },
  LOG: {
    name: "Operations intake log",
    active: 8,
    ready: 2,
  },
} as const;

const CATEGORY_SEQUENCE = [
  ...Array<string | null>(14).fill("DRIVER"),
  ...Array<string | null>(8).fill("PUTTER"),
  ...Array<string | null>(8).fill("WEDGE"),
  ...Array<string | null>(7).fill("FAIRWAY_WOOD"),
  ...Array<string | null>(6).fill("IRON_SET"),
  ...Array<string | null>(4).fill("HYBRID"),
  null,
] as const;

const PRODUCT_BY_CATEGORY = {
  DRIVER: ["TaylorMade", "Stealth 2"],
  PUTTER: ["Odyssey", "White Hot OG"],
  WEDGE: ["Cleveland", "RTX 6 ZipCore"],
  FAIRWAY_WOOD: ["Titleist", "TSR"],
  IRON_SET: ["PING", "G425"],
  HYBRID: ["Callaway", "Paradym"],
} as const;

const REVIEW_MISSING_FIELDS = [
  ["conditionGrade", "shaftFlex", "tradeInValue", "productLine", "category"],
  ["conditionGrade", "shaftFlex", "tradeInValue", "productLine"],
  ["conditionGrade", "shaftFlex", "tradeInValue", "productLine"],
  ["conditionGrade", "shaftFlex", "tradeInValue"],
  ["conditionGrade", "shaftFlex", "tradeInValue"],
  ["conditionGrade", "shaftFlex", "tradeInValue"],
  ["conditionGrade", "shaftFlex"],
  ["conditionGrade"],
  ["conditionGrade"],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [
    "brand",
    "productLine",
    "category",
    "shaftFlex",
    "conditionGrade",
    "tradeInValue",
  ],
] as const;

const REVIEW_SCENARIOS: BaselineScenario[] = [
  "AMBIGUOUS_CATALOG_IDENTITY",
  "UNKNOWN_PRODUCT_LINE",
  "NEGATIVE_EVIDENCE",
  "STORE_INSPECTION",
  "NEGATIVE_EVIDENCE",
  "STORE_INSPECTION",
  "MALFORMED_CSV_ROW",
  "MALFORMED_CSV_ROW",
  "MALFORMED_CSV_ROW",
  "AMBIGUOUS_CATALOG_IDENTITY",
  "STORE_INSPECTION",
  "DEGRADED_LOG_PAYLOAD",
  "DEGRADED_LOG_PAYLOAD",
  "DEGRADED_LOG_PAYLOAD",
  "DEGRADED_LOG_PAYLOAD",
  "DEGRADED_LOG_PAYLOAD",
  "DEGRADED_LOG_PAYLOAD",
];

const REPLACEMENT_ACTIVE_INDEXES = [0, 1, 2, 15, 16, 21, 29, 30];
const RESOLVED_ACTIVE_INDEXES = [...REPLACEMENT_ACTIVE_INDEXES, 3];

type ActiveRecordDefinition = {
  activeIndex: number;
  sourceType: BaselineSourceType;
  sourceOrdinal: number;
  ready: boolean;
  reviewOrdinal: number | null;
  storeId: string;
  category: string | null;
  scenario: BaselineScenario;
  workflowIndex: number;
};

function dateBefore(anchor: Date, milliseconds: number): Date {
  return new Date(anchor.getTime() - milliseconds);
}

function id(type: string, value: number): string {
  return `${ADMIN_OPS_BASELINE_ID_PREFIX}_${type}_${String(value).padStart(2, "0")}`;
}

function getStoreId(sourceType: BaselineSourceType, ordinal: number): string {
  if (sourceType === "FREE_TEXT") {
    return "104";
  }

  if (sourceType === "POORLY_FORMED_CSV") {
    return ordinal < 3 ? "104" : "207";
  }

  if (sourceType === "EMAIL") {
    return ordinal < 7 ? "207" : "312";
  }

  return "312";
}

function getWorkflowIndex(ready: boolean, ordinal: number): number {
  const readyRunSizes = [4, 4, 4, 4, 4, 4, 4, 3];
  const reviewRunSizes = [4, 4, 3, 3, 3];
  const runSizes = ready ? readyRunSizes : reviewRunSizes;
  let consumed = 0;

  for (let index = 0; index < runSizes.length; index += 1) {
    consumed += runSizes[index] ?? 0;

    if (ordinal < consumed) {
      return ready ? index : index + readyRunSizes.length;
    }
  }

  throw new Error("Baseline record could not be assigned to a workflow run.");
}

function buildActiveDefinitions(): ActiveRecordDefinition[] {
  const readyDefinitions: Omit<
    ActiveRecordDefinition,
    "activeIndex" | "category" | "workflowIndex"
  >[] = [];
  const reviewDefinitions: Omit<
    ActiveRecordDefinition,
    "activeIndex" | "category" | "workflowIndex"
  >[] = [];
  let reviewOrdinal = 0;

  for (const sourceType of Object.keys(
    SOURCE_DEFINITIONS,
  ) as BaselineSourceType[]) {
    const definition = SOURCE_DEFINITIONS[sourceType];

    for (
      let sourceOrdinal = 0;
      sourceOrdinal < definition.active;
      sourceOrdinal += 1
    ) {
      const ready = sourceOrdinal < definition.ready;
      const scenario: BaselineScenario = ready
        ? sourceOrdinal % 2 === 0
          ? "CLEAN_COUNTER_NOTE"
          : "RECOGNIZED_SHORTHAND"
        : (REVIEW_SCENARIOS[reviewOrdinal] ?? "STORE_INSPECTION");
      const record = {
        sourceType,
        sourceOrdinal,
        ready,
        reviewOrdinal: ready ? null : reviewOrdinal,
        storeId: getStoreId(sourceType, sourceOrdinal),
        scenario,
      };

      if (ready) {
        readyDefinitions.push(record);
      } else {
        reviewDefinitions.push(record);
        reviewOrdinal += 1;
      }
    }
  }

  return [...readyDefinitions, ...reviewDefinitions].map(
    (definition, activeIndex) => ({
      ...definition,
      activeIndex,
      category: CATEGORY_SEQUENCE[activeIndex] ?? null,
      workflowIndex: getWorkflowIndex(
        definition.ready,
        definition.ready ? activeIndex : activeIndex - readyDefinitions.length,
      ),
    }),
  );
}

function getRecordCreatedAt(anchor: Date, index: number): Date {
  if (index < 9) {
    return dateBefore(anchor, (index + 2) * 2 * HOUR_MS);
  }

  return dateBefore(anchor, (30 + (index - 9) * 3) * HOUR_MS);
}

function getProductFields(category: string | null, activeIndex: number) {
  if (category === null) {
    return {
      brand: null,
      productLine: null,
      category: null,
    };
  }

  const [brand, baseProductLine] =
    PRODUCT_BY_CATEGORY[category as keyof typeof PRODUCT_BY_CATEGORY];

  return {
    brand,
    productLine: `${baseProductLine}${activeIndex % 3 === 0 ? "" : ` ${activeIndex % 3}`}`,
    category,
  };
}

function getRawText(input: {
  brand: string | null;
  productLine: string | null;
  category: string | null;
  storeId: string;
  sourceType: BaselineSourceType;
  scenario: BaselineScenario;
}) {
  const product = [input.brand, input.productLine, input.category]
    .filter(Boolean)
    .join(" ");
  const base = `${product || "unknown club"}; shaft stiff; condition average; trade value $145; store ${input.storeId}`;

  if (input.scenario === "AMBIGUOUS_CATALOG_IDENTITY") {
    return `${base}; catalog match could be one of two current products`;
  }

  if (input.scenario === "UNKNOWN_PRODUCT_LINE") {
    return `Callaway mystery club; product line unknown; category driver; store ${input.storeId}`;
  }

  if (input.scenario === "NEGATIVE_EVIDENCE") {
    return `${product}; shaft unknown; condition pending; value TBD; store ${input.storeId}`;
  }

  if (input.scenario === "STORE_INSPECTION") {
    return `${product}; physical inspection required; details not listed; store ${input.storeId}`;
  }

  if (input.sourceType === "POORLY_FORMED_CSV") {
    return `${input.storeId},${input.brand ?? ""},${input.productLine ?? ""},${input.category ?? ""},shaft=stf,,145`;
  }

  if (input.sourceType === "EMAIL") {
    return `Trade-in desk note: ${base}. Please verify before close.`;
  }

  if (input.sourceType === "LOG") {
    return `store=${input.storeId}|club=${product}|flex:?|condition:?|valuation:pending`;
  }

  return base;
}

function buildAiReadyRecord(
  definition: ActiveRecordDefinition,
  anchor: Date,
): BaselineAiReadyRecordFixture {
  const recordId = id("record", definition.activeIndex + 1);
  const product = getProductFields(definition.category, definition.activeIndex);
  const missingFields =
    definition.reviewOrdinal === null
      ? []
      : [...(REVIEW_MISSING_FIELDS[definition.reviewOrdinal] ?? [])];
  const rawText = getRawText({
    ...product,
    storeId: definition.storeId,
    sourceType: definition.sourceType,
    scenario: definition.scenario,
  });
  const createdAt = getRecordCreatedAt(anchor, definition.activeIndex);

  return {
    id: recordId,
    intakeBatchId: id("batch", definition.workflowIndex + 1),
    intakeItemId: id("item", definition.activeIndex + 1),
    workflowRunId: id("workflow", definition.workflowIndex + 1),
    sourceRecordId: `store-${definition.storeId}-${String(definition.activeIndex + 1).padStart(3, "0")}`,
    sourceType: definition.sourceType,
    sourceName: `${SOURCE_DEFINITIONS[definition.sourceType].name} · Store ${definition.storeId}`,
    rawText,
    cleanedText: rawText.replace(/\s+/g, " ").trim(),
    normalizedJson: {
      id: recordId,
      sourceId: id("batch", definition.workflowIndex + 1),
      sourceType: definition.sourceType,
      ...product,
      shaftFlex: missingFields.includes("shaftFlex") ? null : "STIFF",
      conditionGrade: missingFields.includes("conditionGrade")
        ? null
        : "8.0 Average",
      tradeInValue: missingFields.includes("tradeInValue") ? null : 145,
      customerName: null,
      customerEmail: null,
      storeId: definition.storeId,
      eventTimestamp: createdAt.toISOString(),
      attachmentsMentioned: [],
      missingFields,
      confidence: definition.ready ? 0.94 : 0.62,
      reviewNeeded: !definition.ready,
      sourceText: rawText,
      normalizedText: rawText.toLowerCase(),
    },
    inferredSchemaJson: null,
    metadataJson: {
      syntheticBaseline: true,
      storeId: definition.storeId,
      scenario: definition.scenario,
    },
    qualitySignalsJson: definition.ready
      ? []
      : [
          {
            signal: definition.scenario,
            severity: "REVIEW",
            message: "Source evidence requires bounded human verification.",
          },
        ],
    status: definition.ready ? "READY_FOR_RAG" : "NEEDS_REVIEW",
    reviewNeeded: !definition.ready,
    dataOrigin: DATA_ORIGIN,
    embeddingReady: definition.ready,
    ragReady: definition.ready,
    supersededByAiReadyIntakeRecordId: null,
    supersededAt: null,
    supersededReason: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildSupersededRecords(
  activeRecords: BaselineAiReadyRecordFixture[],
  anchor: Date,
): BaselineAiReadyRecordFixture[] {
  return REPLACEMENT_ACTIVE_INDEXES.map((activeIndex, historyIndex) => {
    const replacement = activeRecords[activeIndex];

    if (!replacement) {
      throw new Error("Baseline replacement record is missing.");
    }

    const createdAt = dateBefore(anchor, (historyIndex + 4) * 12 * HOUR_MS);
    const normalizedJson = {
      ...replacement.normalizedJson,
      id: id("history_record", historyIndex + 1),
      missingFields: ["conditionGrade"],
      reviewNeeded: true,
    };

    return {
      ...replacement,
      id: id("history_record", historyIndex + 1),
      sourceRecordId: `${replacement.sourceRecordId}-previous`,
      sourceName: `${replacement.sourceName} · replaced candidate`,
      normalizedJson,
      metadataJson: {
        ...replacement.metadataJson,
        scenario: "HUMAN_CORRECTION",
      },
      qualitySignalsJson: [
        {
          signal: "HUMAN_CORRECTION",
          severity: "INFO",
          message: "A reviewed correction replaced this upstream candidate.",
        },
      ],
      status: "SUPERSEDED",
      reviewNeeded: false,
      embeddingReady: false,
      ragReady: false,
      supersededByAiReadyIntakeRecordId: replacement.id,
      supersededAt: replacement.createdAt,
      supersededReason:
        "Replaced by later reviewed workflow output; retained for provenance.",
      createdAt,
      updatedAt: replacement.createdAt,
    };
  });
}

function reviewReason(record: BaselineAiReadyRecordFixture) {
  const scenario = record.metadataJson.scenario;

  if (scenario === "AMBIGUOUS_CATALOG_IDENTITY") {
    return "AMBIGUOUS_INPUT" as const;
  }

  if (scenario === "NEGATIVE_EVIDENCE") {
    return "LOW_CONFIDENCE" as const;
  }

  return "MISSING_REQUIRED_FIELDS" as const;
}

function buildReviewQueueItems(
  activeRecords: BaselineAiReadyRecordFixture[],
  supersededRecords: BaselineAiReadyRecordFixture[],
): BaselineReviewQueueItemFixture[] {
  const resolved = RESOLVED_ACTIVE_INDEXES.map((activeIndex, index) => {
    const record = activeRecords[activeIndex];

    if (!record) {
      throw new Error("Baseline resolved review record is missing.");
    }

    return {
      id: id("review_resolved", index + 1),
      intakeItemId: record.intakeItemId,
      golfClubId: null,
      workflowRunId: record.workflowRunId,
      reason: "MISSING_REQUIRED_FIELDS" as const,
      status: "RESOLVED" as const,
      dataOrigin: DATA_ORIGIN,
      originalText: record.rawText,
      proposedGolfClubJson: record.normalizedJson,
      reviewerNotes:
        "Verified source details and preserved the reviewed replacement.",
      resolvedAt: record.createdAt,
      supersededByReviewQueueItemId: null,
      supersededAt: null,
      supersededReason: null,
      createdAt: dateBefore(record.createdAt, 2 * HOUR_MS),
      updatedAt: record.createdAt,
    };
  });
  const activeReviews = activeRecords
    .filter((record) => record.reviewNeeded)
    .map((record, index) => ({
      id: id("review_active", index + 1),
      intakeItemId: record.intakeItemId,
      golfClubId: null,
      workflowRunId: record.workflowRunId,
      reason: reviewReason(record),
      status: index < 10 ? ("OPEN" as const) : ("IN_REVIEW" as const),
      dataOrigin: DATA_ORIGIN,
      originalText: record.rawText,
      proposedGolfClubJson: record.normalizedJson,
      reviewerNotes:
        index < 10
          ? null
          : "Assigned to store verification; no unsupported value has been applied.",
      resolvedAt: null,
      supersededByReviewQueueItemId: null,
      supersededAt: null,
      supersededReason: null,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
    }));
  const supersededReviews = supersededRecords.map((record, index) => {
    const replacementReview = resolved[index];

    if (!replacementReview) {
      throw new Error("Baseline replacement review item is missing.");
    }

    return {
      id: id("review_history", index + 1),
      intakeItemId: record.intakeItemId,
      golfClubId: null,
      workflowRunId: record.workflowRunId,
      reason: "MISSING_REQUIRED_FIELDS" as const,
      status: "SUPERSEDED" as const,
      dataOrigin: DATA_ORIGIN,
      originalText: record.rawText,
      proposedGolfClubJson: record.normalizedJson,
      reviewerNotes: "Retained as replaced review history.",
      resolvedAt: null,
      supersededByReviewQueueItemId: replacementReview.id,
      supersededAt: replacementReview.resolvedAt,
      supersededReason:
        "A later reviewed output replaced this upstream review candidate.",
      createdAt: record.createdAt,
      updatedAt: replacementReview.updatedAt,
    };
  });

  return [...activeReviews, ...resolved, ...supersededReviews];
}

function buildModelTelemetry(
  anchor: Date,
  workflowSteps: AdminOpsBaselineFixtures["workflowSteps"],
): {
  modelCalls: BaselineModelCallFixture[];
  modelCallAttempts: BaselineModelCallAttemptFixture[];
} {
  const outcomeTypes = [
    ...Array<string>(32).fill("REPAIR_SUGGESTED"),
    ...Array<string>(14).fill("CANDIDATE_COMPARISON"),
    ...Array<string>(12).fill("NO_SAFE_REPAIR"),
  ];
  let outcomeIndex = 0;
  const modelCalls: BaselineModelCallFixture[] = [];
  const modelCallAttempts: BaselineModelCallAttemptFixture[] = [];

  for (let index = 0; index < 20; index += 1) {
    const selectedRecordCount = index < 18 ? 3 : 2;
    const selectedOutcomes = outcomeTypes
      .slice(outcomeIndex, outcomeIndex + selectedRecordCount)
      .map((outcomeType, recordIndex) => ({
        recordId: `assessed-${index + 1}-${recordIndex + 1}`,
        outcomeType,
      }));
    outcomeIndex += selectedRecordCount;
    const timeoutFallback = index === 18;
    const rateLimitFallback = index === 19;
    const usesFallback = timeoutFallback || rateLimitFallback;
    const callId = id("model_call", index + 1);
    const workflowIndex = index % 13;
    const workflowStep = workflowSteps.find(
      (step) =>
        step.workflowRunId === id("workflow", workflowIndex + 1) &&
        step.stepType === "RETRIEVE_EVIDENCE",
    );

    if (!workflowStep) {
      throw new Error("Baseline model-call workflow step is missing.");
    }

    const startedAt = dateBefore(anchor, (index + 8) * 6 * HOUR_MS);
    const latencyMs = timeoutFallback
      ? 25_000
      : rateLimitFallback
        ? 15_720
        : 6_500;
    const estimatedCostUsd = rateLimitFallback ? 0.0044 : 0.003;
    const provider = usesFallback ? "MOCK" : "OPENAI";
    const model = usesFallback ? "mock-golf-workflow-model" : "gpt-4.1-mini";
    const records = Array.from(
      { length: selectedRecordCount },
      (_, recordIndex) => ({
        id: `assessed-${index + 1}-${recordIndex + 1}`,
      }),
    );

    modelCalls.push({
      id: callId,
      workflowRunId: id("workflow", workflowIndex + 1),
      workflowStepId: workflowStep.id,
      provider,
      model,
      status: "SUCCEEDED",
      dataOrigin: DATA_ORIGIN,
      promptTokens: 1_050,
      completionTokens: 380,
      totalTokens: 1_430,
      latencyMs,
      estimatedCostUsd,
      requestJson: {
        policyKey: "MAIN_RUN_FIELD_REPAIR",
        agentName: "main-run-field-repair-agent",
        outputSchema: {
          name: "main_run_field_repair",
          version: "1.0",
          strict: true,
        },
        inputJson: { records },
        baselineScenario: timeoutFallback
          ? "PROVIDER_TIMEOUT"
          : rateLimitFallback
            ? "PROVIDER_RATE_LIMIT"
            : "VALIDATED_ASSISTANCE",
      },
      responseJson: {
        validation: {
          jsonValid: true,
          validationPassed: true,
          validationErrors: [],
        },
        providerExecution: {
          outputJson: {
            parsedJson: { recordOutcomes: selectedOutcomes },
          },
        },
      },
      errorMessage: null,
      startedAt,
      completedAt: new Date(startedAt.getTime() + latencyMs),
      createdAt: startedAt,
    });

    if (usesFallback) {
      const failedLatency = timeoutFallback ? 10_000 : 1_000;
      modelCallAttempts.push({
        id: id("model_attempt", modelCallAttempts.length + 1),
        modelCallLogId: callId,
        provider: "OPENAI",
        model: "gpt-4.1-mini",
        attemptOrder: 1,
        status: timeoutFallback ? "TIMEOUT" : "RATE_LIMITED",
        reason: timeoutFallback
          ? "Provider attempt exceeded the configured deadline."
          : "Provider returned a retryable rate limit response.",
        errorMessage: timeoutFallback
          ? "Preferred provider timed out."
          : "Preferred provider was rate limited.",
        latencyMs: failedLatency,
        estimatedCostUsd: 0,
        startedAt,
        completedAt: new Date(startedAt.getTime() + failedLatency),
        createdAt: startedAt,
      });
      modelCallAttempts.push({
        id: id("model_attempt", modelCallAttempts.length + 1),
        modelCallLogId: callId,
        provider: "MOCK",
        model: "mock-golf-workflow-model",
        attemptOrder: 2,
        status: "SUCCESS",
        reason: "Fallback provider returned schema-valid advisory output.",
        errorMessage: null,
        latencyMs: latencyMs - failedLatency,
        estimatedCostUsd,
        startedAt: new Date(startedAt.getTime() + failedLatency),
        completedAt: new Date(startedAt.getTime() + latencyMs),
        createdAt: startedAt,
      });
    } else {
      modelCallAttempts.push({
        id: id("model_attempt", modelCallAttempts.length + 1),
        modelCallLogId: callId,
        provider: "OPENAI",
        model: "gpt-4.1-mini",
        attemptOrder: 1,
        status: "SUCCESS",
        reason: "Preferred provider returned schema-valid advisory output.",
        errorMessage: null,
        latencyMs,
        estimatedCostUsd,
        startedAt,
        completedAt: new Date(startedAt.getTime() + latencyMs),
        createdAt: startedAt,
      });
    }
  }

  return { modelCalls, modelCallAttempts };
}

export function buildAdminOpsBaselineFixtures(
  anchor: Date = new Date(),
): AdminOpsBaselineFixtures {
  const normalizedAnchor = new Date(anchor);

  if (Number.isNaN(normalizedAnchor.getTime())) {
    throw new Error("The Admin Ops baseline anchor must be a valid date.");
  }

  const definitions = buildActiveDefinitions();
  const activeRecords = definitions.map((definition) =>
    buildAiReadyRecord(definition, normalizedAnchor),
  );
  const supersededRecords = buildSupersededRecords(
    activeRecords,
    normalizedAnchor,
  );
  const workflowRuns = Array.from({ length: 14 }, (_, index) => {
    const failed = index === 13;
    const needsReview = index >= 8 && index < 13;
    const startedAt = dateBefore(normalizedAnchor, (index + 1) * 11 * HOUR_MS);
    const completedAt = new Date(
      startedAt.getTime() + (failed ? 90_000 : 420_000),
    );

    return {
      id: id("workflow", index + 1),
      intakeBatchId: id("batch", index + 1),
      intakeItemId: null,
      workflowName: failed
        ? "multi-source-intake-source-processing"
        : "guarded-trade-in-operational-run",
      status: failed
        ? ("FAILED" as const)
        : needsReview
          ? ("NEEDS_REVIEW" as const)
          : ("COMPLETED" as const),
      dataOrigin: DATA_ORIGIN,
      startedAt,
      completedAt,
      errorMessage: failed
        ? "Store 207 CSV header did not contain a recoverable record boundary."
        : null,
      failureJson: failed
        ? {
            classification: "SOURCE_PROCESSING_FAILURE",
            retryable: true,
            operatorAction:
              "Verify the export format and rerun the intake batch.",
          }
        : null,
      createdAt: startedAt,
      updatedAt: completedAt,
    };
  });
  const recordCountsByWorkflow = definitions.reduce<Record<number, number>>(
    (counts, definition) => ({
      ...counts,
      [definition.workflowIndex]: (counts[definition.workflowIndex] ?? 0) + 1,
    }),
    {},
  );
  const intakeBatches = workflowRuns.map((run, index) => ({
    id: id("batch", index + 1),
    name: `Operational intake · ${String(index + 1).padStart(2, "0")}`,
    description:
      index === 13
        ? "Source-processing failure retained for operational diagnosis."
        : "Synthetic seven-day operational baseline batch.",
    sourceType:
      index < 4
        ? ("FREEFORM_NOTES" as const)
        : index < 8
          ? ("BAD_CSV" as const)
          : index < 11
            ? ("EMAIL" as const)
            : ("MANUAL_ENTRY" as const),
    status: run.status,
    itemCount: recordCountsByWorkflow[index] ?? 0,
    dataOrigin: DATA_ORIGIN,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  }));
  const intakeItems = activeRecords.map((record, index) => ({
    id: record.intakeItemId,
    intakeBatchId: record.intakeBatchId,
    rawText: record.rawText,
    sourceRowNumber: index + 1,
    status: record.reviewNeeded
      ? ("NEEDS_REVIEW" as const)
      : ("STRUCTURED" as const),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
  const workflowSteps = workflowRuns.flatMap((run, runIndex) => {
    const failed = run.status === "FAILED";
    const stepDefinitions = failed
      ? ([["Parse source envelope", "PARSE_INPUT", "FAILED"]] as const)
      : ([
          ["Parse source records", "PARSE_INPUT", "COMPLETED"],
          ["Normalize source fields", "NORMALIZE_DATA", "COMPLETED"],
          ["Retrieve bounded evidence", "RETRIEVE_EVIDENCE", "COMPLETED"],
          ["Finalize operational result", "FINALIZE_WORKFLOW", "COMPLETED"],
        ] as const);

    return stepDefinitions.map(([stepName, stepType, status], stepIndex) => ({
      id: id("step", runIndex * 4 + stepIndex + 1),
      workflowRunId: run.id,
      stepName,
      stepType,
      status,
      orderIndex: stepIndex + 1,
      inputJson: { syntheticBaseline: true },
      outputJson: failed ? null : { completed: true, validationPassed: true },
      errorMessage: failed ? run.errorMessage : null,
      retryCount: 0,
      startedAt: new Date(run.startedAt.getTime() + stepIndex * 60_000),
      completedAt: new Date(run.startedAt.getTime() + (stepIndex + 1) * 60_000),
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    }));
  });
  const reviewQueueItems = buildReviewQueueItems(
    activeRecords,
    supersededRecords,
  );
  const reviewedTradeInRecords = reviewQueueItems
    .filter((item) => item.status === "RESOLVED")
    .map((item, index) => {
      const normalized = item.proposedGolfClubJson;
      const approvedAt = item.resolvedAt ?? item.updatedAt;

      return {
        id: id("reviewed_record", index + 1),
        reviewQueueItemId: item.id,
        workflowRunId: item.workflowRunId,
        intakeItemId: item.intakeItemId,
        originalText: item.originalText,
        correctedBrand:
          typeof normalized.brand === "string" ? normalized.brand : null,
        correctedProductLine:
          typeof normalized.productLine === "string"
            ? normalized.productLine
            : null,
        correctedCategory:
          typeof normalized.category === "string" ? normalized.category : null,
        correctedShaftFlex: "STIFF",
        correctedConditionGrade: "8.0 Average",
        conditionEvidenceText:
          "Store-confirmed condition during guided review.",
        correctedDemoValue: 145,
        demoValuationNote:
          "Synthetic range used only for the operational baseline.",
        reviewerNotes: "Verified correction retained with its source evidence.",
        approvedAt,
        dataOrigin: DATA_ORIGIN,
        createdAt: approvedAt,
        updatedAt: approvedAt,
      };
    });
  const modelTelemetry = buildModelTelemetry(normalizedAnchor, workflowSteps);
  const evidenceStepsByWorkflow = new Map(
    workflowSteps
      .filter((step) => step.stepType === "RETRIEVE_EVIDENCE")
      .map((step) => [step.workflowRunId, step]),
  );
  let toolIndex = 0;
  const toolCalls: AdminOpsBaselineFixtures["toolCalls"] =
    activeRecords.flatMap((record, index) => {
      const workflowStep = evidenceStepsByWorkflow.get(record.workflowRunId);

      if (!workflowStep) {
        throw new Error("Baseline tool-call workflow step is missing.");
      }

      const tools: Array<[string, Record<string, unknown>]> = [];

      if (index < 44) {
        tools.push([
          "swingops.knowledgeBase.search",
          { resultCount: 3, grounded: true },
        ]);
      }

      if (index < 42) {
        tools.push([
          "swingops.inventory.lookupProduct",
          { candidateCount: 1, supported: true },
        ]);
      }

      if (index < 38) {
        tools.push([
          "swingops.tradeInValuation.estimate",
          { rangeReturned: true },
        ]);
      }

      return tools.map(([toolName, outputJson]) => {
        toolIndex += 1;

        return {
          id: id("tool_call", toolIndex),
          workflowRunId: record.workflowRunId,
          workflowStepId: workflowStep.id,
          toolName,
          status: "SUCCEEDED" as const,
          dataOrigin: DATA_ORIGIN,
          inputJson: { recordId: record.id },
          outputJson,
          errorMessage: null,
          startedAt: record.createdAt,
          completedAt: new Date(record.createdAt.getTime() + 25),
          createdAt: record.createdAt,
        };
      });
    });

  for (let blockedIndex = 0; blockedIndex < 2; blockedIndex += 1) {
    const record = activeRecords[blockedIndex];

    if (!record) {
      throw new Error("Baseline blocked-tool record is missing.");
    }

    const workflowStep = evidenceStepsByWorkflow.get(record.workflowRunId);

    if (!workflowStep) {
      throw new Error("Baseline blocked-tool workflow step is missing.");
    }

    toolIndex += 1;
    toolCalls.push({
      id: id("tool_call", toolIndex),
      workflowRunId: record.workflowRunId,
      workflowStepId: workflowStep.id,
      toolName: "swingops.inventory.createSku",
      status: "FAILED",
      dataOrigin: DATA_ORIGIN,
      inputJson: { recordId: record.id, requestedMutation: true },
      outputJson: {
        policyDecision: "BLOCKED",
        reason: "Mutation tools are not authorized for this workflow.",
      },
      errorMessage: "Blocked by application-owned tool policy.",
      startedAt: record.createdAt,
      completedAt: new Date(record.createdAt.getTime() + 5),
      createdAt: record.createdAt,
    });
  }

  const fixtures: AdminOpsBaselineFixtures = {
    anchor: normalizedAnchor,
    intakeBatches,
    intakeItems,
    workflowRuns,
    workflowSteps,
    aiReadyRecords: [...activeRecords, ...supersededRecords],
    reviewQueueItems,
    reviewedTradeInRecords,
    humanReviewLearningEvents: [],
    modelCalls: modelTelemetry.modelCalls,
    modelCallAttempts: modelTelemetry.modelCallAttempts,
    toolCalls,
  };

  validateAdminOpsBaselineFixtures(fixtures);

  return fixtures;
}
