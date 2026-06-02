import type { ToolCallLog } from "../types/workflow";
import { isRecord } from "./objectFields";

export function getToolCallOutputJson(
  toolCallLog: ToolCallLog,
): Record<string, unknown> | null {
  return isRecord(toolCallLog.outputJson) ? toolCallLog.outputJson : null;
}

export function getConnectorResultData(
  toolCallLog: ToolCallLog,
): Record<string, unknown> | null {
  const outputJson = getToolCallOutputJson(toolCallLog);
  const connectorResult = isRecord(outputJson?.connectorResult)
    ? outputJson.connectorResult
    : null;
  const data = isRecord(connectorResult?.data) ? connectorResult.data : null;

  return data;
}

export function isGroundingToolCallLog(toolCallLog: ToolCallLog): boolean {
  return toolCallLog.toolName === "swingops.clubReference.search";
}

export function isAuditOnlyToolCallLog(toolCallLog: ToolCallLog): boolean {
  const outputJson = getToolCallOutputJson(toolCallLog);

  return outputJson?.previewOnly === true;
}

export function getClubReferenceSearchData(
  value: unknown,
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const clubReferenceSearch = value.clubReferenceSearch;

  return isRecord(clubReferenceSearch) ? clubReferenceSearch : null;
}

export function getGroundingSummaryFromToolCall(toolCallLog: ToolCallLog): string {
  const data = getConnectorResultData(toolCallLog);
  const clubReferenceSearch = getClubReferenceSearchData(data);
  const summary = clubReferenceSearch?.summary;

  return typeof summary === "string" ? summary : "No grounding summary returned.";
}
