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

export type ModelProviderFallbackAttempt = {
  provider: ModelProviderName;
  model: string;
  attemptOrder: number;
  status: ModelProviderFallbackAttemptStatus;
  reason: string;
  errorMessage: string | null;
  latencyMs: number;
  estimatedCostUsd: number;
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
};

export async function executeModelWithProviderFallback(
  input: ExecuteModelWithProviderFallbackInput
): Promise<ExecuteModelWithProviderFallbackResult> {
  const runtimeConfig = input.runtimeConfig ?? getModelProviderRuntimeConfig();
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

  for (const candidate of candidates) {
    const provider = getModelProvider(candidate.provider);
    const startedAt = new Date();
    const startMs = Date.now();

    if (!provider) {
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        attemptOrder: attempts.length + 1,
        status: "DISABLED",
        reason: "Provider is not registered.",
        errorMessage: "Provider is not registered.",
        latencyMs: Date.now() - startMs,
        estimatedCostUsd: candidate.estimatedCostUsd,
        startedAt,
        completedAt: new Date()
      });
      continue;
    }

    try {
      const result = await provider.execute({
        model: candidate.model,
        taskType: input.taskType,
        inputJson: input.inputJson,
        ...(input.outputSchema !== undefined
          ? { outputSchema: input.outputSchema }
          : {}),
        runtimeConfig,
        ...(input.fetchFn !== undefined ? { fetchFn: input.fetchFn } : {})
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
          reason: `Provider ${candidate.provider} / ${candidate.model} returned output that failed validation.`,
          errorMessage: buildValidationFailureMessage(validationResult),
          latencyMs: Date.now() - startMs,
          estimatedCostUsd: candidate.estimatedCostUsd,
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
        reason: `Provider ${candidate.provider} / ${candidate.model} succeeded.`,
        errorMessage: null,
        latencyMs: Date.now() - startMs,
        estimatedCostUsd: candidate.estimatedCostUsd,
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
        errorMessage: null
      };
    } catch (error) {
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        attemptOrder: attempts.length + 1,
        status: classifyAttemptStatus(error),
        reason: `Provider ${candidate.provider} / ${candidate.model} did not complete successfully.`,
        errorMessage: getErrorMessage(error),
        latencyMs: Date.now() - startMs,
        estimatedCostUsd: candidate.estimatedCostUsd,
        startedAt,
        completedAt: new Date()
      });
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
    errorMessage: attempts.at(-1)?.errorMessage ?? "No provider attempt succeeded."
  };
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

function classifyAttemptStatus(
  error: unknown
): ModelProviderFallbackAttemptStatus {
  if (isModelProviderAdapterError(error)) {
    if (error.code === "MODEL_PROVIDER_NOT_CONFIGURED") {
      return "SKIPPED";
    }

    if (error.code === "MODEL_PROVIDER_REQUEST_FAILED") {
      if (error.statusCode === 429) {
        return "RATE_LIMITED";
      }

      if (error.statusCode === 408 || error.statusCode === 504) {
        return "TIMEOUT";
      }
    }

    return "FAILED";
  }

  const message = getErrorMessage(error).toLowerCase();

  if (message.includes("timeout") || message.includes("timed out")) {
    return "TIMEOUT";
  }

  return "FAILED";
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
