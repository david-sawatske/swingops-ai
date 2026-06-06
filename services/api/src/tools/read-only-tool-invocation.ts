import type { Prisma, ToolCallLog } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { searchKnowledgeBase } from "../knowledge/knowledge-search.js";
import { searchClubReference } from "./club-reference.js";
import {
  evaluateToolExecutionPolicy,
  type ToolExecutionMode,
  type ToolExecutionPolicyEvaluation
} from "./tool-execution-policy.js";
import type { AgentToolDefinition } from "./tool-registry.types.js";

type ReadOnlyToolInvocationStatus = "SUCCEEDED" | "FAILED" | "BLOCKED";

type ReadOnlyToolInvocationInput = {
  toolName: string;
  inputJson?: unknown;
  requestedBy?: string;
  workflowRunId?: string;
  workflowStepId?: string;
  executionMode?: ToolExecutionMode;
  humanApprovalGranted?: boolean;
};

type ConnectorResult = {
  contentType: "application/json";
  data: unknown;
  metadata: {
    source: "swingops.internal-db";
    readOnly: true;
    mutatesData: false;
    externalTransport: false;
  };
};

export type ReadOnlyToolInvocationResult = {
  invocation: {
    toolName: string;
    status: ReadOnlyToolInvocationStatus;
    requestedBy: string;
    workflowRunId: string | null;
    workflowStepId: string | null;
    inputJson: unknown | null;
    outputJson: unknown | null;
    executionAttempted: boolean;
    startedAt: string;
    completedAt: string;
    toolCallLogId: string;
  };
  policyEvaluation: ToolExecutionPolicyEvaluation;
  connectorResult: ConnectorResult | null;
  toolCallLog: ToolCallLog;
  executionMetadata: {
    route: "POST /mcp/tools/invocations/execute-readonly";
    externalTransport: false;
    readOnlyOnly: true;
    mutationToolsEnabled: false;
    policyCheckedBeforeExecution: true;
  };
};

const inputObjectSchema = z.record(z.unknown()).default({});

const getByIdInputSchema = z
  .object({
    id: z.string().min(1)
  })
  .strict();

const workflowRunsListInputSchema = z
  .object({
    status: z
      .enum(["QUEUED", "RUNNING", "NEEDS_REVIEW", "COMPLETED", "FAILED"])
      .optional()
  })
  .strict();

const reviewQueueItemsListInputSchema = z
  .object({
    status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]).optional()
  })
  .strict();

const clubReferenceSearchInputSchema = z
  .object({
    query: z.string().min(1)
  })
  .strict();

const knowledgeChunkTypeSchema = z.enum([
  "CLUB_REFERENCE",
  "TRADE_IN_POLICY",
  "CONDITION_GUIDE",
  "BRAND_ALIAS",
  "SHAFT_FLEX_GUIDE"
]);

const knowledgeBaseSearchInputSchema = z
  .object({
    query: z.string().min(1),
  sourceName: z.string().min(1).optional(),
    brand: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    chunkType: knowledgeChunkTypeSchema.optional(),
    maxResults: z.number().int().min(1).max(10).optional()
  })
  .strict();

function serializeIntakeBatch(batch: {
  id: string;
  name: string;
  description: string | null;
  sourceType: string;
  status: string;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: batch.id,
    name: batch.name,
    description: batch.description,
    sourceType: batch.sourceType,
    status: batch.status,
    itemCount: batch.itemCount,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString()
  };
}

