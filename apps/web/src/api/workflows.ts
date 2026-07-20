import { apiGet, apiPost } from "./client";
import type {
  ExecuteEndToEndAgenticTradeInDemoRequest,
  ExecuteMultiSourceIntakeDemoRequest,
  ExecuteEndToEndAgenticTradeInDemoResponse,
  ExecuteMultiSourceIntakeDemoResponse,
  GetAdminOpsNormalizationMatrixResponse,
  GetAdminOpsSummaryResponse,
  GetAdminOpsWorkflowConfigResponse,
  ListAiReadyIntakeRecordsResponse,
  ListReviewQueueItemsResponse,
  ListWorkflowRunsResponse,
  ListWorkflowEvalScenariosResponse,
  PrepareGoldenDemonstrationResponse,
  RunWorkflowEvalsResponse,
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

export async function prepareGoldenDemonstration(): Promise<PrepareGoldenDemonstrationResponse> {
  return apiPost<PrepareGoldenDemonstrationResponse, Record<string, never>>(
    "/workflow-runs/golden-demonstration/prepare",
    {},
  );
}

export async function listWorkflowEvalScenarios(): Promise<ListWorkflowEvalScenariosResponse> {
  return apiGet<ListWorkflowEvalScenariosResponse>("/workflow-evals/scenarios");
}

export async function runWorkflowEvals(): Promise<RunWorkflowEvalsResponse> {
  return apiPost<RunWorkflowEvalsResponse, Record<string, never>>(
    "/workflow-evals/run",
    {},
  );
}

export async function listAiReadyIntakeRecords(
  filters: {
    workflowRunId?: string;
    intakeBatchId?: string;
    search?: string;
    sourceType?: string;
    status?: string;
    activeOnly?: boolean;
    reviewNeeded?: boolean;
    ragReady?: boolean;
    missingFields?: boolean;
    createdFrom?: string;
    createdTo?: string;
    limit?: number;
    offset?: number;
    sort?: string;
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

export async function getAdminOpsSummary(): Promise<GetAdminOpsSummaryResponse> {
  return apiGet<GetAdminOpsSummaryResponse>("/admin/ops/summary");
}

export async function getAdminOpsNormalizationMatrix(): Promise<GetAdminOpsNormalizationMatrixResponse> {
  return apiGet<GetAdminOpsNormalizationMatrixResponse>(
    "/admin/ops/normalization-matrix",
  );
}

export async function getAdminOpsWorkflowConfig(): Promise<GetAdminOpsWorkflowConfigResponse> {
  return apiGet<GetAdminOpsWorkflowConfigResponse>(
    "/admin/ops/workflow-config",
  );
}
