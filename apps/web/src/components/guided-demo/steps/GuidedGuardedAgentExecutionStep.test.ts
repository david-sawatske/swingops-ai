import { describe, expect, it } from "vitest";

import type {
  ExecuteEndToEndAgenticTradeInDemoResponse,
} from "../../../types/workflow";
import {
  getModelAssistanceScopeNotice,
  getOrchestrationSummary,
  getProviderFallbackNotice,
} from "./GuidedGuardedAgentExecutionStep";

type ProviderFallbackTrace =
  ExecuteEndToEndAgenticTradeInDemoResponse["providerFallbackTrace"];
type FieldRepairExecution =
  ExecuteEndToEndAgenticTradeInDemoResponse["fieldRepairExecution"];

const validatedExecution: FieldRepairExecution = {
  modelCallLogId: "model-call-1",
  recordOutcomes: [],
  suggestions: [],
  jsonValid: true,
  validationPassed: true,
  validationErrors: [],
};

describe("getModelAssistanceScopeNotice", () => {
  it("explains when eligible records were kept out of the bounded model request", () => {
    expect(
      getModelAssistanceScopeNotice({
        eligibleRecordCount: 10,
        selectedRecordCount: 8,
        deferredRecordCount: 2,
        maxSelectedRecordCount: 8,
      }),
    ).toBe(
      "8 of 10 eligible records were included in this bounded model request. The remaining 2 stayed in deterministic processing and were routed to human review.",
    );
  });

  it("stays hidden when every eligible record was assessed", () => {
    expect(
      getModelAssistanceScopeNotice({
        eligibleRecordCount: 4,
        selectedRecordCount: 4,
        deferredRecordCount: 0,
        maxSelectedRecordCount: 8,
      }),
    ).toBeNull();
  });
});

describe("getProviderFallbackNotice", () => {
  it("returns no notice when fallback was not used", () => {
    const trace: ProviderFallbackTrace = {
      routingGoal: "HIGH_QUALITY",
      selectedProvider: "OPENAI",
      selectedModel: "gpt-4.1-mini",
      finalProvider: "OPENAI",
      finalModel: "gpt-4.1-mini",
      fallbackUsed: false,
      simulationRequested: false,
      attempts: [
        {
          provider: "OPENAI",
          model: "gpt-4.1-mini",
          attemptOrder: 1,
          status: "SUCCESS",
          failureClass: "NONE",
          retryable: false,
          reason: "Provider succeeded.",
          errorMessage: null,
          latencyMs: 850,
          estimatedCostUsd: 0.002,
          timeoutMs: 10000,
        },
      ],
      summary: "Preferred provider completed successfully.",
    };

    expect(
      getProviderFallbackNotice(trace, validatedExecution),
    ).toBeNull();
  });

  it("explains the failed preferred attempt and successful fallback", () => {
    const trace: ProviderFallbackTrace = {
      routingGoal: "HIGH_QUALITY",
      selectedProvider: "OPENAI",
      selectedModel: "gpt-4.1-mini",
      finalProvider: "MOCK",
      finalModel: "mock-golf-workflow-model",
      fallbackUsed: true,
      simulationRequested: true,
      attempts: [
        {
          provider: "OPENAI",
          model: "gpt-4.1-mini",
          attemptOrder: 1,
          status: "FAILED",
          failureClass: "CLIENT_ERROR",
          retryable: false,
          reason:
            "Provider OPENAI / gpt-4.1-mini did not complete successfully.",
          errorMessage:
            "OPENAI adapter request failed with 400 Bad Request.",
          latencyMs: 1628,
          estimatedCostUsd: 0.0012,
          timeoutMs: 10000,
        },
        {
          provider: "MOCK",
          model: "mock-golf-workflow-model",
          attemptOrder: 2,
          status: "SUCCESS",
          failureClass: "NONE",
          retryable: false,
          reason:
            "Provider MOCK / mock-golf-workflow-model succeeded.",
          errorMessage: null,
          latencyMs: 2,
          estimatedCostUsd: 0,
          timeoutMs: 10000,
        },
      ],
      summary: "Fallback provider completed the request.",
    };

    expect(
      getProviderFallbackNotice(trace, validatedExecution),
    ).toEqual({
      title: "Fallback test passed",
      summary:
        "A simulated service error prevented OPENAI · gpt-4.1-mini from completing. MOCK · mock-golf-workflow-model completed the model review assistance.",
      statusLabel: "Simulated outage",
      preferredProvider: "OPENAI · gpt-4.1-mini",
      preferredStatus: "failed",
      reason:
        "OPENAI adapter request failed with 400 Bad Request.",
      preferredLatencyMs: 1628,
      attemptDeadlineMs: 10000,
      failureClass: "CLIENT_ERROR",
      retryable: false,
      finalProvider: "MOCK · mock-golf-workflow-model",
      finalStatus: "success",
      validationLabel: "Validation passed",
    });
  });

  it("distinguishes an automatic recovery from a requested simulation", () => {
    const trace: ProviderFallbackTrace = {
      routingGoal: "HIGH_QUALITY",
      selectedProvider: "OPENAI",
      selectedModel: "gpt-4.1-mini",
      finalProvider: "MOCK",
      finalModel: "mock-golf-workflow-model",
      fallbackUsed: true,
      simulationRequested: false,
      attempts: [
        {
          provider: "OPENAI",
          model: "gpt-4.1-mini",
          attemptOrder: 1,
          status: "TIMEOUT",
          failureClass: "TIMEOUT",
          retryable: true,
          reason: "Provider attempt timed out.",
          errorMessage: "Provider attempt timed out after 10000ms.",
          latencyMs: 10000,
          estimatedCostUsd: 0.0012,
          timeoutMs: 10000,
        },
        {
          provider: "MOCK",
          model: "mock-golf-workflow-model",
          attemptOrder: 2,
          status: "SUCCESS",
          failureClass: "NONE",
          retryable: false,
          reason: "Provider succeeded.",
          errorMessage: null,
          latencyMs: 2,
          estimatedCostUsd: 0,
          timeoutMs: 10000,
        },
      ],
      summary: "Automatic provider fallback completed the request.",
    };

    expect(
      getProviderFallbackNotice(trace, validatedExecution),
    ).toMatchObject({
      title: "Automatic fallback completed this run",
      summary:
        "OPENAI · gpt-4.1-mini did not complete successfully. MOCK · mock-golf-workflow-model completed the model review assistance.",
      statusLabel: "Automatic recovery",
    });
  });
});

