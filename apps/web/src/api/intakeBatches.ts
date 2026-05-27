import { apiGet, apiPost } from "./client";
import type {
  CreateIntakeBatchRequest,
  CreateIntakeBatchResponse,
  IntakeBatchSummary,
  ListIntakeBatchesResponse,
} from "../types/intake";

export async function listIntakeBatches(): Promise<IntakeBatchSummary[]> {
  const response = await apiGet<ListIntakeBatchesResponse>("/intake-batches");

  return response.intakeBatches;
}

export async function createIntakeBatch(
  request: CreateIntakeBatchRequest,
): Promise<IntakeBatchSummary> {
  const response = await apiPost<
    CreateIntakeBatchResponse,
    CreateIntakeBatchRequest
  >("/intake-batches", request);

  return response.intakeBatch;
}
