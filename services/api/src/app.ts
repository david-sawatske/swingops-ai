import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

import { env } from "./config/env.js";
import { aiRoutes } from "./routes/ai.routes.js";
import { aiReadyIntakeRecordRoutes } from "./routes/ai-ready-intake-records.routes.js";
import { adminOpsRoutes } from "./routes/admin-ops.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { knowledgeRoutes } from "./routes/knowledge.routes.js";
import { reviewQueueItemRoutes } from "./routes/review-queue-items.routes.js";
import { toolRoutes } from "./routes/tools.routes.js";
import { workflowRunRoutes } from "./routes/workflow-runs.routes.js";
import { workflowEvalRoutes } from "./routes/workflow-evals.routes.js";

// Routes that run workflows, evaluations, or (with real providers enabled)
// paid model calls get a tighter per-client limit than the rest of the API.
export const WORKFLOW_RATE_LIMITED_ROUTES = new Set([
  "POST /workflow-runs/agentic-trade-in-demo",
  "POST /workflow-runs/multi-source-intake-demo",
  "POST /workflow-runs/golden-demonstration/prepare",
  "POST /workflow-evals/run",
  "POST /knowledge/evals/run",
  "POST /knowledge/ingest-demo",
]);

export type BuildAppOptions = {
  trustProxyHops?: number;
  rateLimitMaxPerMinute?: number;
  workflowRateLimitMaxPerMinute?: number;
  knowledgeIngestRouteEnabled?: boolean;
};

export function buildApp(options: BuildAppOptions = {}) {
  const trustProxyHops = options.trustProxyHops ?? env.TRUST_PROXY_HOPS;
  const rateLimitMaxPerMinute =
    options.rateLimitMaxPerMinute ?? env.RATE_LIMIT_MAX_PER_MINUTE;
  const workflowRateLimitMaxPerMinute =
    options.workflowRateLimitMaxPerMinute ??
    env.WORKFLOW_RATE_LIMIT_MAX_PER_MINUTE;
  const knowledgeIngestRouteEnabled =
    options.knowledgeIngestRouteEnabled ?? env.KNOWLEDGE_INGEST_ROUTE_ENABLED;

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
    trustProxy: trustProxyHops > 0 ? trustProxyHops : false,
  });

  app.register(cors, {
    origin: env.WEB_ORIGIN,
  });

  if (workflowRateLimitMaxPerMinute > 0) {
    app.addHook("onRoute", (routeOptions) => {
      const methods = [routeOptions.method].flat();
      const isWorkflowRoute = methods.some((method) =>
        WORKFLOW_RATE_LIMITED_ROUTES.has(`${method} ${routeOptions.url}`),
      );

      if (isWorkflowRoute) {
        routeOptions.config = {
          ...routeOptions.config,
          rateLimit: {
            max: workflowRateLimitMaxPerMinute,
            timeWindow: "1 minute",
          },
        };
      }
    });
  }

  if (rateLimitMaxPerMinute > 0 || workflowRateLimitMaxPerMinute > 0) {
    app.register(rateLimit, {
      global: rateLimitMaxPerMinute > 0,
      max: rateLimitMaxPerMinute,
      timeWindow: "1 minute",
    });
  }

  app.register(healthRoutes);
  app.register(aiRoutes);
  app.register(aiReadyIntakeRecordRoutes);
  app.register(adminOpsRoutes);
  app.register(knowledgeRoutes, {
    ingestRouteEnabled: knowledgeIngestRouteEnabled,
  });
  app.register(reviewQueueItemRoutes);
  app.register(workflowRunRoutes);
  app.register(workflowEvalRoutes);
  app.register(toolRoutes);

  return app;
}
