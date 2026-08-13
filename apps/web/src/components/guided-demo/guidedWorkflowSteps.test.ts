import { describe, expect, it } from "vitest";

import { getCompletedGuidedStepStatus } from "./guidedWorkflowSteps";

describe("guided workflow step status", () => {
  it("keeps unresolved human review visible after opening the final report", () => {
    expect(getCompletedGuidedStepStatus("VALIDATION_REVIEW", true)).toBe(
      "Review open",
    );
  });

  it("marks completed or fully resolved earlier steps as done", () => {
    expect(getCompletedGuidedStepStatus("VALIDATION_REVIEW", false)).toBe(
      "Done",
    );
    expect(getCompletedGuidedStepStatus("GUARDED_AGENT_EXECUTION", true)).toBe(
      "Done",
    );
  });
});
