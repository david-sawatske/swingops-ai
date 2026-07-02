import type { MultiSourceIntakeRecord, MultiSourceIntakeSchemaField, MultiSourceIntakeSourceResult, MultiSourceIntakeSourceType } from "./multiSourceIntake";

export type AiReadyIntakeRecordStatus =
  | "READY_FOR_REVIEW"
  | "READY_FOR_RAG"
  | "NEEDS_REVIEW";

export type AiReadyIntakeRecord = {
  id: string;
  intakeBatchId: string | null;
  intakeItemId: string | null;
  workflowRunId: string | null;
  sourceRecordId: string | null;
  sourceType: MultiSourceIntakeSourceType;
  sourceName: string;
  rawText: string;
  cleanedText: string;
  normalizedJson: MultiSourceIntakeRecord;
  inferredSchemaJson: MultiSourceIntakeSchemaField[] | null;
  metadataJson: MultiSourceIntakeSourceResult["metadata"] | null;
  qualitySignalsJson: MultiSourceIntakeSourceResult["qualitySignals"] | null;
  status: AiReadyIntakeRecordStatus;
  reviewNeeded: boolean;
  embeddingReady: boolean;
  ragReady: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ListAiReadyIntakeRecordsResponse = {
  records: AiReadyIntakeRecord[];
  count: number;
};

export type GetAiReadyIntakeRecordResponse = {
  record: AiReadyIntakeRecord;
};
