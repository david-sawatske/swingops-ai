import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { routeModel } from "../ai/model-router.js";

const modelTaskTypeSchema = z.enum([
  "INTAKE_PARSING",
  "FIELD_NORMALIZATION",
  "VALIDATION",
  "REVIEW_SUMMARY"
]);

const modelRoutingGoalSchema = z.enum([
  "LOW_COST",
  "LOW_LATENCY",
  "HIGH_QUALITY",
  "LOCAL_ONLY"
]);

const modelRoutingPreviewBodySchema = z
  .object({
    taskType: modelTaskTypeSchema,
    preferredGoal: modelRoutingGoalSchema.default("LOW_COST"),
    requireJson: z.boolean().default(true),
    allowDisabledProvidersForSimulation: z.boolean().default(true)
  })
  .strict();

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.post("/ai/model-routing/preview", async (request, reply) => {
    const parsedBody = modelRoutingPreviewBodySchema.safeParse(request.body ?? {});

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid model routing preview request",
        details: parsedBody.error.flatten()
      });
    }

    const routingDecision = routeModel({
      taskType: parsedBody.data.taskType,
      preferredGoal: parsedBody.data.preferredGoal,
      requireJson: parsedBody.data.requireJson,
      allowDisabledProvidersForSimulation:
        parsedBody.data.allowDisabledProvidersForSimulation
    });

    return {
      routingRequest: parsedBody.data,
      routingDecision
    };
  });
}
