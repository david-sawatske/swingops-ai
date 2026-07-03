# Backend Systems

The backend is a Fastify and TypeScript API that runs the workflow, persists audit state, and exposes the data needed by the Guided Workflow UI.

## Application entry

    services/api/src/server.ts
    services/api/src/app.ts

`server.ts` starts the Fastify app and handles shutdown. `app.ts` registers CORS and all API route modules.

Registered route modules include:

- `aiRoutes`
- `aiReadyIntakeRecordRoutes`
- `healthRoutes`
- `knowledgeRoutes`
- `reviewQueueItemRoutes`
- `toolRoutes`
- `workflowRunRoutes`

## Key routes

### Workflow runs

File:

    services/api/src/routes/workflow-runs.routes.ts

Important routes:

    POST /workflow-runs/multi-source-intake-demo
    POST /workflow-runs/agentic-trade-in-demo
    GET /workflow-runs
    GET /workflow-runs/:id

Responsibilities:

- Run the multi-source intake workflow.
- Run the guarded trade-in workflow.
- List workflow runs with summary information.
- Load a workflow run with steps, tool logs, model logs, and review items.

### AI-ready intake records

File:

    services/api/src/routes/ai-ready-intake-records.routes.ts

Important routes:

    GET /ai-ready-intake-records
    GET /ai-ready-intake-records/:id

Responsibilities:

- Filter AI-ready records by workflow run, intake batch, source type, status, and limit.
- Return serialized persisted AI-ready records.

### Review queue

File:

    services/api/src/routes/review-queue-items.routes.ts

Important routes:

    GET /review-queue-items
    POST /review-queue-items/:id/resolve
    POST /review-queue-items/:id/dismiss
    POST /review-queue-items/:id/resolve-with-corrections

Responsibilities:

- List review queue items with workflow and intake context.
- Resolve items.
- Dismiss items.
- Persist structured corrections.
- Persist reviewed trade-in records.
- Persist human review learning events.
- Update AI-ready records when corrected records are ready.
- Complete workflow runs when all review work is closed.

### Knowledge

File:

    services/api/src/routes/knowledge.routes.ts

Important routes:

    POST /knowledge/ingest-demo
    GET /knowledge/chunks
    POST /knowledge/search
    POST /knowledge/evals/run

Responsibilities:

- Ingest local demo knowledge.
- List chunks.
- Search the local knowledge base.
- Run retrieval evaluations.

### Tools and MCP-compatible connectors

File:

    services/api/src/routes/tools.routes.ts

Important routes include:

    GET /mcp/connectors/catalog
    GET /mcp/tools/invocations/history
    POST /mcp/tools/invocations/preview
    POST /mcp/tools/invocations/preview-log
    POST /mcp/tools/execution-policy/preview
    POST /mcp/tools/invocations/execute-readonly
    GET /tools
    GET /tools/:name
    POST /mcp/tools/:toolId/call

Responsibilities:

- Expose the connector catalog.
- Preview tool calls.
- Preview and enforce execution policy.
- Execute allowed read-only tools.
- Persist tool call logs.
- Expose MCP-compatible tool list and call behavior.

### AI/model routing

File:

    services/api/src/routes/ai.routes.ts

Responsibilities:

- Expose model routing preview behavior.
- Demonstrate provider selection and fallback metadata.

## Key workflows

### Multi-source intake workflow

File:

    services/api/src/workflows/multi-source-intake-demo.ts

Supporting files:

    services/api/src/workflows/multi-source-intake-parser.ts
    services/api/src/workflows/multi-source-intake-types.ts

Responsibilities:

- Accept multiple messy source inputs.
- Normalize records from supported source types.
- Infer schema fields.
- Build metadata and quality signals.
- Determine review-needed status.
- Determine embedding and RAG readiness.
- Persist AI-ready intake records.

### Guarded trade-in workflow

File:

    services/api/src/workflows/end-to-end-agentic-trade-in-demo.ts

Supporting files:

    services/api/src/workflows/trade-in-demo-parser.ts
    services/api/src/workflows/workflow-quality.ts
    services/api/src/workflows/workflow-quality-builders.ts
    services/api/src/workflows/workflow-quality-types.ts
    services/api/src/workflows/workflow-model-logging.ts

Responsibilities:

- Parse generated trade-in input.
- Create workflow run state.
- Retrieve knowledge evidence.
- Match inventory products.
- Estimate valuation ranges.
- Route model work.
- Execute safe read-only tools.
- Block unsafe mutation behavior.
- Build validation and retry traces.
- Create review queue items.
- Return summary data for the Guided Workflow.

## Key services

### Knowledge search