function serializeIntakeItem(item: {
  id: string;
  intakeBatchId: string;
  rawText: string;
  sourceRowNumber: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    intakeBatchId: item.intakeBatchId,
    rawText: item.rawText,
    sourceRowNumber: item.sourceRowNumber,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function serializeWorkflowRun(run: {
  id: string;
  intakeBatchId: string | null;
  intakeItemId: string | null;
  workflowName: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: run.id,
    intakeBatchId: run.intakeBatchId,
    intakeItemId: run.intakeItemId,
    workflowName: run.workflowName,
    status: run.status,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    errorMessage: run.errorMessage,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString()
  };
}

function serializeWorkflowStep(step: {
  id: string;
  workflowRunId: string;
  stepName: string;
  stepType: string;
  status: string;
  orderIndex: number;
  inputJson: unknown;
  outputJson: unknown;
  errorMessage: string | null;
  retryCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: step.id,
    workflowRunId: step.workflowRunId,
    stepName: step.stepName,
    stepType: step.stepType,
    status: step.status,
    orderIndex: step.orderIndex,
    inputJson: step.inputJson,
    outputJson: step.outputJson,
    errorMessage: step.errorMessage,
    retryCount: step.retryCount,
    startedAt: step.startedAt?.toISOString() ?? null,
    completedAt: step.completedAt?.toISOString() ?? null,
    createdAt: step.createdAt.toISOString(),
    updatedAt: step.updatedAt.toISOString()
  };
}

function serializeToolCallLog(log: {
  id: string;
  workflowRunId: string | null;
  workflowStepId: string | null;
  toolName: string;
  status: string;
  inputJson: unknown;
  outputJson: unknown;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: log.id,
    workflowRunId: log.workflowRunId,
    workflowStepId: log.workflowStepId,
    toolName: log.toolName,
    status: log.status,
    inputJson: log.inputJson,
    outputJson: log.outputJson,
    errorMessage: log.errorMessage,
    startedAt: log.startedAt.toISOString(),
    completedAt: log.completedAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString()
  };
}

function serializeModelCallLog(log: {
  id: string;
  workflowRunId: string | null;
  workflowStepId: string | null;
  provider: string;
  model: string;
  status: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  estimatedCostUsd: number | null;
  requestJson: unknown;
  responseJson: unknown;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: log.id,
    workflowRunId: log.workflowRunId,
    workflowStepId: log.workflowStepId,
    provider: log.provider,
    model: log.model,
    status: log.status,
    promptTokens: log.promptTokens,
    completionTokens: log.completionTokens,
    totalTokens: log.totalTokens,
    latencyMs: log.latencyMs,
    estimatedCostUsd: log.estimatedCostUsd,
    requestJson: log.requestJson,
    responseJson: log.responseJson,
    errorMessage: log.errorMessage,
    startedAt: log.startedAt.toISOString(),
    completedAt: log.completedAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString()
  };
}

function serializeReviewQueueItem(item: {
  id: string;
  intakeItemId: string | null;
  golfClubId: string | null;
  workflowRunId: string | null;
  reason: string;
  status: string;
  originalText: string | null;
  proposedGolfClubJson: unknown;
  reviewerNotes: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    intakeItemId: item.intakeItemId,
    golfClubId: item.golfClubId,
    workflowRunId: item.workflowRunId,
    reason: item.reason,
    status: item.status,
    originalText: item.originalText,
    proposedGolfClubJson: item.proposedGolfClubJson,
    reviewerNotes: item.reviewerNotes,
    resolvedAt: item.resolvedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function serializeWorkflowRunListItem(run: {
  id: string;
  intakeBatchId: string | null;
  intakeItemId: string | null;
  workflowName: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  intakeBatch: {
    id: string;
    name: string;
    description: string | null;
    sourceType: string;
    status: string;
    itemCount: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  intakeItem: {
    id: string;
    intakeBatchId: string;
    rawText: string;
    sourceRowNumber: number | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  modelCallLogs: {
    id: string;
    workflowRunId: string | null;
    workflowStepId: string | null;
    provider: string;
    model: string;
    status: string;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    latencyMs: number | null;
    estimatedCostUsd: number | null;
    requestJson: unknown;
    responseJson: unknown;
    errorMessage: string | null;
    startedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
  }[];
  toolCallLogs: {
    id: string;
    workflowRunId: string | null;
    workflowStepId: string | null;
    toolName: string;
    status: string;
    inputJson: unknown;
    outputJson: unknown;
    errorMessage: string | null;
    startedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
  }[];
  reviewQueueItems: {
    status: string;
  }[];
}) {
  const openReviewQueueItemCount = run.reviewQueueItems.filter(
    (item) => item.status === "OPEN" || item.status === "IN_REVIEW"
  ).length;

  const auditOnlyToolCallLogCount = run.toolCallLogs.filter(
    (log) =>
      typeof log.outputJson === "object" &&
      log.outputJson !== null &&
      !Array.isArray(log.outputJson) &&
      "previewOnly" in log.outputJson &&
      log.outputJson.previewOnly === true
  ).length;

  return {
    ...serializeWorkflowRun(run),
    intakeBatch: run.intakeBatch ? serializeIntakeBatch(run.intakeBatch) : null,
    intakeItem: run.intakeItem ? serializeIntakeItem(run.intakeItem) : null,
    latestModelCallLog: run.modelCallLogs[0]
      ? serializeModelCallLog(run.modelCallLogs[0])
      : null,
    latestToolCallLog: run.toolCallLogs[0]
      ? serializeToolCallLog(run.toolCallLogs[0])
      : null,
    totalToolCallLogCount: run.toolCallLogs.length,
    auditOnlyToolCallLogCount,
    totalReviewQueueItemCount: run.reviewQueueItems.length,
    openReviewQueueItemCount
  };
}

function serializeReviewQueueItemWithContext(item: {
  id: string;
  intakeItemId: string | null;
  golfClubId: string | null;
  workflowRunId: string | null;
  reason: string;
  status: string;
  originalText: string | null;
  proposedGolfClubJson: unknown;
  reviewerNotes: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  workflowRun: {
    id: string;
    intakeBatchId: string | null;
    intakeItemId: string | null;
    workflowName: string;
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  intakeItem: {
    id: string;
    intakeBatchId: string;
    rawText: string;
    sourceRowNumber: number | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    intakeBatch: {
      id: string;
      name: string;
      description: string | null;
      sourceType: string;
      status: string;
      itemCount: number;
      createdAt: Date;
      updatedAt: Date;
    };
  } | null;
}) {
  return {
    ...serializeReviewQueueItem(item),
    workflowRun: item.workflowRun ? serializeWorkflowRun(item.workflowRun) : null,
    intakeItem: item.intakeItem ? serializeIntakeItem(item.intakeItem) : null,
    intakeBatch: item.intakeItem
      ? serializeIntakeBatch(item.intakeItem.intakeBatch)
      : null
  };
}

function connectorResult(data: unknown): ConnectorResult {
  return {
    contentType: "application/json",
    data,
    metadata: {
      source: "swingops.internal-db",
      readOnly: true,
      mutatesData: false,
      externalTransport: false
    }
  };
}

function blockedOutputJson(input: {
  requestedBy: string;
  policyEvaluation: ToolExecutionPolicyEvaluation;
  reason: string;
  readOnlyReasonCode?: string;
}) {
  return {
    connectorInvocation: true,
    executionAttempted: false,
    connectorResult: null,
    requestedBy: input.requestedBy,
    policyDecision: input.policyEvaluation.decision,
    policyReasonCodes:
      input.readOnlyReasonCode &&
      !input.policyEvaluation.reasonCodes.includes(
        input.readOnlyReasonCode as never
      )
        ? [...input.policyEvaluation.reasonCodes, input.readOnlyReasonCode]
        : input.policyEvaluation.reasonCodes,
    policyReason: input.policyEvaluation.reason,
    executionMode: input.policyEvaluation.executionMode,
    executionEnabled: input.policyEvaluation.executionEnabled,
    humanApprovalGranted: input.policyEvaluation.humanApprovalGranted,
    failureReason: input.reason
  };
}

function successOutputJson(input: {
  requestedBy: string;
  policyEvaluation: ToolExecutionPolicyEvaluation;
  connectorResult: ConnectorResult;
}): Prisma.InputJsonObject {
  return {
    connectorInvocation: true,
    executionAttempted: true,
    requestedBy: input.requestedBy,
    policyDecision: input.policyEvaluation.decision,
    policyReasonCodes: input.policyEvaluation.reasonCodes,
    executionMode: input.policyEvaluation.executionMode,
    executionEnabled: input.policyEvaluation.executionEnabled,
    humanApprovalGranted: input.policyEvaluation.humanApprovalGranted,
    connectorResult: input.connectorResult as unknown as Prisma.InputJsonObject
  };
}

function toInputJsonValue(inputJson: unknown | null): Prisma.InputJsonValue | undefined {
  if (inputJson === null) {
    return undefined;
  }

  return inputJson as Prisma.InputJsonValue;
}

async function createStartedToolCallLog(input: {
  toolName: string;
  workflowRunId: string | null;
  workflowStepId: string | null;
  inputJson: unknown | null;
}) {
  const inputJson = toInputJsonValue(input.inputJson);

  return prisma.toolCallLog.create({
    data: {
      ...(input.workflowRunId === null ? {} : { workflowRunId: input.workflowRunId }),
      ...(input.workflowStepId === null ? {} : { workflowStepId: input.workflowStepId }),
      toolName: input.toolName,
      status: "STARTED",
      ...(inputJson === undefined ? {} : { inputJson })
    }
  });
}

async function completeToolCallLog(input: {
  toolCallLogId: string;
  status: "SUCCEEDED" | "FAILED";
  outputJson: Prisma.InputJsonObject;
  errorMessage?: string;
}) {
  return prisma.toolCallLog.update({
    where: {
      id: input.toolCallLogId
    },
    data: {
      status: input.status,
      outputJson: input.outputJson,
      completedAt: new Date(),
      ...(input.errorMessage === undefined ? {} : { errorMessage: input.errorMessage })
    }
  });
}

function toResult(input: {
  toolName: string;
  status: ReadOnlyToolInvocationStatus;
  requestedBy: string;
  workflowRunId: string | null;
  workflowStepId: string | null;
  inputJson: unknown | null;
  outputJson: unknown | null;
  executionAttempted: boolean;
  startedAt: Date;
  completedAt: Date;
  policyEvaluation: ToolExecutionPolicyEvaluation;
  connectorResult: ConnectorResult | null;
  toolCallLog: ToolCallLog;
}): ReadOnlyToolInvocationResult {
  return {
    invocation: {
      toolName: input.toolName,
      status: input.status,
      requestedBy: input.requestedBy,
      workflowRunId: input.workflowRunId,
      workflowStepId: input.workflowStepId,
      inputJson: input.inputJson,
      outputJson: input.outputJson,
      executionAttempted: input.executionAttempted,
      startedAt: input.startedAt.toISOString(),
      completedAt: input.completedAt.toISOString(),
      toolCallLogId: input.toolCallLog.id
    },
    policyEvaluation: input.policyEvaluation,
    connectorResult: input.connectorResult,
    toolCallLog: input.toolCallLog,
    executionMetadata: {
      route: "POST /mcp/tools/invocations/execute-readonly",
      externalTransport: false,
      readOnlyOnly: true,
      mutationToolsEnabled: false,
      policyCheckedBeforeExecution: true
    }
  };
}

function getInputObject(inputJson: unknown | undefined) {
  return inputObjectSchema.parse(inputJson ?? {});
}

function ensureExecutableReadOnlyTool(
  tool: AgentToolDefinition | null
): { reason: string; reasonCode: string } | null {
  if (!tool) {
    return {
      reason: "Tool is not registered and cannot be executed.",
      reasonCode: "TOOL_NOT_FOUND"
    };
  }

  if (!tool.enabled) {
    return {
      reason: "Tool is disabled and cannot be executed.",
      reasonCode: "TOOL_DISABLED"
    };
  }

  if (tool.mutatesData) {
    return {
      reason:
        "Mutation tools are not enabled on the read-only connector invocation surface.",
      reasonCode: "MUTATION_BLOCKED_IN_READ_ONLY_MODE"
    };
  }

  if (tool.requiresHumanApproval) {
    return {
      reason:
        "Approval-required tools are not enabled on the read-only connector invocation surface.",
      reasonCode: "HUMAN_APPROVAL_REQUIRED"
    };
  }

  if (tool.riskLevel !== "LOW") {
    return {
      reason:
        "Only low-risk tools are enabled on the read-only connector invocation surface.",
      reasonCode: "HUMAN_APPROVAL_REQUIRED"
    };
  }

  return null;
}

async function executeConnectorTool(input: {
  toolName: string;
  inputJson: unknown | undefined;
}): Promise<ConnectorResult> {
  const inputObject = getInputObject(input.inputJson);

  if (input.toolName === "swingops.clubReference.search") {
    const parsedInput = clubReferenceSearchInputSchema.parse(inputObject);

    return connectorResult({
      clubReferenceSearch: searchClubReference(parsedInput.query)
    });
  }

  if (input.toolName === "swingops.knowledgeBase.search") {
    const parsedInput = knowledgeBaseSearchInputSchema.parse(inputObject);

    return connectorResult({
      knowledgeBaseSearch: await searchKnowledgeBase({
        query: parsedInput.query,
        ...(parsedInput.sourceName === undefined
          ? {}
          : { sourceName: parsedInput.sourceName }),
        ...(parsedInput.brand === undefined ? {} : { brand: parsedInput.brand }),
        ...(parsedInput.category === undefined
          ? {}
          : { category: parsedInput.category }),
        ...(parsedInput.chunkType === undefined
          ? {}
          : { chunkType: parsedInput.chunkType }),
        ...(parsedInput.maxResults === undefined
          ? {}
          : { maxResults: parsedInput.maxResults })
      })
    });
  }

  if (input.toolName === "swingops.intakeBatches.list") {
    const intakeBatches = await prisma.intakeBatch.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    return connectorResult({
      intakeBatches: intakeBatches.map(serializeIntakeBatch)
    });
  }

  if (input.toolName === "swingops.intakeBatches.get") {
    const parsedInput = getByIdInputSchema.parse(inputObject);

    const intakeBatch = await prisma.intakeBatch.findUnique({
      where: {
        id: parsedInput.id
      },
      include: {
        items: {
          orderBy: {
            createdAt: "asc"
          }
        },
        workflowRuns: {
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    if (!intakeBatch) {
      throw new Error("Intake batch not found");
    }

    return connectorResult({
      intakeBatch: serializeIntakeBatch(intakeBatch),
      items: intakeBatch.items.map(serializeIntakeItem),
      workflowRuns: intakeBatch.workflowRuns.map(serializeWorkflowRun)
    });
  }

  if (input.toolName === "swingops.workflowRuns.list") {
    const parsedInput = workflowRunsListInputSchema.parse(inputObject);

    const workflowRuns = await prisma.workflowRun.findMany({
      where: parsedInput.status
        ? {
            status: parsedInput.status
          }
        : {},
      orderBy: {
        createdAt: "desc"
      },
      include: {
        intakeBatch: true,
        intakeItem: true,
        modelCallLogs: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        },
        toolCallLogs: {
          orderBy: {
            createdAt: "desc"
          }
        },
        reviewQueueItems: {
          select: {
            status: true
          }
        }
      }
    });

    return connectorResult({
      workflowRuns: workflowRuns.map(serializeWorkflowRunListItem)
    });
  }

  if (input.toolName === "swingops.workflowRuns.get") {
    const parsedInput = getByIdInputSchema.parse(inputObject);

    const workflowRun = await prisma.workflowRun.findUnique({
      where: {
        id: parsedInput.id
      },
      include: {
        steps: {
          orderBy: {
            orderIndex: "asc"
          }
        },
        toolCallLogs: {
          orderBy: {
            createdAt: "asc"
          }
        },
        modelCallLogs: {
          orderBy: {
            createdAt: "asc"
          }
        },
        reviewQueueItems: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    if (!workflowRun) {
      throw new Error("Workflow run not found");
    }

    return connectorResult({
      workflowRun: serializeWorkflowRun(workflowRun),
      steps: workflowRun.steps.map(serializeWorkflowStep),
      toolCallLogs: workflowRun.toolCallLogs.map(serializeToolCallLog),
      modelCallLogs: workflowRun.modelCallLogs.map(serializeModelCallLog),
      reviewQueueItems: workflowRun.reviewQueueItems.map(serializeReviewQueueItem)
    });
  }

  if (input.toolName === "swingops.reviewQueueItems.list") {
    const parsedInput = reviewQueueItemsListInputSchema.parse(inputObject);

    const reviewQueueItems = await prisma.reviewQueueItem.findMany({
      where: parsedInput.status
        ? {
            status: parsedInput.status
          }
        : {},
      include: {
        workflowRun: true,
        intakeItem: {
          include: {
            intakeBatch: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return connectorResult({
      reviewQueueItems: reviewQueueItems.map(serializeReviewQueueItemWithContext)
    });
  }

  if (input.toolName === "swingops.reviewQueueItems.get") {
    const parsedInput = getByIdInputSchema.parse(inputObject);

    const reviewQueueItem = await prisma.reviewQueueItem.findUnique({
      where: {
        id: parsedInput.id
      },
      include: {
        workflowRun: true,
        intakeItem: {
          include: {
            intakeBatch: true
          }
        }
      }
    });

    if (!reviewQueueItem) {
      throw new Error("Review queue item not found");
    }

    return connectorResult({
      reviewQueueItem: serializeReviewQueueItemWithContext(reviewQueueItem)
    });
  }

  throw new Error("Tool has no read-only connector implementation.");
}

export async function executeReadOnlyToolInvocation(
  input: ReadOnlyToolInvocationInput
): Promise<ReadOnlyToolInvocationResult> {
  const requestedBy = input.requestedBy ?? "agent.readonly";
  const workflowRunId = input.workflowRunId ?? null;
  const workflowStepId = input.workflowStepId ?? null;
  const inputJson = input.inputJson ?? null;
  const startedAt = new Date();

  const policyEvaluation = evaluateToolExecutionPolicy({
    toolName: input.toolName,
    executionMode: input.executionMode ?? "AGENT_AUTONOMOUS",
    humanApprovalGranted: input.humanApprovalGranted ?? false
  });

  const startedLog = await createStartedToolCallLog({
    toolName: input.toolName,
    workflowRunId,
    workflowStepId,
    inputJson
  });

  const readOnlyBlock =
    policyEvaluation.decision === "ALLOW"
      ? ensureExecutableReadOnlyTool(policyEvaluation.tool)
      : {
          reason: policyEvaluation.reason,
          reasonCode: policyEvaluation.reasonCodes[0] ?? "TOOL_EXECUTION_FAILED"
        };

  if (readOnlyBlock) {
    const outputJson = blockedOutputJson({
      requestedBy,
      policyEvaluation,
      reason: readOnlyBlock.reason,
      readOnlyReasonCode: readOnlyBlock.reasonCode
    });

    const completedLog = await completeToolCallLog({
      toolCallLogId: startedLog.id,
      status: "FAILED",
      outputJson,
      errorMessage: readOnlyBlock.reason
    });

    const completedAt = completedLog.completedAt ?? new Date();

    return toResult({
      toolName: input.toolName,
      status: "BLOCKED",
      requestedBy,
      workflowRunId,
      workflowStepId,
      inputJson,
      outputJson,
      executionAttempted: false,
      startedAt,
      completedAt,
      policyEvaluation,
      connectorResult: null,
      toolCallLog: completedLog
    });
  }

  try {
    const result = await executeConnectorTool({
      toolName: input.toolName,
      inputJson: input.inputJson
    });
    const outputJson = successOutputJson({
      requestedBy,
      policyEvaluation,
      connectorResult: result
    });

    const completedLog = await completeToolCallLog({
      toolCallLogId: startedLog.id,
      status: "SUCCEEDED",
      outputJson
    });

    const completedAt = completedLog.completedAt ?? new Date();

    return toResult({
      toolName: input.toolName,
      status: "SUCCEEDED",
      requestedBy,
      workflowRunId,
      workflowStepId,
      inputJson,
      outputJson,
      executionAttempted: true,
      startedAt,
      completedAt,
      policyEvaluation,
      connectorResult: result,
      toolCallLog: completedLog
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Read-only tool execution failed.";
    const outputJson = {
      connectorInvocation: true,
      executionAttempted: true,
      connectorResult: null,
      requestedBy,
      policyDecision: policyEvaluation.decision,
      policyReasonCodes: policyEvaluation.reasonCodes,
      executionMode: policyEvaluation.executionMode,
      executionEnabled: policyEvaluation.executionEnabled,
      humanApprovalGranted: policyEvaluation.humanApprovalGranted,
      failureReason: errorMessage
    };

    const completedLog = await completeToolCallLog({
      toolCallLogId: startedLog.id,
      status: "FAILED",
      outputJson,
      errorMessage
    });

    const completedAt = completedLog.completedAt ?? new Date();

    return toResult({
      toolName: input.toolName,
      status: "FAILED",
      requestedBy,
      workflowRunId,
      workflowStepId,
      inputJson,
      outputJson,
      executionAttempted: true,
      startedAt,
      completedAt,
      policyEvaluation,
      connectorResult: null,
      toolCallLog: completedLog
    });
  }
}
