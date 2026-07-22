import type { Prisma, WorkflowRun, WorkflowStep } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

const ACTIVE_WORKFLOW_RUN_STATUSES = ["QUEUED", "RUNNING"] as const;
const ACTIVE_WORKFLOW_STEP_STATUSES = ["RUNNING", "RETRYING"] as const;
const MAX_ERROR_MESSAGE_LENGTH = 4000;

function getErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : "Workflow step failed with an unknown error.";

  return message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

function getErrorName(error: unknown): string {
  return error instanceof Error && error.name.trim()
    ? error.name
    : "UnknownError";
}

function getErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.trim()
  ) {
    return error.code.slice(0, 120);
  }

  return null;
}

function buildWorkflowFailureDetails(input: {
  step: WorkflowStep;
  error: unknown;
  occurredAt: Date;
}) {
  const message = getErrorMessage(input.error);

  return {
    schemaVersion: 1,
    code: "WORKFLOW_STEP_EXECUTION_FAILED",
    message,
    occurredAt: input.occurredAt.toISOString(),
    failedStep: {
      id: input.step.id,
      name: input.step.stepName,
      type: input.step.stepType,
      orderIndex: input.step.orderIndex,
    },
    cause: {
      name: getErrorName(input.error),
      code: getErrorCode(input.error),
      message,
    },
  } as const satisfies Prisma.InputJsonObject;
}

export async function failPersistedWorkflowRun(input: {
  step: WorkflowStep;
  error: unknown;
}): Promise<WorkflowRun> {
  const existingRun = await prisma.workflowRun.findUniqueOrThrow({
    where: {
      id: input.step.workflowRunId,
    },
  });

  if (existingRun.status !== "QUEUED" && existingRun.status !== "RUNNING") {
    return existingRun;
  }

  const occurredAt = new Date();
  const failureDetails = buildWorkflowFailureDetails({
    step: input.step,
    error: input.error,
    occurredAt,
  });
  const errorMessage = failureDetails.message;
  const stoppedMessage = `Stopped because workflow step "${input.step.stepName}" failed.`;
  const skippedMessage = `Skipped because workflow step "${input.step.stepName}" failed.`;

  await prisma.$transaction(async (transaction) => {
    const transition = await transaction.workflowRun.updateMany({
      where: {
        id: input.step.workflowRunId,
        status: {
          in: [...ACTIVE_WORKFLOW_RUN_STATUSES],
        },
      },
      data: {
        status: "FAILED",
        completedAt: occurredAt,
        errorMessage,
        failureJson: failureDetails,
      },
    });

    if (transition.count === 0) {
      return;
    }

    await transaction.workflowStep.updateMany({
      where: {
        id: input.step.id,
        status: {
          in: ["PENDING", ...ACTIVE_WORKFLOW_STEP_STATUSES],
        },
      },
      data: {
        status: "FAILED",
        outputJson: {
          failure: failureDetails,
        },
        errorMessage,
        completedAt: occurredAt,
      },
    });

    await transaction.workflowStep.updateMany({
      where: {
        workflowRunId: input.step.workflowRunId,
        id: {
          not: input.step.id,
        },
        status: {
          in: [...ACTIVE_WORKFLOW_STEP_STATUSES],
        },
      },
      data: {
        status: "FAILED",
        errorMessage: stoppedMessage,
        completedAt: occurredAt,
      },
    });

    await transaction.workflowStep.updateMany({
      where: {
        workflowRunId: input.step.workflowRunId,
        id: {
          not: input.step.id,
        },
        status: "PENDING",
      },
      data: {
        status: "SKIPPED",
        errorMessage: skippedMessage,
        completedAt: occurredAt,
      },
    });

    await transaction.toolCallLog.updateMany({
      where: {
        workflowRunId: input.step.workflowRunId,
        status: "STARTED",
      },
      data: {
        status: "FAILED",
        errorMessage: stoppedMessage,
        completedAt: occurredAt,
      },
    });

    await transaction.modelCallLog.updateMany({
      where: {
        workflowRunId: input.step.workflowRunId,
        status: "STARTED",
      },
      data: {
        status: "FAILED",
        errorMessage: stoppedMessage,
        completedAt: occurredAt,
      },
    });

    if (existingRun.intakeBatchId) {
      await transaction.intakeBatch.updateMany({
        where: {
          id: existingRun.intakeBatchId,
          status: {
            in: ["QUEUED", "PROCESSING"],
          },
        },
        data: {
          status: "FAILED",
        },
      });

      await transaction.intakeItem.updateMany({
        where: {
          intakeBatchId: existingRun.intakeBatchId,
          status: {
            in: ["PENDING", "PROCESSING"],
          },
        },
        data: {
          status: "FAILED",
        },
      });
    }
  });

  return prisma.workflowRun.findUniqueOrThrow({
    where: {
      id: input.step.workflowRunId,
    },
  });
}

export async function failIntakeBatchAfterWorkflowSetupError(
  intakeBatchId: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.intakeBatch.updateMany({
      where: {
        id: intakeBatchId,
        status: {
          in: ["QUEUED", "PROCESSING"],
        },
      },
      data: {
        status: "FAILED",
      },
    }),
    prisma.intakeItem.updateMany({
      where: {
        intakeBatchId,
        status: {
          in: ["PENDING", "PROCESSING"],
        },
      },
      data: {
        status: "FAILED",
      },
    }),
  ]);
}
