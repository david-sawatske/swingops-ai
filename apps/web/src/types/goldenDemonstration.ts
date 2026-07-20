export type GoldenDemonstrationHistoricalEvidence = {
  created: boolean;
  workflowRunId: string;
  reviewQueueItemId: string;
  reviewedTradeInRecordId: string;
  learningEventId: string;
  fieldName: "shaftFlex";
  rawTextMatch: "shaft firm";
  correctedValue: "STIFF";
};

export type PrepareGoldenDemonstrationResponse = {
  historicalEvidence: GoldenDemonstrationHistoricalEvidence;
};
