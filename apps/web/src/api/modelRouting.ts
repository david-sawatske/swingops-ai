import { apiPost } from "./client";
import type {
  PreviewModelRoutingRequest,
  PreviewModelRoutingResponse,
} from "../types/ai";

export async function previewModelRouting(
  request: PreviewModelRoutingRequest,
): Promise<PreviewModelRoutingResponse> {
  return apiPost<PreviewModelRoutingResponse, PreviewModelRoutingRequest>(
    "/ai/model-routing/preview",
    request,
  );
}
