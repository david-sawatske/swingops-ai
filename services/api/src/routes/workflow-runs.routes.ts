import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import {
  serializeModelCallLog,
  serializeReviewQueueItem,
  serializeToolCallLog,
  serializeWorkflowRun,
  serializeWorkflowRunListItem,
  serializeWorkflowStep
} from "./workflow-runs.serializers.js";
import {
  DEFAULT_AGENTIC_TRADE_IN_DEMO_INPUT,
  executeEndToEndAgenticTradeInDemo
} from "../workflows/end-to-end-agentic-trade-in-demo.js";
import {
  executeMultiSourceIntakeDemo
} from "../workflows/multi-source-intake-demo.js";

const workflowRunParamsSchema = z.object({
  id: z.string().min(1)
});

const agenticTradeInDemoBodySchema = z
  .object({
    rawInput: z.string().optional()
  })
  .strict();

const multiSourceIntakeSourceTypeSchema = z.enum([
  "FREE_TEXT",
  "POORLY_FORMED_CSV",
  "EMAIL",
  "LOG"
]);

const multiSourceIntakeDemoBodySchema = z
  .object({
    sourceTypes: z.array(multiSourceIntakeSourceTypeSchema).min(1).optional(),
    sources: z
      .array(
        z
          .object({
            sourceType: multiSourceIntakeSourceTypeSchema,
            sourceName: z.string().trim().min(1).max(120).optional(),
            rawContent: z.string().trim().min(1).max(20000)
          })
          .strict()
      )
      .min(1)
      .max(8)
      .optional()
  })
  .strict();

export async function workflowRunRoutes(app: FastifyInstance): Promise<void> {
  app.post("/workflow-runs/multi-source-intake-demo", async (request, reply) => {
    const parsedBody = multiSourceIntakeDemoBodySchema.safeParse(request.body ?? {});

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid multi-source intake demo request",
        details: parsedBody.error.flatten()
      });
    }

    const demoInput: Parameters<typeof executeMultiSourceIntakeDemo>[0] = {};

    if (parsedBody.data.sources) {
      demoInput.sources = parsedBody.data.sources.map((source) => ({
        sourceType: source.sourceType,
        rawContent: source.rawContent,
        ...(source.sourceName ? { sourceName: source.sourceName } : {})
      }));
    } else if (parsedBody.data.sourceTypes) {
      demoInput.sourceTypes = parsedBody.data.sourceTypes;
    }

    return executeMultiSourceIntakeDemo(demoInput);
  });

  app.post("/workflow-runs/agentic-trade-in-demo", async (request, reply) => {
    const parsedBody = agenticTradeInDemoBodySchema.safeParse(request.body ?? {});

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid agentic trade-in demo request",
        details: parsedBody.error.flatten()
      });
    }

    return executeEndToEndAgenticTradeInDemo({
      rawInput: parsedBody.data.rawInput ?? DEFAULT_AGENTIC_TRADE_IN_DEMO_INPUT
    });
  });

  app.get("/workflow-runs", async () => {
    const workflowRuns = await prisma.workflowRun.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 100,
      include: {
        intakeBatch: true,
        intakeItem: true,
        modelCallLogs: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          include: {
            attemptLogs: {
              orderBy: {
                attemptOrder: "asc"
              }
            }
          }
        },
        toolCallLogs: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            id: true,
            workflowRunId: true,
            workflowStepId: true,
            toolName: true,
            status: true,
            errorMessage: true,
            startedAt: true,
            completedAt: true,
            createdAt: true
          }
        },
        reviewQueueItems: {
          select: {
            status: true
          }
        },
        _count: {
          select: {
            toolCallLogs: true,
            reviewQueueItems: true
          }
        }
      }
    });

    const workflowRunIds = workflowRuns.map((run) => run.id);
    const auditOnlyToolCallLogs =
      workflowRunIds.length > 0
        ? await prisma.toolCallLog.findMany({
            where: {
              workflowRunId: {
                in: workflowRunIds
              },
              outputJson: {
                path: ["previewOnly"],
                equals: true
              }
            },
            select: {
              workflowRunId: true
            }
          })
        : [];
    const auditOnlyToolCallLogCountsByRunId = auditOnlyToolCallLogs.reduce<
      Record<string, number>
    >((counts, log) => {
      if (log.workflowRunId) {
        counts[log.workflowRunId] = (counts[log.workflowRunId] ?? 0) + 1;
      }

      return counts;
    }, {});

    return {
      workflowRuns: workflowRuns.map((workflowRun) =>
        serializeWorkflowRunListItem({
          ...workflowRun,
          // List responses intentionally omit tool input and output payloads.
          // Full audit payloads remain available from GET /workflow-runs/:id.
          toolCallLogs: workflowRun.toolCallLogs.map(
            (toolCallLog) => ({
              ...toolCallLog,
              inputJson: null,
              outputJson: null
            })
          ),
          auditOnlyToolCallLogCount:
            auditOnlyToolCallLogCountsByRunId[workflowRun.id] ?? 0
        })
      )
    };
  });

  app.get("/workflow-runs/:id", async (request, reply) => {
    const parsedParams = workflowRunParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Invalid workflow run id",
        details: parsedParams.error.flatten()
      });
    }

    const workflowRun = await prisma.workflowRun.findUnique({
      where: {
        id: parsedParams.data.id
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
          },
          include: {
            attemptLogs: {
              orderBy: {
                attemptOrder: "asc"
              }
            }
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
      return reply.status(404).send({
        error: "Workflow run not found"
      });
    }

    return {
      workflowRun: serializeWorkflowRun(workflowRun),
      steps: workflowRun.steps.map(serializeWorkflowStep),
      toolCallLogs: workflowRun.toolCallLogs.map(serializeToolCallLog),
      modelCallLogs: workflowRun.modelCallLogs.map(serializeModelCallLog),
      reviewQueueItems: workflowRun.reviewQueueItems.map(
        serializeReviewQueueItem
      )
    };
  });

}
