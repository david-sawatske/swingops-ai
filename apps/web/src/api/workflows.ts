import { apiPost } from "./client";
import type { StartWorkflowResponse } from "../types/workflow";

export async function startWorkflowForIntakeBatch(
  intakeBatchId: string,
): Promise<StartWorkflowResponse> {
  return apiPost<StartWorkflowResponse, Record<string, never>>(
    `/intake-batches/${intakeBatchId}/start-workflow`,
    {},
  );
}
