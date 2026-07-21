import type { Prisma, WorkflowStep } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Workflow step failed with an unknown error.";
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
}): Promise<Result> {
  const startedAt = new Date();

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

  try {
    const result = await input.execute(input.step);

    await prisma.workflowStep.update({
      where: {
        id: input.step.id
      },
      data: {
        status: "COMPLETED",
        outputJson: input.buildOutputJson(result),
        completedAt: new Date(),
        errorMessage: null
      }
    });

    return result;
  } catch (error) {
    await prisma.workflowStep
      .update({
        where: {
          id: input.step.id
        },
        data: {
          status: "FAILED",
          errorMessage: getErrorMessage(error),
          completedAt: new Date()
        }
      })
      .catch(() => undefined);

    throw error;
  }
}
