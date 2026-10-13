-- Policy-blocked tool calls were stored as FAILED because the enum had no
-- BLOCKED value. A new enum value cannot be used in the transaction that adds
-- it, so the backfill runs in the following migration.
ALTER TYPE "ToolCallStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';
