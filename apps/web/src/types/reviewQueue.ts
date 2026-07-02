import type { AiReadyIntakeRecord } from "./aiReadyRecords";
import type { WorkflowRunSummary } from "./workflowRun";

export type ReviewQueueItemStatus =
  | "OPEN"
  | "IN_REVIEW"
  | "RESOLVED"
  | "DISMISSED";

export type ReviewedTradeInRecord = {
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
  correctedDemoValue: number | null;
  demoValuationNote: string | null;
  reviewerNotes: string | null;
  approvedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type HumanReviewLearningEvent = {
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
  createdAt: string;
};

export type ReviewQueueItem = {
  id: string;
  intakeItemId: string | null;
  golfClubId: string | null;
  workflowRunId: string | null;
  reason: string;
  status: ReviewQueueItemStatus;
  originalText: string | null;
  proposedGolfClubJson: unknown;
  reviewerNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewQueueIntakeItemSummary = {
  id: string;
  intakeBatchId: string;
  rawText: string;
  sourceRowNumber: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewQueueIntakeBatchSummary = {
  id: string;
  name: string;
  description: string | null;
  sourceType: string;
  status: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GlobalReviewQueueItem = ReviewQueueItem & {
  workflowRun: WorkflowRunSummary | null;
  intakeItem: ReviewQueueIntakeItemSummary | null;
  intakeBatch: ReviewQueueIntakeBatchSummary | null;
  reviewedTradeInRecord: ReviewedTradeInRecord | null;
  humanReviewLearningEvents: HumanReviewLearningEvent[];
};

export type ListReviewQueueItemsResponse = {
  reviewQueueItems: GlobalReviewQueueItem[];
};

export type ReviewQueueItemActionRequest = {
  reviewerNotes?: string;
};

export type ReviewQueueItemActionResponse = {
  reviewQueueItem: ReviewQueueItem;
  workflowRun: WorkflowRunSummary | null;
};

export type ReviewConditionGrade =
  | "9.5 Mint"
  | "9.0 Above Average"
  | "8.0 Average"
  | "7.0 Below Average"
  | "6.0 Poor";

export type ReviewCorrectionCategory =
  | "DRIVER"
  | "FAIRWAY_WOOD"
  | "HYBRID"
  | "IRON_SET"
  | "WEDGE"
  | "PUTTER";

export type ReviewCorrectionShaftFlex =
  | "STIFF"
  | "REGULAR"
  | "SENIOR"
  | "X_STIFF"
  | "LADIES"
  | "TOUR_X_STIFF";

export type StructuredReviewCorrectedRecord = {
  brand?: string;
  productLine?: string;
  category?: ReviewCorrectionCategory;
  shaftFlex?: ReviewCorrectionShaftFlex;
  conditionGrade?: ReviewConditionGrade;
  demoValue?: number;
  demoValuationNote?: string;
};

export type StructuredReviewLearningEventInput = {
  fieldName: string;
  rawTextMatch?: string;
  proposedValue?: string;
  correctedValue?: string;
  evidenceText?: string;
  confidenceImpact?: string;
};

export type ResolveReviewQueueItemWithCorrectionsRequest = {
  reviewerNotes?: string;
  correctedRecord: StructuredReviewCorrectedRecord;
  learningEvents: StructuredReviewLearningEventInput[];
};

export type ResolveReviewQueueItemWithCorrectionsResponse = {
  reviewQueueItem: ReviewQueueItem;
  workflowRun: WorkflowRunSummary | null;
  reviewedTradeInRecord: ReviewedTradeInRecord;
  aiReadyIntakeRecord: AiReadyIntakeRecord | null;
  learningEvents: HumanReviewLearningEvent[];
};
