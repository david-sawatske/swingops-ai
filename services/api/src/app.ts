import cors from "@fastify/cors";
import Fastify from "fastify";

import { env } from "./config/env.js";
import { aiRoutes } from "./routes/ai.routes.js";
import { aiReadyIntakeRecordRoutes } from "./routes/ai-ready-intake-records.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { knowledgeRoutes } from "./routes/knowledge.routes.js";
import { reviewQueueItemRoutes } from "./routes/review-queue-items.routes.js";
import { toolRoutes } from "./routes/tools.routes.js";
import { workflowRunRoutes } from "./routes/workflow-runs.routes.js";
import { workflowEvalRoutes } from "./routes/workflow-evals.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL
    }
  });

  app.register(cors, {
    origin: env.WEB_ORIGIN
  });

  app.register(healthRoutes);
  app.register(aiRoutes);
  app.register(aiReadyIntakeRecordRoutes);
  app.register(knowledgeRoutes);
  app.register(reviewQueueItemRoutes);
  app.register(workflowRunRoutes);
  app.register(workflowEvalRoutes);
  app.register(toolRoutes);

  return app;
}
