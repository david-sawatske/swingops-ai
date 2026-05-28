import { apiGet, apiPost } from "./client";
import type {
  ExecuteWorkflowRunRequest,
  ExecuteWorkflowRunResponse,
  ListReviewQueueItemsResponse,
  ListWorkflowRunsResponse,
  ReviewQueueItemActionRequest,
  ReviewQueueItemActionResponse,
  StartWorkflowResponse,
  WorkflowRunDetail,
} from "../types/workflow";

export async function startWorkflowForIntakeBatch(
  intakeBatchId: string,
): Promise<StartWorkflowResponse> {
  return apiPost<StartWorkflowResponse, Record<string, never>>(
    `/intake-batches/${intakeBatchId}/start-workflow`,
    {},
  );
}

export async function executeWorkflowRun(
  workflowRunId: string,
  request: ExecuteWorkflowRunRequest = {},
): Promise<ExecuteWorkflowRunResponse> {
  return apiPost<ExecuteWorkflowRunResponse, ExecuteWorkflowRunRequest>(
    `/workflow-runs/${workflowRunId}/execute`,
    request,
  );
}

export async function listWorkflowRuns(): Promise<ListWorkflowRunsResponse> {
  return apiGet<ListWorkflowRunsResponse>("/workflow-runs");
}

export async function getWorkflowRun(
  workflowRunId: string,
): Promise<WorkflowRunDetail> {
  return apiGet<WorkflowRunDetail>(`/workflow-runs/${workflowRunId}`);
}

export async function listReviewQueueItems(): Promise<ListReviewQueueItemsResponse> {
  return apiGet<ListReviewQueueItemsResponse>("/review-queue-items");
}

export async function resolveReviewQueueItem(
  reviewQueueItemId: string,
  request: ReviewQueueItemActionRequest = {},
): Promise<ReviewQueueItemActionResponse> {
  return apiPost<ReviewQueueItemActionResponse, ReviewQueueItemActionRequest>(
    `/review-queue-items/${reviewQueueItemId}/resolve`,
    request,
  );
}

export async function dismissReviewQueueItem(
  reviewQueueItemId: string,
  request: ReviewQueueItemActionRequest = {},
): Promise<ReviewQueueItemActionResponse> {
  return apiPost<ReviewQueueItemActionResponse, ReviewQueueItemActionRequest>(
    `/review-queue-items/${reviewQueueItemId}/dismiss`,
    request,
  );
}
