import { apiPost } from "./client";
import type {
  ExecuteReadOnlyToolInvocationRequest,
  ExecuteReadOnlyToolInvocationResponse,
} from "../types/mcp";

export async function executeReadOnlyToolInvocation(
  request: ExecuteReadOnlyToolInvocationRequest,
): Promise<ExecuteReadOnlyToolInvocationResponse> {
  return apiPost<
    ExecuteReadOnlyToolInvocationResponse,
    ExecuteReadOnlyToolInvocationRequest
  >("/mcp/tools/invocations/execute-readonly", request);
}
