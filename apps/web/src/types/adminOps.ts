export type AdminOpsNormalizationField =
  | "shaftFlex"
  | "category"
  | "conditionGrade"
  | "tradeInValue";

export type AdminOpsNormalizationAction =
  | "NORMALIZE"
  | "BLOCK_REPAIR"
  | "ROUTE_TO_REVIEW";

export type AdminOpsNormalizationMatrixEntry = {
  id: string;
  field: AdminOpsNormalizationField;
  aliases: string[];
  canonicalValue: string | number | null;
  action: AdminOpsNormalizationAction;
  requiresContext: boolean;
  notes: string;
};

export type GetAdminOpsNormalizationMatrixResponse = {
  entries: AdminOpsNormalizationMatrixEntry[];
};

export type GetAdminOpsWorkflowConfigResponse = {
  confidenceThresholds: Array<{
    name: string;
    value: string;
    description: string;
  }>;
  reviewRoutingRules: Array<{
    ruleId: string;
    label: string;
    effect: string;
    description: string;
  }>;
  providerRoutingPolicy: Array<{
    taskType: string;
    primaryProvider: string;
    fallbackProvider: string;
    validationRequired: boolean;
  }>;
  mutationPolicy: {
    readOnlyToolsOnly: boolean;
    blockedMutationsVisible: boolean;
    description: string;
  };
};

export type AdminOpsCountEntry = {
  label: string;
  count: number;
};

export type AdminOpsSourceQualityEntry = {
  sourceType: string;
  total: number;
  active: number;
  reviewNeeded: number;
  groundingReady: number;
  superseded: number;
};

export type AdminOpsAiReadyFreshnessSummary = {
  newestCreatedAt: string | null;
  last24Hours: number;
  last7Days: number;
  last30Days: number;
};

export type AdminOpsAiReadyRecordsSummary = {
  total: number;
  active: number;
  superseded: number;
  byStatus: Record<string, number>;
  bySourceType: Record<string, number>;
  reviewNeeded: number;
  ragReady: number;
  missingFieldCounts: Record<string, number>;
  missingFieldHotspots: AdminOpsCountEntry[];
  categoryMix: AdminOpsCountEntry[];
  sourceQuality: AdminOpsSourceQualityEntry[];
  freshness: AdminOpsAiReadyFreshnessSummary;
};

export type AdminOpsWorkflowRunsSummary = {
  total: number;
  byStatus: Record<string, number>;
};

export type AdminOpsModelExecutionsSummary = {
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  fallbackCount: number;
  fallbackRate: number;
  executionSuccessRate: number;
  validationTrackedCalls: number;
  validationPassedCalls: number;
  validationFailedCalls: number;
  validationPassRate: number;
  assistance: {
    totalCalls: number;
    validationTrackedCalls: number;
    validationPassedCalls: number;
    validationFailedCalls: number;
    validationPassRate: number;
    selectedRecords: number;
    recordOutcomes: number;
    outcomeCoverageRate: number;
    repairSuggested: number;
    candidateComparison: number;
    noSafeRepair: number;
  };
  attempts: {
    totalAttempts: number;
    successfulAttempts: number;
    nonSuccessfulAttempts: number;
    attemptSuccessRate: number;
    byProviderModel: Array<{
      provider: string;
      model: string;
      attemptCount: number;
      successfulAttemptCount: number;
      nonSuccessfulAttemptCount: number;
      averageLatencyMs: number | null;
      estimatedCostTotal: number;
      latestFailureMessage: string | null;
    }>;
  };
  averageLatencyMs: number | null;
  estimatedCostTotal: number;
  totalTokens: number;
  byProviderModel: Array<{
    provider: string;
    model: string;
    callCount: number;
    failedCallCount: number;
    fallbackCount: number;
    averageLatencyMs: number | null;
    estimatedCostTotal: number;
    totalTokens: number;
    validationTrackedCallCount: number;
    validationPassedCallCount: number;
    validationPassRate: number;
    assistanceCallCount: number;
    selectedRecordCount: number;
    recordOutcomeCount: number;
    outcomeCoverageRate: number;
    repairSuggestedCount: number;
    candidateComparisonCount: number;
    noSafeRepairCount: number;
  }>;
};

export type GetAdminOpsSummaryResponse = {
  aiReadyRecords: AdminOpsAiReadyRecordsSummary;
  workflowRuns: AdminOpsWorkflowRunsSummary;
  modelExecutions: AdminOpsModelExecutionsSummary;
};
