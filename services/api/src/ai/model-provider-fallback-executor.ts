import { getModelProvider } from "./model-provider-registry.js";
import { isModelProviderAdapterError } from "./model-provider-errors.js";
import {
  routeModel,
  type ModelRouteCandidateSummary,
  type ModelRouteDecision,
  type ModelRoutingGoal
} from "./model-router.js";
import type {
  ModelProviderExecuteResult,
  ModelProviderName,
  ModelProviderOutputSchema,
  ModelTaskType
} from "./model-provider.types.js";
import {
  getModelProviderRuntimeConfig,
  type ModelProviderFetch,
  type ModelProviderRuntimeConfig
} from "./model-provider-runtime-config.js";

export type ModelProviderFallbackAttemptStatus =
  | "SUCCESS"
  | "FAILED"
  | "SKIPPED"
  | "TIMEOUT"
  | "UNHEALTHY"
  | "DISABLED"
  | "RATE_LIMITED";

export type ModelProviderFailureClass =
  | "NONE"
  | "CONFIGURATION"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "SERVER_ERROR"
  | "CLIENT_ERROR"
  | "INVALID_RESPONSE"
  | "OUTPUT_VALIDATION"
  | "CANCELLED"
  | "UNKNOWN";

export const DEFAULT_PROVIDER_ATTEMPT_TIMEOUT_MS = 10_000;
export const DEFAULT_PROVIDER_WORKFLOW_TIMEOUT_MS = 25_000;

export type ModelProviderFallbackAttempt = {
  provider: ModelProviderName;
  model: string;
  attemptOrder: number;
  status: ModelProviderFallbackAttemptStatus;
  failureClass: ModelProviderFailureClass;
  retryable: boolean;
  reason: string;
  errorMessage: string | null;
  latencyMs: number;
  estimatedCostUsd: number;
  timeoutMs: number;
  startedAt: Date;
  completedAt: Date;
};

export type ModelProviderOutputValidationResult = {
  jsonValid: boolean;
  validationPassed: boolean;
  validationErrors: string[];
};

export type ExecuteModelWithProviderFallbackInput = {
  taskType: ModelTaskType;
  goal: ModelRoutingGoal;
  inputJson: Record<string, unknown>;
  outputSchema?: ModelProviderOutputSchema;
  requireJson?: boolean;
  allowDisabledProvidersForSimulation?: boolean;
  runtimeConfig?: ModelProviderRuntimeConfig;
  fetchFn?: ModelProviderFetch;
  signal?: AbortSignal;
  attemptTimeoutMs?: number;
  workflowTimeoutMs?: number;
  validateOutput?: (
    outputJson: Record<string, unknown> | null
  ) => ModelProviderOutputValidationResult;
};

export type ExecuteModelWithProviderFallbackResult = {
  status: "SUCCEEDED" | "FAILED";
  provider: ModelProviderName | null;
  model: string | null;
  outputJson: Record<string, unknown> | null;
  usage: ModelProviderExecuteResult["usage"] | null;
  attempts: ModelProviderFallbackAttempt[];
  routingDecision: ModelRouteDecision;
  errorMessage: string | null;
  deadline: {
    attemptTimeoutMs: number;
    workflowTimeoutMs: number;
    workflowDeadlineReached: boolean;
    cancelled: boolean;
    durationMs: number;
  };
};

type AttemptFailureClassification = {
  status: ModelProviderFallbackAttemptStatus;
  failureClass: ModelProviderFailureClass;
  retryable: boolean;
};

class ProviderAttemptTimeoutError extends Error {
  readonly timeoutMs: number;
  readonly workflowDeadlineReached: boolean;

  constructor(input: {
    timeoutMs: number;
    workflowDeadlineReached: boolean;
  }) {
    super(
      input.workflowDeadlineReached
        ? `Provider fallback workflow exceeded its ${input.timeoutMs}ms remaining deadline.`
        : `Provider attempt timed out after ${input.timeoutMs}ms.`
    );
    this.name = "ProviderAttemptTimeoutError";
    this.timeoutMs = input.timeoutMs;
    this.workflowDeadlineReached = input.workflowDeadlineReached;
  }
}

class ProviderExecutionCancelledError extends Error {
  constructor() {
    super("Provider execution was cancelled by the caller.");
    this.name = "ProviderExecutionCancelledError";
  }
}

