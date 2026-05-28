import type { Prisma, ToolCallLog } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import {
  previewToolInvocation,
  type PreviewToolInvocationInput,
  type ToolInvocationPreview
} from "./tool-invocation-preview.js";

export type PersistToolInvocationPreviewLogInput = PreviewToolInvocationInput;

export type PersistedToolInvocationPreview = Omit<
  ToolInvocationPreview,
  "invocation" | "previewMetadata"
> & {
  invocation: Omit<ToolInvocationPreview["invocation"], "persisted"> & {
    persisted: true;
    toolCallLogId: string;
  };
  previewMetadata: Omit<
    ToolInvocationPreview["previewMetadata"],
    "persisted"
  > & {
    persisted: true;
    toolCallLogId: string;
  };
  toolCallLog: ToolCallLog;
};

export class ToolInvocationPreviewLogRequiresWorkflowContextError extends Error {
  constructor() {
    super(
      "A workflowRunId or workflowStepId is required to persist a tool invocation preview log."
    );
    this.name = "ToolInvocationPreviewLogRequiresWorkflowContextError";
  }
}

function toAuditOutputJson(
  preview: ToolInvocationPreview
): Prisma.InputJsonObject {
  return {
    previewOnly: true,
    executionAttempted: false,
    actualToolOutput: null,
    policyDecision: preview.invocation.policyDecision,
    policyReasonCodes: preview.invocation.policyReasonCodes,
    invocationStatus: preview.invocation.status,
    requestedBy: preview.invocation.requestedBy,
    invocationId: preview.invocation.invocationId,
    createdAt: preview.invocation.createdAt,
    policyReason: preview.policyEvaluation.reason,
    executionMode: preview.policyEvaluation.executionMode,
    executionEnabled: preview.policyEvaluation.executionEnabled,
    humanApprovalGranted: preview.policyEvaluation.humanApprovalGranted,
    persistedPurpose:
      "Audit-only planned invocation preview. No tool execution was attempted."
  };
}

export async function persistToolInvocationPreviewLog(
  input: PersistToolInvocationPreviewLogInput
): Promise<PersistedToolInvocationPreview> {
  if (input.workflowRunId === undefined && input.workflowStepId === undefined) {
    throw new ToolInvocationPreviewLogRequiresWorkflowContextError();
  }

  const preview = previewToolInvocation(input);

  const toolCallLog = await prisma.toolCallLog.create({
    data: {
      ...(preview.invocation.workflowRunId === null
        ? {}
        : { workflowRunId: preview.invocation.workflowRunId }),
      ...(preview.invocation.workflowStepId === null
        ? {}
        : { workflowStepId: preview.invocation.workflowStepId }),
      toolName: preview.invocation.toolName,
      status: "STARTED",
      ...(preview.invocation.inputJson === null
        ? {}
        : { inputJson: preview.invocation.inputJson as Prisma.InputJsonValue }),
      outputJson: toAuditOutputJson(preview)
    }
  });

  return {
    invocation: {
      ...preview.invocation,
      persisted: true,
      toolCallLogId: toolCallLog.id
    },
    policyEvaluation: preview.policyEvaluation,
    previewMetadata: {
      ...preview.previewMetadata,
      persisted: true,
      toolCallLogId: toolCallLog.id,
      message:
        "Tool invocation preview log persisted for audit only. No tool execution was attempted."
    },
    toolCallLog
  };
}
