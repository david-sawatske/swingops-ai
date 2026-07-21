# Development

This guide covers local setup, development commands, validation commands, and troubleshooting notes.

## Prerequisites

Install:

- Node.js
- pnpm
- Docker

The app uses Docker for local PostgreSQL.

## Install dependencies

From the repo root:

    pnpm install

## Environment setup

Create the API's workspace-local environment file:

    cp services/api/.env.example services/api/.env
    pnpm config:check

Both the API runtime and Prisma commands read `services/api/.env`. The checked-in
example points at the PostgreSQL container's published host port, `5433`, and
allows the default Vite origin at `http://localhost:5173`.

`TEST_DATABASE_URL` points at a separate database whose name must end in
`_test`. API test commands create that database when necessary and reset it
before running; they refuse to reset the development database.

The web app defaults to `http://localhost:4000` for the API and needs no local
environment file for the standard setup. To override that URL:

    cp apps/web/.env.example apps/web/.env

Real provider calls are disabled by default. The API example lists the opt-in
flag and supported provider variables; deterministic/mock behavior works
without credentials.

## Start PostgreSQL

    pnpm db:up

View logs:

    pnpm db:logs

Stop services:

    pnpm db:down

## Prisma setup

Generate the Prisma client:

    pnpm --filter @swingops/api prisma:generate

Apply local migrations:

    pnpm --filter @swingops/api prisma:migrate

Open Prisma Studio:

    pnpm --filter @swingops/api prisma:studio

## Run the app

Run all workspace dev processes:

    pnpm dev

Run API only:

    pnpm --filter @swingops/api dev

Run web only:

    pnpm --filter @swingops/web dev

Use the URL printed by Vite to open the web app.

## Run validation

Typecheck the web app:

    pnpm --filter @swingops/web typecheck

Typecheck the API:

    pnpm --filter @swingops/api typecheck

Typecheck shared package:

    pnpm --filter @swingops/shared typecheck

Typecheck all workspaces:

    pnpm -r typecheck

Run tests:

    pnpm --filter @swingops/web test
    pnpm --filter @swingops/api test
    pnpm --filter @swingops/shared test

Run all tests:

    pnpm -r test

Check whitespace and patch formatting before committing:

    git diff --check

## Demo knowledge ingestion

For richer knowledge grounding, ingest the demo knowledge base through the app UI.

The backend route is:

    POST /knowledge/ingest-demo

The knowledge system stores local demo chunks for club references, trade-in policy, condition guides, brand aliases, and shaft flex guides.

## Local MCP server

Run the local stdio MCP server:

    pnpm --filter @swingops/api mcp:dev

The local server wraps the existing SwingOps connector contracts and read-only execution policy.

## Branch and commit workflow

Recommended local workflow:

    git status --short
    git checkout -b chore/descriptive-branch-name

Make a small focused change, then validate:

    git diff --check
    pnpm --filter @swingops/web typecheck
    pnpm --filter @swingops/api typecheck

For docs-only changes, typecheck is usually enough to confirm the repo still builds. Run tests when code changes or when docs were updated alongside code behavior.

Review the diff before committing:

    git diff -- README.md docs

Commit after review:

    git add README.md docs
    git commit -m "docs: document guided workflow architecture"

## Troubleshooting

### Database connection errors

Confirm PostgreSQL is running:

    pnpm db:up
    pnpm db:logs

Confirm the API environment points at the local database.

Validate the resolved non-secret configuration:

    pnpm config:check

### Prisma client errors

Regenerate the Prisma client:

    pnpm --filter @swingops/api prisma:generate

If schema changes are present, apply migrations:

    pnpm --filter @swingops/api prisma:migrate

### Empty or weak knowledge matches

Ingest the demo knowledge base through the UI before running a full guided workflow.

### Web app cannot reach API

Confirm the API dev server is running, `WEB_ORIGIN` in `services/api/.env`
matches the web origin, and `VITE_API_BASE_URL` in `apps/web/.env` points at the
API when you are not using the default ports.

### Review step has no current-run review items

The review step is run-scoped. First run source intake, then run guarded agent execution. Review items only appear when the current workflow run creates records that need human attention.