export async function executeModelWithProviderFallback(
  input: ExecuteModelWithProviderFallbackInput
): Promise<ExecuteModelWithProviderFallbackResult> {
  const executionStartedMs = Date.now();
  const runtimeConfig = input.runtimeConfig ?? getModelProviderRuntimeConfig();
  const attemptTimeoutMs = resolvePositiveTimeout(
    input.attemptTimeoutMs ?? runtimeConfig.providerAttemptTimeoutMs,
    DEFAULT_PROVIDER_ATTEMPT_TIMEOUT_MS
  );
  const workflowTimeoutMs = resolvePositiveTimeout(
    input.workflowTimeoutMs ?? runtimeConfig.providerWorkflowTimeoutMs,
    DEFAULT_PROVIDER_WORKFLOW_TIMEOUT_MS
  );
  const workflowDeadlineMs = executionStartedMs + workflowTimeoutMs;
  const routingDecision = routeModel(
    {
      preferredGoal: input.goal,
      taskType: input.taskType,
      ...(input.requireJson !== undefined
        ? { requireJson: input.requireJson }
        : {}),
      ...(input.allowDisabledProvidersForSimulation !== undefined
        ? {
            allowDisabledProvidersForSimulation:
              input.allowDisabledProvidersForSimulation
          }
        : {})
    },
    {
      providerEnabledByName: buildRuntimeProviderEnabledByName(runtimeConfig)
    }
  );
  const candidates = buildExecutionCandidates(routingDecision);
  const attempts: ModelProviderFallbackAttempt[] = [];
  let workflowDeadlineReached = false;
  let cancelled = false;
  let terminalErrorMessage: string | null = null;

  for (const candidate of candidates) {
    if (input.signal?.aborted) {
      cancelled = true;
      terminalErrorMessage = "Provider execution was cancelled by the caller.";
      break;
    }

    const workflowTimeRemainingMs = workflowDeadlineMs - Date.now();

    if (workflowTimeRemainingMs <= 0) {
      workflowDeadlineReached = true;
      terminalErrorMessage =
        `Provider fallback workflow timed out after ${workflowTimeoutMs}ms.`;
      break;
    }

    const effectiveAttemptTimeoutMs = Math.max(
      1,
      Math.min(attemptTimeoutMs, workflowTimeRemainingMs)
    );
    const attemptUsesWorkflowDeadline =
      workflowTimeRemainingMs <= attemptTimeoutMs;
    const provider = getModelProvider(candidate.provider);
    const startedAt = new Date();
    const startMs = Date.now();

    if (!provider) {
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        attemptOrder: attempts.length + 1,
        status: "DISABLED",
        failureClass: "CONFIGURATION",
        retryable: false,
        reason: "Provider is not registered.",
        errorMessage: "Provider is not registered.",
        latencyMs: Date.now() - startMs,
        estimatedCostUsd: candidate.estimatedCostUsd,
        timeoutMs: effectiveAttemptTimeoutMs,
        startedAt,
        completedAt: new Date()
      });
      continue;
    }

    try {
      const result = await executeProviderAttempt({
        timeoutMs: effectiveAttemptTimeoutMs,
        workflowDeadlineReached: attemptUsesWorkflowDeadline,
        ...(input.signal ? { signal: input.signal } : {}),
        execute(signal) {
          return provider.execute({
            model: candidate.model,
            taskType: input.taskType,
            inputJson: input.inputJson,
            ...(input.outputSchema !== undefined
              ? { outputSchema: input.outputSchema }
              : {}),
            runtimeConfig,
            ...(input.fetchFn !== undefined ? { fetchFn: input.fetchFn } : {}),
            signal
          });
        }
      });
      const validationResult = input.validateOutput
        ? input.validateOutput(result.outputJson)
        : null;
      const completedAt = new Date();

      if (validationResult && !validationResult.validationPassed) {
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          attemptOrder: attempts.length + 1,
          status: "FAILED",
          failureClass: "OUTPUT_VALIDATION",
          retryable: false,
          reason: `Provider ${candidate.provider} / ${candidate.model} returned output that failed validation.`,
          errorMessage: buildValidationFailureMessage(validationResult),
          latencyMs: Date.now() - startMs,
          estimatedCostUsd: candidate.estimatedCostUsd,
          timeoutMs: effectiveAttemptTimeoutMs,
          startedAt,
          completedAt
        });
        continue;
      }

      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        attemptOrder: attempts.length + 1,
        status: "SUCCESS",
        failureClass: "NONE",
        retryable: false,
        reason: `Provider ${candidate.provider} / ${candidate.model} succeeded.`,
        errorMessage: null,
        latencyMs: Date.now() - startMs,
        estimatedCostUsd: candidate.estimatedCostUsd,
        timeoutMs: effectiveAttemptTimeoutMs,
        startedAt,
        completedAt
      });

      return {
        status: "SUCCEEDED",
        provider: candidate.provider,
        model: candidate.model,
        outputJson: result.outputJson,
        usage: result.usage ?? null,
        attempts,
        routingDecision,
        errorMessage: null,
        deadline: {
          attemptTimeoutMs,
          workflowTimeoutMs,
          workflowDeadlineReached: false,
          cancelled: false,
          durationMs: Date.now() - executionStartedMs
        }
      };
    } catch (error) {
      const classification = classifyAttemptFailure(error);

      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        attemptOrder: attempts.length + 1,
        status: classification.status,
        failureClass: classification.failureClass,
        retryable: classification.retryable,
        reason: `Provider ${candidate.provider} / ${candidate.model} did not complete successfully.`,
        errorMessage: getErrorMessage(error),
        latencyMs: Date.now() - startMs,
        estimatedCostUsd: candidate.estimatedCostUsd,
        timeoutMs: effectiveAttemptTimeoutMs,
        startedAt,
        completedAt: new Date()
      });

      if (error instanceof ProviderExecutionCancelledError) {
        cancelled = true;
        terminalErrorMessage = error.message;
        break;
      }

      if (
        error instanceof ProviderAttemptTimeoutError &&
        error.workflowDeadlineReached
      ) {
        workflowDeadlineReached = true;
        terminalErrorMessage =
          `Provider fallback workflow timed out after ${workflowTimeoutMs}ms.`;
        break;
      }
    }
  }

  return {
    status: "FAILED",
    provider: null,
    model: null,
    outputJson: null,
    usage: null,
    attempts,
    routingDecision,
    errorMessage:
      terminalErrorMessage ??
      attempts.at(-1)?.errorMessage ??
      "No provider attempt succeeded.",
    deadline: {
      attemptTimeoutMs,
      workflowTimeoutMs,
      workflowDeadlineReached,
      cancelled,
      durationMs: Date.now() - executionStartedMs
    }
  };
}

