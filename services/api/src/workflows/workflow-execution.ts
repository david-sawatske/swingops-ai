import type {
  Prisma,
  ReviewQueueItem,
  ToolCallLog,
  WorkflowRun,
  WorkflowStep,
  WorkflowStepType
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export type WorkflowExecutionSimulationScenario = "HAPPY_PATH" | "NEEDS_REVIEW";

export type ExecuteWorkflowRunSimulationInput = {
  workflowRunId: string;
  scenario?: WorkflowExecutionSimulationScenario;
};

export type ExecuteWorkflowRunSimulationResult = {
  workflowRun: WorkflowRun;
  steps: WorkflowStep[];
  toolCallLogs: ToolCallLog[];
  reviewQueueItems: ReviewQueueItem[];
};

type WorkflowStepInputJson = {
  intakeBatchId?: string;
  intakeBatchName?: string;
  sourceType?: string;
  itemCount?: number;
  originalText?: string;
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

function getOriginalText(inputJson: unknown): string | null {
  const parsedInput = getStepInputJson(inputJson);

  if (typeof parsedInput.originalText === "string") {
    return parsedInput.originalText;
  }

  return null;
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

function buildProposedReviewGolfClubJson(): Prisma.InputJsonObject {
  return {
    brand: "TaylorMade",
    model: "Unknown Driver",
    category: "DRIVER",
    loft: "10.5",
    shaftFlex: null,
    dexterity: "RIGHT_HANDED",
    condition: null,
    confidenceScore: 0.58,
    missingFields: ["shaftFlex", "condition"]
  };
}

function buildSimulatedStepOutput(
  step: WorkflowStep,
  scenario: WorkflowExecutionSimulationScenario
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
      if (scenario === "NEEDS_REVIEW") {
        return {
          simulated: true,
          stepType: step.stepType,
          extractedFields: buildProposedReviewGolfClubJson(),
          confidenceScore: 0.58
        };
      }

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
      if (scenario === "NEEDS_REVIEW") {
        return {
          simulated: true,
          stepType: step.stepType,
          validationStatus: "NEEDS_REVIEW",
          needsReview: true,
          reviewReason: "LOW_CONFIDENCE",
          confidenceScore: 0.58,
          missingFields: ["shaftFlex", "condition"]
        };
      }

      return {
        simulated: true,
        stepType: step.stepType,
        validationStatus: "PASSED",
        needsReview: false,
        missingFields: []
      };

    case "CREATE_REVIEW_ITEM":
      if (scenario === "NEEDS_REVIEW") {
        return {
          simulated: true,
          stepType: step.stepType,
          reviewItemCreated: true,
          reviewReason: "LOW_CONFIDENCE"
        };
      }

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
        persisted: scenario === "HAPPY_PATH",
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

async function createReviewQueueItemForWorkflowRun(input: {
  workflowRunId: string;
  originalText: string | null;
}): Promise<ReviewQueueItem> {
  return prisma.reviewQueueItem.create({
    data: {
      workflowRunId: input.workflowRunId,
      reason: "LOW_CONFIDENCE",
      status: "OPEN",
      originalText: input.originalText,
      proposedGolfClubJson: buildProposedReviewGolfClubJson()
    }
  });
}

export async function executeWorkflowRunSimulation(
  input: ExecuteWorkflowRunSimulationInput
): Promise<ExecuteWorkflowRunSimulationResult> {
  const scenario = input.scenario ?? "HAPPY_PATH";

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

  let originalTextForReview: string | null = null;

  for (const step of existingWorkflowRun.steps) {
    const stepStartedAt = new Date();
    const outputJson = buildSimulatedStepOutput(step, scenario);

    if (scenario === "NEEDS_REVIEW" && originalTextForReview === null) {
      originalTextForReview = getOriginalText(step.inputJson);
    }

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

  if (scenario === "NEEDS_REVIEW") {
    await createReviewQueueItemForWorkflowRun({
      workflowRunId: existingWorkflowRun.id,
      originalText: originalTextForReview
    });
  }

  const completedWorkflowRun = await prisma.workflowRun.update({
    where: {
      id: existingWorkflowRun.id
    },
    data: {
      status: scenario === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "COMPLETED",
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
      },
      reviewQueueItems: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  return {
    workflowRun: completedWorkflowRun,
    steps: completedWorkflowRun.steps,
    toolCallLogs: completedWorkflowRun.toolCallLogs,
    reviewQueueItems: completedWorkflowRun.reviewQueueItems
  };
}
