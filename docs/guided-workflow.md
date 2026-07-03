# Guided Workflow

The Guided Workflow is the primary product experience in SwingOps AI.

It is designed to make an AI-assisted operational workflow understandable from start to finish. The user sees what they provide, what the system extracts, what evidence is gathered, what is blocked, what needs review, and what final records are produced.

## Overview/setup page

### What the user does

The user starts from a guided overview page that explains the operational run before any actionable workflow step begins.

### What the app does

The app frames the workflow as a sequence of controlled steps rather than a single model prompt. It explains the source intake, normalization, agent execution, validation, review, and final report stages.

### Technical notes

The overview is rendered by:

    apps/web/src/components/guided-demo/steps/GuidedRunSetupStep.tsx

The current guided step state is managed by `App.tsx` and passed into:

    apps/web/src/components/guided-demo/GuidedDemoPathPage.tsx

No workflow records are created by the overview page itself.

## Step 1: Messy Source Intake

### What the user does

The user creates one or more source cards.

For each source, the user can:

- Name the source.
- Choose whether to paste text or upload a text file.
- Select a source type.
- Add messy source content.
- Use a sample for the selected source type.
- Add additional sources.
- Run normalization.

Supported guided source types are:

- `FREE_TEXT`
- `POORLY_FORMED_CSV`
- `EMAIL`
- `LOG`

### What the app does

The web app sends the runnable sources to the backend multi-source intake workflow.

The workflow parses messy source content into normalized preview records. It also creates persisted AI-ready intake records that preserve source context, normalized JSON, metadata, quality signals, review-needed status, embedding readiness, and RAG readiness.

### Backend route

    POST /workflow-runs/multi-source-intake-demo

Route file:

    services/api/src/routes/workflow-runs.routes.ts

Workflow file:

    services/api/src/workflows/multi-source-intake-demo.ts

Parser files:

    services/api/src/workflows/multi-source-intake-parser.ts
    services/api/src/workflows/multi-source-intake-types.ts

### Records created or updated

This step can create:

- `IntakeBatch`
- `IntakeItem`
- `AiReadyIntakeRecord`

### Evidence and audit output

The response includes:

- Source-level summaries.
- Cleaned dataset preview.
- Inferred schema fields.
- Metadata.
- Review signals.
- RAG-ready asset summaries.
- Persisted AI-ready record identifiers.

## Step 2: AI-Ready Records

### What the user does

The user inspects the normalized records created from source intake.

The UI shows:

- Extracted record count.
- Ready record count.
- Review-needed record count.
- Persisted record count.
- Compact preview table.
- Full expanded record table.

### What the app does

The app presents the normalized source output as a handoff point between intake and guarded execution.

Records are not treated as approved just because they are structured. The UI keeps missing fields and review-needed status visible.

### Backend routes

The records are created by the Step 1 workflow. The app can also read persisted records through:

    GET /ai-ready-intake-records
    GET /ai-ready-intake-records/:id

Route file:

    services/api/src/routes/ai-ready-intake-records.routes.ts

### Records created or updated

This step primarily displays existing `AiReadyIntakeRecord` data created during Step 1.

### Evidence and audit output

The displayed evidence includes:

- Normalized fields.
- Source type.
- Source name.
- Missing-field signals.
- Review-needed status.
- Persisted count.
- RAG readiness and embedding readiness metadata where available.

## Step 3: Guarded Agent Execution

### What the user does

The user runs the guarded trade-in workflow using the normalized input from source intake.

The workflow input can be generated from the source intake result and then submitted to the backend workflow.

### What the app does

The backend executes a full guarded trade-in workflow. It parses the generated input, retrieves knowledge evidence, matches inventory products, estimates trade-in valuation ranges, routes model work, executes safe read-only tools, blocks mutation behavior, validates quality, and creates review queue items for records needing human attention.

### Backend route

    POST /workflow-runs/agentic-trade-in-demo

Route file:

    services/api/src/routes/workflow-runs.routes.ts

Workflow file:

    services/api/src/workflows/end-to-end-agentic-trade-in-demo.ts

Related workflow quality files:

    services/api/src/workflows/workflow-quality.ts
    services/api/src/workflows/workflow-quality-builders.ts
    services/api/src/workflows/workflow-quality-types.ts

### Records created or updated

This step can create or update:

- `WorkflowRun`
- `WorkflowStep`
- `ModelCallLog`
- `ModelCallAttemptLog`
- `ToolCallLog`
- `ReviewQueueItem`

