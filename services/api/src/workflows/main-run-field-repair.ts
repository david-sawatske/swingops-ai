import { z } from "zod";

export const MAIN_RUN_FIELD_REPAIR_POLICY_KEY = "MAIN_RUN_FIELD_REPAIR";
export const MAIN_RUN_FIELD_REPAIR_AGENT_NAME = "main-run-field-repair-agent";
export const MAIN_RUN_FIELD_REPAIR_TASK_TYPE = "FIELD_NORMALIZATION" as const;
export const FIELD_REPAIR_AUTO_ACCEPT_CONFIDENCE_THRESHOLD = 0.85;

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

export const fieldRepairOutputSchema = z
  .object({
    suggestions: z.array(fieldRepairSuggestionSchema)
  })
  .strict();

export type FieldRepairFieldName = z.infer<typeof fieldRepairFieldNameSchema>;
export type FieldRepairSuggestion = z.infer<typeof fieldRepairSuggestionSchema>;
export type FieldRepairOutput = z.infer<typeof fieldRepairOutputSchema>;

export type MainRunFieldRepairRecordInput = {
  recordId: string;
  sourceText: string;
  missingFields: string[];
  confidence: number;
  currentFields: Partial<Record<FieldRepairFieldName, string | number | null>>;
  parserEvidence?: unknown;
};

export type BuildMainRunFieldRepairExecutionInput = {
  workflowRunId: string;
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
      jsonValid: false;
      validationPassed: false;
      output: null;
      validationErrors: string[];
    };

export function buildMainRunFieldRepairExecutionInput(
  input: BuildMainRunFieldRepairExecutionInput
): Record<string, unknown> {
  return {
    policyKey: MAIN_RUN_FIELD_REPAIR_POLICY_KEY,
    agentName: MAIN_RUN_FIELD_REPAIR_AGENT_NAME,
    workflowRunId: input.workflowRunId,
    records: input.records.map((record) => ({
      recordId: record.recordId,
      sourceText: record.sourceText,
      missingFields: record.missingFields,
      confidence: record.confidence,
      currentFields: record.currentFields,
      parserEvidence: record.parserEvidence ?? null
    })),
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
        sourcePhrase: "condition avg",
        fieldName: "conditionGrade",
        candidateValue: "8.0 Average"
      }
    ],
    outputContract: {
      suggestions: [
        {
          recordId: "source record id",
          fieldName: "one supported field name",
          sourcePhrase: "exact source phrase that supports the suggestion",
          candidateValue:
            "approved normalized value only. Do not return abbreviations like S or free-text values like Average.",
          confidence: "number from 0 to 1",
          reason: "brief evidence-based reason",
          reviewRequired: "boolean"
        }
      ]
    },
    validationRules: [
      "Return JSON only.",
      "Only suggest fields supported by source evidence.",
      "Every suggestion must include a non-empty sourcePhrase.",
      "For shaftFlex, candidateValue must be one of LADIES, SENIOR, REGULAR, STIFF, X_STIFF, TOUR_X_STIFF.",
      "For conditionGrade, candidateValue must be one of 9.5 Mint, 9.0 Above Average, 8.0 Average, 7.0 Below Average, 6.0 Poor.",
      "For category, candidateValue must be one of DRIVER, FAIRWAY_WOOD, HYBRID, IRON_SET, WEDGE, PUTTER.",
      "For tradeInValue, candidateValue must be a number.",
      "Low-confidence suggestions must keep reviewRequired true.",
      "Do not invent missing fields without evidence."
    ]
  };
}

export function validateMainRunFieldRepairModelOutput(
  outputJson: Record<string, unknown> | null
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

  return {
    jsonValid: true,
    validationPassed: true,
    output: {
      suggestions: parsedOutput.data.suggestions.map(
        normalizeSuggestionReviewRequirement
      )
    },
    validationErrors: []
  };
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
