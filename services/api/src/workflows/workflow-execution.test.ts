import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import { executeWorkflowRunSimulation } from "./workflow-execution.js";

const testWorkflowName = "test-workflow-execution";

const testWorkflowSteps = [
  {
    stepName: "Parse intake input",
    stepType: "PARSE_INPUT" as const,
    orderIndex: 1
  },
  {
    stepName: "Normalize trade-in data",
    stepType: "NORMALIZE_DATA" as const,
    orderIndex: 2
  },
  {
    stepName: "Extract golf club fields",
    stepType: "EXTRACT_GOLF_CLUB_FIELDS" as const,
    orderIndex: 3
  },
  {
    stepName: "Validate structured output",
    stepType: "VALIDATE_STRUCTURED_OUTPUT" as const,
    orderIndex: 4
  }
];

afterEach(async () => {
  await prisma.workflowRun.deleteMany({
    where: {
      workflowName: testWorkflowName
    }
  });
});

describe("workflow execution simulation", () => {
  it("completes pending workflow steps with deterministic execution outputs", async () => {
    const workflowRun = await prisma.workflowRun.create({
      data: {
        workflowName: testWorkflowName,
        status: "QUEUED",
        steps: {
          create: testWorkflowSteps.map((step) => ({
            ...step,
            status: "PENDING" as const,
            inputJson: {
              intakeBatchId: "test-batch-1",
              intakeBatchName: "Execution Test Batch",
              sourceType: "FREEFORM_NOTES",
              itemCount: 1
            }
          }))
        }
      }
    });

    const result = await executeWorkflowRunSimulation({
      workflowRunId: workflowRun.id
    });

    expect(result.workflowRun.id).toBe(workflowRun.id);
    expect(result.workflowRun.status).toBe("COMPLETED");
    expect(result.workflowRun.startedAt).toBeInstanceOf(Date);
    expect(result.workflowRun.completedAt).toBeInstanceOf(Date);
    expect(result.workflowRun.errorMessage).toBeNull();

    expect(result.steps).toHaveLength(testWorkflowSteps.length);
    expect(result.steps.map((step) => step.status)).toEqual([
      "COMPLETED",
      "COMPLETED",
      "COMPLETED",
      "COMPLETED"
    ]);
    expect(result.steps.map((step) => step.orderIndex)).toEqual([1, 2, 3, 4]);

    expect(result.steps[0]!.outputJson).toMatchObject({
      simulated: true,
      stepType: "PARSE_INPUT",
      parsedItemCount: 1
    });

    expect(result.steps[1]!.outputJson).toMatchObject({
      simulated: true,
      stepType: "NORMALIZE_DATA",
      normalizedItemCount: 1
    });

    expect(result.steps[2]!.outputJson).toMatchObject({
      simulated: true,
      stepType: "EXTRACT_GOLF_CLUB_FIELDS",
      extractedFields: {
        brand: "TaylorMade",
        model: "Stealth 2",
        category: "DRIVER",
        dexterity: "RIGHT_HANDED"
      }
    });

    expect(result.steps[3]!.outputJson).toMatchObject({
      simulated: true,
      stepType: "VALIDATE_STRUCTURED_OUTPUT",
      validationStatus: "PASSED",
      needsReview: false
    });

    for (const step of result.steps) {
      expect(step.inputJson).toBeTruthy();
      expect(step.startedAt).toBeInstanceOf(Date);
      expect(step.completedAt).toBeInstanceOf(Date);
      expect(step.errorMessage).toBeNull();
    }

    expect(result.toolCallLogs).toHaveLength(testWorkflowSteps.length);
    expect(result.toolCallLogs.map((log) => log.status)).toEqual([
      "SUCCEEDED",
      "SUCCEEDED",
      "SUCCEEDED",
      "SUCCEEDED"
    ]);
    expect(result.toolCallLogs.map((log) => log.toolName)).toEqual([
      "simulate.parseInput",
      "simulate.normalizeData",
      "simulate.extractGolfClubFields",
      "simulate.validateStructuredOutput"
    ]);
  });
});
