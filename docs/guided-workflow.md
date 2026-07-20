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

## Golden demonstration run

The golden demonstration is the canonical browser walkthrough for proving the complete SwingOps AI product story with one repeatable five-record run.

It is intended to demonstrate:

- Mixed-source intake preservation.
- Deterministic extraction and reference authority.
- A real OpenAI provider call.
- Useful but advisory model assistance.
- Safe abstention when evidence is insufficient.
- Reviewer-controlled corrections.
- Persisted learning evidence.
- An accurate final run report.

The expected counts below are acceptance expectations for the current canonical corpus. They are not implementation constants and should not be hardcoded into workflow logic.

### Canonical source set

Step 1 provides a **Load golden demonstration** action.

The action prepares or reuses one earlier reviewer-approved correction for the phrase `shaft firm` and stages four editable source types containing five records.

| Source | Record role | Expected intake behavior |
| --- | --- | --- |
| Free text | Cleveland RTX 6 ZipCore wedge | Complete deterministic control record |
| Free text | TaylorMade Stealth 2 driver | Preserve `shaft firm`; shaft flex remains unresolved |
| Poorly formed CSV | Odyssey White Hot OG putter | Preserve `cosmetics poor`; shaft flex is not applicable |
| Email | Titleist TSR fairway wood | Preserve Stiff and 8.0 Average while keeping TSR generation ambiguous |
| Log | Callaway mystery driver | Preserve unknown, unclear and pending values without inventing replacements |

The source-of-truth fixture is:

    apps/web/src/components/guided-demo/source-intake/goldenDemonstrationSources.ts

The preparation route is:

    POST /workflow-runs/golden-demonstration/prepare

The preparation operation is idempotent. The first call can report that historical evidence was prepared. Later calls report that the existing reviewer-approved correction was reused.

### Step 1: stage and normalize the sources

1. Start the Guided Workflow and continue to Messy Source Intake.
2. Select **Load golden demonstration**.
3. Confirm:
   - Four sources are staged.
   - Four source types are selected.
   - Four sources are ready.
   - Normalization has not run.
   - The button changes to **Golden demonstration loaded** and becomes unavailable.
4. Select **Normalize Sources**.

Loading the demonstration must not automatically normalize records or execute the model.

### Step 2: verify the AI-ready records

The normalized result should contain exactly five records.

Expected state:

| Record | Expected normalized result |
| --- | --- |
| Cleveland RTX 6 ZipCore | Wedge, Senior, 9.0 Above Average, $72, store 104, clear |
| TaylorMade Stealth 2 | Driver, 9.0 Above Average, $155, store 104, missing only shaft flex |
| Odyssey White Hot OG | Putter, $85, store 207, missing only condition grade |
| Titleist TSR | Fairway Wood, Stiff, 8.0 Average, $135, store 104, review required with no missing fields |
| Callaway mystery driver | Driver, store 207, unresolved shaft flex, condition and value |

Important acceptance rules:

- A putter must not require shaft flex.
- Product-generation uncertainty must not erase supported shaft or condition evidence.
- The Titleist record must remain `TSR`; the parser must not invent TSR2 or TSR3.
- The Callaway record must remain incomplete rather than receiving defaults.

### Step 3: run guarded agent execution

Run the guarded trade-in workflow once.

The expected record roles are:

- Cleveland remains outside field-repair assistance because deterministic evidence is complete.
- TaylorMade receives a reviewer-controlled Stiff suggestion based on `shaft firm` and approved historical evidence.
- Odyssey receives a reviewer-controlled 6.0 Poor suggestion based on `cosmetics poor`.
- Titleist receives a comparison between supplied authoritative TSR candidates without an automatic selection.
- Callaway receives no safe repair.

Provider acceptance requires browser-visible evidence that:

