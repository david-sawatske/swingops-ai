import type {
  Prisma,
  ToolCallLog,
  WorkflowRun,
  WorkflowStep,
  WorkflowStepType
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export type ExecuteWorkflowRunSimulationInput = {
  workflowRunId: string;
};

export type ExecuteWorkflowRunSimulationResult = {
  workflowRun: WorkflowRun;
  steps: WorkflowStep[];
  toolCallLogs: ToolCallLog[];
};

type WorkflowStepInputJson = {
  intakeBatchId?: string;
  intakeBatchName?: string;
  sourceType?: string;
  itemCount?: number;
};

function getStepInputJson(inputJson: unknown): WorkflowStepInputJson {
  if (!inputJson || typeof inputJson !== "object" || Array.isArray(inputJson)) {
    return {};
  }

  return inputJson as WorkflowStepInputJson;
}

function getItemCount(inputJson: unknown): number {
  const parsedInput = getStepInputJson(inputJson);

  if (typeof parsedInput.itemCount === "number") {
    return parsedInput.itemCount;
  }

  return 0;
}

function getToolNameForStepType(stepType: WorkflowStepType): string {
  switch (stepType) {
    case "PARSE_INPUT":
      return "simulate.parseInput";
    case "NORMALIZE_DATA":
      return "simulate.normalizeData";
    case "EXTRACT_GOLF_CLUB_FIELDS":
      return "simulate.extractGolfClubFields";
    case "VALIDATE_STRUCTURED_OUTPUT":
      return "simulate.validateStructuredOutput";
    case "CREATE_REVIEW_ITEM":
      return "simulate.createReviewItem";
    case "PERSIST_GOLF_CLUB":
      return "simulate.persistGolfClub";
    default:
      return "simulate.unknownStep";
  }
}

function buildSimulatedStepOutput(
  step: WorkflowStep
): Prisma.InputJsonObject {
  const itemCount = getItemCount(step.inputJson);

  switch (step.stepType) {
    case "PARSE_INPUT":
      return {
        simulated: true,
        stepType: step.stepType,
        parsedItemCount: itemCount,
        parser: "mock-freeform-golf-intake-parser-v1"
      };

    case "NORMALIZE_DATA":
      return {
        simulated: true,
        stepType: step.stepType,
        normalizedItemCount: itemCount,
        normalizedFields: ["brand", "model", "loft", "shaftFlex", "dexterity"]
      };

    case "EXTRACT_GOLF_CLUB_FIELDS":
      return {
        simulated: true,
        stepType: step.stepType,
        extractedFields: {
          brand: "TaylorMade",
          model: "Stealth 2",
          category: "DRIVER",
          loft: "10.5",
          shaftFlex: "STIFF",
          dexterity: "RIGHT_HANDED",
          condition: "VERY_GOOD"
        },
        confidenceScore: 0.92
      };

    case "VALIDATE_STRUCTURED_OUTPUT":
      return {
        simulated: true,
        stepType: step.stepType,
        validationStatus: "PASSED",
        needsReview: false,
        missingFields: []
      };

    case "CREATE_REVIEW_ITEM":
      return {
        simulated: true,
        stepType: step.stepType,
        reviewItemCreated: false,
        reason: "No review needed for deterministic happy-path simulation."
      };

    case "PERSIST_GOLF_CLUB":
      return {
        simulated: true,
        stepType: step.stepType,
        persisted: true,
        mode: "mock"
      };

    default:
      return {
        simulated: true,
        stepType: step.stepType,
        status: "No simulation output configured for this step type."
      };
  }
}

function toOptionalInputJsonValue(
  value: Prisma.JsonValue
): Prisma.InputJsonValue | undefined {
  if (value === null) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

export async function executeWorkflowRunSimulation(
  input: ExecuteWorkflowRunSimulationInput
): Promise<ExecuteWorkflowRunSimulationResult> {
  const existingWorkflowRun = await prisma.workflowRun.findUnique({
    where: {
      id: input.workflowRunId
    },
    include: {
      steps: {
        orderBy: {
          orderIndex: "asc"
        }
      }
    }
  });

  if (!existingWorkflowRun) {
    throw new Error("Workflow run not found");
  }

  const runStartedAt = existingWorkflowRun.startedAt ?? new Date();

  await prisma.workflowRun.update({
    where: {
      id: existingWorkflowRun.id
    },
    data: {
      status: "RUNNING",
      startedAt: runStartedAt,
      completedAt: null,
      errorMessage: null
    }
  });

  for (const step of existingWorkflowRun.steps) {
    const stepStartedAt = new Date();
    const outputJson = buildSimulatedStepOutput(step);

    const completedStep = await prisma.workflowStep.update({
      where: {
        id: step.id
      },
      data: {
        status: "COMPLETED",
        outputJson,
        errorMessage: null,
        startedAt: stepStartedAt,
        completedAt: new Date()
      }
    });

    const toolInputJson = toOptionalInputJsonValue(completedStep.inputJson);

    await prisma.toolCallLog.create({
      data: {
        workflowRunId: existingWorkflowRun.id,
        workflowStepId: completedStep.id,
        toolName: getToolNameForStepType(completedStep.stepType),
        status: "SUCCEEDED",
        ...(toolInputJson === undefined ? {} : { inputJson: toolInputJson }),
        outputJson,
        completedAt: completedStep.completedAt
      }
    });
  }

  const completedWorkflowRun = await prisma.workflowRun.update({
    where: {
      id: existingWorkflowRun.id
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      errorMessage: null
    },
    include: {
      steps: {
        orderBy: {
          orderIndex: "asc"
        }
      },
      toolCallLogs: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  return {
    workflowRun: completedWorkflowRun,
    steps: completedWorkflowRun.steps,
    toolCallLogs: completedWorkflowRun.toolCallLogs
  };
}
