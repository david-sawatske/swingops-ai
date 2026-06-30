export type RecordSummary = {
  id: string;
  intakeItemId: string | null;
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

export type MergedRecordSummary = RecordSummary & {
  finalReviewLabel: string;
  finalReviewDetail: string;
  sourceStageLabel: string;
  transformationNotes: string[];
};

export type CorrectionSummary = {
  fieldName: string;
  label: string;
  recordLabel: string;
  beforeValue: string;
  afterValue: string;
};
