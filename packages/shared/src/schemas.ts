import { z } from "zod";

import {
  clubConditions,
  dexterities,
  golfClubCategories,
  intakeBatchStatuses,
  intakeItemStatuses,
  intakeSourceTypes,
  modelCallStatuses,
  modelProviderNames,
  reviewQueueStatuses,
  reviewReasons,
  shaftFlexes,
  toolCallStatuses,
  workflowRunStatuses,
  workflowStepStatuses,
  workflowStepTypes
} from "./enums";

import {
  CONFIDENCE_SCORE_MAX,
  CONFIDENCE_SCORE_MIN
} from "./constants";

export const isoDateTimeStringSchema = z
  .string()
  .datetime()
  .describe("ISO 8601 timestamp string.");

export const idSchema = z.string().min(1);

export const golfClubCategorySchema = z.enum(golfClubCategories);
export const shaftFlexSchema = z.enum(shaftFlexes);
export const dexteritySchema = z.enum(dexterities);
export const clubConditionSchema = z.enum(clubConditions);

export const intakeBatchStatusSchema = z.enum(intakeBatchStatuses);
export const intakeItemStatusSchema = z.enum(intakeItemStatuses);
export const intakeSourceTypeSchema = z.enum(intakeSourceTypes);

export const workflowRunStatusSchema = z.enum(workflowRunStatuses);
export const workflowStepStatusSchema = z.enum(workflowStepStatuses);
export const workflowStepTypeSchema = z.enum(workflowStepTypes);

export const toolCallStatusSchema = z.enum(toolCallStatuses);
export const modelCallStatusSchema = z.enum(modelCallStatuses);
export const modelProviderNameSchema = z.enum(modelProviderNames);

export const reviewQueueStatusSchema = z.enum(reviewQueueStatuses);
export const reviewReasonSchema = z.enum(reviewReasons);

export const golfClubSchema = z.object({
  id: idSchema.optional(),
  intakeItemId: idSchema.optional(),

  brand: z.string().min(1),
  model: z.string().min(1),
  category: golfClubCategorySchema,

  loft: z.string().optional(),
  shaftBrand: z.string().optional(),
  shaftFlex: shaftFlexSchema.optional(),
  dexterity: dexteritySchema.optional(),

  condition: clubConditionSchema,

  gripCondition: z.string().optional(),
  length: z.string().optional(),
  notes: z.string().optional(),

  confidenceScore: z
    .number()
    .min(CONFIDENCE_SCORE_MIN)
    .max(CONFIDENCE_SCORE_MAX),

  missingFields: z.array(z.string()).default([]),

  createdAt: isoDateTimeStringSchema.optional(),
  updatedAt: isoDateTimeStringSchema.optional()
});

export const createGolfClubInputSchema = golfClubSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const intakeBatchSchema = z.object({
  id: idSchema,

  name: z.string().min(1),
  description: z.string().optional(),

  sourceType: intakeSourceTypeSchema,
  status: intakeBatchStatusSchema,

  itemCount: z.number().int().nonnegative().default(0),

  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema
});

export const createIntakeBatchInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sourceType: intakeSourceTypeSchema
});

export const intakeItemSchema = z.object({
  id: idSchema,
  intakeBatchId: idSchema,

  rawText: z.string().min(1),
  sourceRowNumber: z.number().int().positive().optional(),

  status: intakeItemStatusSchema,

  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema
});

export const createIntakeItemInputSchema = z.object({
  intakeBatchId: idSchema,
  rawText: z.string().min(1),
  sourceRowNumber: z.number().int().positive().optional()
});

export const workflowRunSchema = z.object({
  id: idSchema,

  intakeBatchId: idSchema.optional(),
  intakeItemId: idSchema.optional(),

  workflowName: z.string().min(1),
  status: workflowRunStatusSchema,

  startedAt: isoDateTimeStringSchema.optional(),
  completedAt: isoDateTimeStringSchema.optional(),

  errorMessage: z.string().optional(),

  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema
});

export const workflowStepSchema = z.object({
  id: idSchema,
  workflowRunId: idSchema,

  stepName: z.string().min(1),
  stepType: workflowStepTypeSchema,
  status: workflowStepStatusSchema,

  orderIndex: z.number().int().positive(),

  inputJson: z.record(z.unknown()).optional(),
  outputJson: z.record(z.unknown()).optional(),

  errorMessage: z.string().optional(),
  retryCount: z.number().int().nonnegative().default(0),

  startedAt: isoDateTimeStringSchema.optional(),
  completedAt: isoDateTimeStringSchema.optional(),

  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema
});

export const toolCallLogSchema = z.object({
  id: idSchema,

  workflowRunId: idSchema.optional(),
  workflowStepId: idSchema.optional(),

  toolName: z.string().min(1),
  status: toolCallStatusSchema,

  inputJson: z.record(z.unknown()).optional(),
  outputJson: z.record(z.unknown()).optional(),

  errorMessage: z.string().optional(),

  startedAt: isoDateTimeStringSchema,
  completedAt: isoDateTimeStringSchema.optional(),

  createdAt: isoDateTimeStringSchema
});

export const modelCallLogSchema = z.object({
  id: idSchema,

  workflowRunId: idSchema.optional(),
  workflowStepId: idSchema.optional(),

  provider: modelProviderNameSchema,
  model: z.string().min(1),

  status: modelCallStatusSchema,

  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),

  latencyMs: z.number().int().nonnegative().optional(),
  estimatedCostUsd: z.number().nonnegative().optional(),

  requestJson: z.record(z.unknown()).optional(),
  responseJson: z.record(z.unknown()).optional(),

  errorMessage: z.string().optional(),

  startedAt: isoDateTimeStringSchema,
  completedAt: isoDateTimeStringSchema.optional(),

  createdAt: isoDateTimeStringSchema
});

export const reviewQueueItemSchema = z.object({
  id: idSchema,

  intakeItemId: idSchema.optional(),
  golfClubId: idSchema.optional(),
  workflowRunId: idSchema.optional(),

  reason: reviewReasonSchema,
  status: reviewQueueStatusSchema,

  originalText: z.string().optional(),
  proposedGolfClubJson: z.record(z.unknown()).optional(),

  reviewerNotes: z.string().optional(),
  resolvedAt: isoDateTimeStringSchema.optional(),

  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema
});

// TEMP PLACEHOLDER SCHEMAS

export const evalCaseSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  input: z.record(z.unknown()),
  expectedOutput: z.record(z.unknown()).optional(),
  createdAt: isoDateTimeStringSchema.optional()
});

export const evalResultSchema = z.object({
  id: idSchema,
  evalCaseId: idSchema,
  workflowRunId: idSchema.optional(),
  passed: z.boolean(),
  score: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
  createdAt: isoDateTimeStringSchema.optional()
});

export const modelRoutingPolicySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  taskType: z.string().min(1),
  preferredProvider: modelProviderNameSchema,
  fallbackProviders: z.array(modelProviderNameSchema).default([]),
  maxEstimatedCostUsd: z.number().nonnegative().optional(),
  maxLatencyMs: z.number().int().positive().optional(),
  createdAt: isoDateTimeStringSchema.optional()
});

export const mcpToolDefinitionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchemaJson: z.record(z.unknown()).optional(),
  outputSchemaJson: z.record(z.unknown()).optional(),
  enabled: z.boolean().default(false),
  createdAt: isoDateTimeStringSchema.optional()
});
