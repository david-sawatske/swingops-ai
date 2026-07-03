# Testing

SwingOps AI uses TypeScript typechecking and Vitest tests across the workspace.

## Typecheck commands

Run all typechecks:

    pnpm -r typecheck

Run individual workspace typechecks:

    pnpm --filter @swingops/web typecheck
    pnpm --filter @swingops/api typecheck
    pnpm --filter @swingops/shared typecheck

## Test commands

Run all tests:

    pnpm -r test

Run web tests:

    pnpm --filter @swingops/web test

Run API tests:

    pnpm --filter @swingops/api test

Run shared package tests:

    pnpm --filter @swingops/shared test

## Formatting guard

Before committing, run:

    git diff --check

This catches whitespace errors and patch formatting issues.

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

### Knowledge tests

Important areas include:

    services/api/src/knowledge/knowledge-search.test.ts

These tests protect local retrieval behavior, scoring, and metadata.

### Tool tests

Important areas include:

    services/api/src/tools/tool-registry.test.ts
    services/api/src/tools/tool-execution-policy.test.ts
    services/api/src/tools/read-only-tool-invocation.test.ts
    services/api/src/tools/tool-invocation-preview.test.ts
    services/api/src/tools/tool-invocation-preview-logging.test.ts

These tests protect:

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
