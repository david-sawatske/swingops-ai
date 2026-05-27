import { z } from "zod";

import {
  clubConditionSchema,
  createGolfClubInputSchema,
  createIntakeBatchInputSchema,
  createIntakeItemInputSchema,
  dexteritySchema,
  evalCaseSchema,
  evalResultSchema,
  golfClubCategorySchema,
  golfClubSchema,
  intakeBatchSchema,
  intakeBatchStatusSchema,
  intakeItemSchema,
  intakeItemStatusSchema,
  intakeSourceTypeSchema,
  mcpToolDefinitionSchema,
  modelCallLogSchema,
  modelCallStatusSchema,
  modelProviderNameSchema,
  modelRoutingPolicySchema,
  reviewQueueItemSchema,
  reviewQueueStatusSchema,
  reviewReasonSchema,
  shaftFlexSchema,
  toolCallLogSchema,
  toolCallStatusSchema,
  workflowRunSchema,
  workflowRunStatusSchema,
  workflowStepSchema,
  workflowStepStatusSchema,
  workflowStepTypeSchema
} from "./schemas";

export type GolfClubCategory = z.infer<typeof golfClubCategorySchema>;
export type ShaftFlex = z.infer<typeof shaftFlexSchema>;
export type Dexterity = z.infer<typeof dexteritySchema>;
export type ClubCondition = z.infer<typeof clubConditionSchema>;

export type IntakeBatchStatus = z.infer<typeof intakeBatchStatusSchema>;
export type IntakeItemStatus = z.infer<typeof intakeItemStatusSchema>;
export type IntakeSourceType = z.infer<typeof intakeSourceTypeSchema>;

export type WorkflowRunStatus = z.infer<typeof workflowRunStatusSchema>;
export type WorkflowStepStatus = z.infer<typeof workflowStepStatusSchema>;
export type WorkflowStepType = z.infer<typeof workflowStepTypeSchema>;

export type ToolCallStatus = z.infer<typeof toolCallStatusSchema>;

export type ModelCallStatus = z.infer<typeof modelCallStatusSchema>;
export type ModelProviderName = z.infer<typeof modelProviderNameSchema>;

export type ReviewQueueStatus = z.infer<typeof reviewQueueStatusSchema>;
export type ReviewReason = z.infer<typeof reviewReasonSchema>;

export type GolfClub = z.infer<typeof golfClubSchema>;
export type CreateGolfClubInput = z.infer<typeof createGolfClubInputSchema>;

export type IntakeBatch = z.infer<typeof intakeBatchSchema>;
export type CreateIntakeBatchInput = z.infer<
  typeof createIntakeBatchInputSchema
>;

export type IntakeItem = z.infer<typeof intakeItemSchema>;
export type CreateIntakeItemInput = z.infer<typeof createIntakeItemInputSchema>;

export type WorkflowRun = z.infer<typeof workflowRunSchema>;
export type WorkflowStep = z.infer<typeof workflowStepSchema>;

export type ToolCallLog = z.infer<typeof toolCallLogSchema>;
export type ModelCallLog = z.infer<typeof modelCallLogSchema>;

export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;

export type EvalCase = z.infer<typeof evalCaseSchema>;
export type EvalResult = z.infer<typeof evalResultSchema>;
export type ModelRoutingPolicy = z.infer<typeof modelRoutingPolicySchema>;
export type McpToolDefinition = z.infer<typeof mcpToolDefinitionSchema>;
