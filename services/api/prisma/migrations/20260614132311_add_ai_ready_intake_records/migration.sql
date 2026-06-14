-- CreateEnum
CREATE TYPE "AiReadyIntakeRecordStatus" AS ENUM ('READY_FOR_REVIEW', 'READY_FOR_RAG', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "ai_ready_intake_records" (
    "id" TEXT NOT NULL,
    "intake_batch_id" TEXT,
    "intake_item_id" TEXT,
    "workflow_run_id" TEXT,
    "source_record_id" TEXT,
    "source_type" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "cleaned_text" TEXT NOT NULL,
    "normalized_json" JSONB NOT NULL,
    "inferred_schema_json" JSONB,
    "metadata_json" JSONB,
    "quality_signals_json" JSONB,
    "status" "AiReadyIntakeRecordStatus" NOT NULL DEFAULT 'READY_FOR_REVIEW',
    "review_needed" BOOLEAN NOT NULL DEFAULT false,
    "embedding_ready" BOOLEAN NOT NULL DEFAULT false,
    "rag_ready" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_ready_intake_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_ready_intake_records_intake_batch_id_idx" ON "ai_ready_intake_records"("intake_batch_id");

-- CreateIndex
CREATE INDEX "ai_ready_intake_records_intake_item_id_idx" ON "ai_ready_intake_records"("intake_item_id");

-- CreateIndex
CREATE INDEX "ai_ready_intake_records_workflow_run_id_idx" ON "ai_ready_intake_records"("workflow_run_id");

-- CreateIndex
CREATE INDEX "ai_ready_intake_records_source_type_idx" ON "ai_ready_intake_records"("source_type");

-- CreateIndex
CREATE INDEX "ai_ready_intake_records_status_idx" ON "ai_ready_intake_records"("status");

-- CreateIndex
CREATE INDEX "ai_ready_intake_records_review_needed_idx" ON "ai_ready_intake_records"("review_needed");

-- AddForeignKey
ALTER TABLE "ai_ready_intake_records" ADD CONSTRAINT "ai_ready_intake_records_intake_batch_id_fkey" FOREIGN KEY ("intake_batch_id") REFERENCES "intake_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_ready_intake_records" ADD CONSTRAINT "ai_ready_intake_records_intake_item_id_fkey" FOREIGN KEY ("intake_item_id") REFERENCES "intake_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_ready_intake_records" ADD CONSTRAINT "ai_ready_intake_records_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
