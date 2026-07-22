import { describe, expect, it } from "vitest";

import {
  TRADE_IN_WORKFLOW_STEP_NAMES,
  buildTradeInWorkflowOrchestrationTrace,
} from "./workflow-orchestration-trace.js";

const orderedStepNames = Object.values(TRADE_IN_WORKFLOW_STEP_NAMES);

function buildPersistedSteps() {
  return orderedStepNames.map((stepName, index) => ({
    stepName,
    orderIndex: index + 1,
    status: "COMPLETED" as const,
    retryCount: stepName === TRADE_IN_WORKFLOW_STEP_NAMES.targetedRetry ? 1 : 0,
    startedAt: new Date(`2026-07-21T12:0${index}:00.000Z`),
    completedAt: new Date(`2026-07-21T12:0${index}:01.000Z`),
  }));
}

describe("trade-in workflow orchestration trace", () => {
  it("describes application-controlled transitions and bounded model authority", () => {
    const trace = buildTradeInWorkflowOrchestrationTrace(buildPersistedSteps());

    expect(trace).toMatchObject({
      mode: "DETERMINISTIC_STATE_MACHINE",
      transitionAuthority: "APPLICATION_CODE",
      modelBoundary: {
        authority: "ADVISORY_ONLY",
        assistedStateIds: [
          TRADE_IN_WORKFLOW_STEP_NAMES.modelAssistance,
          TRADE_IN_WORKFLOW_STEP_NAMES.targetedRetry,
        ],
      },
    });
    expect(trace.states).toHaveLength(8);
    expect(
      trace.states.every(
        (state) => state.transitionAuthority === "APPLICATION_CODE",
      ),
    ).toBe(true);
    expect(
      trace.states.filter(
        (state) => state.executionKind === "BOUNDED_MODEL_ASSISTANCE",
      ),
    ).toHaveLength(2);
    expect(trace.modelBoundary.prohibitedActions).toEqual(
      expect.arrayContaining([
        "Choose or change workflow states.",
        "Select or execute tools.",
        "Authorize mutations.",
        "Write final records.",
      ]),
    );
  });

  it("rejects a persisted state sequence that does not match the definition", () => {
    const persistedSteps = buildPersistedSteps();
    const modelAssistanceStep = persistedSteps[2];

    if (!modelAssistanceStep) {
      throw new Error("Expected a model-assistance test state.");
    }

    persistedSteps[2] = {
      ...modelAssistanceStep,
      orderIndex: 4,
    };

    expect(() =>
      buildTradeInWorkflowOrchestrationTrace(persistedSteps),
    ).toThrow(
      'Workflow state "run-field-repair-model" has order 4; expected 3.',
    );
  });
});
