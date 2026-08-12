CREATE TYPE "OperationalDataOrigin" AS ENUM (
  'LIVE_DEMO',
  'GOLDEN_DEMONSTRATION',
  'SEEDED_BASELINE'
);

ALTER TABLE "intake_batches"
ADD COLUMN "data_origin" "OperationalDataOrigin" NOT NULL DEFAULT 'LIVE_DEMO';

ALTER TABLE "workflow_runs"
ADD COLUMN "data_origin" "OperationalDataOrigin" NOT NULL DEFAULT 'LIVE_DEMO';

ALTER TABLE "tool_call_logs"
ADD COLUMN "data_origin" "OperationalDataOrigin" NOT NULL DEFAULT 'LIVE_DEMO';

ALTER TABLE "model_call_logs"
ADD COLUMN "data_origin" "OperationalDataOrigin" NOT NULL DEFAULT 'LIVE_DEMO';

ALTER TABLE "review_queue_items"
ADD COLUMN "data_origin" "OperationalDataOrigin" NOT NULL DEFAULT 'LIVE_DEMO';

ALTER TABLE "ai_ready_intake_records"
ADD COLUMN "data_origin" "OperationalDataOrigin" NOT NULL DEFAULT 'LIVE_DEMO';

ALTER TABLE "reviewed_trade_in_records"
ADD COLUMN "data_origin" "OperationalDataOrigin" NOT NULL DEFAULT 'LIVE_DEMO';

ALTER TABLE "human_review_learning_events"
ADD COLUMN "data_origin" "OperationalDataOrigin" NOT NULL DEFAULT 'LIVE_DEMO';

UPDATE "workflow_runs"
SET "data_origin" = 'GOLDEN_DEMONSTRATION'
WHERE "id" = 'golden_demo_history_workflow';

UPDATE "review_queue_items"
SET "data_origin" = 'GOLDEN_DEMONSTRATION'
WHERE "id" = 'golden_demo_history_review';

UPDATE "ai_ready_intake_records"
SET "data_origin" = 'GOLDEN_DEMONSTRATION'
WHERE "id" IN (
  'golden_demo_history_ai_ready_previous',
  'golden_demo_history_ai_ready_replacement'
);

UPDATE "reviewed_trade_in_records"
SET "data_origin" = 'GOLDEN_DEMONSTRATION'
WHERE "id" = 'golden_demo_history_record';

UPDATE "human_review_learning_events"
SET "data_origin" = 'GOLDEN_DEMONSTRATION'
WHERE "id" = 'golden_demo_history_learning_shaft_firm';

CREATE INDEX "intake_batches_data_origin_idx"
ON "intake_batches"("data_origin");

CREATE INDEX "workflow_runs_data_origin_idx"
ON "workflow_runs"("data_origin");

CREATE INDEX "tool_call_logs_data_origin_idx"
ON "tool_call_logs"("data_origin");

CREATE INDEX "model_call_logs_data_origin_idx"
ON "model_call_logs"("data_origin");

CREATE INDEX "review_queue_items_data_origin_idx"
ON "review_queue_items"("data_origin");

CREATE INDEX "ai_ready_intake_records_data_origin_idx"
ON "ai_ready_intake_records"("data_origin");

CREATE INDEX "reviewed_trade_in_records_data_origin_idx"
ON "reviewed_trade_in_records"("data_origin");

CREATE INDEX "human_review_learning_events_data_origin_idx"
ON "human_review_learning_events"("data_origin");
