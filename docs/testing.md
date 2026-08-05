# Testing

SwingOps AI uses TypeScript typechecking and Vitest tests across the workspace,
plus Playwright for the complete guided browser journey.

## Test database isolation

API integration tests require the local PostgreSQL/pgvector service:

    pnpm db:up

The API test lifecycle reads `TEST_DATABASE_URL` from `services/api/.env`. If it
is omitted, SwingOps derives a sibling database by appending `_test` to the
development database name. Before every API test suite, the project:

1. Refuses any target whose database name does not end in `_test`.
2. Refuses a target that resolves to the development database.
3. Creates the test database when it does not exist.
4. Resets the test schema and applies all Prisma migrations.

Prepare it without running tests:

    pnpm test:db:prepare

The reset is intentionally limited to the guarded test database. Development
workflow, review, and model-call records are not touched.

## Typecheck commands

Run all typechecks:

    pnpm -r typecheck

Run individual workspace typechecks:

    pnpm --filter @swingops/web typecheck
    pnpm --filter @swingops/api typecheck

## Code quality commands

Run the same code, stylesheet, and formatting checks used in continuous
integration:

    pnpm lint

Run an individual check when narrowing down a failure:

    pnpm lint:code
    pnpm lint:styles
    pnpm format:check

Apply the configured formatter:

    pnpm format

## Test commands

Run all tests:

    pnpm -r test

## Workflow and retrieval evaluations

The API exposes deterministic evaluation runners in addition to unit,
integration, and browser tests. With the API running:

    GET  /workflow-evals/scenarios
    POST /workflow-evals/run
    POST /knowledge/evals/run

Workflow evaluation scenarios execute the real intake or guarded workflow path,
compare observed records and review routing with business-level expectations,
and clean up temporary scenario data. They currently protect complete-record
handling, safe abstention for unknown values, traceable parser evidence, and the
rule that prior-review suggestions are never applied automatically.

Knowledge evaluations run seeded queries and verify expected retrieval type,
ranking, evidence, and diagnostic behavior. Both runners are deterministic local
regression surfaces. They do not replace live-provider acceptance, evaluation on
representative production data, load testing, or operational monitoring.

## Golden-demonstration browser test

Install the Chromium runtime once:

    pnpm test:e2e:install

Start the local PostgreSQL service, then run the browser suite:

    pnpm db:up
    pnpm test:e2e

`pnpm test:e2e` prepares the guarded test database, starts isolated API and web
servers, and walks the golden demonstration from source staging through the
final run report. The test verifies the five expected records, deterministic
model-assistance outcomes, two supported review corrections, final readiness
counts, and the absence of browser errors or server responses at status 500 and
above.

The browser servers force `NODE_ENV=test` and disable real model calls. API
traffic uses the resolved `TEST_DATABASE_URL`; the runner refuses a database
whose name does not end in `_test` or matches the development target. It uses
ports 4010 and 4174 by default so it can run separately from the standard local
development servers.

Failure artifacts are written to:

    playwright-report
    test-results/e2e

This deterministic suite protects the product journey. It does not replace the
separate live-provider acceptance checks in `docs/guided-workflow.md`.

## Continuous integration

The GitHub Actions workflow in `.github/workflows/ci.yml` runs on pushes and
pull requests. It provisions PostgreSQL with pgvector, installs locked
dependencies, validates configuration, checks code and stylesheet quality,
verifies formatting, typechecks, runs workspace tests, builds every workspace,
installs Chromium, and executes the golden browser test. Browser traces,
screenshots, videos, and the HTML report are uploaded when available.

Run web tests:

    pnpm --filter @swingops/web test

Run API tests:

    pnpm --filter @swingops/api test

## Patch guard

Before committing, run:

    pnpm lint
    git diff --check

This validates source and stylesheet rules, repository formatting, and patch
whitespace.

## What the tests cover

### Web tests

The web tests cover focused UI utilities and final report behavior.

Important areas include:

    apps/web/src/utils/formatting.test.ts
    apps/web/src/components/guided-demo/steps/final-run-report/finalRunReportUtils.test.ts

