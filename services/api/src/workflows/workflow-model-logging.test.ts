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
  it("persists provider fallback attempts and records the final successful model route", async () => {
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
    expect(modelCallLog.provider).toBe("MOCK");
    expect(modelCallLog.model).toBe("mock-golf-workflow-model");
    expect(modelCallLog.status).toBe("SUCCEEDED");
    expect(modelCallLog.latencyMs).toBeGreaterThanOrEqual(0);
    expect(modelCallLog.estimatedCostUsd).toBeGreaterThanOrEqual(0);
    expect(modelCallLog.completedAt).toBeInstanceOf(Date);

    expect(modelCallLog.requestJson).toMatchObject({
      workflowRunId: workflowRun.id,
      taskType: "INTAKE_PARSING",
      routingGoal: "HIGH_QUALITY",
      requireJson: true,
      allowDisabledProvidersForSimulation: true,
      providerFallbackExecutor: true,
      mock: true
    });

    expect(modelCallLog.responseJson).toMatchObject({
      mock: true,
      providerFallbackExecutor: true,
      routingDecision: {
        provider: "OPENAI",
        model: "gpt-4.1-mini",
        fallbackProvider: "AZURE_OPENAI",
        fallbackModel: "azure-gpt-4.1-mini",
        estimatedCostTier: "LOW",
        expectedLatencyTier: "MEDIUM",
        qualityTier: "MEDIUM",
        selectedModelMetadata: {
          provider: "OPENAI",
          model: "gpt-4.1-mini",
          supportsJson: true,
          providerEnabled: false,
          modelEnabled: true,
          enabledForExecution: false
        },
        fallbackReason: null
      },
      providerExecution: {
        outputJson: {
          mock: true,
          provider: "MOCK",
          model: "mock-golf-workflow-model",
          taskType: "INTAKE_PARSING"
        }
      }
    });

    const responseJson = modelCallLog.responseJson as {
      routingDecision?: {
        candidatesConsidered?: unknown[];
        rejectedCandidates?: unknown[];
      };
      providerExecution?: {
        attempts?: unknown[];
      };
    };

    expect(responseJson.routingDecision?.candidatesConsidered).toHaveLength(5);
    expect(responseJson.routingDecision?.rejectedCandidates).toEqual([]);
    expect(responseJson.providerExecution?.attempts).toHaveLength(3);

    const attemptLogs = await prisma.modelCallAttemptLog.findMany({
      where: {
        modelCallLogId: modelCallLog.id
      },
      orderBy: {
        attemptOrder: "asc"
      }
    });

    expect(attemptLogs).toHaveLength(3);
    expect(attemptLogs[0]).toMatchObject({
      modelCallLogId: modelCallLog.id,
      provider: "OPENAI",
      model: "gpt-4.1-mini",
      attemptOrder: 1,
      status: "SKIPPED"
    });
    expect(attemptLogs[0]?.errorMessage).toContain(
      "OPENAI real model calls are disabled"
    );

    expect(attemptLogs[1]).toMatchObject({
      modelCallLogId: modelCallLog.id,
      provider: "AZURE_OPENAI",
      model: "azure-gpt-4.1-mini",
      attemptOrder: 2,
      status: "SKIPPED"
    });
    expect(attemptLogs[1]?.errorMessage).toContain(
      "AZURE_OPENAI real model calls are disabled"
    );

    expect(attemptLogs[2]).toMatchObject({
      modelCallLogId: modelCallLog.id,
      provider: "MOCK",
      model: "mock-golf-workflow-model",
      attemptOrder: 3,
      status: "SUCCESS",
      errorMessage: null
    });
    expect(attemptLogs[2]?.completedAt).toBeInstanceOf(Date);
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
          "Fallback mock model because no eligible local model supports VALIDATION.",
        fallbackReason:
          "Fallback mock model because no eligible local model supports VALIDATION.",
        rejectedCandidates: expect.arrayContaining([
          expect.objectContaining({
            provider: "OLLAMA",
            rejectedReasons: expect.arrayContaining([
              "Does not support task type VALIDATION."
            ])
          })
        ])
      },
      providerExecution: {
        outputJson: {
          mock: true,
          provider: "MOCK",
          model: "mock-golf-workflow-model",
          taskType: "VALIDATION"
        }
      }
    });

    const attemptLogs = await prisma.modelCallAttemptLog.findMany({
      where: {
        modelCallLogId: modelCallLog.id
      },
      orderBy: {
        attemptOrder: "asc"
      }
    });

    expect(attemptLogs).toHaveLength(1);
    expect(attemptLogs[0]).toMatchObject({
      modelCallLogId: modelCallLog.id,
      provider: "MOCK",
      model: "mock-golf-workflow-model",
      attemptOrder: 1,
      status: "SUCCESS",
      latencyMs: expect.any(Number),
      estimatedCostUsd: 0
    });
  });
});
