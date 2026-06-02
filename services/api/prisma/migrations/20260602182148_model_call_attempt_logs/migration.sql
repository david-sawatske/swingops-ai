-- CreateEnum
CREATE TYPE "ModelCallAttemptStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED', 'TIMEOUT', 'UNHEALTHY', 'DISABLED', 'RATE_LIMITED');

-- CreateTable
CREATE TABLE "model_call_attempt_logs" (
    "id" TEXT NOT NULL,
    "model_call_log_id" TEXT NOT NULL,
    "provider" "ModelProviderName" NOT NULL,
    "model" TEXT NOT NULL,
    "attempt_order" INTEGER NOT NULL,
    "status" "ModelCallAttemptStatus" NOT NULL,
    "reason" TEXT,
    "error_message" TEXT,
    "latency_ms" INTEGER,
    "estimated_cost_usd" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_call_attempt_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "model_call_attempt_logs_model_call_log_id_idx" ON "model_call_attempt_logs"("model_call_log_id");

-- CreateIndex
CREATE INDEX "model_call_attempt_logs_provider_idx" ON "model_call_attempt_logs"("provider");

-- CreateIndex
CREATE INDEX "model_call_attempt_logs_status_idx" ON "model_call_attempt_logs"("status");

-- CreateIndex
CREATE INDEX "model_call_attempt_logs_attempt_order_idx" ON "model_call_attempt_logs"("attempt_order");

-- AddForeignKey
ALTER TABLE "model_call_attempt_logs" ADD CONSTRAINT "model_call_attempt_logs_model_call_log_id_fkey" FOREIGN KEY ("model_call_log_id") REFERENCES "model_call_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
