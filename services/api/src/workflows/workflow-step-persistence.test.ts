import { describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import {
  executePersistedWorkflowStep,
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
    } finally {
      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });
    }
  });
});
