# Data Models

The primary data models are defined in:

    services/api/prisma/schema.prisma

This document explains the main persisted records from the perspective of the Guided Workflow.

## IntakeBatch

Represents a group of intake items.

Used by:

- Multi-source intake.
- AI-ready record persistence.
- Workflow run grouping.

Important relationships:

- `items`
- `workflowRuns`
- `aiReadyIntakeRecords`

## IntakeItem

Represents one raw intake item.

Used by:

- Parsed source rows.
- Review queue items.
- Workflow runs.
- Reviewed trade-in records.
- Human review learning events.
- AI-ready intake records.

Important relationships:

- `intakeBatch`
- `workflowRuns`
- `reviewQueueItems`
- `reviewedTradeInRecords`
- `humanReviewLearningEvents`
- `aiReadyIntakeRecords`

## GolfClub

Represents a structured golf club record.

This model remains available for structured equipment persistence. The current Guided Workflow emphasizes AI-ready intake records and reviewed trade-in records as the main user-visible outputs.

## WorkflowRun

Represents one workflow execution.

A workflow run is the main audit container for the guarded workflow.

Important fields:

- `workflowName`
- `status`
- `startedAt`
- `completedAt`
- `errorMessage`

Important relationships:

- `steps`
- `toolCallLogs`
- `modelCallLogs`
- `reviewQueueItems`
- `aiReadyIntakeRecords`
- `reviewedTradeInRecords`
- `humanReviewLearningEvents`

## WorkflowStep

Represents an ordered step inside a workflow run.

Important fields:

- `stepName`
- `stepType`
- `status`
- `orderIndex`
- `inputJson`
- `outputJson`
- `retryCount`

The guided workflow uses step data as part of the execution audit trail.

## ModelCallLog

Represents a model-related call or model routing decision.

Important relationships:

- `workflowRun`
- `workflowStep`
- `attemptLogs`

Model logs help explain provider selection, fallback behavior, status, cost, latency, and quality metadata.

## ModelCallAttemptLog

Represents a provider/model attempt inside a model call.

Useful for showing:

- Attempt order.
- Provider.
- Model.
- Attempt status.
- Failure or fallback behavior.
- Latency and cost metadata.

## ToolCallLog

Represents a tool invocation attempt.

Used by:

- Read-only MCP-compatible tool execution.
- Preview logs.
- Blocked mutation evidence.
- Connector invocation history.
- Final audit trace.

Important fields:

- `toolName`
- `status`
- `inputJson`
- `outputJson`
- `workflowRunId`
- `workflowStepId`

## ReviewQueueItem

Represents work that needs human review.

A review queue item can be created when a record is incomplete, ambiguous, low confidence, or otherwise not safe to treat as final.

Important fields:

- `status`
- `reasonCodes`
- `originalText`
- `proposedGolfClubJson`
- `reviewerNotes`
- `resolvedAt`

Important relationships:

- `workflowRun`
- `intakeItem`
- `golfClub`
- `reviewedTradeInRecord`

## ReviewedTradeInRecord

Represents a corrected record submitted through the review flow.

Important fields:

- `correctedBrand`
- `correctedProductLine`
- `correctedCategory`
- `correctedShaftFlex`
- `correctedConditionGrade`
- `conditionEvidenceText`
- `demoValue`
- `demoValuationNote`
- `reviewerNotes`

This model records what the reviewer approved or corrected.

## HumanReviewLearningEvent

Represents an individual learning signal captured during review.

Important fields:

- `fieldName`
- `rawTextMatch`
- `proposedValue`
- `correctedValue`
- `evidenceText`
- `confidenceImpact`

The current app persists these events to make review feedback visible and inspectable. They are evidence that human review produced reusable structured signals.

## AiReadyIntakeRecord

Represents a normalized source-derived record ready for review, RAG, or downstream use depending on status.

Important fields:

- `sourceType`
- `sourceName`
- `rawText`
- `cleanedText`
- `normalizedJson`
- `inferredSchemaJson`
- `metadataJson`
- `qualitySignalsJson`
- `status`
- `reviewNeeded`
- `embeddingReady`
- `ragReady`

Important statuses:

- `READY_FOR_REVIEW`
- `READY_FOR_RAG`
- `NEEDS_REVIEW`

AI-ready records are central to the current Guided Workflow because they are the persisted bridge between messy source intake and later workflow execution.

## KnowledgeDocument

Represents a source document in the local knowledge base.

Important relationships:

- `chunks`
- `ingestionRun`

## KnowledgeChunk

Represents a searchable knowledge unit.

Important fields:

- `chunkText`
- `chunkType`
- `brand`
- `productLine`
- `category`
- `searchText`
- `embedding`
- `metadataJson`

Knowledge chunks support grounded retrieval and score explanations.

## KnowledgeIngestionRun

Represents an ingestion attempt for the demo knowledge base.

Useful for tracking:

- Ingestion status.
- Started/completed timestamps.
- Error messages.
- Ingested document/chunk counts.

## Relationship summary

A typical guided run creates a flow like this:

    IntakeBatch
      -> IntakeItem
        -> AiReadyIntakeRecord

    WorkflowRun
      -> WorkflowStep
      -> ModelCallLog
        -> ModelCallAttemptLog
      -> ToolCallLog
      -> ReviewQueueItem
        -> ReviewedTradeInRecord
      -> HumanReviewLearningEvent
      -> AiReadyIntakeRecord

The final report uses this connected data to explain what happened and what records are ready.
