-- DropIndex
DROP INDEX "knowledge_chunks_embedding_model_idx";

-- DropIndex
DROP INDEX "knowledge_chunks_embedding_provider_idx";

-- CreateTable
CREATE TABLE "reviewed_trade_in_records" (
    "id" TEXT NOT NULL,
    "review_queue_item_id" TEXT NOT NULL,
    "workflow_run_id" TEXT,
    "intake_item_id" TEXT,
    "original_text" TEXT,
    "corrected_brand" TEXT,
    "corrected_product_line" TEXT,
    "corrected_category" TEXT,
    "corrected_shaft_flex" TEXT,
    "corrected_condition_grade" TEXT,
    "condition_evidence_text" TEXT,
    "corrected_demo_value" INTEGER,
    "demo_valuation_note" TEXT,
    "reviewer_notes" TEXT,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviewed_trade_in_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "human_review_learning_events" (
    "id" TEXT NOT NULL,
    "reviewed_trade_in_record_id" TEXT NOT NULL,
    "review_queue_item_id" TEXT NOT NULL,
    "workflow_run_id" TEXT,
    "intake_item_id" TEXT,
    "field_name" TEXT NOT NULL,
    "raw_text_match" TEXT,
    "proposed_value" TEXT,
    "corrected_value" TEXT,
    "evidence_text" TEXT,
    "confidence_impact" TEXT,
    "reviewer_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_review_learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviewed_trade_in_records_review_queue_item_id_key" ON "reviewed_trade_in_records"("review_queue_item_id");

-- CreateIndex
CREATE INDEX "reviewed_trade_in_records_workflow_run_id_idx" ON "reviewed_trade_in_records"("workflow_run_id");

-- CreateIndex
CREATE INDEX "reviewed_trade_in_records_intake_item_id_idx" ON "reviewed_trade_in_records"("intake_item_id");

-- CreateIndex
CREATE INDEX "reviewed_trade_in_records_corrected_brand_idx" ON "reviewed_trade_in_records"("corrected_brand");

-- CreateIndex
CREATE INDEX "reviewed_trade_in_records_corrected_category_idx" ON "reviewed_trade_in_records"("corrected_category");

-- CreateIndex
CREATE INDEX "reviewed_trade_in_records_corrected_condition_grade_idx" ON "reviewed_trade_in_records"("corrected_condition_grade");

-- CreateIndex
CREATE INDEX "human_review_learning_events_reviewed_trade_in_record_id_idx" ON "human_review_learning_events"("reviewed_trade_in_record_id");

-- CreateIndex
CREATE INDEX "human_review_learning_events_review_queue_item_id_idx" ON "human_review_learning_events"("review_queue_item_id");

-- CreateIndex
CREATE INDEX "human_review_learning_events_workflow_run_id_idx" ON "human_review_learning_events"("workflow_run_id");

-- CreateIndex
CREATE INDEX "human_review_learning_events_intake_item_id_idx" ON "human_review_learning_events"("intake_item_id");

-- CreateIndex
CREATE INDEX "human_review_learning_events_field_name_idx" ON "human_review_learning_events"("field_name");

-- CreateIndex
CREATE INDEX "human_review_learning_events_raw_text_match_idx" ON "human_review_learning_events"("raw_text_match");

-- AddForeignKey
ALTER TABLE "reviewed_trade_in_records" ADD CONSTRAINT "reviewed_trade_in_records_review_queue_item_id_fkey" FOREIGN KEY ("review_queue_item_id") REFERENCES "review_queue_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewed_trade_in_records" ADD CONSTRAINT "reviewed_trade_in_records_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewed_trade_in_records" ADD CONSTRAINT "reviewed_trade_in_records_intake_item_id_fkey" FOREIGN KEY ("intake_item_id") REFERENCES "intake_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_review_learning_events" ADD CONSTRAINT "human_review_learning_events_reviewed_trade_in_record_id_fkey" FOREIGN KEY ("reviewed_trade_in_record_id") REFERENCES "reviewed_trade_in_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_review_learning_events" ADD CONSTRAINT "human_review_learning_events_review_queue_item_id_fkey" FOREIGN KEY ("review_queue_item_id") REFERENCES "review_queue_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_review_learning_events" ADD CONSTRAINT "human_review_learning_events_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_review_learning_events" ADD CONSTRAINT "human_review_learning_events_intake_item_id_fkey" FOREIGN KEY ("intake_item_id") REFERENCES "intake_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
