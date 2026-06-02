import type { ModelCallLog } from "../types/workflow";
import { isRecord } from "./objectFields";

export function getRoutingDecision(
  modelCallLog: ModelCallLog | null,
): Record<string, unknown> | null {
  if (!modelCallLog || !isRecord(modelCallLog.responseJson)) {
    return null;
  }

  const routingDecision = modelCallLog.responseJson.routingDecision;

  return isRecord(routingDecision) ? routingDecision : null;
}

export function getRoutingGoal(modelCallLog: ModelCallLog | null): string {
  if (!modelCallLog || !isRecord(modelCallLog.requestJson)) {
    return "—";
  }

  const routingGoal = modelCallLog.requestJson.routingGoal;

  return typeof routingGoal === "string" ? routingGoal : "—";
}
