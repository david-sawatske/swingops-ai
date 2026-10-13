export type BaselineSourceType =
  "FREE_TEXT" | "POORLY_FORMED_CSV" | "EMAIL" | "LOG";

export type BaselineScenario =
  | "CLEAN_COUNTER_NOTE"
  | "RECOGNIZED_SHORTHAND"
  | "MALFORMED_CSV_ROW"
  | "DEGRADED_LOG_PAYLOAD"
  | "AMBIGUOUS_CATALOG_IDENTITY"
  | "UNKNOWN_PRODUCT_LINE"
  | "NEGATIVE_EVIDENCE"
  | "STORE_INSPECTION"
  | "HUMAN_CORRECTION"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RATE_LIMIT"
  | "UNSAFE_MUTATION"
  | "SOURCE_PROCESSING_FAILURE";

export type BaselineIntakeBatchFixture = {
  id: string;
  name: string;
  description: string;
  sourceType: "FREEFORM_NOTES" | "BAD_CSV" | "EMAIL" | "MANUAL_ENTRY";
  status: "COMPLETED" | "FAILED" | "NEEDS_REVIEW";
  itemCount: number;
  dataOrigin: "SEEDED_BASELINE";
  createdAt: Date;
  updatedAt: Date;
};

export type BaselineIntakeItemFixture = {
  id: string;
  intakeBatchId: string;
  rawText: string;
  sourceRowNumber: number;
  status: "STRUCTURED" | "NEEDS_REVIEW";
  createdAt: Date;
  updatedAt: Date;
};

export type BaselineWorkflowRunFixture = {
  id: string;
  intakeBatchId: string;
  intakeItemId: null;
  workflowName: string;
  status: "COMPLETED" | "FAILED" | "NEEDS_REVIEW";
  dataOrigin: "SEEDED_BASELINE";
  startedAt: Date;
  completedAt: Date;
  errorMessage: string | null;
  failureJson: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BaselineWorkflowStepFixture = {
  id: string;
  workflowRunId: string;
  stepName: string;
  stepType:
    | "PARSE_INPUT"
    | "NORMALIZE_DATA"
    | "RETRIEVE_EVIDENCE"
    | "EXTRACT_GOLF_CLUB_FIELDS"
    | "FINALIZE_WORKFLOW";
  status: "COMPLETED" | "FAILED";
  orderIndex: number;
  inputJson: Record<string, unknown> | null;
  outputJson: Record<string, unknown> | null;
  errorMessage: string | null;
  retryCount: number;
  startedAt: Date;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type BaselineAiReadyRecordFixture = {
  id: string;
  intakeBatchId: string;
  intakeItemId: string;
  workflowRunId: string;
  sourceRecordId: string;
  sourceType: BaselineSourceType;
  sourceName: string;
  rawText: string;
  cleanedText: string;
  normalizedJson: Record<string, unknown>;
  inferredSchemaJson: null;
  metadataJson: Record<string, unknown>;
  qualitySignalsJson: Array<Record<string, unknown>>;
  status: "READY_FOR_RAG" | "NEEDS_REVIEW" | "SUPERSEDED";
  reviewNeeded: boolean;
  dataOrigin: "SEEDED_BASELINE";
  embeddingReady: boolean;
  ragReady: boolean;
  supersededByAiReadyIntakeRecordId: string | null;
  supersededAt: Date | null;
  supersededReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BaselineReviewQueueItemFixture = {
  id: string;
  intakeItemId: string;
  golfClubId: null;
  workflowRunId: string;
  reason: "MISSING_REQUIRED_FIELDS" | "LOW_CONFIDENCE" | "AMBIGUOUS_INPUT";
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "SUPERSEDED";
  dataOrigin: "SEEDED_BASELINE";
  originalText: string;
  proposedGolfClubJson: Record<string, unknown>;
  reviewerNotes: string | null;
  resolvedAt: Date | null;
  supersededByReviewQueueItemId: string | null;
  supersededAt: Date | null;
  supersededReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BaselineReviewedTradeInRecordFixture = {
  id: string;
  reviewQueueItemId: string;
  workflowRunId: string;
  intakeItemId: string;
  originalText: string;
  correctedBrand: string | null;
  correctedProductLine: string | null;
  correctedCategory: string | null;
  correctedShaftFlex: string | null;
  correctedConditionGrade: string | null;
  conditionEvidenceText: string | null;
  correctedDemoValue: number | null;
  demoValuationNote: string;
  reviewerNotes: string;
  approvedAt: Date;
  dataOrigin: "SEEDED_BASELINE";
  createdAt: Date;
  updatedAt: Date;
};

export type BaselineModelCallFixture = {
  id: string;
  workflowRunId: string;
  workflowStepId: string;
  provider: "OPENAI" | "MOCK";
  model: string;
  status: "SUCCEEDED";
  dataOrigin: "SEEDED_BASELINE";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  requestJson: Record<string, unknown>;
  responseJson: Record<string, unknown>;
  errorMessage: null;
  startedAt: Date;
  completedAt: Date;
  createdAt: Date;
};

export type BaselineModelCallAttemptFixture = {
  id: string;
  modelCallLogId: string;
  provider: "OPENAI" | "MOCK";
  model: string;
  attemptOrder: number;
  status: "SUCCESS" | "TIMEOUT" | "RATE_LIMITED";
  reason: string;
  errorMessage: string | null;
  latencyMs: number;
  estimatedCostUsd: number;
  startedAt: Date;
  completedAt: Date;
  createdAt: Date;
};

export type BaselineToolCallFixture = {
  id: string;
  workflowRunId: string;
  workflowStepId: string;
  toolName: string;
  status: "SUCCEEDED" | "FAILED" | "BLOCKED";
  dataOrigin: "SEEDED_BASELINE";
  inputJson: Record<string, unknown>;
  outputJson: Record<string, unknown>;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date;
  createdAt: Date;
};

export type AdminOpsBaselineFixtures = {
  anchor: Date;
  intakeBatches: BaselineIntakeBatchFixture[];
  intakeItems: BaselineIntakeItemFixture[];
  workflowRuns: BaselineWorkflowRunFixture[];
  workflowSteps: BaselineWorkflowStepFixture[];
  aiReadyRecords: BaselineAiReadyRecordFixture[];
  reviewQueueItems: BaselineReviewQueueItemFixture[];
  reviewedTradeInRecords: BaselineReviewedTradeInRecordFixture[];
  humanReviewLearningEvents: [];
  modelCalls: BaselineModelCallFixture[];
  modelCallAttempts: BaselineModelCallAttemptFixture[];
  toolCalls: BaselineToolCallFixture[];
};
