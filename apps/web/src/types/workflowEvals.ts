import type { MultiSourceIntakeSourceType } from "./multiSourceIntake";
import type { ParserEvidence } from "./parserEvidence";

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

export type WorkflowEvalScenarioSummary = {
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
};

export type WorkflowEvalObservedRecord = {
  id: string;
  sourceType: MultiSourceIntakeSourceType;
  brand: string | null;
  productLine: string | null;
  category: string | null;
  shaftFlex: string | null;
  conditionGrade: string | null;
  tradeInValue: number | null;
  missingFields: string[];
  reviewNeeded: boolean;
  confidence: number;
  parserEvidence?: ParserEvidence;
};

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
  priorReviewSuggestions?: WorkflowEvalPriorReviewSuggestion[];
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

export type ListWorkflowEvalScenariosResponse = {
  scenarios: WorkflowEvalScenarioSummary[];
};

export type RunWorkflowEvalsResponse = {
  summary: WorkflowEvalRunSummary;
  results: WorkflowEvalResult[];
};
