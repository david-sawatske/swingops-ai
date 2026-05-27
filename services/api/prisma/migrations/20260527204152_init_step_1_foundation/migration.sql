-- CreateEnum
CREATE TYPE "GolfClubCategory" AS ENUM ('DRIVER', 'FAIRWAY_WOOD', 'HYBRID', 'IRON_SET', 'WEDGE', 'PUTTER');

-- CreateEnum
CREATE TYPE "ShaftFlex" AS ENUM ('LADIES', 'SENIOR', 'REGULAR', 'STIFF', 'X_STIFF');

-- CreateEnum
CREATE TYPE "Dexterity" AS ENUM ('RIGHT', 'LEFT');

-- CreateEnum
CREATE TYPE "ClubCondition" AS ENUM ('NEW', 'EXCELLENT', 'VERY_GOOD', 'GOOD', 'FAIR');

-- CreateEnum
CREATE TYPE "IntakeBatchStatus" AS ENUM ('DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "IntakeItemStatus" AS ENUM ('PENDING', 'PROCESSING', 'STRUCTURED', 'NEEDS_REVIEW', 'FAILED');

-- CreateEnum
CREATE TYPE "IntakeSourceType" AS ENUM ('FREEFORM_NOTES', 'BAD_CSV', 'EMAIL', 'PDF_TEXT', 'MANUAL_ENTRY');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkflowStepStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'RETRYING');

-- CreateEnum
CREATE TYPE "WorkflowStepType" AS ENUM ('PARSE_INPUT', 'NORMALIZE_DATA', 'EXTRACT_GOLF_CLUB_FIELDS', 'VALIDATE_STRUCTURED_OUTPUT', 'CREATE_REVIEW_ITEM', 'PERSIST_GOLF_CLUB');

-- CreateEnum
CREATE TYPE "ToolCallStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'RETRIED');

-- CreateEnum
CREATE TYPE "ModelCallStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'RETRIED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ModelProviderName" AS ENUM ('MOCK', 'OPENAI', 'ANTHROPIC', 'AZURE_OPENAI', 'OLLAMA');

-- CreateEnum
CREATE TYPE "ReviewQueueStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReviewReason" AS ENUM ('MISSING_REQUIRED_FIELDS', 'LOW_CONFIDENCE', 'VALIDATION_FAILED', 'AMBIGUOUS_INPUT', 'POSSIBLE_DUPLICATE', 'MANUAL_REVIEW_REQUESTED');

-- CreateTable
CREATE TABLE "intake_batches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source_type" "IntakeSourceType" NOT NULL,
    "status" "IntakeBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "item_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_items" (
    "id" TEXT NOT NULL,
    "intake_batch_id" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "source_row_number" INTEGER,
    "status" "IntakeItemStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "golf_clubs" (
    "id" TEXT NOT NULL,
    "intake_item_id" TEXT,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "category" "GolfClubCategory" NOT NULL,
    "loft" TEXT,
    "shaft_brand" TEXT,
    "shaft_flex" "ShaftFlex",
    "dexterity" "Dexterity",
    "condition" "ClubCondition" NOT NULL,
    "grip_condition" TEXT,
    "length" TEXT,
    "notes" TEXT,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "missing_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "golf_clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "intake_batch_id" TEXT,
    "intake_item_id" TEXT,
    "workflow_name" TEXT NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'QUEUED',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" TEXT NOT NULL,
    "workflow_run_id" TEXT NOT NULL,
    "step_name" TEXT NOT NULL,
    "step_type" "WorkflowStepType" NOT NULL,
    "status" "WorkflowStepStatus" NOT NULL DEFAULT 'PENDING',
    "order_index" INTEGER NOT NULL,
    "input_json" JSONB,
    "output_json" JSONB,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_call_logs" (
    "id" TEXT NOT NULL,
    "workflow_run_id" TEXT,
    "workflow_step_id" TEXT,
    "tool_name" TEXT NOT NULL,
    "status" "ToolCallStatus" NOT NULL DEFAULT 'STARTED',
    "input_json" JSONB,
    "output_json" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_call_logs" (
    "id" TEXT NOT NULL,
    "workflow_run_id" TEXT,
    "workflow_step_id" TEXT,
    "provider" "ModelProviderName" NOT NULL,
    "model" TEXT NOT NULL,
    "status" "ModelCallStatus" NOT NULL DEFAULT 'STARTED',
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "latency_ms" INTEGER,
    "estimated_cost_usd" DOUBLE PRECISION,
    "request_json" JSONB,
    "response_json" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_queue_items" (
    "id" TEXT NOT NULL,
    "intake_item_id" TEXT,
    "golf_club_id" TEXT,
    "workflow_run_id" TEXT,
    "reason" "ReviewReason" NOT NULL,
    "status" "ReviewQueueStatus" NOT NULL DEFAULT 'OPEN',
    "original_text" TEXT,
    "proposed_golf_club_json" JSONB,
    "reviewer_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_queue_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intake_batches_status_idx" ON "intake_batches"("status");

