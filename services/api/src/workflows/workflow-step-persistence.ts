import type { Prisma, WorkflowStep } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { failPersistedWorkflowRun } from "./workflow-run-failure.js";

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
    await prisma.workflowStep.update({
      where: {
        id: input.step.id
      },
      data: {
        status: "RUNNING",
        startedAt,
        completedAt: null,
        errorMessage: null,
        ...(input.inputJson === undefined ? {} : { inputJson: input.inputJson })
      }
    });

    const result = await input.execute(input.step);
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

        await transaction.workflowStep.update({
          where: {
            id: input.step.id
          },
          data: {
            status: terminalStatus,
            outputJson,
            completedAt,
            errorMessage: null
          }
        });
      });
    } else {
      await prisma.workflowStep.update({
        where: {
          id: input.step.id
        },
        data: {
          status: terminalStatus,
          outputJson,
          completedAt,
          errorMessage: null
        }
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
  await prisma.workflowStep.update({
    where: {
      id: step.id
    },
    data: {
      status: "RETRYING",
      retryCount: {
        increment: 1
      }
    }
  });
}
