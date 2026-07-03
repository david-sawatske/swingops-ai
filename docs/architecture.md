# Architecture

SwingOps AI is a local full-stack workflow demo built around a guided operational run. The application is split into a web app, an API service, shared package code, and a PostgreSQL database.

The architecture emphasizes:

- Structured workflow state.
- Traceable model and tool activity.
- Read-only connector execution.
- Human review before uncertain records are treated as final.
- Persisted normalized records that can be inspected after the run.

## Workspace layout

    apps/web
    services/api
    packages/shared
    docs

## `apps/web`

The web app is a React and TypeScript Vite application.

Primary responsibilities:

- Render the Guided Workflow.
- Collect messy source input.
- Call backend workflow routes.
- Display normalized AI-ready records.
- Display guarded workflow evidence.
- Surface validation and review queue work.
- Submit structured review corrections.
- Display the final run report.

Important areas:

    apps/web/src/App.tsx
    apps/web/src/components/guided-demo
    apps/web/src/components/guided-demo/source-intake
    apps/web/src/components/guided-demo/steps
    apps/web/src/components/guided-demo/steps/validation-review
    apps/web/src/components/guided-demo/steps/final-run-report
    apps/web/src/components/review-queue
    apps/web/src/hooks
    apps/web/src/types
    apps/web/src/api
    apps/web/src/utils

`App.tsx` keeps the Guided Workflow as the primary view and wires workflow state, review queue state, and the current guided step into `GuidedDemoPathPage`.

## `services/api`

The API is a Fastify and TypeScript service.

Primary responsibilities:

- Register HTTP routes.
- Execute demo workflows.
- Persist workflow run state.
- Persist AI-ready records.
- Persist review queue items and review corrections.
- Search the knowledge base.
- Route model tasks through provider selection and fallback logic.
- Execute read-only tools behind policy checks.
- Serialize database records into UI-safe responses.

Important areas:

    services/api/src/app.ts
    services/api/src/server.ts
    services/api/src/routes
    services/api/src/workflows
    services/api/src/knowledge
    services/api/src/ai
    services/api/src/tools
    services/api/src/internal-systems
    services/api/src/serializers
    services/api/prisma/schema.prisma

## `packages/shared`

The shared package is available for cross-workspace TypeScript code. It keeps reusable shared code separate from app-specific UI and API implementation details.

## PostgreSQL, Prisma, and pgvector-compatible storage

The local database is PostgreSQL, accessed through Prisma.

The database stores:

- Intake batches and intake items.
- Workflow runs and workflow steps.
- Model call logs and model provider attempt logs.
- Tool call logs.
- Review queue items.
- Reviewed trade-in records.
- Human review learning events.
- AI-ready intake records.
- Knowledge documents, chunks, and ingestion runs.

Knowledge chunks include embedding metadata and pgvector-compatible vector storage. The local retrieval implementation uses deterministic embeddings and weighted scoring so the app can demonstrate grounding behavior without depending on a remote embedding service.

## Workflow runs

A `WorkflowRun` is the top-level audit container for a guarded execution.

It connects:

- The intake batch or intake item being processed.
- Ordered workflow steps.
- Model call logs.
- Tool call logs.
- Review queue items.
- AI-ready intake records.
- Reviewed trade-in records.
- Human review learning events.

The UI uses workflow run data to show status, evidence, audit traces, and final readiness.

## Review queue

The review queue captures records that should not be silently accepted.

A review item can represent:

- Missing required fields.
- Low-confidence extraction.
- Ambiguous input.
- Validation failure.
- Manual review routing.

The guided review step filters the review queue to the current run and lets a reviewer resolve records through a controlled correction flow.

## AI-ready records

An AI-ready intake record is a normalized, persisted source-derived record. It includes:

- Source type and source name.
- Raw source text and cleaned text.
- Normalized JSON.
- Inferred schema JSON.
- Metadata JSON.
- Quality signals JSON.
- Review-needed status.
- Embedding readiness.
- RAG readiness.

AI-ready does not mean automatically approved. It means the record has enough structure, source context, and quality metadata to be safely used by later workflow steps or reviewed before downstream use.

## Knowledge and RAG

The knowledge system stores local demo knowledge as documents and chunks.

The search flow supports:

- Brand and category filtering.
- Chunk type filtering.
- Weighted score breakdowns.
- Matched terms.
- Scoring explanations.
- Citations back to source document metadata.

The retrieval mode is deterministic for local development. It demonstrates the shape of retrieval grounding while keeping local runs repeatable.

## Model routing

The model routing layer demonstrates how model work can be selected and logged based on provider, model, cost, latency, quality, and health behavior.

The workflow logs model call attempts so a reviewer can see:

- Which provider/model was selected.
- Which goal the model call served.
- Whether fallback behavior occurred.
- Cost and latency metadata.
- Attempt outcomes.

## MCP-compatible tools

The tool layer exposes internal tool contracts through an MCP-compatible surface.

Key design points:

- Tool definitions are grouped by domain.
- Tools include risk metadata.
- Read-only tools can execute through the read-only executor.
- Mutation tools can remain visible for planning and governance but are blocked without approval.
- All allowed, blocked, and failed calls can be audited through `ToolCallLog`.

The local stdio MCP server wraps the same connector surface used by the API. It is intentionally thin so there is one source of truth for tool contracts and policy.

## Inventory and valuation internal systems

The app includes simulated internal systems for:

- Inventory product matching.
- Similar product lookup.
- Trade-in valuation range estimation.
- Valuation adjustment explanation.

These systems are local services, but they are architected like internal read-only operational systems. The guarded workflow uses them as evidence sources instead of treating model output as the only source of truth.

## Audit logging

Auditability is built into the persisted data model.

A completed guided run can produce:

- Workflow run status.
- Ordered workflow step output.
- Model call logs and provider attempts.
- Tool call logs.
- Knowledge matches and score explanations.
- Inventory match evidence.
- Valuation range evidence.
- Review queue items.
- Reviewed trade-in records.
- Human review learning events.
- Final merged record readiness.

The final report pulls these pieces together so a reviewer can understand what happened, what changed, and what is ready for later use.
