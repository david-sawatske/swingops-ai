export function serializeIntakeBatch(batch: {
  id: string;
  name: string;
  description: string | null;
  sourceType: string;
  status: string;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: batch.id,
    name: batch.name,
    description: batch.description,
    sourceType: batch.sourceType,
    status: batch.status,
    itemCount: batch.itemCount,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString()
  };
}

export function serializeIntakeItem(item: {
  id: string;
  intakeBatchId: string;
  rawText: string;
  sourceRowNumber: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    intakeBatchId: item.intakeBatchId,
    rawText: item.rawText,
    sourceRowNumber: item.sourceRowNumber,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

export function serializeWorkflowRun(run: {
  id: string;
  intakeBatchId: string | null;
  intakeItemId: string | null;
  workflowName: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: run.id,
    intakeBatchId: run.intakeBatchId,
    intakeItemId: run.intakeItemId,
    workflowName: run.workflowName,
    status: run.status,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    errorMessage: run.errorMessage,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString()
  };
}

export function serializeWorkflowStep(step: {
  id: string;
  workflowRunId: string;
  stepName: string;
  stepType: string;
  status: string;
  orderIndex: number;
  inputJson: unknown;
  outputJson: unknown;
  errorMessage: string | null;
  retryCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: step.id,
    workflowRunId: step.workflowRunId,
    stepName: step.stepName,
    stepType: step.stepType,
    status: step.status,
    orderIndex: step.orderIndex,
    inputJson: step.inputJson,
    outputJson: step.outputJson,
    errorMessage: step.errorMessage,
    retryCount: step.retryCount,
    startedAt: step.startedAt?.toISOString() ?? null,
    completedAt: step.completedAt?.toISOString() ?? null,
    createdAt: step.createdAt.toISOString(),
    updatedAt: step.updatedAt.toISOString()
  };
}

export function serializeToolCallLog(log: {
  id: string;
  workflowRunId: string | null;
  workflowStepId: string | null;
  toolName: string;
  status: string;
  inputJson: unknown;
  outputJson: unknown;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: log.id,
    workflowRunId: log.workflowRunId,
    workflowStepId: log.workflowStepId,
    toolName: log.toolName,
    status: log.status,
    inputJson: log.inputJson,
    outputJson: log.outputJson,
    errorMessage: log.errorMessage,
    startedAt: log.startedAt.toISOString(),
    completedAt: log.completedAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString()
  };
}

export function serializeModelCallLog(log: {
  id: string;
  workflowRunId: string | null;
  workflowStepId: string | null;
  provider: string;
  model: string;
  status: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  estimatedCostUsd: number | null;
  requestJson: unknown;
  responseJson: unknown;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: log.id,
    workflowRunId: log.workflowRunId,
    workflowStepId: log.workflowStepId,
    provider: log.provider,
    model: log.model,
    status: log.status,
    promptTokens: log.promptTokens,
    completionTokens: log.completionTokens,
    totalTokens: log.totalTokens,
    latencyMs: log.latencyMs,
    estimatedCostUsd: log.estimatedCostUsd,
    requestJson: log.requestJson,
    responseJson: log.responseJson,
    errorMessage: log.errorMessage,
    startedAt: log.startedAt.toISOString(),
    completedAt: log.completedAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString()
  };
}

export function serializeReviewQueueItem(item: {
  id: string;
  intakeItemId: string | null;
  golfClubId: string | null;
  workflowRunId: string | null;
  reason: string;
  status: string;
  originalText: string | null;
  proposedGolfClubJson: unknown;
  reviewerNotes: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    intakeItemId: item.intakeItemId,
    golfClubId: item.golfClubId,
    workflowRunId: item.workflowRunId,
    reason: item.reason,
    status: item.status,
    originalText: item.originalText,
    proposedGolfClubJson: item.proposedGolfClubJson,
    reviewerNotes: item.reviewerNotes,
    resolvedAt: item.resolvedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

export function serializeWorkflowRunListItem(run: {
  id: string;
  intakeBatchId: string | null;
  intakeItemId: string | null;
  workflowName: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  intakeBatch: {
    id: string;
    name: string;
    description: string | null;
    sourceType: string;
    status: string;
    itemCount: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  intakeItem: {
    id: string;
    intakeBatchId: string;
    rawText: string;
    sourceRowNumber: number | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  modelCallLogs: {
    id: string;
    workflowRunId: string | null;
    workflowStepId: string | null;
    provider: string;
    model: string;
    status: string;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    latencyMs: number | null;
    estimatedCostUsd: number | null;
    requestJson: unknown;
    responseJson: unknown;
    errorMessage: string | null;
    startedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
  }[];
  toolCallLogs: {
    id: string;
    workflowRunId: string | null;
    workflowStepId: string | null;
    toolName: string;
    status: string;
    inputJson: unknown;
    outputJson: unknown;
    errorMessage: string | null;
    startedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
  }[];
  reviewQueueItems: {
    status: string;
  }[];
}) {
  const openReviewQueueItemCount = run.reviewQueueItems.filter(
    (item) => item.status === "OPEN" || item.status === "IN_REVIEW"
  ).length;

  const auditOnlyToolCallLogCount = run.toolCallLogs.filter(
    (log) =>
      typeof log.outputJson === "object" &&
      log.outputJson !== null &&
      !Array.isArray(log.outputJson) &&
      "previewOnly" in log.outputJson &&
      log.outputJson.previewOnly === true
  ).length;

  return {
    ...serializeWorkflowRun(run),
    intakeBatch: run.intakeBatch ? serializeIntakeBatch(run.intakeBatch) : null,
    intakeItem: run.intakeItem ? serializeIntakeItem(run.intakeItem) : null,
    latestModelCallLog: run.modelCallLogs[0]
      ? serializeModelCallLog(run.modelCallLogs[0])
      : null,
    latestToolCallLog: run.toolCallLogs[0]
      ? serializeToolCallLog(run.toolCallLogs[0])
      : null,
    totalToolCallLogCount: run.toolCallLogs.length,
    auditOnlyToolCallLogCount,
    totalReviewQueueItemCount: run.reviewQueueItems.length,
    openReviewQueueItemCount
  };
}

export function serializeReviewQueueItemWithContext(item: {
  id: string;
  intakeItemId: string | null;
  golfClubId: string | null;
  workflowRunId: string | null;
  reason: string;
  status: string;
  originalText: string | null;
  proposedGolfClubJson: unknown;
  reviewerNotes: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  workflowRun: {
    id: string;
    intakeBatchId: string | null;
    intakeItemId: string | null;
    workflowName: string;
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  intakeItem: {
    id: string;
    intakeBatchId: string;
    rawText: string;
    sourceRowNumber: number | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    intakeBatch: {
      id: string;
      name: string;
      description: string | null;
      sourceType: string;
      status: string;
      itemCount: number;
      createdAt: Date;
      updatedAt: Date;
    };
  } | null;
}) {
  return {
    ...serializeReviewQueueItem(item),
    workflowRun: item.workflowRun ? serializeWorkflowRun(item.workflowRun) : null,
    intakeItem: item.intakeItem ? serializeIntakeItem(item.intakeItem) : null,
    intakeBatch: item.intakeItem
      ? serializeIntakeBatch(item.intakeItem.intakeBatch)
      : null
  };
}
