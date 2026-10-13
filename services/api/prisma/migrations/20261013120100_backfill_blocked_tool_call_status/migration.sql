-- Reclassify tool calls that were blocked before execution. Blocked invocations
-- record executionAttempted = false; seeded baseline rows record the policy
-- decision BLOCKED. Connector errors record executionAttempted = true and stay FAILED.
UPDATE "tool_call_logs"
SET "status" = 'BLOCKED'
WHERE "status" = 'FAILED'
  AND (
    "output_json" ->> 'executionAttempted' = 'false'
    OR "output_json" ->> 'policyDecision' = 'BLOCKED'
  );
