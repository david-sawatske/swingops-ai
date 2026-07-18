import { z } from "zod";

import type {
  ModelProviderOutputSchema
} from "../ai/model-provider.types.js";
import type {
  MainRunFieldRepairAdvisoryCandidate
} from "./field-repair-advisory-candidates.js";

import {
  getFieldRepairSuggestionMatrixValidationErrors,
  getGolfTermNormalizationMatrix
} from "./golf-term-normalization.js";

export const MAIN_RUN_FIELD_REPAIR_POLICY_KEY = "MAIN_RUN_FIELD_REPAIR";
export const MAIN_RUN_FIELD_REPAIR_AGENT_NAME = "main-run-field-repair-agent";
export const MAIN_RUN_FIELD_REPAIR_TASK_TYPE = "FIELD_NORMALIZATION" as const;
export const FIELD_REPAIR_AUTO_ACCEPT_CONFIDENCE_THRESHOLD = 0.85;

export const MAIN_RUN_FIELD_REPAIR_OUTPUT_SCHEMA_VERSION = "1.0.0";

const fieldRepairSuggestionOutputJsonSchema: Record<string, unknown> = {
  anyOf: [
    {
      type: "object",
      properties: {
        recordId: { type: "string" },
        fieldName: { type: "string", enum: ["brand"] },
        sourcePhrase: { type: "string" },
        candidateValue: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason: { type: "string" },
        reviewRequired: { type: "boolean" }
      },
      required: [
        "recordId",
        "fieldName",
        "sourcePhrase",
        "candidateValue",
        "confidence",
        "reason",
        "reviewRequired"
      ],
      additionalProperties: false
    },
    {
      type: "object",
      properties: {
        recordId: { type: "string" },
        fieldName: { type: "string", enum: ["productLine"] },
        sourcePhrase: { type: "string" },
        candidateValue: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason: { type: "string" },
        reviewRequired: { type: "boolean" }
      },
      required: [
        "recordId",
        "fieldName",
        "sourcePhrase",
        "candidateValue",
        "confidence",
        "reason",
        "reviewRequired"
      ],
      additionalProperties: false
    },
    {
      type: "object",
      properties: {
        recordId: { type: "string" },
        fieldName: { type: "string", enum: ["category"] },
        sourcePhrase: { type: "string" },
        candidateValue: {
          type: "string",
          enum: [
            "DRIVER",
            "FAIRWAY_WOOD",
            "HYBRID",
            "IRON_SET",
            "WEDGE",
            "PUTTER"
          ]
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason: { type: "string" },
        reviewRequired: { type: "boolean" }
      },
      required: [
        "recordId",
        "fieldName",
        "sourcePhrase",
        "candidateValue",
        "confidence",
        "reason",
        "reviewRequired"
      ],
      additionalProperties: false
    },
    {
      type: "object",
      properties: {
        recordId: { type: "string" },
        fieldName: { type: "string", enum: ["shaftFlex"] },
        sourcePhrase: { type: "string" },
        candidateValue: {
          type: "string",
          enum: [
            "LADIES",
            "SENIOR",
            "REGULAR",
            "STIFF",
            "X_STIFF",
            "TOUR_X_STIFF"
          ]
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason: { type: "string" },
        reviewRequired: { type: "boolean" }
      },
      required: [
        "recordId",
        "fieldName",
        "sourcePhrase",
        "candidateValue",
        "confidence",
        "reason",
        "reviewRequired"
      ],
      additionalProperties: false
    },
    {
      type: "object",
      properties: {
        recordId: { type: "string" },
        fieldName: { type: "string", enum: ["conditionGrade"] },
        sourcePhrase: { type: "string" },
        candidateValue: {
          type: "string",
          enum: [
            "9.5 Mint",
            "9.0 Above Average",
            "8.0 Average",
            "7.0 Below Average",
            "6.0 Poor"
          ]
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason: { type: "string" },
        reviewRequired: { type: "boolean" }
      },
      required: [
        "recordId",
        "fieldName",
        "sourcePhrase",
        "candidateValue",
        "confidence",
        "reason",
        "reviewRequired"
      ],
      additionalProperties: false
    },
    {
      type: "object",
      properties: {
        recordId: { type: "string" },
        fieldName: { type: "string", enum: ["tradeInValue"] },
        sourcePhrase: { type: "string" },
        candidateValue: { type: "number", minimum: 0 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason: { type: "string" },
        reviewRequired: { type: "boolean" }
      },
      required: [
        "recordId",
        "fieldName",
        "sourcePhrase",
        "candidateValue",
        "confidence",
        "reason",
        "reviewRequired"
      ],
      additionalProperties: false
    }
  ]
};

const fieldRepairRecordOutcomeOutputJsonSchema: Record<string, unknown> = {
  anyOf: [
    {
      type: "object",
      properties: {
        outcomeType: { type: "string", enum: ["REPAIR_SUGGESTED"] },
        recordId: { type: "string" },
        summary: { type: "string" },
        evidenceIds: {
          type: "array",
          items: { type: "string" }
        },
        reviewerQuestion: { type: "string" },
        suggestions: {
          type: "array",
          minItems: 1,
          items: fieldRepairSuggestionOutputJsonSchema
        }
      },
      required: [
        "outcomeType",
        "recordId",
        "summary",
        "evidenceIds",
        "reviewerQuestion",
        "suggestions"
      ],
      additionalProperties: false
    },
    {
      type: "object",
      properties: {
        outcomeType: { type: "string", enum: ["CANDIDATE_COMPARISON"] },
        recordId: { type: "string" },
        summary: { type: "string" },
        evidenceIds: {
          type: "array",
          items: { type: "string" }
        },
        reviewerQuestion: { type: "string" },
        candidateProductIds: {
          type: "array",
          minItems: 2,
          items: { type: "string" }
        }
      },
      required: [
        "outcomeType",
        "recordId",
        "summary",
        "evidenceIds",
        "reviewerQuestion",
        "candidateProductIds"
      ],
      additionalProperties: false
    },
    {
      type: "object",
      properties: {
        outcomeType: { type: "string", enum: ["NO_SAFE_REPAIR"] },
        recordId: { type: "string" },
        summary: { type: "string" },
        evidenceIds: {
          type: "array",
          items: { type: "string" }
        },
        reviewerQuestion: { type: "string" },
        reasonCodes: {
          type: "array",
          minItems: 1,
          items: { type: "string" }
        }
      },
      required: [
        "outcomeType",
        "recordId",
        "summary",
        "evidenceIds",
        "reviewerQuestion",
        "reasonCodes"
      ],
      additionalProperties: false
    }
  ]
};

export const MAIN_RUN_FIELD_REPAIR_OUTPUT_SCHEMA = {
  name: "main_run_field_repair",
  version: MAIN_RUN_FIELD_REPAIR_OUTPUT_SCHEMA_VERSION,
  strict: true,
  schema: {
    type: "object",
    properties: {
      recordOutcomes: {
        type: "array",
        items: fieldRepairRecordOutcomeOutputJsonSchema
      },
      suggestions: {
        type: "array",
        items: fieldRepairSuggestionOutputJsonSchema
      }
    },
    required: ["recordOutcomes", "suggestions"],
    additionalProperties: false
  }
} satisfies ModelProviderOutputSchema;

export const fieldRepairFieldNameSchema = z.enum([
  "brand",
  "productLine",
  "category",
  "shaftFlex",
  "conditionGrade",
  "tradeInValue"
]);

export const fieldRepairCategoryValueSchema = z.enum([
  "DRIVER",
  "FAIRWAY_WOOD",
  "HYBRID",
  "IRON_SET",
  "WEDGE",
  "PUTTER"
]);

export const fieldRepairShaftFlexValueSchema = z.enum([
  "LADIES",
  "SENIOR",
  "REGULAR",
  "STIFF",
  "X_STIFF",
  "TOUR_X_STIFF"
]);

export const fieldRepairConditionGradeValueSchema = z.enum([
  "9.5 Mint",
  "9.0 Above Average",
  "8.0 Average",
  "7.0 Below Average",
  "6.0 Poor"
]);

const fieldRepairSuggestionBaseSchema = z
  .object({
    recordId: z.string().trim().min(1).optional(),
    sourcePhrase: z.string().trim().min(1),
    confidence: z.number().min(0).max(1),
    reason: z.string().trim().min(1),
    reviewRequired: z.boolean()
  })
  .strict();

export const fieldRepairSuggestionSchema = z.discriminatedUnion("fieldName", [
  fieldRepairSuggestionBaseSchema.extend({
    fieldName: z.literal("brand"),
    candidateValue: z.string().trim().min(1)
  }),
  fieldRepairSuggestionBaseSchema.extend({
    fieldName: z.literal("productLine"),
    candidateValue: z.string().trim().min(1)
  }),
  fieldRepairSuggestionBaseSchema.extend({
    fieldName: z.literal("category"),
    candidateValue: fieldRepairCategoryValueSchema
  }),
  fieldRepairSuggestionBaseSchema.extend({
    fieldName: z.literal("shaftFlex"),
    candidateValue: fieldRepairShaftFlexValueSchema
  }),
  fieldRepairSuggestionBaseSchema.extend({
    fieldName: z.literal("conditionGrade"),
    candidateValue: fieldRepairConditionGradeValueSchema
  }),
  fieldRepairSuggestionBaseSchema.extend({
    fieldName: z.literal("tradeInValue"),
    candidateValue: z.number().min(0)
  })
]);

const fieldRepairRecordOutcomeBaseSchema = z
  .object({
    recordId: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    evidenceIds: z.array(z.string().trim().min(1)),
    reviewerQuestion: z.string().trim().min(1)
  })
  .strict();

export const fieldRepairRecordOutcomeSchema = z.discriminatedUnion(
  "outcomeType",
  [
    fieldRepairRecordOutcomeBaseSchema.extend({
      outcomeType: z.literal("REPAIR_SUGGESTED"),
      suggestions: z.array(fieldRepairSuggestionSchema).min(1)
    }),
    fieldRepairRecordOutcomeBaseSchema.extend({
      outcomeType: z.literal("CANDIDATE_COMPARISON"),
      candidateProductIds: z.array(z.string().trim().min(1)).min(2)
    }),
    fieldRepairRecordOutcomeBaseSchema.extend({
      outcomeType: z.literal("NO_SAFE_REPAIR"),
      reasonCodes: z.array(z.string().trim().min(1)).min(1)
    })
  ]
);

export const fieldRepairOutputSchema = z
  .object({
    recordOutcomes: z.array(fieldRepairRecordOutcomeSchema).default([]),
    suggestions: z.array(fieldRepairSuggestionSchema)
  })
  .strict();

export type FieldRepairFieldName = z.infer<typeof fieldRepairFieldNameSchema>;
export type FieldRepairSuggestion = z.infer<typeof fieldRepairSuggestionSchema>;
export type FieldRepairRecordOutcome = z.infer<
  typeof fieldRepairRecordOutcomeSchema
>;
export type FieldRepairOutput = z.infer<typeof fieldRepairOutputSchema>;

export type MainRunFieldRepairSelectionReason = {
  lowConfidence: boolean;
  confidence: number;
  missingFields: string[];
  uncertaintyNotes: string[];
  reviewReasonCodes: string[];
};

export type MainRunFieldRepairFieldApplicability = {
  shaftFlex: "REQUIRED" | "NOT_APPLICABLE";
};

export type MainRunFieldRepairProductResolutionContext = {
  status: "MATCHED" | "AMBIGUOUS" | "UNRESOLVED";
  reason: string;
  matchedProductId: string | null;
  matchedSku: string | null;
  candidateProductIds: string[];
};

export type MainRunFieldRepairEvidenceType =
  | "PARSER"
  | "DETERMINISTIC_POLICY"
  | "PRODUCT_RESOLUTION"
  | "KNOWLEDGE"
  | "INVENTORY"
  | "VALUATION"
  | "PRIOR_REVIEW";

export type MainRunFieldRepairEvidenceItem = {
  evidenceId: string;
  evidenceType: MainRunFieldRepairEvidenceType;
  summary: string;
  payload: unknown;
};

export type MainRunFieldRepairRecordInput = {
  recordId: string;
  sourceText: string;
  missingFields: string[];
  confidence: number;
  selectionReason: MainRunFieldRepairSelectionReason;
  currentFields: Partial<Record<FieldRepairFieldName, string | number | null>>;
  fieldApplicability: MainRunFieldRepairFieldApplicability;
  parserEvidence?: unknown;
  productResolution: MainRunFieldRepairProductResolutionContext;
  advisoryCandidates?: MainRunFieldRepairAdvisoryCandidate[];
  evidence: MainRunFieldRepairEvidenceItem[];
};

export type BuildMainRunFieldRepairExecutionInput = {
  workflowRunId: string;
  records: MainRunFieldRepairRecordInput[];
};

export type FieldRepairValidationContext = {
  records: MainRunFieldRepairRecordInput[];
};

export type FieldRepairValidationResult =
  | {
      jsonValid: true;
      validationPassed: true;
      output: FieldRepairOutput;
      validationErrors: [];
    }
  | {
      jsonValid: true;
      validationPassed: false;
      output: null;
      validationErrors: string[];
    }
  | {
      jsonValid: false;
      validationPassed: false;
      output: null;
      validationErrors: string[];
    };

export function buildMainRunFieldRepairExecutionInput(
  input: BuildMainRunFieldRepairExecutionInput
): Record<string, unknown> {
  const requiredRecordIds =
    input.records.map(
      (record) => record.recordId
    );

  return {
    policyKey: MAIN_RUN_FIELD_REPAIR_POLICY_KEY,
    agentName: MAIN_RUN_FIELD_REPAIR_AGENT_NAME,
    workflowRunId: input.workflowRunId,
    records: input.records.map((record) => ({
      recordId: record.recordId,
      sourceText: record.sourceText,
      missingFields: record.missingFields,
      confidence: record.confidence,
      selectionReason: record.selectionReason,
      currentFields: record.currentFields,
      fieldApplicability: record.fieldApplicability,
      parserEvidence: record.parserEvidence ?? null,
      productResolution: record.productResolution,
      advisoryCandidates:
        record.advisoryCandidates ?? [],
      evidence: record.evidence
    })),
    outcomeCompleteness: {
      expectedRecordCount:
        requiredRecordIds.length,
      requiredRecordIds,
      requirement:
        "Return exactly one recordOutcomes entry for every requiredRecordId, preserving this order."
    },
    authorityOrder: [
      "HUMAN_CORRECTION",
      "DETERMINISTIC_POLICY",
      "PRODUCT_RESOLUTION",
      "INVENTORY_AND_VALUATION",
      "KNOWLEDGE",
      "PRIOR_REVIEW",
      "MODEL"
    ],
    advisoryCandidatePolicy: {
      description:
        "Evidence-backed advisory candidates were validated before model execution and remain subject to human review.",
      requiredOutcome:
        "When a non-ambiguous record has advisoryCandidates, return REPAIR_SUGGESTED.",
      requiredEvidence:
        "Cite every advisory candidate sourceEvidenceId in the record outcome.",
      suggestionHandling:
        "Preserve each candidate suggestion recordId, fieldName, sourcePhrase, candidateValue, confidence, and reviewRequired value. Do not add unsupported suggestions."
    },
    approvedValueSets: {
      category: [
        "DRIVER",
        "FAIRWAY_WOOD",
        "HYBRID",
        "IRON_SET",
        "WEDGE",
        "PUTTER"
      ],
      shaftFlex: [
        "LADIES",
        "SENIOR",
        "REGULAR",
        "STIFF",
        "X_STIFF",
        "TOUR_X_STIFF"
      ],
      conditionGrade: [
        "9.5 Mint",
        "9.0 Above Average",
        "8.0 Average",
        "7.0 Below Average",
        "6.0 Poor"
      ]
    },
    normalizationMatrix: getGolfTermNormalizationMatrix(),
    normalizationExamples: [
      {
        sourcePhrase: "s flex",
        fieldName: "shaftFlex",
        candidateValue: "STIFF"
      },
      {
        sourcePhrase: "x-stiff",
        fieldName: "shaftFlex",
        candidateValue: "X_STIFF"
      },
      {
        sourcePhrase: "tour x stiff",
        fieldName: "shaftFlex",
        candidateValue: "TOUR_X_STIFF"
      },
      {
        sourcePhrase: "shaft unknown",
        fieldName: "shaftFlex",
        candidateValue: null,
        action: "BLOCK_REPAIR"
      },
      {
        sourcePhrase: "UW 19 degree",
        fieldName: "category",
        candidateValue: null,
        action: "ROUTE_TO_REVIEW"
      },
      {
        sourcePhrase: "condition avg",
        fieldName: "conditionGrade",
        candidateValue: "8.0 Average"
      },
      {
        sourcePhrase: "overall avg",
        fieldName: "conditionGrade",
        candidateValue: "8.0 Average"
      },
      {
        sourcePhrase: "cosmetics mint",
        fieldName: "conditionGrade",
        candidateValue: "9.5 Mint"
      }
    ],
    outputContract: {
      recordOutcomes: [
        {
          outcomeType: "REPAIR_SUGGESTED",
          recordId: "source record id",
          summary: "brief reviewer-facing summary",
          evidenceIds: ["only evidenceId values supplied for this record"],
          reviewerQuestion: "specific question or approval action for the reviewer",
          suggestions: [
            {
              recordId: "source record id",
              fieldName: "one supported field name",
              sourcePhrase: "exact source phrase supporting the repair",
              candidateValue:
                "approved normalized value only. Do not return abbreviations like S or free-text values like Average.",
              confidence: "number from 0 to 1",
              reason: "brief evidence-based reason",
              reviewRequired: "boolean"
            }
          ]
        },
        {
          outcomeType: "CANDIDATE_COMPARISON",
          recordId: "source record id",
          summary: "compare only supplied deterministic candidates",
          evidenceIds: ["product-resolution evidenceId supplied for this record"],
          reviewerQuestion: "specific distinction the reviewer should confirm",
          candidateProductIds: [
            "only product IDs supplied in productResolution.candidateProductIds"
          ]
        },
        {
          outcomeType: "NO_SAFE_REPAIR",
          recordId: "source record id",
          summary: "why available evidence cannot safely repair the record",
          evidenceIds: ["only evidenceId values supplied for this record"],
          reviewerQuestion: "specific missing fact the reviewer should confirm",
          reasonCodes: ["one or more concise safety or evidence reason codes"]
        }
      ],
      suggestions:
        "Compatibility field. Repeat only suggestions nested under REPAIR_SUGGESTED outcomes. The validator derives the accepted projection from validated record outcomes."
    },
    validationRules: [
      "Return JSON only.",
      "Return exactly one recordOutcomes entry for every record in records, preserving input order. Do not stop after processing records with advisoryCandidates.",
      "Only suggest fields supported by source evidence.",
      "Every suggestion must include a non-empty sourcePhrase.",
      "For shaftFlex, candidateValue must be one of LADIES, SENIOR, REGULAR, STIFF, X_STIFF, TOUR_X_STIFF.",
      "For conditionGrade, candidateValue must be one of 9.5 Mint, 9.0 Above Average, 8.0 Average, 7.0 Below Average, 6.0 Poor.",
      "For category, candidateValue must be one of DRIVER, FAIRWAY_WOOD, HYBRID, IRON_SET, WEDGE, PUTTER.",
      "For tradeInValue, candidateValue must be a number.",
      "Do not suggest a value when sourcePhrase contains negative evidence such as unknown, unclear, pending, not listed, ?, or tbd.",
      "Do not map utility wood evidence such as UW or utility wood to WEDGE.",
      "Only map single-letter R to REGULAR when the source phrase clearly identifies shaft-flex context.",
      "Low-confidence suggestions must keep reviewRequired true.",
      "Do not invent missing fields without evidence.",
      "When currentFields.conditionGrade is null and missingFields includes conditionGrade, an explicit contextual phrase describing overall condition or cosmetics may support a review-required suggestion on the approved conditionGrade scale.",
      "Use the shortest exact source phrase carrying the condition meaning. Do not derive conditionGrade from isolated wear or damage notes such as worn grips, face wear, sky marks, scratches, or paint wear.",
      "A separate valuation requirement for condition notes does not block an evidence-backed conditionGrade suggestion. Keep any remaining valuation review need in the summary or reviewer question.",
      "The model is advisory and subordinate to human corrections, deterministic policy, product resolution, inventory and valuation evidence, knowledge evidence, and prior review evidence.",
      "Do not replace a MATCHED product identity.",
      "For AMBIGUOUS product resolution, use only candidateProductIds supplied in the record packet.",
      "For UNRESOLVED product resolution, do not invent product IDs, SKUs, product lines, or valuation.",
      "Cite only evidenceId values supplied in the selected record packet.",
      "When advisoryCandidates is non-empty, return REPAIR_SUGGESTED, cite every advisory candidate sourceEvidenceId, and include every supplied candidate suggestion.",
      "For supplied advisory candidates, preserve recordId, fieldName, sourcePhrase, candidateValue, confidence, and reviewRequired exactly. The reason may briefly restate the supplied rationale.",
      "Do not return NO_SAFE_REPAIR when the selected record includes a valid evidence-backed advisory candidate.",
      "Do not add suggestions that are not present in advisoryCandidates when advisoryCandidates is non-empty.",
      "When fieldApplicability.shaftFlex is NOT_APPLICABLE, do not suggest shaftFlex or ask the reviewer to provide it.",
      "Top-level suggestions is compatibility-only. Include only suggestions already nested under REPAIR_SUGGESTED outcomes."
    ]
  };
}

export function validateMainRunFieldRepairModelOutput(
  outputJson: Record<string, unknown> | null,
  context?: FieldRepairValidationContext
): FieldRepairValidationResult {
  const candidateJson = getCandidateFieldRepairJson(outputJson);
  const parsedOutput = fieldRepairOutputSchema.safeParse(candidateJson);

  if (!parsedOutput.success) {
    return {
      jsonValid: false,
      validationPassed: false,
      output: null,
      validationErrors: formatFieldRepairValidationErrors(
        parsedOutput.error.issues,
        candidateJson
      )
    };
  }

  const usesRecordOutcomeContract =
    parsedOutput.data.recordOutcomes.length > 0;
  const indexedSuggestions = [
    ...(usesRecordOutcomeContract
      ? []
      : parsedOutput.data.suggestions.map((suggestion, index) => ({
          path: `suggestions.${index}`,
          suggestion
        }))),
    ...parsedOutput.data.recordOutcomes.flatMap((outcome, outcomeIndex) =>
      outcome.outcomeType === "REPAIR_SUGGESTED"
        ? outcome.suggestions.map((suggestion, suggestionIndex) => ({
            path:
              `recordOutcomes.${outcomeIndex}.suggestions.${suggestionIndex}`,
            suggestion
          }))
        : []
    )
  ];
  const matrixValidationErrors = indexedSuggestions.flatMap(
    ({ path, suggestion }) =>
      getFieldRepairSuggestionMatrixValidationErrors(suggestion).map(
        (message) => `${path}: ${message}`
      )
  );
  const outputForContextValidation: FieldRepairOutput =
    usesRecordOutcomeContract
      ? {
          ...parsedOutput.data,
          suggestions: []
        }
      : parsedOutput.data;
  const contextValidationErrors = context
    ? getFieldRepairContextValidationErrors(
        outputForContextValidation,
        context
      )
    : [];
  const validationErrors = [
    ...matrixValidationErrors,
    ...contextValidationErrors
  ];

  if (validationErrors.length > 0) {
    return {
      jsonValid: true,
      validationPassed: false,
      output: null,
      validationErrors
    };
  }

  const normalizedRecordOutcomes =
    parsedOutput.data.recordOutcomes.map(
      normalizeRecordOutcomeReviewRequirements
    );
  const compatibilitySuggestions = usesRecordOutcomeContract
    ? normalizedRecordOutcomes.flatMap((outcome) =>
        outcome.outcomeType === "REPAIR_SUGGESTED"
          ? outcome.suggestions
          : []
      )
    : parsedOutput.data.suggestions.map(
        normalizeSuggestionReviewRequirement
      );

  return {
    jsonValid: true,
    validationPassed: true,
    output: {
      recordOutcomes: normalizedRecordOutcomes,
      suggestions: compatibilitySuggestions
    },
    validationErrors: []
  };
}

function getFieldRepairContextValidationErrors(
  output: FieldRepairOutput,
  context: FieldRepairValidationContext
): string[] {
  const errors: string[] = [];
  const recordsById = new Map(
    context.records.map((record) => [record.recordId, record])
  );
  const outcomeCountByRecordId = new Map<string, number>();

  for (const [outcomeIndex, outcome] of output.recordOutcomes.entries()) {
    outcomeCountByRecordId.set(
      outcome.recordId,
      (outcomeCountByRecordId.get(outcome.recordId) ?? 0) + 1
    );

    const record = recordsById.get(outcome.recordId);

    if (!record) {
      errors.push(
        `recordOutcomes.${outcomeIndex}: unknown recordId=${outcome.recordId}.`
      );
      continue;
    }

    errors.push(
      ...getOutcomeContextValidationErrors({
        outcome,
        outcomeIndex,
        record
      })
    );
  }

  for (const record of context.records) {
    const outcomeCount = outcomeCountByRecordId.get(record.recordId) ?? 0;

    if (outcomeCount === 0) {
      errors.push(
        `recordOutcomes: missing advisory outcome for recordId=${record.recordId}.`
      );
    } else if (outcomeCount > 1) {
      errors.push(
        `recordOutcomes: expected one advisory outcome for recordId=${record.recordId}, received ${outcomeCount}.`
      );
    }
  }

  for (const [suggestionIndex, suggestion] of output.suggestions.entries()) {
    if (!suggestion.recordId) {
      errors.push(
        `suggestions.${suggestionIndex}: recordId is required when validating against selected records.`
      );
      continue;
    }

    const record = recordsById.get(suggestion.recordId);

    if (!record) {
      errors.push(
        `suggestions.${suggestionIndex}: unknown recordId=${suggestion.recordId}.`
      );
      continue;
    }

    errors.push(
      ...getSuggestionContextValidationErrors({
        suggestion,
        path: `suggestions.${suggestionIndex}`,
        record
      })
    );
  }

  return errors;
}

function getOutcomeContextValidationErrors(input: {
  outcome: FieldRepairRecordOutcome;
  outcomeIndex: number;
  record: MainRunFieldRepairRecordInput;
}): string[] {
  const errors: string[] = [];
  const path = `recordOutcomes.${input.outcomeIndex}`;
  const allowedEvidenceIds = new Set(
    input.record.evidence.map((evidence) => evidence.evidenceId)
  );
  const advisoryCandidates =
    input.record.advisoryCandidates ?? [];

  for (const evidenceId of input.outcome.evidenceIds) {
    if (!allowedEvidenceIds.has(evidenceId)) {
      errors.push(
        `${path}: unknown evidenceId=${evidenceId} for recordId=${input.record.recordId}.`
      );
    }
  }

  for (const advisoryCandidate of advisoryCandidates) {
    if (
      !allowedEvidenceIds.has(
        advisoryCandidate.sourceEvidenceId
      )
    ) {
      errors.push(
        `${path}: advisory candidate ${advisoryCandidate.candidateId} references unknown sourceEvidenceId=${advisoryCandidate.sourceEvidenceId}.`
      );
    }

    if (
      !input.outcome.evidenceIds.includes(
        advisoryCandidate.sourceEvidenceId
      )
    ) {
      errors.push(
        `${path}: missing required sourceEvidenceId=${advisoryCandidate.sourceEvidenceId} for advisory candidate ${advisoryCandidate.candidateId}.`
      );
    }
  }

  if (
    advisoryCandidates.length > 0 &&
    input.outcome.outcomeType !== "REPAIR_SUGGESTED"
  ) {
    errors.push(
      `${path}: recordId=${input.record.recordId} requires REPAIR_SUGGESTED because evidence-backed advisory candidates were supplied.`
    );
  }

  if (
    input.record.fieldApplicability.shaftFlex === "NOT_APPLICABLE" &&
    /\b(?:shaft|flex)\b/i.test(input.outcome.reviewerQuestion)
  ) {
    errors.push(
      `${path}: reviewerQuestion must not request shaft-flex information for a putter.`
    );
  }

  if (input.outcome.outcomeType === "CANDIDATE_COMPARISON") {
    if (input.record.productResolution.status !== "AMBIGUOUS") {
      errors.push(
        `${path}: CANDIDATE_COMPARISON requires AMBIGUOUS deterministic product resolution.`
      );
    }

    const allowedCandidateIds = new Set(
      input.record.productResolution.candidateProductIds
    );

    for (const candidateProductId of input.outcome.candidateProductIds) {
      if (!allowedCandidateIds.has(candidateProductId)) {
        errors.push(
          `${path}: unsupported candidateProductId=${candidateProductId}.`
        );
      }
    }
  }

  if (input.outcome.outcomeType === "REPAIR_SUGGESTED") {
    for (const [suggestionIndex, suggestion] of
      input.outcome.suggestions.entries()) {
      errors.push(
        ...getSuggestionContextValidationErrors({
          suggestion,
          path: `${path}.suggestions.${suggestionIndex}`,
          record: input.record
        })
      );
    }

    errors.push(
      ...getAdvisoryCandidateOutcomeValidationErrors({
        outcome: input.outcome,
        path,
        record: input.record
      })
    );
  }

  return errors;
}

function getAdvisoryCandidateOutcomeValidationErrors(input: {
  outcome: Extract<
    FieldRepairRecordOutcome,
    {
      outcomeType: "REPAIR_SUGGESTED";
    }
  >;
  path: string;
  record: MainRunFieldRepairRecordInput;
}): string[] {
  const advisoryCandidates =
    input.record.advisoryCandidates ?? [];

  if (advisoryCandidates.length === 0) {
    return [];
  }

  const errors: string[] = [];

  for (const advisoryCandidate of advisoryCandidates) {
    const matchingSuggestion =
      input.outcome.suggestions.find((suggestion) =>
        suggestionMatchesAdvisoryCandidate(
          suggestion,
          advisoryCandidate
        )
      );

    if (!matchingSuggestion) {
      errors.push(
        `${input.path}: missing or altered advisory candidate ${advisoryCandidate.candidateId}.`
      );
    }
  }

  for (const [
    suggestionIndex,
    suggestion
  ] of input.outcome.suggestions.entries()) {
    const suppliedCandidate =
      advisoryCandidates.some((advisoryCandidate) =>
        suggestionMatchesAdvisoryCandidate(
          suggestion,
          advisoryCandidate
        )
      );

    if (!suppliedCandidate) {
      errors.push(
        `${input.path}.suggestions.${suggestionIndex}: suggestion was not supplied as an evidence-backed advisory candidate.`
      );
    }
  }

  return errors;
}

function suggestionMatchesAdvisoryCandidate(
  suggestion: FieldRepairSuggestion,
  advisoryCandidate: MainRunFieldRepairAdvisoryCandidate
): boolean {
  const suppliedSuggestion =
    advisoryCandidate.suggestion;

  return (
    suggestion.recordId ===
      suppliedSuggestion.recordId &&
    suggestion.fieldName ===
      suppliedSuggestion.fieldName &&
    suggestion.sourcePhrase ===
      suppliedSuggestion.sourcePhrase &&
    getFieldRepairCandidateValueKey(
      suggestion.candidateValue
    ) ===
      getFieldRepairCandidateValueKey(
        suppliedSuggestion.candidateValue
      ) &&
    suggestion.confidence ===
      suppliedSuggestion.confidence &&
    suggestion.reviewRequired ===
      suppliedSuggestion.reviewRequired
  );
}

function getFieldRepairCandidateValueKey(
  value: string | number
): string {
  return typeof value === "number"
    ? `number:${value}`
    : `string:${value}`;
}

function getSuggestionContextValidationErrors(input: {
  suggestion: FieldRepairSuggestion;
  path: string;
  record: MainRunFieldRepairRecordInput;
}): string[] {
  const errors: string[] = [];

  if (input.suggestion.recordId !== input.record.recordId) {
    errors.push(
      `${input.path}: suggestion recordId must match outcome recordId=${input.record.recordId}.`
    );
  }

  if (
    !input.record.sourceText
      .toLowerCase()
      .includes(input.suggestion.sourcePhrase.toLowerCase())
  ) {
    errors.push(
      `${input.path}: sourcePhrase was not found in the selected record source text.`
    );
  }

  if (
    input.record.fieldApplicability.shaftFlex === "NOT_APPLICABLE" &&
    input.suggestion.fieldName === "shaftFlex"
  ) {
    errors.push(
      `${input.path}: shaftFlex is not applicable for a putter record.`
    );
  }

  if (
    input.record.productResolution.status === "MATCHED" &&
    ["brand", "productLine", "category"].includes(
      input.suggestion.fieldName
    )
  ) {
    errors.push(
      `${input.path}: model repair cannot replace deterministic MATCHED product identity.`
    );
  }

  return errors;
}

function formatFieldRepairValidationErrors(
  issues: z.ZodIssue[],
  candidateJson: unknown
): string[] {
  return issues.map((issue) => {
    const baseMessage = [issue.path.join("."), issue.message]
      .filter(Boolean)
      .join(": ");
    const fieldName = getIssueSuggestionFieldName({
      issue,
      candidateJson
    });

    return fieldName ? `${baseMessage} fieldName=${fieldName}` : baseMessage;
  });
}

function getIssueSuggestionFieldName(input: {
  issue: z.ZodIssue;
  candidateJson: unknown;
}): string | null {
  const [collectionName, suggestionIndex] = input.issue.path;

  if (collectionName !== "suggestions" || typeof suggestionIndex !== "number") {
    return null;
  }

  if (!isRecord(input.candidateJson) || !Array.isArray(input.candidateJson.suggestions)) {
    return null;
  }

  const suggestion = input.candidateJson.suggestions[suggestionIndex];

  if (!isRecord(suggestion) || typeof suggestion.fieldName !== "string") {
    return null;
  }

  return suggestion.fieldName;
}

function getCandidateFieldRepairJson(
  outputJson: Record<string, unknown> | null
): unknown {
  if (!outputJson) {
    return null;
  }

  if (isRecord(outputJson.parsedJson)) {
    return outputJson.parsedJson;
  }

  return outputJson;
}

function normalizeRecordOutcomeReviewRequirements(
  outcome: FieldRepairRecordOutcome
): FieldRepairRecordOutcome {
  if (outcome.outcomeType !== "REPAIR_SUGGESTED") {
    return outcome;
  }

  return {
    ...outcome,
    suggestions: outcome.suggestions.map(
      normalizeSuggestionReviewRequirement
    )
  };
}

function normalizeSuggestionReviewRequirement(
  suggestion: FieldRepairSuggestion
): FieldRepairSuggestion {
  return {
    ...suggestion,
    reviewRequired:
      suggestion.reviewRequired ||
      suggestion.confidence < FIELD_REPAIR_AUTO_ACCEPT_CONFIDENCE_THRESHOLD
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
