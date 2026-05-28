import { apiGet, apiPost } from "./client";
import type {
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

export async function getWorkflowRun(
  workflowRunId: string,
): Promise<WorkflowRunDetail> {
  return apiGet<WorkflowRunDetail>(`/workflow-runs/${workflowRunId}`);
}
