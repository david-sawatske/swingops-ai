import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getAgentTool,
  listAgentTools,
  type AgentToolRegistryFilter
} from "../tools/tool-registry.js";
import { previewToolExecutionPolicy } from "../tools/tool-execution-policy.js";
import { previewToolInvocation } from "../tools/tool-invocation-preview.js";
import {
  persistToolInvocationPreviewLog,
  ToolInvocationPreviewLogRequiresWorkflowContextError
} from "../tools/tool-invocation-preview-logging.js";
import { executeReadOnlyToolInvocation } from "../tools/read-only-tool-invocation.js";

const agentToolCategorySchema = z.enum([
  "INTAKE",
  "WORKFLOW",
  "REVIEW_QUEUE"
]);

const agentToolRiskLevelSchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
]);

const booleanQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const listAgentToolsQuerySchema = z
  .object({
    category: agentToolCategorySchema.optional(),
    riskLevel: agentToolRiskLevelSchema.optional(),
    enabled: booleanQuerySchema.optional(),
    mutatesData: booleanQuerySchema.optional(),
    requiresHumanApproval: booleanQuerySchema.optional()
  })
  .strict();

const agentToolParamsSchema = z.object({
  name: z.string().min(1)
});

const toolExecutionModeSchema = z.enum([
  "PREVIEW_ONLY",
  "AGENT_AUTONOMOUS",
  "HUMAN_APPROVED"
]);

const toolExecutionPolicyPreviewBodySchema = z
  .object({
    toolName: z.string().min(1),
    executionMode: toolExecutionModeSchema.default("PREVIEW_ONLY"),
    humanApprovalGranted: z.boolean().default(false)
  })
  .strict();

const toolInvocationPreviewBodySchema = z
  .object({
    toolName: z.string().min(1),
    inputJson: z.unknown().optional(),
    requestedBy: z.string().min(1).default("agent.preview"),
    workflowRunId: z.string().min(1).optional(),
    workflowStepId: z.string().min(1).optional(),
    executionMode: toolExecutionModeSchema.default("PREVIEW_ONLY"),
    humanApprovalGranted: z.boolean().default(false)
  })
  .strict();

const readOnlyToolInvocationBodySchema = z
  .object({
    toolName: z.string().min(1),
    inputJson: z.unknown().optional(),
    requestedBy: z.string().min(1).default("agent.readonly"),
    workflowRunId: z.string().min(1).optional(),
    workflowStepId: z.string().min(1).optional(),
    executionMode: toolExecutionModeSchema.default("AGENT_AUTONOMOUS"),
    humanApprovalGranted: z.boolean().default(false)
  })
  .strict();

function toRegistryFilter(
  query: z.infer<typeof listAgentToolsQuerySchema>
): AgentToolRegistryFilter {
  return {
    ...(query.category === undefined ? {} : { category: query.category }),
    ...(query.riskLevel === undefined ? {} : { riskLevel: query.riskLevel }),
    ...(query.enabled === undefined ? {} : { enabled: query.enabled }),
    ...(query.mutatesData === undefined
      ? {}
      : { mutatesData: query.mutatesData }),
    ...(query.requiresHumanApproval === undefined
      ? {}
      : { requiresHumanApproval: query.requiresHumanApproval })
  };
}

function toPreviewInvocationInput(
  data: z.infer<typeof toolInvocationPreviewBodySchema>
) {
  return {
    toolName: data.toolName,
    requestedBy: data.requestedBy,
    executionMode: data.executionMode,
    humanApprovalGranted: data.humanApprovalGranted,
    ...(data.inputJson === undefined ? {} : { inputJson: data.inputJson }),
    ...(data.workflowRunId === undefined
      ? {}
      : { workflowRunId: data.workflowRunId }),
    ...(data.workflowStepId === undefined
      ? {}
      : { workflowStepId: data.workflowStepId })
  };
}

function toReadOnlyInvocationInput(
  data: z.infer<typeof readOnlyToolInvocationBodySchema>
) {
  return {
    toolName: data.toolName,
    requestedBy: data.requestedBy,
    executionMode: data.executionMode,
    humanApprovalGranted: data.humanApprovalGranted,
    ...(data.inputJson === undefined ? {} : { inputJson: data.inputJson }),
    ...(data.workflowRunId === undefined
      ? {}
      : { workflowRunId: data.workflowRunId }),
    ...(data.workflowStepId === undefined
      ? {}
      : { workflowStepId: data.workflowStepId })
  };
}

export async function toolRoutes(app: FastifyInstance): Promise<void> {
  app.post("/mcp/tools/invocations/preview", async (request, reply) => {
    const parsedBody = toolInvocationPreviewBodySchema.safeParse(
      request.body ?? {}
    );

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid tool invocation preview request",
        details: parsedBody.error.flatten()
      });
    }

    return previewToolInvocation(toPreviewInvocationInput(parsedBody.data));
  });

  app.post("/mcp/tools/invocations/preview-log", async (request, reply) => {
    const parsedBody = toolInvocationPreviewBodySchema.safeParse(
      request.body ?? {}
    );

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid tool invocation preview log request",
        details: parsedBody.error.flatten()
      });
    }

    try {
      return await persistToolInvocationPreviewLog(
        toPreviewInvocationInput(parsedBody.data)
      );
    } catch (error) {
      if (
        error instanceof ToolInvocationPreviewLogRequiresWorkflowContextError
      ) {
        return reply.status(400).send({
          error: error.message
        });
      }

      throw error;
    }
  });

  app.post("/mcp/tools/execution-policy/preview", async (request, reply) => {
    const parsedBody = toolExecutionPolicyPreviewBodySchema.safeParse(
      request.body ?? {}
    );

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid tool execution policy preview request",
        details: parsedBody.error.flatten()
      });
    }

    return previewToolExecutionPolicy({
      toolName: parsedBody.data.toolName,
      executionMode: parsedBody.data.executionMode,
      humanApprovalGranted: parsedBody.data.humanApprovalGranted
    });
  });

  app.post("/mcp/tools/invocations/execute-readonly", async (request, reply) => {
    const parsedBody = readOnlyToolInvocationBodySchema.safeParse(
      request.body ?? {}
    );

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid read-only tool invocation request",
        details: parsedBody.error.flatten()
      });
    }

    return executeReadOnlyToolInvocation(
      toReadOnlyInvocationInput(parsedBody.data)
    );
  });

  app.get("/mcp/tools", async (request, reply) => {
    const parsedQuery = listAgentToolsQuerySchema.safeParse(request.query ?? {});

    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: "Invalid agent tool registry query",
        details: parsedQuery.error.flatten()
      });
    }

    const tools = listAgentTools(toRegistryFilter(parsedQuery.data));

    return {
      tools,
      registryMetadata: {
        transport: "INTERNAL_PREVIEW",
        executionEnabled: false,
        status:
          "Tool registry preview only. MCP transport and tool execution are intentionally not enabled in this slice."
      }
    };
  });

  app.get("/mcp/tools/:name", async (request, reply) => {
    const parsedParams = agentToolParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Invalid agent tool lookup params",
        details: parsedParams.error.flatten()
      });
    }

    const tool = getAgentTool(parsedParams.data.name);

    if (!tool) {
      return reply.status(404).send({
        error: "Agent tool not found"
      });
    }

    return {
      tool
    };
  });
}
