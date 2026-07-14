export type RecordSummary = {
  id: string;
  intakeItemId: string | null;
  sourceRecordId: string | null;
  sourceName: string;
  sourceType: string;
  supersededByAiReadyIntakeRecordId: string | null;
  supersededAt: string | null;
  supersededReason: string | null;
  label: string;
  brand: string | null;
  productLine: string | null;
  category: string | null;
  shaftFlex: string | null;
  conditionGrade: string | null;
  tradeInValue: number | null;
  valueLabel: string;
  status: string;
  reviewNeeded: boolean;
  ragReady: boolean;
  missingFields: string[];
  rawText: string;
  cleanedText: string;
};

export type FinalRecordProvenanceKey =
  | "SOURCE_NORMALIZATION"
  | "KNOWLEDGE_EVIDENCE"
  | "INVENTORY_MATCH"
  | "VALUATION_EVIDENCE"
  | "MODEL_SUGGESTION"
  | "HUMAN_CORRECTION"
  | "PERSISTED_RECORD";

export type FinalRecordProvenanceEntry = {
  key: FinalRecordProvenanceKey;
  label: string;
  detail: string;
};

export type MergedRecordSummary = RecordSummary & {
  finalReviewLabel: string;
  finalReviewDetail: string;
  sourceStageLabel: string;
  transformationNotes: string[];
  provenanceEntries: FinalRecordProvenanceEntry[];
  persistedRecordId: string;
  persistenceLabel: string;
  replacedRecordId: string | null;
};

export type CorrectionSummary = {
  fieldName: string;
  label: string;
  recordLabel: string;
  beforeValue: string;
  afterValue: string;
};
