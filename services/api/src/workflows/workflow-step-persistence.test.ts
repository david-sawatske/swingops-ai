import { describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import {
  executePersistedWorkflowStep,
  markPersistedWorkflowStepRetrying,
  requireWorkflowStep
} from "./workflow-step-persistence.js";

async function createTestWorkflowRun(stepName: string) {
  return prisma.workflowRun.create({
    data: {
      workflowName: `workflow-step-persistence-${stepName}`,
      status: "RUNNING",
      startedAt: new Date(),
      steps: {
        create: {
          stepName,
          stepType: "PARSE_INPUT",
          orderIndex: 1
        }
      }
    },
    include: {
      steps: true
    }
  });
}

async function createOrderedTestWorkflowRun() {
  return prisma.workflowRun.create({
    data: {
      workflowName: "workflow-step-persistence-ordered",
      status: "RUNNING",
      startedAt: new Date(),
      steps: {
        create: [
          {
            stepName: "first-step",
            stepType: "PARSE_INPUT",
            orderIndex: 1
          },
          {
            stepName: "second-step",
            stepType: "RETRIEVE_EVIDENCE",
            orderIndex: 2
          }
        ]
      }
    },
    include: {
      steps: {
        orderBy: {
          orderIndex: "asc"
        }
      }
    }
  });
}

describe("persisted workflow step execution", () => {
  it("records a successful step transition with input and output", async () => {
    const workflowRun = await createTestWorkflowRun("successful-step");

    try {
      const step = requireWorkflowStep(workflowRun.steps, "successful-step");
      const result = await executePersistedWorkflowStep({
        step,
        inputJson: {
          recordCount: 2
        },
        execute() {
          return {
            acceptedRecordCount: 2
          };
        },
        buildOutputJson(value) {
          return value;
        }
      });

      expect(result.acceptedRecordCount).toBe(2);

      const persistedStep = await prisma.workflowStep.findUniqueOrThrow({
        where: {
          id: step.id
        }
      });

      expect(persistedStep).toMatchObject({
        status: "COMPLETED",
        inputJson: {
          recordCount: 2
        },
        outputJson: {
          acceptedRecordCount: 2
        },
        errorMessage: null
      });
      expect(persistedStep.startedAt).toBeInstanceOf(Date);
      expect(persistedStep.completedAt).toBeInstanceOf(Date);

    } finally {
      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });
    }
  });

  it("records a failed step transition before rethrowing the error", async () => {
    const workflowRun = await createTestWorkflowRun("failed-step");

    try {
      const step = requireWorkflowStep(workflowRun.steps, "failed-step");

      await expect(
        executePersistedWorkflowStep({
          step,
          execute() {
            throw new Error("Deliberate step failure");
          },
          buildOutputJson() {
            return {};
          }
        })
      ).rejects.toThrow("Deliberate step failure");

      const persistedStep = await prisma.workflowStep.findUniqueOrThrow({
        where: {
          id: step.id
        }
      });

      expect(persistedStep).toMatchObject({
        status: "FAILED",
        errorMessage: "Deliberate step failure"
      });
      expect(persistedStep.startedAt).toBeInstanceOf(Date);
      expect(persistedStep.completedAt).toBeInstanceOf(Date);

      const persistedRun = await prisma.workflowRun.findUniqueOrThrow({
        where: {
          id: workflowRun.id
        }
      });

      expect(persistedRun).toMatchObject({
        status: "FAILED",
        errorMessage: "Deliberate step failure"
      });
      expect(persistedRun.completedAt).toBeInstanceOf(Date);
      expect(persistedRun.failureJson).toMatchObject({
        code: "WORKFLOW_STEP_EXECUTION_FAILED",
        failedStep: {
          id: step.id,
          name: "failed-step"
        }
      });
    } finally {
      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });
    }
  });

  it("fails the run when an atomic completion side effect cannot commit", async () => {
    const workflowRun = await createTestWorkflowRun("finalization-step");

    try {
      const step = requireWorkflowStep(workflowRun.steps, "finalization-step");

      await expect(
        executePersistedWorkflowStep({
          step,
          execute() {
            return {
              workflowStatus: "COMPLETED"
            } as const;
          },
          buildOutputJson(result) {
            return result;
          },
          async onCompleted() {
            throw new Error("Finalization transaction failed");
          }
        })
      ).rejects.toThrow("Finalization transaction failed");

      const [persistedRun, persistedStep] = await Promise.all([
        prisma.workflowRun.findUniqueOrThrow({
          where: {
            id: workflowRun.id
          }
        }),
        prisma.workflowStep.findUniqueOrThrow({
          where: {
            id: step.id
          }
        })
      ]);

      expect(persistedRun).toMatchObject({
        status: "FAILED",
        errorMessage: "Finalization transaction failed"
      });
      expect(persistedStep).toMatchObject({
        status: "FAILED",
        errorMessage: "Finalization transaction failed"
      });
      expect(persistedRun.completedAt).toBeInstanceOf(Date);
      expect(persistedStep.completedAt).toBeInstanceOf(Date);
    } finally {
      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });
    }
  });

  it("rejects a step when an earlier ordered step is incomplete", async () => {
    const workflowRun = await createOrderedTestWorkflowRun();

    try {
      const secondStep = requireWorkflowStep(workflowRun.steps, "second-step");
      let executionAttempted = false;

      await expect(
        executePersistedWorkflowStep({
          step: secondStep,
          execute() {
            executionAttempted = true;
            return {};
          },
          buildOutputJson(result) {
            return result;
          }
        })
      ).rejects.toThrow(
        'cannot start before predecessor "first-step" reaches a terminal success state; current status is PENDING'
      );

      expect(executionAttempted).toBe(false);

      const [persistedRun, firstStep, persistedSecondStep] = await Promise.all([
        prisma.workflowRun.findUniqueOrThrow({
          where: {
            id: workflowRun.id
          }
        }),
        prisma.workflowStep.findUniqueOrThrow({
          where: {
            id: workflowRun.steps[0]!.id
          }
        }),
        prisma.workflowStep.findUniqueOrThrow({
          where: {
            id: secondStep.id
          }
        })
      ]);

      expect(persistedRun.status).toBe("FAILED");
      expect(firstStep.status).toBe("SKIPPED");
      expect(persistedSecondStep.status).toBe("FAILED");
    } finally {
      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });
    }
  });

  it("rejects duplicate execution after a step reaches a terminal state", async () => {
    const workflowRun = await createTestWorkflowRun("single-entry-step");

    try {
      const step = requireWorkflowStep(workflowRun.steps, "single-entry-step");

      await executePersistedWorkflowStep({
        step,
        execute() {
          return {};
        },
        buildOutputJson(result) {
          return result;
        }
      });

      await expect(
        executePersistedWorkflowStep({
          step,
          execute() {
            return {};
          },
          buildOutputJson(result) {
            return result;
          }
        })
      ).rejects.toThrow(
        'cannot transition from COMPLETED to RUNNING'
      );
    } finally {
      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });
    }
  });

  it("only allows retrying from a running step", async () => {
    const workflowRun = await createTestWorkflowRun("retry-state-step");

    try {
      const step = requireWorkflowStep(workflowRun.steps, "retry-state-step");

      await expect(markPersistedWorkflowStepRetrying(step)).rejects.toThrow(
        'cannot transition to RETRYING because it is not RUNNING'
      );

      const persistedStep = await prisma.workflowStep.findUniqueOrThrow({
        where: {
          id: step.id
        }
      });

      expect(persistedStep).toMatchObject({
        status: "PENDING",
        retryCount: 0
      });
    } finally {
      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });
    }
  });
});