Files:

    services/api/src/knowledge/knowledge-ingestion.ts
    services/api/src/knowledge/knowledge-search.ts
    services/api/src/knowledge/knowledge-embeddings.ts
    services/api/src/knowledge/knowledge-seed-data.ts
    services/api/src/knowledge/knowledge-evals.ts

The knowledge system uses deterministic local embeddings and weighted scoring. It returns matched chunks, score breakdowns, matched terms, explanations, and citation metadata.

### Model routing

Files:

    services/api/src/ai/model-router.ts
    services/api/src/ai/model-provider-registry.ts
    services/api/src/ai/model-provider-fallback-executor.ts
    services/api/src/ai/model-provider-health.ts
    services/api/src/ai/model-provider-costs.ts
    services/api/src/ai/model-provider-adapters.ts

The model routing layer demonstrates provider choice, fallback behavior, cost/latency metadata, and attempt logging.

### Tool registry and execution policy

Files:

    services/api/src/tools/tool-registry.ts
    services/api/src/tools/tool-registry.types.ts
    services/api/src/tools/tool-contracts.ts
    services/api/src/tools/tool-execution-policy.ts
    services/api/src/tools/read-only-tool-invocation.ts
    services/api/src/tools/mcp-compatible-tool-surface.ts
    services/api/src/tools/connector-catalog.ts
    services/api/src/tools/mcp-output-sanitizer.ts
    services/api/src/tools/read-only-tool-serializers.ts

Tool definitions are organized by domain:

    services/api/src/tools/tool-definitions/customer-communication-tools.ts
    services/api/src/tools/tool-definitions/inventory-tools.ts
    services/api/src/tools/tool-definitions/review-queue-tools.ts
    services/api/src/tools/tool-definitions/valuation-tools.ts
    services/api/src/tools/tool-definitions/workflow-tools.ts

The policy system separates planning from execution. Mutation tools can be visible as part of a governed tool catalog while still being blocked by execution policy.

### Internal inventory and valuation systems

Files:

    services/api/src/internal-systems/inventory-service.ts
    services/api/src/internal-systems/inventory-demo-data.ts
    services/api/src/internal-systems/trade-in-valuation-service.ts
    services/api/src/internal-systems/trade-in-valuation-demo-data.ts

These are simulated internal systems. They behave like read-only operational services that return evidence the workflow can use.

## Serializers

Serializers keep database shape separate from API response shape.

Important files:

    services/api/src/routes/workflow-runs.serializers.ts
    services/api/src/routes/review-queue-items.serializers.ts
    services/api/src/tools/read-only-tool-serializers.ts
    services/api/src/serializers/shared-workflow-serializers.ts

Responsibilities:

- Convert dates to strings.
- Shape nested records for UI use.
- Avoid leaking unnecessary Prisma internals.
- Keep route handlers smaller and easier to inspect.

## Read-only tool execution policy

Read-only tool invocation is handled through:

    services/api/src/tools/read-only-tool-invocation.ts

The executor:

- Validates input with Zod.
- Evaluates execution policy before execution.
- Allows supported low-risk read-only tools.
- Blocks disabled or mutation-oriented tools.
- Persists `ToolCallLog` records.
- Returns sanitized connector-style output.
- Includes metadata showing that the route is read-only and policy-checked.

This allows the app to demonstrate agent tool use without allowing uncontrolled mutation.

## Human review corrections

Structured review correction is handled in:

    services/api/src/routes/review-queue-items.routes.ts

When resolving with corrections, the backend can:

- Mark the review queue item as resolved.
- Upsert a `ReviewedTradeInRecord`.
- Create `HumanReviewLearningEvent` records.
- Update or create an `AiReadyIntakeRecord`.
- Mark the parent workflow run completed when no open review work remains.

The correction flow is intentionally controlled. Fields such as category, shaft flex, and condition grade are validated against allowed values.

## AI-ready record production

AI-ready records are produced in the multi-source intake workflow and may be updated by the review correction flow.

They preserve:

- Raw text.
- Cleaned text.
- Normalized JSON.
- Inferred schema JSON.
- Metadata JSON.
- Quality signals JSON.
- Review status.
- Embedding readiness.
- RAG readiness.

This gives later workflow steps and reviewers a stable record shape to inspect.

## Simulated vs production-style boundaries

Simulated locally:

- Inventory product data.
- Valuation data.
- Deterministic embeddings.
- Demo knowledge base.
- Mock/provider-style model behavior where configured.

Architected like production-style systems:

- Workflow run persistence.
- Model attempt logging.
- Tool policy enforcement.
- Read-only connector execution.
- Review queue correction loop.
- Serialized route responses.
- Knowledge retrieval with scoring metadata.
- Audit trail across model, tool, review, and final output.