-- CreateIndex
CREATE INDEX "intake_batches_source_type_idx" ON "intake_batches"("source_type");

-- CreateIndex
CREATE INDEX "intake_items_intake_batch_id_idx" ON "intake_items"("intake_batch_id");

-- CreateIndex
CREATE INDEX "intake_items_status_idx" ON "intake_items"("status");

-- CreateIndex
CREATE INDEX "golf_clubs_intake_item_id_idx" ON "golf_clubs"("intake_item_id");

-- CreateIndex
CREATE INDEX "golf_clubs_brand_idx" ON "golf_clubs"("brand");

-- CreateIndex
CREATE INDEX "golf_clubs_category_idx" ON "golf_clubs"("category");

-- CreateIndex
CREATE INDEX "golf_clubs_condition_idx" ON "golf_clubs"("condition");

-- CreateIndex
CREATE INDEX "workflow_runs_intake_batch_id_idx" ON "workflow_runs"("intake_batch_id");

-- CreateIndex
CREATE INDEX "workflow_runs_intake_item_id_idx" ON "workflow_runs"("intake_item_id");

-- CreateIndex
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");

-- CreateIndex
CREATE INDEX "workflow_runs_workflow_name_idx" ON "workflow_runs"("workflow_name");

-- CreateIndex
CREATE INDEX "workflow_steps_workflow_run_id_idx" ON "workflow_steps"("workflow_run_id");

-- CreateIndex
CREATE INDEX "workflow_steps_status_idx" ON "workflow_steps"("status");

-- CreateIndex
CREATE INDEX "workflow_steps_step_type_idx" ON "workflow_steps"("step_type");

-- CreateIndex
CREATE INDEX "tool_call_logs_workflow_run_id_idx" ON "tool_call_logs"("workflow_run_id");

-- CreateIndex
CREATE INDEX "tool_call_logs_workflow_step_id_idx" ON "tool_call_logs"("workflow_step_id");

-- CreateIndex
CREATE INDEX "tool_call_logs_tool_name_idx" ON "tool_call_logs"("tool_name");

-- CreateIndex
CREATE INDEX "tool_call_logs_status_idx" ON "tool_call_logs"("status");

-- CreateIndex
CREATE INDEX "model_call_logs_workflow_run_id_idx" ON "model_call_logs"("workflow_run_id");

-- CreateIndex
CREATE INDEX "model_call_logs_workflow_step_id_idx" ON "model_call_logs"("workflow_step_id");

-- CreateIndex
CREATE INDEX "model_call_logs_provider_idx" ON "model_call_logs"("provider");

-- CreateIndex
CREATE INDEX "model_call_logs_model_idx" ON "model_call_logs"("model");

-- CreateIndex
CREATE INDEX "model_call_logs_status_idx" ON "model_call_logs"("status");

-- CreateIndex
CREATE INDEX "review_queue_items_intake_item_id_idx" ON "review_queue_items"("intake_item_id");

-- CreateIndex
CREATE INDEX "review_queue_items_golf_club_id_idx" ON "review_queue_items"("golf_club_id");

-- CreateIndex
CREATE INDEX "review_queue_items_workflow_run_id_idx" ON "review_queue_items"("workflow_run_id");

-- CreateIndex
CREATE INDEX "review_queue_items_reason_idx" ON "review_queue_items"("reason");

-- CreateIndex
CREATE INDEX "review_queue_items_status_idx" ON "review_queue_items"("status");

-- AddForeignKey
ALTER TABLE "intake_items" ADD CONSTRAINT "intake_items_intake_batch_id_fkey" FOREIGN KEY ("intake_batch_id") REFERENCES "intake_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "golf_clubs" ADD CONSTRAINT "golf_clubs_intake_item_id_fkey" FOREIGN KEY ("intake_item_id") REFERENCES "intake_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_intake_batch_id_fkey" FOREIGN KEY ("intake_batch_id") REFERENCES "intake_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_intake_item_id_fkey" FOREIGN KEY ("intake_item_id") REFERENCES "intake_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_call_logs" ADD CONSTRAINT "tool_call_logs_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_call_logs" ADD CONSTRAINT "tool_call_logs_workflow_step_id_fkey" FOREIGN KEY ("workflow_step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_call_logs" ADD CONSTRAINT "model_call_logs_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_call_logs" ADD CONSTRAINT "model_call_logs_workflow_step_id_fkey" FOREIGN KEY ("workflow_step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_queue_items" ADD CONSTRAINT "review_queue_items_intake_item_id_fkey" FOREIGN KEY ("intake_item_id") REFERENCES "intake_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_queue_items" ADD CONSTRAINT "review_queue_items_golf_club_id_fkey" FOREIGN KEY ("golf_club_id") REFERENCES "golf_clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_queue_items" ADD CONSTRAINT "review_queue_items_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