### Evidence and audit output

The response can include:

- Agent plan.
- Validation checks.
- Retry events.
- Provider fallback trace.
- Knowledge/RAG matches.
- Inventory matches.
- Valuation ranges.
- Read-only tool call results.
- Blocked mutation policy evidence.
- Review queue item identifiers.
- Persisted workflow run identifiers.
- Final summary metrics.

### Related systems

Knowledge search:

    services/api/src/knowledge/knowledge-search.ts

Model routing:

    services/api/src/ai/model-router.ts
    services/api/src/ai/model-provider-fallback-executor.ts

Tool policy and execution:

    services/api/src/tools/tool-execution-policy.ts
    services/api/src/tools/read-only-tool-invocation.ts
    services/api/src/tools/mcp-compatible-tool-surface.ts

Internal inventory and valuation:

    services/api/src/internal-systems/inventory-service.ts
    services/api/src/internal-systems/trade-in-valuation-service.ts

## Step 4: Validation Review

### What the user does

The user reviews run-scoped validation and review items.

The UI separates:

- Summary cards.
- Passed gates.
- Run-level audit.
- Record-level review cards.
- Controlled correction fields.
- Review notes.
- Correction submission actions.

When a record needs human judgment, the user can resolve it with structured corrections.

### What the app does

The app filters review queue items to the current workflow run. It lets the reviewer resolve records with controlled correction values and learning event metadata.

Structured corrections are persisted and can update AI-ready record readiness when the corrected record has enough information for downstream use.

### Backend routes

    GET /review-queue-items
    POST /review-queue-items/:id/resolve
    POST /review-queue-items/:id/dismiss
    POST /review-queue-items/:id/resolve-with-corrections

Route file:

    services/api/src/routes/review-queue-items.routes.ts

Serializer file:

    services/api/src/routes/review-queue-items.serializers.ts

### Records created or updated

This step can update or create:

- `ReviewQueueItem`
- `ReviewedTradeInRecord`
- `HumanReviewLearningEvent`
- `AiReadyIntakeRecord`
- `WorkflowRun`

When all open review queue items for a run are resolved or dismissed, the workflow run can be completed.

### Evidence and audit output

The review flow can persist:

- Reviewer notes.
- Corrected brand.
- Corrected product line.
- Corrected category.
- Corrected shaft flex.
- Corrected condition grade.
- Demo value.
- Demo valuation note.
- Evidence text.
- Learning events.
- Updated AI-ready status.

## Step 5: Final Run Report

### What the user does

The user reviews the final state of the run.

The final report shows:

- Final readiness summary.
- Workflow recap.
- Finalized records table.
- Review changes summary.
- Audit trace.
- Knowledge/RAG, inventory, valuation, tool, model, and review evidence.

### What the app does

The app merges the source intake result, guarded workflow result, current run AI-ready records, review queue items, reviewed trade-in records, and learning events into a final report.

The goal is to show what is ready, what changed during review, and what evidence supports the final state.

### Frontend files

    apps/web/src/components/guided-demo/steps/final-run-report/GuidedFinalRunReportStep.tsx
    apps/web/src/components/guided-demo/steps/final-run-report/FinalReadinessSummary.tsx
    apps/web/src/components/guided-demo/steps/final-run-report/FinalWorkflowRecap.tsx
    apps/web/src/components/guided-demo/steps/final-run-report/FinalizedRecordsTable.tsx
    apps/web/src/components/guided-demo/steps/final-run-report/ReviewChangesSummary.tsx
    apps/web/src/components/guided-demo/steps/final-run-report/FinalAuditTrace.tsx
    apps/web/src/components/guided-demo/steps/final-run-report/finalRunReportUtils.ts

### Records created or updated

The final report itself is a UI synthesis. It does not need to create a new database record to display the final state.

It reads from records created or updated by earlier steps:

- `AiReadyIntakeRecord`
- `WorkflowRun`
- `ReviewQueueItem`
- `ReviewedTradeInRecord`
- `HumanReviewLearningEvent`
- `ModelCallLog`
- `ToolCallLog`

### Evidence and audit output

The report shows:

- Final merged record status.
- RAG-ready count.
- Review-needed count.
- Learning event count.
- Review correction summary.
- Knowledge match count.
- Inventory match count.
- Valuation range count.
- Blocked action count.
- Model/tool audit trace.
- Human review audit trace.
