export type MultiSourceIntakeSourceType =
  | "FREE_TEXT"
  | "POORLY_FORMED_CSV"
  | "EMAIL"
  | "LOG";

export type MultiSourceIntakeSourceInput = {
  sourceType: MultiSourceIntakeSourceType;
  sourceName?: string;
  rawContent: string;
};

export type MultiSourceIntakeRecord = {
  id: string;
  sourceId: string;
  sourceType: MultiSourceIntakeSourceType;
  brand: string | null;
  productLine: string | null;
  category: string | null;
  shaftFlex: string | null;
  conditionGrade: string | null;
  tradeInValue: number | null;
  customerName: string | null;
  customerEmail: string | null;
  storeId: string | null;
  eventTimestamp: string | null;
  attachmentsMentioned: string[];
  missingFields: string[];
  confidence: number;
  reviewNeeded: boolean;
  normalizedText: string;
};

export type MultiSourceIntakeSchemaField = {
  fieldName: string;
  type: "string" | "number" | "boolean" | "datetime" | "string[]";
  nullable: boolean;
  description: string;
  examples: string[];
};

export type MultiSourceIntakeSourceResult = {
  id: string;
  sourceType: MultiSourceIntakeSourceType;
  sourceName: string;
  rawContent: string;
  cleanedText: string;
  extractedRecords: MultiSourceIntakeRecord[];
  inferredSchema: MultiSourceIntakeSchemaField[];
  metadata: {
    detectedBrands: string[];
    detectedCategories: string[];
    detectedStoreIds: string[];
    customerEmails: string[];
    attachmentNames: string[];
    eventTimestamps: string[];
    operationalTags: string[];
  };
  qualitySignals: {
    signal: string;
    severity: "INFO" | "WARNING" | "REVIEW";
    message: string;
  }[];
  missingFields: string[];
  confidence: number;
  embeddingReadiness: {
    ready: boolean;
    chunkCount: number;
    reason: string;
    suggestedChunkStrategy: string;
  };
  ragIndexReadiness: {
    ready: boolean;
    indexName: string;
    metadataFields: string[];
    reason: string;
  };
};

export type ExecuteMultiSourceIntakeDemoRequest = {
  sourceTypes?: MultiSourceIntakeSourceType[];
  sources?: MultiSourceIntakeSourceInput[];
};

export type ExecuteMultiSourceIntakeDemoResponse = {
  sourcesProcessed: number;
  recordsExtracted: number;
  assetsCreated: number;
  reviewNeeded: number;
  sourceResults: MultiSourceIntakeSourceResult[];
  inferredDatasetSchema: MultiSourceIntakeSchemaField[];
  cleanedDatasetPreview: MultiSourceIntakeRecord[];
  metadataSummary: {
    sourceTypes: MultiSourceIntakeSourceType[];
    detectedBrands: string[];
    detectedCategories: string[];
    detectedStoreIds: string[];
    customerEmails: string[];
    attachmentNames: string[];
    eventTimestamps: string[];
    operationalTags: string[];
  };
  ragReadinessSummary: {
    readySourceCount: number;
    totalSourceCount: number;
    readyRecordCount: number;
    totalRecordCount: number;
    embeddingReady: boolean;
    ragIndexReady: boolean;
    summary: string;
  };
  auditTrail: {
    orderIndex: number;
    label: string;
    status: "SUCCEEDED" | "NEEDS_REVIEW" | "INFO";
    summary: string;
    details: unknown;
  }[];
  finalSummary: string;
  persistedIds: {
    intakeBatchId: string;
    intakeItemIds: string[];
    workflowRunId: string;
    reviewQueueItemIds: string[];
    toolCallLogIds: string[];
    aiReadyIntakeRecordIds: string[];
  };
};
