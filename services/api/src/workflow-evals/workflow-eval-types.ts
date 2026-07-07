import type {
  MultiSourceIntakeRecord,
  MultiSourceIntakeSourceInput,
  MultiSourceIntakeSourceType
} from "../workflows/multi-source-intake-demo.js";

export type WorkflowEvalFieldName =
  | "brand"
  | "productLine"
  | "category"
  | "shaftFlex"
  | "conditionGrade"
  | "tradeInValue";

export type WorkflowEvalExecutionMode =
  | "MULTI_SOURCE_INTAKE"
  | "GUARDED_AGENT_WORKFLOW";

export type WorkflowEvalStatus = "PASSED" | "FAILED";

export type WorkflowEvalPriorReviewLearningEventSeed = {
  fieldName: WorkflowEvalFieldName;
  rawTextMatch: string;
  proposedValue?: string | null;
  correctedValue: string;
  evidenceText: string;
  confidenceImpact?: string | null;
};

export type WorkflowEvalFieldExpectation = {
  recordIndex: number;
  fieldName: WorkflowEvalFieldName;
  expectedValue?: string | number | null;
  expectedSourceTextIncludes?: string;
};

export type WorkflowEvalMissingFieldExpectation = {
  recordIndex: number;
  includes?: WorkflowEvalFieldName[];
  excludes?: WorkflowEvalFieldName[];
};

export type WorkflowEvalNoInventedValueExpectation = {
  recordIndex: number;
  fieldName: WorkflowEvalFieldName;
};

export type WorkflowEvalScenario = {
  id: string;
  name: string;
  description: string;
  sourceType: MultiSourceIntakeSourceType;
  executionMode: WorkflowEvalExecutionMode;
  workflowStage: string;
  protectedBehavior: string;
  sampleInput: string;
  expectedBehavior: string[];
  failureImpact: string;
  sources?: MultiSourceIntakeSourceInput[];
  rawInput?: string;
  setup?: {
    priorReviewLearningEvents?: WorkflowEvalPriorReviewLearningEventSeed[];
  };
  expectations: {
    parsedRecordCount?: number;
    aiReadyRecordCount?: number;
    reviewItemCount?: number;
    priorReviewSuggestionCount?: number;
    fieldEvidence?: WorkflowEvalFieldExpectation[];
    missingFields?: WorkflowEvalMissingFieldExpectation[];
    noInventedValues?: WorkflowEvalNoInventedValueExpectation[];
  };
};

export type WorkflowEvalScenarioSummary = Pick<
  WorkflowEvalScenario,
  | "id"
  | "name"
  | "description"
  | "sourceType"
  | "executionMode"
  | "workflowStage"
  | "protectedBehavior"
  | "sampleInput"
  | "expectedBehavior"
  | "failureImpact"
>;

export type WorkflowEvalObservedRecord = Pick<
  MultiSourceIntakeRecord,
  | "id"
  | "sourceType"
  | "brand"
  | "productLine"
  | "category"
  | "shaftFlex"
  | "conditionGrade"
  | "tradeInValue"
  | "missingFields"
  | "reviewNeeded"
  | "confidence"
  | "parserEvidence"
>;

export type WorkflowEvalPriorReviewSuggestion = {
  fieldName: string;
  rawTextMatch: string | null;
  suggestedValue: string | null;
  previousCorrectedValue: string | null;
  proposedValue: string | null;
  evidenceText: string | null;
  confidence: number;
  strength: string;
  confidenceImpact: string;
  summary: string;
  whySuggestionExists: string;
  sourceLearningEventId: string;
  status: string;
};

export type WorkflowEvalObserved = {
  parsedRecordCount: number;
  aiReadyRecordCount: number;
  reviewItemCount: number;
  priorReviewSuggestionCount: number;
  priorReviewSuggestions: WorkflowEvalPriorReviewSuggestion[];
  records: WorkflowEvalObservedRecord[];
};

export type WorkflowEvalFailure = {
  expectation: string;
  message: string;
};

export type WorkflowEvalResult = {
  scenarioId: string;
  scenarioName: string;
  sourceType: MultiSourceIntakeSourceType;
  executionMode: WorkflowEvalExecutionMode;
  status: WorkflowEvalStatus;
  observed: WorkflowEvalObserved;
  failures: WorkflowEvalFailure[];
};

export type WorkflowEvalRunSummary = {
  total: number;
  passed: number;
  failed: number;
};

export type WorkflowEvalRunResult = {
  summary: WorkflowEvalRunSummary;
  results: WorkflowEvalResult[];
};
