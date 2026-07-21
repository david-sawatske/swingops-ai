ALTER TYPE "WorkflowStepType" ADD VALUE 'RETRIEVE_EVIDENCE';
ALTER TYPE "WorkflowStepType" ADD VALUE 'PERSIST_AI_READY_RECORDS';
ALTER TYPE "WorkflowStepType" ADD VALUE 'EXECUTE_TOOL_CALLS';
ALTER TYPE "WorkflowStepType" ADD VALUE 'FINALIZE_WORKFLOW';

CREATE UNIQUE INDEX "workflow_steps_workflow_run_id_order_index_key"
ON "workflow_steps"("workflow_run_id", "order_index");
