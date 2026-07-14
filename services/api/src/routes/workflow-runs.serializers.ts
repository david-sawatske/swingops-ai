import {
  serializeWorkflowRun,
  serializeIntakeBatch,
  serializeIntakeItem,
  serializeWorkflowStep,
  serializeToolCallLog,
  serializeReviewQueueItem
} from "../serializers/shared-workflow-serializers.js";

export {
  serializeWorkflowRun,
  serializeIntakeBatch,
  serializeIntakeItem,
  serializeWorkflowStep,
  serializeToolCallLog,
  serializeReviewQueueItem
};

export function serializeModelCallAttemptLog(attempt: {
  id: string;
  modelCallLogId: string;
  provider: string;
  model: string;
  attemptOrder: number;
  status: string;
  reason: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  estimatedCostUsd: number | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: attempt.id,
    modelCallLogId: attempt.modelCallLogId,
    provider: attempt.provider,
    model: attempt.model,
    attemptOrder: attempt.attemptOrder,
    status: attempt.status,
    reason: attempt.reason,
    errorMessage: attempt.errorMessage,
    latencyMs: attempt.latencyMs,
    estimatedCostUsd: attempt.estimatedCostUsd,
    startedAt: attempt.startedAt.toISOString(),
    completedAt: attempt.completedAt?.toISOString() ?? null,
    createdAt: attempt.createdAt.toISOString()
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
  attemptLogs?: {
    id: string;
    modelCallLogId: string;
    provider: string;
    model: string;
    attemptOrder: number;
    status: string;
    reason: string | null;
    errorMessage: string | null;
    latencyMs: number | null;
    estimatedCostUsd: number | null;
    startedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
  }[];
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
    createdAt: log.createdAt.toISOString(),
    attemptLogs: log.attemptLogs?.map(serializeModelCallAttemptLog) ?? []
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
  _count?: {
    toolCallLogs: number;
    reviewQueueItems: number;
  };
  auditOnlyToolCallLogCount?: number;
}) {
  const openReviewQueueItemCount = run.reviewQueueItems.filter(
    (item) => item.status === "OPEN" || item.status === "IN_REVIEW"
  ).length;
  const auditOnlyToolCallLogCount =
    run.auditOnlyToolCallLogCount ??
    run.toolCallLogs.filter(
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
    totalToolCallLogCount: run._count?.toolCallLogs ?? run.toolCallLogs.length,
    auditOnlyToolCallLogCount,
    totalReviewQueueItemCount:
      run._count?.reviewQueueItems ?? run.reviewQueueItems.length,
    openReviewQueueItemCount
  };
}