These tests protect:

- Enum label formatting.
- Final report record merging.
- Final readiness status behavior.
- Review correction summary behavior.

### Browser tests

The end-to-end test is located at:

    tests/e2e/golden-demonstration.spec.ts

It protects the primary guided path across the web app, API, persistence layer,
deterministic model provider, review correction writes, and final report.

### API route tests

The API route tests cover route behavior, validation, serialization, and persistence expectations.

Important areas include:

    services/api/src/routes/workflow-runs.routes.test.ts
    services/api/src/routes/review-queue-items.routes.test.ts
    services/api/src/routes/ai-ready-intake-records.routes.test.ts
    services/api/src/routes/tools.routes.test.ts
    services/api/src/routes/knowledge.routes.test.ts
    services/api/src/routes/ai.routes.test.ts
    services/api/src/routes/health.routes.test.ts

These tests protect:

- Workflow route responses.
- Multi-source intake behavior.
- Guarded trade-in workflow behavior.
- AI-ready record filtering.
- Review queue filtering, resolving, dismissing, and correction persistence.
- Tool policy and MCP-compatible route behavior.
- Knowledge ingestion/search behavior.
- Model routing preview behavior.
- Health endpoint behavior.

### Workflow tests

Workflow tests cover parsing, normalization, model logging, and workflow quality behavior.

Important areas include:

    services/api/src/workflows/multi-source-intake-demo.test.ts
    services/api/src/workflows/trade-in-demo-parser.test.ts
    services/api/src/workflows/workflow-model-logging.test.ts

These tests protect:

- Source parsing.
- Normalized output shape.
- Review-needed behavior.
- Model log persistence.
- Workflow quality output.

### Workflow evaluation tests

Important areas include:

    services/api/src/workflow-evals/workflow-eval-runner.test.ts
    services/api/src/routes/workflow-evals.routes.test.ts

These tests protect:

- Scenario discovery.
- End-to-end scenario execution through workflow services.
- Business-level expectation reporting.
- Cleanup of temporary evaluation records.

### Knowledge tests

Important areas include:

    services/api/src/knowledge/knowledge-search.test.ts

These tests protect local retrieval behavior, scoring, metadata, pgvector degradation classification, query-safe warning events, deterministic fallback diagnostics, and propagation of unexpected database failures.

### Tool tests

Important areas include:

    services/api/src/mcp/server.test.ts
    services/api/src/tools/tool-registry.test.ts
    services/api/src/tools/tool-execution-policy.test.ts
    services/api/src/tools/read-only-tool-invocation.test.ts
    services/api/src/tools/tool-invocation-preview.test.ts
    services/api/src/tools/tool-invocation-preview-logging.test.ts

These tests protect:

- MCP SDK client negotiation through the real stdio server process.
- Process-boundary tool discovery, policy enforcement, and audit persistence.
- Tool registry filtering.
- Tool risk metadata.
- Execution policy decisions.
- Read-only invocation behavior.
- Blocked mutation behavior.
- Tool call logging.
- Preview behavior.

### Model routing tests

Important areas include:

    services/api/src/ai/model-router.test.ts
    services/api/src/ai/model-provider-registry.test.ts
    services/api/src/ai/model-provider-fallback-executor.test.ts
    services/api/src/ai/model-provider-adapters.test.ts

These tests protect:

- Provider registry behavior.
- Routing decisions.
- Fallback attempts.
- Adapter behavior.

### Internal system tests

Important areas include:

    services/api/src/internal-systems/inventory-service.test.ts
    services/api/src/internal-systems/trade-in-valuation-service.test.ts

These tests protect:

- Inventory matching behavior.
- Similar product lookup behavior.
- Valuation range behavior.
- Adjustment explanation behavior.

## Docs-only validation

For documentation-only changes, run:

    git diff --check
    pnpm --filter @swingops/web typecheck
    pnpm --filter @swingops/api typecheck

Tests are most useful when code behavior changes.