describe("getOrchestrationSummary", () => {
  it("counts terminal and model-assisted states", () => {
    expect(
      getOrchestrationSummary({
        mode: "DETERMINISTIC_STATE_MACHINE",
        transitionAuthority: "APPLICATION_CODE",
        description: "Application code owns every transition.",
        states: [
          {
            stateId: "parse",
            orderIndex: 1,
            label: "Parse",
            status: "COMPLETED",
            enteredFromStateId: null,
            transitionGuard: "Input is valid.",
            transitionAuthority: "APPLICATION_CODE",
            executionKind: "DETERMINISTIC",
            modelAuthority: "NONE",
            retryCount: 0,
            startedAt: null,
            completedAt: null,
          },
          {
            stateId: "repair",
            orderIndex: 2,
            label: "Repair",
            status: "COMPLETED",
            enteredFromStateId: "parse",
            transitionGuard: "Evidence is ready.",
            transitionAuthority: "APPLICATION_CODE",
            executionKind: "BOUNDED_MODEL_ASSISTANCE",
            modelAuthority: "ADVISORY_ONLY",
            retryCount: 0,
            startedAt: null,
            completedAt: null,
          },
          {
            stateId: "retry",
            orderIndex: 3,
            label: "Retry",
            status: "SKIPPED",
            enteredFromStateId: "repair",
            transitionGuard: "Retry eligibility is checked.",
            transitionAuthority: "APPLICATION_CODE",
            executionKind: "BOUNDED_MODEL_ASSISTANCE",
            modelAuthority: "ADVISORY_ONLY",
            retryCount: 0,
            startedAt: null,
            completedAt: null,
          },
        ],
        modelBoundary: {
          authority: "ADVISORY_ONLY",
          assistedStateIds: ["repair", "retry"],
          allowedActions: [],
          prohibitedActions: [],
        },
      }),
    ).toEqual({
      stateCount: 3,
      completedStateCount: 3,
      modelAssistedStateCount: 2,
    });
  });
});