async function executeProviderAttempt<Result>(input: {
  timeoutMs: number;
  workflowDeadlineReached: boolean;
  signal?: AbortSignal;
  execute: (signal: AbortSignal) => Promise<Result>;
}): Promise<Result> {
  const attemptController = new AbortController();

  return new Promise<Result>((resolve, reject) => {
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", onCallerAbort);
      callback();
    };
    const onCallerAbort = () => {
      const error = new ProviderExecutionCancelledError();
      attemptController.abort(error);
      finish(() => reject(error));
    };
    const timeout = setTimeout(() => {
      const error = new ProviderAttemptTimeoutError({
        timeoutMs: input.timeoutMs,
        workflowDeadlineReached: input.workflowDeadlineReached
      });
      attemptController.abort(error);
      finish(() => reject(error));
    }, input.timeoutMs);

    if (input.signal?.aborted) {
      onCallerAbort();
      return;
    }

    input.signal?.addEventListener("abort", onCallerAbort, { once: true });

    Promise.resolve()
      .then(() => input.execute(attemptController.signal))
      .then(
        (result) => finish(() => resolve(result)),
        (error: unknown) => finish(() => reject(error))
      );
  });
}

function resolvePositiveTimeout(
  value: number | undefined,
  fallback: number
): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }

  return fallback;
}

