import { describe, expect, it } from "vitest";

import { LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE } from "../intake/legacy-intake-source-types.js";
import { prisma } from "../lib/prisma.js";
import {
  failIntakeBatchAfterWorkflowSetupError,
  failPersistedWorkflowRun
} from "./workflow-run-failure.js";

describe("workflow run failure transitions", () => {
  it("closes a processing batch when workflow setup cannot finish", async () => {
    const intakeBatch = await prisma.intakeBatch.create({
      data: {
        name: "Workflow setup failure test",
        sourceType: LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE,
        status: "PROCESSING",
        itemCount: 1,
        items: {
          create: {
            rawText: "Pending workflow setup item",
            status: "PROCESSING"
          }
        }
      }
    });

    try {
      await failIntakeBatchAfterWorkflowSetupError(intakeBatch.id);
      await failIntakeBatchAfterWorkflowSetupError(intakeBatch.id);

      const persistedBatch = await prisma.intakeBatch.findUniqueOrThrow({
        where: {
          id: intakeBatch.id
        },
        include: {
          items: true
        }
      });

      expect(persistedBatch.status).toBe("FAILED");
      expect(persistedBatch.items[0]?.status).toBe("FAILED");
    } finally {
      await prisma.intakeBatch.delete({
        where: {
          id: intakeBatch.id
        }
      });
    }
  });

  it("atomically closes a run, its active work, and its intake batch", async () => {
    const intakeBatch = await prisma.intakeBatch.create({
      data: {
        name: "Workflow failure transition test",
        sourceType: LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE,
        status: "PROCESSING",
        itemCount: 2,
        items: {
          create: [
            {
              rawText: "Active intake item",
              status: "PROCESSING"
            },
            {
              rawText: "Already structured intake item",
              status: "STRUCTURED"
            }
          ]
        }
      },
      include: {
        items: true
      }
    });

    const workflowRun = await prisma.workflowRun.create({
      data: {
        intakeBatchId: intakeBatch.id,
        workflowName: "workflow-failure-transition-test",
        status: "RUNNING",
        startedAt: new Date(),
        steps: {
          create: [
            {
              stepName: "completed-step",
              stepType: "PARSE_INPUT",
              status: "COMPLETED",
              orderIndex: 1,
              startedAt: new Date(),
              completedAt: new Date()
            },
            {
              stepName: "failed-step",
              stepType: "RETRIEVE_EVIDENCE",
              status: "RUNNING",
              orderIndex: 2,
              startedAt: new Date()
            },
            {
              stepName: "other-active-step",
              stepType: "EXTRACT_GOLF_CLUB_FIELDS",
              status: "RETRYING",
              orderIndex: 3,
              startedAt: new Date()
            },
            {
              stepName: "future-step",
              stepType: "FINALIZE_WORKFLOW",
              orderIndex: 4
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

    const failedStep = workflowRun.steps[1]!;

    await prisma.toolCallLog.create({
      data: {
        workflowRunId: workflowRun.id,
        workflowStepId: failedStep.id,
        toolName: "swingops.test.activeTool",
        status: "STARTED"
      }
    });

    await prisma.modelCallLog.create({
      data: {
        workflowRunId: workflowRun.id,
        workflowStepId: failedStep.id,
        provider: "MOCK",
        model: "active-test-model",
        status: "STARTED"
      }
    });

    try {
      const providerError = Object.assign(
        new Error("Provider connection was interrupted."),
        {
          code: "UPSTREAM_UNAVAILABLE"
        }
      );
      const failedRun = await failPersistedWorkflowRun({
        step: failedStep,
        error: providerError
      });

      expect(failedRun).toMatchObject({
        status: "FAILED",
        errorMessage: "Provider connection was interrupted."
      });
      expect(failedRun.completedAt).toBeInstanceOf(Date);
      expect(failedRun.failureJson).toMatchObject({
        schemaVersion: 1,
        code: "WORKFLOW_STEP_EXECUTION_FAILED",
        message: "Provider connection was interrupted.",
        occurredAt: expect.any(String),
        failedStep: {
          id: failedStep.id,
          name: "failed-step",
          type: "RETRIEVE_EVIDENCE",
          orderIndex: 2
        },
        cause: {
          name: "Error",
          code: "UPSTREAM_UNAVAILABLE",
          message: "Provider connection was interrupted."
        }
      });

      const steps = await prisma.workflowStep.findMany({
        where: {
          workflowRunId: workflowRun.id
        },
        orderBy: {
          orderIndex: "asc"
        }
      });

      expect(steps.map((step) => step.status)).toEqual([
        "COMPLETED",
        "FAILED",
        "FAILED",
        "SKIPPED"
      ]);
      expect(steps[0]?.completedAt).toBeInstanceOf(Date);
      expect(steps.slice(1).every((step) => step.completedAt !== null)).toBe(true);
      expect(steps[1]?.outputJson).toMatchObject({
        failure: {
          code: "WORKFLOW_STEP_EXECUTION_FAILED"
        }
      });

      const persistedBatch = await prisma.intakeBatch.findUniqueOrThrow({
        where: {
          id: intakeBatch.id
        },
        include: {
          items: {
            orderBy: {
              createdAt: "asc"
            }
          }
        }
      });

      expect(persistedBatch.status).toBe("FAILED");
      expect(
        Object.fromEntries(
          persistedBatch.items.map((item) => [item.rawText, item.status])
        )
      ).toEqual({
        "Active intake item": "FAILED",
        "Already structured intake item": "STRUCTURED"
      });

      const [toolCallLog, modelCallLog] = await Promise.all([
        prisma.toolCallLog.findFirstOrThrow({
          where: {
            workflowRunId: workflowRun.id
          }
        }),
        prisma.modelCallLog.findFirstOrThrow({
          where: {
            workflowRunId: workflowRun.id
          }
        })
      ]);

      expect(toolCallLog.status).toBe("FAILED");
      expect(toolCallLog.completedAt).toBeInstanceOf(Date);
      expect(modelCallLog.status).toBe("FAILED");
      expect(modelCallLog.completedAt).toBeInstanceOf(Date);

      const originalCompletedAt = failedRun.completedAt?.getTime();
      const originalFailureJson = failedRun.failureJson;
      const repeatedTransition = await failPersistedWorkflowRun({
        step: failedStep,
        error: new Error("A later error must not replace the first failure.")
      });

      expect(repeatedTransition.completedAt?.getTime()).toBe(originalCompletedAt);
      expect(repeatedTransition.failureJson).toEqual(originalFailureJson);
      expect(repeatedTransition.errorMessage).toBe(
        "Provider connection was interrupted."
      );
    } finally {
      await prisma.toolCallLog.deleteMany({
        where: {
          workflowRunId: workflowRun.id
        }
      });
      await prisma.modelCallLog.deleteMany({
        where: {
          workflowRunId: workflowRun.id
        }
      });
      await prisma.workflowRun.delete({
        where: {
          id: workflowRun.id
        }
      });
      await prisma.intakeBatch.delete({
        where: {
          id: intakeBatch.id
        }
      });
    }
  });
});
