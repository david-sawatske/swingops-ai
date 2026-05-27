import { apiGet } from "./client";
import type { IntakeBatchSummary } from "../types/intake";

export async function listIntakeBatches(): Promise<IntakeBatchSummary[]> {
  return apiGet<IntakeBatchSummary[]>("/intake-batches");
}
