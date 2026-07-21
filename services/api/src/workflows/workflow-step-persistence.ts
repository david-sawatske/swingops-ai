import type { Prisma, WorkflowStep } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { failPersistedWorkflowRun } from "./workflow-run-failure.js";

const COMPLETED_PREDECESSOR_STATUSES = ["COMPLETED", "SKIPPED"] as const;
const ACTIVE_STEP_STATUSES = ["RUNNING", "RETRYING"] as const;

async function startPersistedWorkflowStep(
  step: WorkflowStep,
  startedAt: Date,
  inputJson?: Prisma.InputJsonValue
): Promise<WorkflowStep> {
  return prisma.$transaction(async (transaction) => {
    const persistedStep = await transaction.workflowStep.findUniqueOrThrow({
      where: {
        id: step.id
      }
    });

    const workflowRun = await transaction.workflowRun.findUniqueOrThrow({
      where: {
        id: persistedStep.workflowRunId
      },
      select: {
        status: true
      }
    });

    if (workflowRun.status !== "RUNNING") {
      throw new Error(
        `Workflow step "${persistedStep.stepName}" cannot start while run status is ${workflowRun.status}.`
      );
    }

    const incompletePredecessor = await transaction.workflowStep.findFirst({
      where: {
        workflowRunId: persistedStep.workflowRunId,
        orderIndex: {
          lt: persistedStep.orderIndex
        },
        status: {
          notIn: [...COMPLETED_PREDECESSOR_STATUSES]
        }
      },
      orderBy: {
        orderIndex: "asc"
      }
    });

    if (incompletePredecessor) {
      throw new Error(
        `Workflow step "${persistedStep.stepName}" cannot start before predecessor "${incompletePredecessor.stepName}" reaches a terminal success state; current status is ${incompletePredecessor.status}.`
      );
    }

    const transition = await transaction.workflowStep.updateMany({
      where: {
        id: persistedStep.id,
        workflowRunId: persistedStep.workflowRunId,
        status: "PENDING"
      },
      data: {
        status: "RUNNING",
        startedAt,
        completedAt: null,
        errorMessage: null,
        ...(inputJson === undefined ? {} : { inputJson })
      }
    });

    if (transition.count !== 1) {
      throw new Error(
        `Workflow step "${persistedStep.stepName}" cannot transition from ${persistedStep.status} to RUNNING.`
      );
    }

    return transaction.workflowStep.findUniqueOrThrow({
      where: {
        id: persistedStep.id
      }
    });
  });
}

async function completePersistedWorkflowStep(input: {
  transaction: Prisma.TransactionClient;
  step: WorkflowStep;
  status: "COMPLETED" | "SKIPPED";
  outputJson: Prisma.InputJsonValue;
  completedAt: Date;
}): Promise<void> {
  const transition = await input.transaction.workflowStep.updateMany({
    where: {
      id: input.step.id,
      workflowRunId: input.step.workflowRunId,
      status: {
        in: [...ACTIVE_STEP_STATUSES]
      }
    },
    data: {
      status: input.status,
      outputJson: input.outputJson,
      completedAt: input.completedAt,
      errorMessage: null
    }
  });

  if (transition.count !== 1) {
    throw new Error(
      `Workflow step "${input.step.stepName}" cannot transition to ${input.status} because it is not active.`
    );
  }
}

export function requireWorkflowStep(
  steps: WorkflowStep[],
  stepName: string
): WorkflowStep {
  const step = steps.find((candidate) => candidate.stepName === stepName);

  if (!step) {
    throw new Error(`Workflow plan is missing required step: ${stepName}.`);
  }

  return step;
}

export async function executePersistedWorkflowStep<Result>(input: {
  step: WorkflowStep;
  inputJson?: Prisma.InputJsonValue;
  execute: (step: WorkflowStep) => Promise<Result> | Result;
  buildOutputJson: (result: Result) => Prisma.InputJsonValue;
  getTerminalStatus?: (result: Result) => "COMPLETED" | "SKIPPED";
  onCompleted?: (input: {
    transaction: Prisma.TransactionClient;
    result: Result;
    completedAt: Date;
  }) => Promise<void>;
}): Promise<Result> {
  const startedAt = new Date();

  try {
    const startedStep = await startPersistedWorkflowStep(
      input.step,
      startedAt,
      input.inputJson
    );

    const result = await input.execute(startedStep);
    const outputJson = input.buildOutputJson(result);
    const terminalStatus = input.getTerminalStatus?.(result) ?? "COMPLETED";
    const completedAt = new Date();

    const onCompleted = input.onCompleted;

    if (onCompleted) {
      await prisma.$transaction(async (transaction) => {
        await onCompleted({
          transaction,
          result,
          completedAt
        });

        await completePersistedWorkflowStep({
          transaction,
          step: startedStep,
          status: terminalStatus,
          outputJson,
          completedAt
        });
      });
    } else {
      await prisma.$transaction(async (transaction) => {
        await completePersistedWorkflowStep({
          transaction,
          step: startedStep,
          status: terminalStatus,
          outputJson,
          completedAt
        });
      });
    }

    return result;
  } catch (error) {
    await failPersistedWorkflowRun({
      step: input.step,
      error
    })
      .catch(() => undefined);

    throw error;
  }
}

export async function markPersistedWorkflowStepRetrying(
  step: WorkflowStep
): Promise<void> {
  const transition = await prisma.workflowStep.updateMany({
    where: {
      id: step.id,
      workflowRunId: step.workflowRunId,
      status: "RUNNING"
    },
    data: {
      status: "RETRYING",
      retryCount: {
        increment: 1
      }
    }
  });

  if (transition.count !== 1) {
    throw new Error(
      `Workflow step "${step.stepName}" cannot transition to RETRYING because it is not RUNNING.`
    );
  }
}
