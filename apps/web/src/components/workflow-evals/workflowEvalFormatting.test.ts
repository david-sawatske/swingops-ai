import { describe, expect, it } from "vitest";

import {
  formatWorkflowEvalExecutionMode,
  formatWorkflowEvalStatus,
  summarizeWorkflowEvalFailures,
} from "./workflowEvalFormatting";

describe("workflow eval formatting", () => {
  it("formats status labels", () => {
    expect(formatWorkflowEvalStatus("PASSED")).toBe("Outcome met");
    expect(formatWorkflowEvalStatus("FAILED")).toBe("Needs attention");
  });

  it("formats execution mode labels", () => {
    expect(formatWorkflowEvalExecutionMode("MULTI_SOURCE_INTAKE")).toBe(
      "Source intake",
    );
    expect(formatWorkflowEvalExecutionMode("GUARDED_AGENT_WORKFLOW")).toBe(
      "Guarded workflow",
    );
  });

  it("summarizes failure details", () => {
    expect(summarizeWorkflowEvalFailures([])).toBe("Guardrail met.");
    expect(
      summarizeWorkflowEvalFailures([
        {
          expectation: "review item count",
          message: "Expected 1, observed 0.",
        },
      ]),
    ).toBe("Expected 1, observed 0.");
    expect(
      summarizeWorkflowEvalFailures([
        {
          expectation: "review item count",
          message: "Expected 1, observed 0.",
        },
        {
          expectation: "prior review suggestion count",
          message: "Expected 1, observed 0.",
        },
      ]),
    ).toBe("2 expectations failed.");
  });
});
