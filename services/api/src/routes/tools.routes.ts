import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getAgentTool,
  listAgentTools,
  type AgentToolRegistryFilter
} from "../tools/tool-registry.js";
import { previewToolExecutionPolicy } from "../tools/tool-execution-policy.js";
import { previewToolInvocation } from "../tools/tool-invocation-preview.js";

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

    return previewToolInvocation({
      toolName: parsedBody.data.toolName,
      requestedBy: parsedBody.data.requestedBy,
      executionMode: parsedBody.data.executionMode,
      humanApprovalGranted: parsedBody.data.humanApprovalGranted,
      ...(parsedBody.data.inputJson === undefined
        ? {}
        : { inputJson: parsedBody.data.inputJson }),
      ...(parsedBody.data.workflowRunId === undefined
        ? {}
        : { workflowRunId: parsedBody.data.workflowRunId }),
      ...(parsedBody.data.workflowStepId === undefined
        ? {}
        : { workflowStepId: parsedBody.data.workflowStepId })
    });
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