- OpenAI executed through the configured provider path.
- The configured model is displayed.
- Provider validation passed.
- Fallback was not used.
- Four records were assessed.
- Two repair suggestions were returned.
- One candidate comparison was returned.
- One no-safe-repair outcome was returned.
- Tool use remained read-only.
- At least one attempted mutation was blocked by policy.

Mocks and automated tests do not replace this provider acceptance evidence.

### Step 4: save only the supported corrections

The initial review checkpoint should contain four active review items and one auto-passed record.

Resolve only:

1. TaylorMade Stealth 2
   - Select **Review and save correction**.
   - Confirm Shaft flex changes from missing to Stiff.
   - Confirm the source phrase is `shaft firm`.
   - Select **Save correction and resolve**.

2. Odyssey White Hot OG
   - Select **Review and save correction**.
   - Confirm Condition grade changes from missing to 6.0 Poor.
   - Confirm the source phrase is `cosmetics poor`.
   - Confirm no shaft-flex correction is requested.
   - Select **Save correction and resolve**.

Do not resolve:

- Titleist TSR, because the available evidence does not distinguish TSR2 from TSR3.
- Callaway mystery driver, because authoritative shaft, condition and value evidence is absent.

After the two supported saves, the checkpoint should show:

- Two records still need attention.
- Two records were resolved by review.
- Four review items were created.
- One record passed review gates automatically.

Resolved records must retain model evidence for audit, but mutation-oriented suggestion actions must no longer be available.

### Step 5: verify the final run report

Continue to the Final Run Report without resolving Titleist or Callaway.

Expected run outcome:

| Metric | Expected value |
| --- | --- |
| Total records | 5 |
| Ready or finalized records | 3 |
| Unresolved records | 2 |
| Reviewer-updated records | 2 |
| Persisted corrections | 2 |
| Current-run learning events | 2 |

Expected record outcomes:

- Cleveland is finalized without review.
- TaylorMade is finalized after human review with Shaft flex set to Stiff.
- Odyssey is finalized after human review with Condition grade set to 6.0 Poor.
- Titleist remains unresolved with the TSR2 versus TSR3 ambiguity visible.
- Callaway remains unresolved with missing shaft flex, condition and value visible.

The final report should also preserve:

- Provider and model evidence.
- Repair, comparison and no-safe-repair outcomes.
- Read-only tool evidence.
- Blocked mutation evidence.
- Reviewer-approved corrections.
- Reusable learning evidence.
- The distinction between model advice and human-authoritative changes.

### Repeatability acceptance

Use **Start over** and run the same procedure again.

The repeated run should demonstrate that:

- Loading the demonstration reuses the stable historical correction instead of creating duplicates.
- The same five source-derived records are produced.
- The same deterministic and safe-abstention boundaries remain intact.
- Previously saved reviewer corrections can surface as prior-review evidence.
- Prior-review evidence remains advisory and still requires reviewer action.
- The final report remains internally consistent after another complete run.

For a clean first run, the seeded historical evidence guarantees the `shaft firm` to Stiff match. After Odyssey has been reviewed once, later runs may also surface `cosmetics poor` to 6.0 Poor as reusable prior-review evidence.

### Browser acceptance checklist

- [ ] Golden loader stages four editable source types without running normalization.
- [ ] Step 2 creates exactly five records with preserved source evidence.
- [ ] Putter shaft flex is treated as not applicable.
- [ ] Titleist identity remains ambiguous without losing supported fields.
- [ ] Real OpenAI provider evidence is visible and fallback is not used.
- [ ] TaylorMade and Odyssey receive useful reviewer-controlled repairs.
- [ ] Titleist receives candidate comparison only.
- [ ] Callaway receives no safe repair.
- [ ] Only TaylorMade and Odyssey are resolved.
- [ ] Resolved cards retain audit evidence without stale mutation controls.
- [ ] Final report shows three ready records and two unresolved records.
- [ ] Two corrections and two learning events are visible.
- [ ] A repeated run reuses historical evidence without duplicating it.
