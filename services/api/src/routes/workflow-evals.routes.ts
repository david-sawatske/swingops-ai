import type { FastifyInstance } from "fastify";

import {
  listWorkflowEvalScenarioSummaries,
  runWorkflowEvals
} from "../workflow-evals/workflow-eval-runner.js";

export async function workflowEvalRoutes(app: FastifyInstance): Promise<void> {
  app.get("/workflow-evals/scenarios", async () => ({
    scenarios: listWorkflowEvalScenarioSummaries()
  }));

  app.post("/workflow-evals/run", async () => runWorkflowEvals());
}
