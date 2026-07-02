import { apiGet, apiPost } from "./client";
import type {
  ExecuteEndToEndAgenticTradeInDemoRequest,
  ExecuteMultiSourceIntakeDemoRequest,
  ExecuteEndToEndAgenticTradeInDemoResponse,
  ExecuteMultiSourceIntakeDemoResponse,
  ListAiReadyIntakeRecordsResponse,
  ListReviewQueueItemsResponse,
  ListWorkflowRunsResponse,
  ResolveReviewQueueItemWithCorrectionsRequest,
  ResolveReviewQueueItemWithCorrectionsResponse,
  ReviewQueueItemActionRequest,
  ReviewQueueItemActionResponse,
} from "../types/workflow";

export async function listWorkflowRuns(): Promise<ListWorkflowRunsResponse> {
  return apiGet<ListWorkflowRunsResponse>("/workflow-runs");
}

export async function listReviewQueueItems(
  filters: {
    status?: string;
    workflowRunId?: string;
  } = {},
): Promise<ListReviewQueueItemsResponse> {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();

  return apiGet<ListReviewQueueItemsResponse>(
    queryString ? `/review-queue-items?${queryString}` : "/review-queue-items",
  );
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

export async function resolveReviewQueueItemWithCorrections(
  reviewQueueItemId: string,
  request: ResolveReviewQueueItemWithCorrectionsRequest,
): Promise<ResolveReviewQueueItemWithCorrectionsResponse> {
  return apiPost<
    ResolveReviewQueueItemWithCorrectionsResponse,
    ResolveReviewQueueItemWithCorrectionsRequest
  >(`/review-queue-items/${reviewQueueItemId}/resolve-with-corrections`, request);
}

export async function executeEndToEndAgenticTradeInDemo(
  request: ExecuteEndToEndAgenticTradeInDemoRequest,
): Promise<ExecuteEndToEndAgenticTradeInDemoResponse> {
  return apiPost<
    ExecuteEndToEndAgenticTradeInDemoResponse,
    ExecuteEndToEndAgenticTradeInDemoRequest
  >("/workflow-runs/agentic-trade-in-demo", request);
}

export async function executeMultiSourceIntakeDemo(
  request: ExecuteMultiSourceIntakeDemoRequest = {},
): Promise<ExecuteMultiSourceIntakeDemoResponse> {
  return apiPost<
    ExecuteMultiSourceIntakeDemoResponse,
    ExecuteMultiSourceIntakeDemoRequest
  >("/workflow-runs/multi-source-intake-demo", request);
}

export async function listAiReadyIntakeRecords(
  filters: {
    workflowRunId?: string;
    intakeBatchId?: string;
    sourceType?: string;
    status?: string;
    limit?: number;
  } = {},
): Promise<ListAiReadyIntakeRecordsResponse> {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();

  return apiGet<ListAiReadyIntakeRecordsResponse>(
    queryString
      ? `/ai-ready-intake-records?${queryString}`
      : "/ai-ready-intake-records",
  );
}
