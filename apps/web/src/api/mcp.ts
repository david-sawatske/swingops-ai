import { apiGet, apiPost } from "./client";
import type {
  ConnectorCatalogResponse,
  ConnectorInvocationHistoryResponse,
  McpCompatibleToolCallRequest,
  McpCompatibleToolCallResponse,
} from "../types/mcp";

export async function listConnectorCatalog(): Promise<ConnectorCatalogResponse> {
  return apiGet<ConnectorCatalogResponse>("/mcp/connectors/catalog");
}

export async function listConnectorInvocationHistory(
  limit = 25,
): Promise<ConnectorInvocationHistoryResponse> {
  return apiGet<ConnectorInvocationHistoryResponse>(
    `/mcp/tools/invocations/history?limit=${limit}`,
  );
}

export async function callMcpCompatibleTool(
  toolId: string,
  request: McpCompatibleToolCallRequest,
): Promise<McpCompatibleToolCallResponse> {
  return apiPost<McpCompatibleToolCallResponse, McpCompatibleToolCallRequest>(
    `/mcp/tools/${toolId}/call`,
    request,
  );
}
