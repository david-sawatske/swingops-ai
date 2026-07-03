# SwingOps AI

SwingOps AI is a guided golf retail workflow demo for turning messy trade-in intake into normalized, reviewable, AI-ready operational records.

The main product experience is the **Guided Workflow**. It walks through messy source intake, normalized record creation, guarded agent execution, human validation, review corrections, audit data, and a final run report.

## What the app demonstrates

SwingOps AI shows how an AI-assisted operational workflow can be structured around safety, traceability, and human review instead of a single black-box model response.

The guided run demonstrates:

- Messy multi-source intake from free text, poorly formed CSV, email-style text, and logs.
- Normalized AI-ready records with schema fields, missing-field signals, and review status.
- Guarded agent execution with workflow planning, validation gates, retry traces, and evidence.
- Retrieval grounding through a local knowledge base and weighted RAG-style matching.
- Internal inventory matching and trade-in valuation evidence.
- Model routing and provider fallback logging.
- MCP-compatible read-only tool execution with policy checks.
- Human validation and review through a run-scoped review queue.
- Structured review corrections that persist improved records and learning events.
- Audit trails across workflow runs, model calls, tool calls, review items, and final output.

## Guided Workflow

The Guided Workflow is the default app view.

It starts with an overview/setup page and then walks through five actionable steps:

1. **Messy Source Intake**
   Add one or more messy source inputs, choose source types, paste or upload text, and normalize the sources.

2. **AI-Ready Records**
   Inspect the normalized records created from intake. The app shows extracted fields, missing fields, review flags, and persisted AI-ready records.

3. **Guarded Agent Execution**
   Run the trade-in workflow using the normalized input. The workflow retrieves knowledge matches, checks inventory, estimates valuation ranges, routes model work, invokes safe read-only tools, and blocks unsafe mutation behavior.

4. **Validation Review**
   Inspect record-level review issues and run-level checks. Resolve review queue items with controlled corrections when human judgment is needed.

5. **Final Run Report**
   Review the final merged output, readiness status, audit trace, review changes, learning events, and records ready for downstream use.

For a deeper walkthrough, see [Guided Workflow](docs/guided-workflow.md).

## Main systems involved

- **Web app**: React and TypeScript guided workflow UI.
- **API**: Fastify and TypeScript backend routes, workflows, services, and serializers.
- **Database**: PostgreSQL accessed through Prisma.
- **Knowledge/RAG**: Local deterministic retrieval over seeded trade-in knowledge chunks, with pgvector-compatible storage.
- **Workflow runs**: Persisted execution records with steps, status, model logs, tool logs, and review items.
- **AI-ready records**: Persisted normalized intake records with source metadata, quality signals, and RAG readiness.
- **Review queue**: Human-in-the-loop queue for incomplete, ambiguous, or low-confidence records.
- **MCP-compatible tools**: Internal connector surface with read-only execution policy and audit logging.
- **Inventory and valuation systems**: Simulated internal systems used to demonstrate matching and valuation evidence.

## Tech stack

- pnpm workspaces
- TypeScript
- React + Vite
- Fastify
- Prisma
- PostgreSQL
- pgvector-compatible knowledge storage
- Zod
- Vitest
- MCP SDK

## Quick start

Install dependencies:

    pnpm install

Start PostgreSQL:

    pnpm db:up

Prepare Prisma locally:

    pnpm --filter @swingops/api prisma:generate
    pnpm --filter @swingops/api prisma:migrate

Start the API and web app together:

    pnpm dev

Or run them separately:

    pnpm --filter @swingops/api dev
    pnpm --filter @swingops/web dev

Open the web app using the URL printed by Vite. The default product experience is **Guided Workflow**.

## Environment assumptions

The local app expects:

- Node.js and pnpm.
- Docker for the local PostgreSQL service.
- A local environment file based on `.env.example`, if your shell does not already provide the required variables.
- Prisma migrations applied to the local database before running the full workflow.

Useful database commands:

    pnpm db:up
    pnpm db:logs
    pnpm db:down

## Demo knowledge base

The guided workflow can retrieve richer grounding evidence when demo knowledge has been ingested.

Run the app, open the connector/knowledge controls in the UI, and use the demo knowledge ingestion action. The backend route behind that action is:

    POST /knowledge/ingest-demo

The knowledge system stores local deterministic embeddings and weighted scoring metadata for trade-in policy, club reference, condition, brand alias, and shaft flex guide chunks.

## Validation commands

Run typechecks:

    pnpm --filter @swingops/web typecheck
    pnpm --filter @swingops/api typecheck
    pnpm --filter @swingops/shared typecheck

Run all workspace typechecks:

    pnpm -r typecheck

Run tests:

    pnpm --filter @swingops/web test
    pnpm --filter @swingops/api test
    pnpm --filter @swingops/shared test

Run all tests:

    pnpm -r test

## Repository structure

    apps/web
      React guided workflow UI, review queue UI, API clients, hooks, types, and styles.

    services/api
      Fastify API, workflow orchestration, route handlers, serializers, Prisma access,
      knowledge retrieval, model routing, tool policy, internal inventory, valuation,
      and MCP-compatible connector execution.

    packages/shared
      Shared TypeScript package used across workspaces.

    docs
      Deeper documentation for architecture, workflow behavior, backend systems,
      data models, development, testing, and AI workflow concepts.

## Documentation

- [Architecture](docs/architecture.md)
- [Guided Workflow](docs/guided-workflow.md)
- [Backend Systems](docs/backend-systems.md)
- [Data Models](docs/data-models.md)
- [AI Workflow Concepts](docs/ai-workflow-concepts.md)
- [Development](docs/development.md)
- [Testing](docs/testing.md)

## Local MCP server

SwingOps AI includes a local stdio MCP server transport for development:

    pnpm --filter @swingops/api mcp:dev

The MCP transport wraps the existing API-owned connector surface. It does not define a second tool registry.

Current behavior:

- `tools/list` exposes the existing SwingOps tool contracts.
- `tools/call` delegates to the same MCP-compatible tool call adapter used by the API.
- Allowed low-risk read-only tools execute through the read-only executor.
- Disabled or mutation-oriented tools remain visible for governance but are blocked before execution.
- Successful, failed, and blocked calls persist `ToolCallLog` records.

This local transport does not claim hosted deployment, tenant isolation, production OAuth, or remote MCP access.
