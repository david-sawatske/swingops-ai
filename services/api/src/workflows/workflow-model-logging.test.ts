import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import { createMockModelCallLogForWorkflowRun } from "./workflow-model-logging.js";

const testWorkflowName = "test-model-routing-workflow";

afterEach(async () => {
  await prisma.workflowRun.deleteMany({
    where: {
      workflowName: testWorkflowName
    }
  });
});

describe("workflow model logging", () => {
  it("creates a succeeded mock model call log using the selected route decision", async () => {
    const workflowRun = await prisma.workflowRun.create({
      data: {
        workflowName: testWorkflowName
      }
    });

    const modelCallLog = await createMockModelCallLogForWorkflowRun({
      workflowRunId: workflowRun.id,
      taskType: "INTAKE_PARSING",
      goal: "HIGH_QUALITY"
    });

    expect(modelCallLog.workflowRunId).toBe(workflowRun.id);
    expect(modelCallLog.provider).toBe("ANTHROPIC");
    expect(modelCallLog.model).toBe("claude-3-5-sonnet");
    expect(modelCallLog.status).toBe("SUCCEEDED");
    expect(modelCallLog.latencyMs).toBe(0);
    expect(modelCallLog.estimatedCostUsd).toBe(0);
    expect(modelCallLog.completedAt).toBeInstanceOf(Date);

    expect(modelCallLog.requestJson).toMatchObject({
      workflowRunId: workflowRun.id,
      taskType: "INTAKE_PARSING",
      routingGoal: "HIGH_QUALITY",
      mock: true
    });

    expect(modelCallLog.responseJson).toMatchObject({
      mock: true,
      routingDecision: {
        provider: "ANTHROPIC",
        model: "claude-3-5-sonnet",
        estimatedCostTier: "HIGH",
        expectedLatencyTier: "MEDIUM",
        qualityTier: "HIGH"
      }
    });
  });

  it("records fallback routing metadata for unsupported local-only tasks", async () => {
    const workflowRun = await prisma.workflowRun.create({
      data: {
        workflowName: testWorkflowName
      }
    });

    const modelCallLog = await createMockModelCallLogForWorkflowRun({
      workflowRunId: workflowRun.id,
      taskType: "VALIDATION",
      goal: "LOCAL_ONLY"
    });

    expect(modelCallLog.provider).toBe("MOCK");
    expect(modelCallLog.model).toBe("mock-golf-workflow-model");

    expect(modelCallLog.responseJson).toMatchObject({
      routingDecision: {
        provider: "MOCK",
        reason:
          "Fallback mock model because no local model supports VALIDATION."
      }
    });
  });
});
