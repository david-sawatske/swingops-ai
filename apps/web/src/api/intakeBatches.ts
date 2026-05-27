import { apiGet } from "./client";
import type {
  IntakeBatchSummary,
  ListIntakeBatchesResponse,
} from "../types/intake";

export async function listIntakeBatches(): Promise<IntakeBatchSummary[]> {
  const response = await apiGet<ListIntakeBatchesResponse>("/intake-batches");

  return response.intakeBatches;
}
