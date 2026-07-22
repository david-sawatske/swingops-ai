import type { WorkflowStep } from "@prisma/client";

export const TRADE_IN_WORKFLOW_STEP_NAMES = {
  parseInput: "parse-and-persist-intake",
  retrieveEvidence: "retrieve-grounding-evidence",
  modelAssistance: "run-field-repair-model",
  validateOutput: "validate-field-repair-output",
  targetedRetry: "retry-targeted-field-extraction",
  createReviewItems: "create-human-review-work",
  executeTools: "execute-guarded-tool-plan",
  finalize: "finalize-workflow-run",
} as const;

export type WorkflowOrchestrationExecutionKind =
  "DETERMINISTIC" | "BOUNDED_MODEL_ASSISTANCE";

export type WorkflowOrchestrationState = {
  stateId: string;
  orderIndex: number;
  label: string;
  status: WorkflowStep["status"];
  enteredFromStateId: string | null;
  transitionGuard: string;
  transitionAuthority: "APPLICATION_CODE";
  executionKind: WorkflowOrchestrationExecutionKind;
  modelAuthority: "NONE" | "ADVISORY_ONLY";
  retryCount: number;
  startedAt: string | null;
  completedAt: string | null;
};

export type WorkflowOrchestrationTrace = {
  mode: "DETERMINISTIC_STATE_MACHINE";
  transitionAuthority: "APPLICATION_CODE";
  description: string;
  states: WorkflowOrchestrationState[];
  modelBoundary: {
    authority: "ADVISORY_ONLY";
    assistedStateIds: string[];
    allowedActions: string[];
    prohibitedActions: string[];
  };
};

type PersistedOrchestrationStep = Pick<
  WorkflowStep,
  | "stepName"
  | "orderIndex"
  | "status"
  | "retryCount"
  | "startedAt"
  | "completedAt"
>;

type OrchestrationStateDefinition = {
  stateId: string;
  label: string;
  transitionGuard: string;
  executionKind: WorkflowOrchestrationExecutionKind;
};

const TRADE_IN_ORCHESTRATION_STATE_DEFINITIONS: OrchestrationStateDefinition[] =
  [
    {
      stateId: TRADE_IN_WORKFLOW_STEP_NAMES.parseInput,
      label: "Parse and persist intake",
      transitionGuard:
        "Validated source input is parsed and persisted before the run is created.",
      executionKind: "DETERMINISTIC",
    },
    {
      stateId: TRADE_IN_WORKFLOW_STEP_NAMES.retrieveEvidence,
      label: "Retrieve grounding evidence",
      transitionGuard: "The run is active and the intake state has completed.",
      executionKind: "DETERMINISTIC",
    },
    {
      stateId: TRADE_IN_WORKFLOW_STEP_NAMES.modelAssistance,
      label: "Request bounded field-repair advice",
      transitionGuard:
        "The run is active, evidence retrieval has completed, and application code selected the records and evidence packet.",
      executionKind: "BOUNDED_MODEL_ASSISTANCE",
    },
    {
      stateId: TRADE_IN_WORKFLOW_STEP_NAMES.validateOutput,
      label: "Validate field-repair output",
      transitionGuard:
        "The run is active and model assistance returned or safely withheld an advisory result.",
      executionKind: "DETERMINISTIC",
    },
    {
      stateId: TRADE_IN_WORKFLOW_STEP_NAMES.targetedRetry,
      label: "Evaluate one targeted field retry",
      transitionGuard:
        "The run is active, validation has completed, and application code found one retry-eligible field.",
      executionKind: "BOUNDED_MODEL_ASSISTANCE",
    },
    {
      stateId: TRADE_IN_WORKFLOW_STEP_NAMES.createReviewItems,
      label: "Create human-review work",
      transitionGuard:
        "The run is active and all bounded repair and retry paths have reached a terminal state.",
      executionKind: "DETERMINISTIC",
    },
    {
      stateId: TRADE_IN_WORKFLOW_STEP_NAMES.executeTools,
      label: "Execute the guarded tool plan",
      transitionGuard:
        "The run is active, review routing has completed, and application policy has classified every tool call.",
      executionKind: "DETERMINISTIC",
    },
    {
      stateId: TRADE_IN_WORKFLOW_STEP_NAMES.finalize,
      label: "Finalize the workflow run",
      transitionGuard:
        "All preceding states are completed or intentionally skipped and the application has computed the terminal run status.",
      executionKind: "DETERMINISTIC",
    },
  ];

const ALLOWED_MODEL_ACTIONS = [
  "Assess only records selected by application code using the supplied evidence packet.",
  "Return schema-validated advisory field-repair outcomes.",
  "Attempt one application-selected field retry when the retry guard allows it.",
];

const PROHIBITED_MODEL_ACTIONS = [
  "Choose or change workflow states.",
  "Select or execute tools.",
  "Authorize mutations.",
  "Write final records.",
  "Approve, dismiss, or resolve human-review work.",
];

export function buildTradeInWorkflowOrchestrationTrace(
  persistedSteps: PersistedOrchestrationStep[],
): WorkflowOrchestrationTrace {
  const states = TRADE_IN_ORCHESTRATION_STATE_DEFINITIONS.map(
    (definition, index) => {
      const matchingSteps = persistedSteps.filter(
        (step) => step.stepName === definition.stateId,
      );

      if (matchingSteps.length !== 1) {
        throw new Error(
          `Expected exactly one persisted workflow state named "${definition.stateId}", found ${matchingSteps.length}.`,
        );
      }

      const persistedStep = matchingSteps[0]!;
      const expectedOrderIndex = index + 1;

      if (persistedStep.orderIndex !== expectedOrderIndex) {
        throw new Error(
          `Workflow state "${definition.stateId}" has order ${persistedStep.orderIndex}; expected ${expectedOrderIndex}.`,
        );
      }

      return {
        stateId: definition.stateId,
        orderIndex: persistedStep.orderIndex,
        label: definition.label,
        status: persistedStep.status,
        enteredFromStateId:
          TRADE_IN_ORCHESTRATION_STATE_DEFINITIONS[index - 1]?.stateId ?? null,
        transitionGuard: definition.transitionGuard,
        transitionAuthority: "APPLICATION_CODE",
        executionKind: definition.executionKind,
        modelAuthority:
          definition.executionKind === "BOUNDED_MODEL_ASSISTANCE"
            ? "ADVISORY_ONLY"
            : "NONE",
        retryCount: persistedStep.retryCount,
        startedAt: persistedStep.startedAt?.toISOString() ?? null,
        completedAt: persistedStep.completedAt?.toISOString() ?? null,
      } satisfies WorkflowOrchestrationState;
    },
  );

  return {
    mode: "DETERMINISTIC_STATE_MACHINE",
    transitionAuthority: "APPLICATION_CODE",
    description:
      "Application code owns the ordered state transitions, validation gates, tool policy, persistence, and terminal status. Model calls are limited to advisory field repair in two bounded states.",
    states,
    modelBoundary: {
      authority: "ADVISORY_ONLY",
      assistedStateIds: states
        .filter((state) => state.executionKind === "BOUNDED_MODEL_ASSISTANCE")
        .map((state) => state.stateId),
      allowedActions: [...ALLOWED_MODEL_ACTIONS],
      prohibitedActions: [...PROHIBITED_MODEL_ACTIONS],
    },
  };
}
