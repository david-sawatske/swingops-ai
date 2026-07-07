import type {
  WorkflowEvalExecutionMode,
  WorkflowEvalFailure,
  WorkflowEvalStatus,
} from "../../types/workflow";

export function formatWorkflowEvalStatus(status: WorkflowEvalStatus) {
  return status === "PASSED" ? "Outcome met" : "Needs attention";
}

export function getWorkflowEvalStatusClassName(status: WorkflowEvalStatus) {
  return status === "PASSED"
    ? "workflow-eval-status workflow-eval-status--passed"
    : "workflow-eval-status workflow-eval-status--failed";
}

export function formatWorkflowEvalExecutionMode(mode: WorkflowEvalExecutionMode) {
  return mode === "MULTI_SOURCE_INTAKE"
    ? "Source intake"
    : "Guarded workflow";
}

export function summarizeWorkflowEvalFailures(failures: WorkflowEvalFailure[]) {
  if (failures.length === 0) {
    return "Guardrail met.";
  }

  if (failures.length === 1) {
    return failures[0]?.message ?? "One expectation failed.";
  }

  return `${failures.length} expectations failed.`;
}
