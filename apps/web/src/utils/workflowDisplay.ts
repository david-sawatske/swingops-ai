import type { GlobalWorkflowRunSummary } from "../types/workflow";

export function getNeedsReviewWorkflowRunSummary(count: number): string {
  if (count === 0) {
    return "No workflow runs currently need review.";
  }

  if (count === 1) {
    return "1 workflow run currently needs review.";
  }

  return `${count} workflow runs currently need review.`;
}

export function getWorkflowRunSourcePreview(run: GlobalWorkflowRunSummary): string {
  return run.intakeItem?.rawText ?? "No item-level source preview captured yet.";
}
