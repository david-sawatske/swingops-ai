-- AlterEnum
ALTER TYPE "AiReadyIntakeRecordStatus" ADD VALUE 'SUPERSEDED';

-- AlterEnum
ALTER TYPE "ReviewQueueStatus" ADD VALUE 'SUPERSEDED';

-- AlterTable
ALTER TABLE "ai_ready_intake_records" ADD COLUMN     "superseded_at" TIMESTAMP(3),
ADD COLUMN     "superseded_by_ai_ready_intake_record_id" TEXT,
ADD COLUMN     "superseded_reason" TEXT;

-- AlterTable
ALTER TABLE "review_queue_items" ADD COLUMN     "superseded_at" TIMESTAMP(3),
ADD COLUMN     "superseded_by_review_queue_item_id" TEXT,
ADD COLUMN     "superseded_reason" TEXT;

-- CreateIndex
CREATE INDEX "ai_ready_intake_records_superseded_by_ai_ready_intake_recor_idx" ON "ai_ready_intake_records"("superseded_by_ai_ready_intake_record_id");

-- CreateIndex
CREATE INDEX "review_queue_items_superseded_by_review_queue_item_id_idx" ON "review_queue_items"("superseded_by_review_queue_item_id");

-- AddForeignKey
ALTER TABLE "review_queue_items" ADD CONSTRAINT "review_queue_items_superseded_by_review_queue_item_id_fkey" FOREIGN KEY ("superseded_by_review_queue_item_id") REFERENCES "review_queue_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_ready_intake_records" ADD CONSTRAINT "ai_ready_intake_records_superseded_by_ai_ready_intake_reco_fkey" FOREIGN KEY ("superseded_by_ai_ready_intake_record_id") REFERENCES "ai_ready_intake_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
