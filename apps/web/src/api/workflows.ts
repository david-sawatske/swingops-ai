import { apiGet, apiPost } from "./client";
import type {
  ExecuteEndToEndAgenticTradeInDemoRequest,
  ExecuteEndToEndAgenticTradeInDemoResponse,
  CreateProviderFallbackDemoResponse,
  ExecuteAgenticTradeInRunResponse,
  ExecuteWorkflowRunRequest,
  ExecuteWorkflowRunResponse,
  ExecuteWorkflowToolCallingPlanResponse,
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

export async function createProviderFallbackDemo(
  workflowRunId: string,
): Promise<CreateProviderFallbackDemoResponse> {
  return apiPost<CreateProviderFallbackDemoResponse, Record<string, never>>(
    `/workflow-runs/${workflowRunId}/model-provider-fallback-demo`,
    {},
  );
}

export async function executeWorkflowToolCallingPlan(
  workflowRunId: string,
): Promise<ExecuteWorkflowToolCallingPlanResponse> {
  return apiPost<ExecuteWorkflowToolCallingPlanResponse, Record<string, never>>(
    `/workflow-runs/${workflowRunId}/tool-calling-plan/execute`,
    {},
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

export async function executeAgenticTradeInRun(
  workflowRunId: string,
): Promise<ExecuteAgenticTradeInRunResponse> {
  return apiPost<ExecuteAgenticTradeInRunResponse, Record<string, never>>(
    `/workflow-runs/${workflowRunId}/agentic-trade-in-run`,
    {},
  );
}

export async function executeEndToEndAgenticTradeInDemo(
  request: ExecuteEndToEndAgenticTradeInDemoRequest,
): Promise<ExecuteEndToEndAgenticTradeInDemoResponse> {
  return apiPost<
    ExecuteEndToEndAgenticTradeInDemoResponse,
    ExecuteEndToEndAgenticTradeInDemoRequest
  >("/workflow-runs/agentic-trade-in-demo", request);
}