function buildExecutionCandidates(
  decision: ModelRouteDecision
): ModelRouteCandidateSummary[] {
  const rejectedCandidateKeys = new Set(
    decision.rejectedCandidates.map((candidate) => candidateKey(candidate))
  );
  const eligibleCandidates = decision.candidatesConsidered.filter(
    (candidate) => !rejectedCandidateKeys.has(candidateKey(candidate))
  );
  const selectedCandidate = eligibleCandidates.find(
    (candidate) =>
      candidate.provider === decision.provider &&
      candidate.model === decision.model
  );
  const fallbackCandidate = eligibleCandidates.find(
    (candidate) =>
      candidate.provider === decision.fallbackProvider &&
      candidate.model === decision.fallbackModel
  );
  const orderedCandidates: ModelRouteCandidateSummary[] = [];

  if (selectedCandidate) {
    orderedCandidates.push(selectedCandidate);
  }

  if (
    fallbackCandidate &&
    !orderedCandidates.some(
      (candidate) => candidateKey(candidate) === candidateKey(fallbackCandidate)
    )
  ) {
    orderedCandidates.push(fallbackCandidate);
  }

  if (
    orderedCandidates.length === 0 &&
    decision.selectedModelMetadata.enabledForExecution
  ) {
    orderedCandidates.push(decision.selectedModelMetadata);
  }

  for (const candidate of eligibleCandidates) {
    if (
      orderedCandidates.some(
        (orderedCandidate) =>
          candidateKey(orderedCandidate) === candidateKey(candidate)
      )
    ) {
      continue;
    }

    orderedCandidates.push(candidate);
  }

  return orderedCandidates;
}

function candidateKey(candidate: {
  provider: ModelProviderName;
  model: string;
}): string {
  return `${candidate.provider}:${candidate.model}`;
}

function classifyAttemptFailure(
  error: unknown
): AttemptFailureClassification {
  if (error instanceof ProviderExecutionCancelledError) {
    return {
      status: "FAILED",
      failureClass: "CANCELLED",
      retryable: false
    };
  }

  if (error instanceof ProviderAttemptTimeoutError) {
    return {
      status: "TIMEOUT",
      failureClass: "TIMEOUT",
      retryable: true
    };
  }

  if (isModelProviderAdapterError(error)) {
    if (error.code === "MODEL_PROVIDER_NOT_CONFIGURED") {
      return {
        status: "SKIPPED",
        failureClass: "CONFIGURATION",
        retryable: false
      };
    }

    if (error.code === "MODEL_PROVIDER_REQUEST_FAILED") {
      if (error.statusCode === 429) {
        return {
          status: "RATE_LIMITED",
          failureClass: "RATE_LIMIT",
          retryable: true
        };
      }

      if (error.statusCode === 408 || error.statusCode === 504) {
        return {
          status: "TIMEOUT",
          failureClass: "TIMEOUT",
          retryable: true
        };
      }

      if (error.statusCode !== undefined && error.statusCode >= 500) {
        return {
          status: "FAILED",
          failureClass: "SERVER_ERROR",
          retryable: true
        };
      }

      if (error.statusCode !== undefined && error.statusCode >= 400) {
        return {
          status: "FAILED",
          failureClass: "CLIENT_ERROR",
          retryable: false
        };
      }
    }

    if (error.code === "MODEL_PROVIDER_INVALID_RESPONSE") {
      return {
        status: "FAILED",
        failureClass: "INVALID_RESPONSE",
        retryable: true
      };
    }

    return {
      status: "FAILED",
      failureClass: "UNKNOWN",
      retryable: true
    };
  }

  const message = getErrorMessage(error).toLowerCase();

  if (message.includes("timeout") || message.includes("timed out")) {
    return {
      status: "TIMEOUT",
      failureClass: "TIMEOUT",
      retryable: true
    };
  }

  return {
    status: "FAILED",
    failureClass: "UNKNOWN",
    retryable: true
  };
}

function buildValidationFailureMessage(
  validationResult: ModelProviderOutputValidationResult
): string {
  return [
    "Model output validation failed.",
    `jsonValid=${validationResult.jsonValid}.`,
    `validationPassed=${validationResult.validationPassed}.`,
    ...validationResult.validationErrors
  ].join(" ");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function buildRuntimeProviderEnabledByName(
  runtimeConfig: ModelProviderRuntimeConfig
): Partial<Record<ModelProviderName, boolean>> {
  return {
    OPENAI: Boolean(runtimeConfig.enableRealModelCalls && runtimeConfig.openAiApiKey),
    ANTHROPIC: Boolean(runtimeConfig.enableRealModelCalls && runtimeConfig.anthropicApiKey),
    AZURE_OPENAI: Boolean(
      runtimeConfig.enableRealModelCalls &&
        runtimeConfig.azureOpenAiApiKey &&
        runtimeConfig.azureOpenAiEndpoint &&
        runtimeConfig.azureOpenAiDeployment
    ),
    OLLAMA: Boolean(runtimeConfig.ollamaBaseUrl)
  };
}
