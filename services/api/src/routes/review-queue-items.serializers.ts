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

export function serializeReviewedTradeInRecord(record: {
  id: string;
  reviewQueueItemId: string;
  workflowRunId: string | null;
  intakeItemId: string | null;
  originalText: string | null;
  correctedBrand: string | null;
  correctedProductLine: string | null;
  correctedCategory: string | null;
  correctedShaftFlex: string | null;
  correctedConditionGrade: string | null;
  conditionEvidenceText: string | null;
  correctedDemoValue: number | null;
  demoValuationNote: string | null;
  reviewerNotes: string | null;
  approvedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    reviewQueueItemId: record.reviewQueueItemId,
    workflowRunId: record.workflowRunId,
    intakeItemId: record.intakeItemId,
    originalText: record.originalText,
    correctedBrand: record.correctedBrand,
    correctedProductLine: record.correctedProductLine,
    correctedCategory: record.correctedCategory,
    correctedShaftFlex: record.correctedShaftFlex,
    correctedConditionGrade: record.correctedConditionGrade,
    conditionEvidenceText: record.conditionEvidenceText,
    correctedDemoValue: record.correctedDemoValue,
    demoValuationNote: record.demoValuationNote,
    reviewerNotes: record.reviewerNotes,
    approvedAt: record.approvedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeHumanReviewLearningEvent(event: {
  id: string;
  reviewedTradeInRecordId: string;
  reviewQueueItemId: string;
  workflowRunId: string | null;
  intakeItemId: string | null;
  fieldName: string;
  rawTextMatch: string | null;
  proposedValue: string | null;
  correctedValue: string | null;
  evidenceText: string | null;
  confidenceImpact: string | null;
  reviewerNotes: string | null;
  createdAt: Date;
}) {
  return {
    id: event.id,
    reviewedTradeInRecordId: event.reviewedTradeInRecordId,
    reviewQueueItemId: event.reviewQueueItemId,
    workflowRunId: event.workflowRunId,
    intakeItemId: event.intakeItemId,
    fieldName: event.fieldName,
    rawTextMatch: event.rawTextMatch ?? null,
    proposedValue: event.proposedValue ?? null,
    correctedValue: event.correctedValue ?? null,
    evidenceText: event.evidenceText ?? null,
    confidenceImpact: event.confidenceImpact ?? null,
    reviewerNotes: event.reviewerNotes,
    createdAt: event.createdAt.toISOString()
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
  reviewedTradeInRecord: {
    id: string;
    reviewQueueItemId: string;
    workflowRunId: string | null;
    intakeItemId: string | null;
    originalText: string | null;
    correctedBrand: string | null;
    correctedProductLine: string | null;
    correctedCategory: string | null;
    correctedShaftFlex: string | null;
    correctedConditionGrade: string | null;
    conditionEvidenceText: string | null;
    correctedDemoValue: number | null;
    demoValuationNote: string | null;
    reviewerNotes: string | null;
    approvedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  humanReviewLearningEvents: {
    id: string;
    reviewedTradeInRecordId: string;
    reviewQueueItemId: string;
    workflowRunId: string | null;
    intakeItemId: string | null;
    fieldName: string;
    rawTextMatch: string | null;
    proposedValue: string | null;
    correctedValue: string | null;
    evidenceText: string | null;
    confidenceImpact: string | null;
    reviewerNotes: string | null;
    createdAt: Date;
  }[];
}) {
  return {
    ...serializeReviewQueueItem(item),
    workflowRun: item.workflowRun ? serializeWorkflowRun(item.workflowRun) : null,
    intakeItem: item.intakeItem ? serializeIntakeItem(item.intakeItem) : null,
    intakeBatch: item.intakeItem
      ? serializeIntakeBatch(item.intakeItem.intakeBatch)
      : null,
    reviewedTradeInRecord: item.reviewedTradeInRecord
      ? serializeReviewedTradeInRecord(item.reviewedTradeInRecord)
      : null,
    humanReviewLearningEvents: item.humanReviewLearningEvents.map(
      serializeHumanReviewLearningEvent
    )
  };
}
