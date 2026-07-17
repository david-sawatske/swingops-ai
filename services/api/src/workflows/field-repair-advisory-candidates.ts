import type {
  PriorReviewLearningSuggestion
} from "../review-learning/review-learning-evidence.js";

import {
  getFieldRepairSuggestionMatrixValidationErrors
} from "./golf-term-normalization.js";
import {
  fieldRepairSuggestionSchema,
  type FieldRepairFieldName,
  type FieldRepairSuggestion
} from "./main-run-field-repair.js";

export type MainRunFieldRepairAdvisoryCandidateSource =
  "PRIOR_REVIEW";

export type MainRunFieldRepairAdvisoryCandidate = {
  candidateId: string;
  sourceType: MainRunFieldRepairAdvisoryCandidateSource;
  sourceEvidenceId: string;
  sourceReferenceId: string;
  suggestion: FieldRepairSuggestion;
};

export type BuildPriorReviewFieldRepairAdvisoryCandidatesInput = {
  recordId: string;
  sourceText: string;
  missingFields: string[];
  fieldApplicability: {
    shaftFlex: "REQUIRED" | "NOT_APPLICABLE";
  };
  productResolutionStatus:
    | "MATCHED"
    | "AMBIGUOUS"
    | "UNRESOLVED";
  sourceEvidenceId: string;
  priorReviewSuggestions: PriorReviewLearningSuggestion[];
};

const SUPPORTED_FIELD_NAMES = new Set<FieldRepairFieldName>([
  "brand",
  "productLine",
  "category",
  "shaftFlex",
  "conditionGrade",
  "tradeInValue"
]);

const PRODUCT_IDENTITY_FIELDS = new Set<FieldRepairFieldName>([
  "brand",
  "productLine",
  "category"
]);

const FIELD_SORT_ORDER: Record<FieldRepairFieldName, number> = {
  brand: 0,
  productLine: 1,
  category: 2,
  shaftFlex: 3,
  conditionGrade: 4,
  tradeInValue: 5
};

const SHAFT_FLEX_VALUE_BY_NORMALIZED_TEXT: Record<
  string,
  string
> = {
  LADIES: "LADIES",
  LADY: "LADIES",
  WOMEN: "LADIES",
  WOMENS: "LADIES",
  SENIOR: "SENIOR",
  SR: "SENIOR",
  A: "SENIOR",
  REGULAR: "REGULAR",
  REG: "REGULAR",
  R: "REGULAR",
  STIFF: "STIFF",
  STF: "STIFF",
  S: "STIFF",
  X_STIFF: "X_STIFF",
  XSTIFF: "X_STIFF",
  X: "X_STIFF",
  TOUR_X_STIFF: "TOUR_X_STIFF",
  TOURXSTIFF: "TOUR_X_STIFF",
  TX: "TOUR_X_STIFF"
};

const CATEGORY_VALUE_BY_NORMALIZED_TEXT: Record<
  string,
  string
> = {
  DRIVER: "DRIVER",
  FAIRWAY_WOOD: "FAIRWAY_WOOD",
  FAIRWAYWOOD: "FAIRWAY_WOOD",
  HYBRID: "HYBRID",
  IRON_SET: "IRON_SET",
  IRONSET: "IRON_SET",
  WEDGE: "WEDGE",
  PUTTER: "PUTTER"
};

const CONDITION_VALUE_BY_NORMALIZED_TEXT: Record<
  string,
  string
> = {
  "9.5 MINT": "9.5 Mint",
  "9.5": "9.5 Mint",
  MINT: "9.5 Mint",
  "9.0 ABOVE AVERAGE": "9.0 Above Average",
  "9.0": "9.0 Above Average",
  "8.0 AVERAGE": "8.0 Average",
  "8.0": "8.0 Average",
  "7.0 BELOW AVERAGE": "7.0 Below Average",
  "7.0": "7.0 Below Average",
  "6.0 POOR": "6.0 Poor",
  "6.0": "6.0 Poor",
  POOR: "6.0 Poor"
};

export function buildPriorReviewFieldRepairAdvisoryCandidates(
  input: BuildPriorReviewFieldRepairAdvisoryCandidatesInput
): MainRunFieldRepairAdvisoryCandidate[] {
  if (
    input.productResolutionStatus === "AMBIGUOUS" ||
    input.sourceEvidenceId.trim().length === 0
  ) {
    return [];
  }

  const validCandidates =
    input.priorReviewSuggestions.flatMap((priorSuggestion) => {
      const candidate = buildPriorReviewCandidate({
        input,
        priorSuggestion
      });

      return candidate ? [candidate] : [];
    });

  return withholdConflictingFieldCandidates(validCandidates).sort(
    (left, right) =>
      FIELD_SORT_ORDER[left.suggestion.fieldName] -
        FIELD_SORT_ORDER[right.suggestion.fieldName] ||
      left.candidateId.localeCompare(right.candidateId)
  );
}

function buildPriorReviewCandidate(input: {
  input: BuildPriorReviewFieldRepairAdvisoryCandidatesInput;
  priorSuggestion: PriorReviewLearningSuggestion;
}): MainRunFieldRepairAdvisoryCandidate | null {
  const priorSuggestion = input.priorSuggestion;

  if (
    priorSuggestion.status !== "SUGGESTED" ||
    priorSuggestion.strength !== "STRONG" ||
    priorSuggestion.confidence < 0.85 ||
    !isSupportedFieldName(priorSuggestion.fieldName) ||
    !input.input.missingFields.includes(
      priorSuggestion.fieldName
    )
  ) {
    return null;
  }

  if (
    input.input.productResolutionStatus === "MATCHED" &&
    PRODUCT_IDENTITY_FIELDS.has(priorSuggestion.fieldName)
  ) {
    return null;
  }

  if (
    priorSuggestion.fieldName === "shaftFlex" &&
    input.input.fieldApplicability.shaftFlex ===
      "NOT_APPLICABLE"
  ) {
    return null;
  }

  const sourcePhrase = findExactSourcePhrase(
    input.input.sourceText,
    priorSuggestion.rawTextMatch
  );
  const candidateValue = normalizeCandidateValue({
    fieldName: priorSuggestion.fieldName,
    value: priorSuggestion.suggestedValue
  });

  if (sourcePhrase === null || candidateValue === null) {
    return null;
  }

  const parsedSuggestion = fieldRepairSuggestionSchema.safeParse({
    recordId: input.input.recordId,
    fieldName: priorSuggestion.fieldName,
    sourcePhrase,
    candidateValue,
    confidence: priorSuggestion.confidence,
    reason: priorSuggestion.whySuggestionExists,
    reviewRequired: true
  });

  if (!parsedSuggestion.success) {
    return null;
  }

  if (
    getFieldRepairSuggestionMatrixValidationErrors(
      parsedSuggestion.data
    ).length > 0
  ) {
    return null;
  }

  return {
    candidateId:
      `prior-review:${priorSuggestion.sourceLearningEventId}:` +
      priorSuggestion.fieldName,
    sourceType: "PRIOR_REVIEW",
    sourceEvidenceId: input.input.sourceEvidenceId,
    sourceReferenceId:
      priorSuggestion.sourceLearningEventId,
    suggestion: parsedSuggestion.data
  };
}

function withholdConflictingFieldCandidates(
  candidates: MainRunFieldRepairAdvisoryCandidate[]
): MainRunFieldRepairAdvisoryCandidate[] {
  const candidatesByField = new Map<
    FieldRepairFieldName,
    MainRunFieldRepairAdvisoryCandidate[]
  >();

  for (const candidate of candidates) {
    const fieldCandidates =
      candidatesByField.get(
        candidate.suggestion.fieldName
      ) ?? [];

    fieldCandidates.push(candidate);
    candidatesByField.set(
      candidate.suggestion.fieldName,
      fieldCandidates
    );
  }

  const acceptedCandidates:
    MainRunFieldRepairAdvisoryCandidate[] = [];

  for (const fieldCandidates of candidatesByField.values()) {
    const candidateValueKeys = new Set(
      fieldCandidates.map((candidate) =>
        getCandidateValueKey(
          candidate.suggestion.candidateValue
        )
      )
    );

    if (candidateValueKeys.size !== 1) {
      continue;
    }

    const strongestCandidate = [...fieldCandidates].sort(
      (left, right) =>
        right.suggestion.confidence -
          left.suggestion.confidence ||
        left.candidateId.localeCompare(right.candidateId)
    )[0];

    if (strongestCandidate) {
      acceptedCandidates.push(strongestCandidate);
    }
  }

  return acceptedCandidates;
}

function normalizeCandidateValue(input: {
  fieldName: FieldRepairFieldName;
  value: string | null;
}): string | number | null {
  const trimmedValue = input.value?.trim();

  if (!trimmedValue) {
    return null;
  }

  if (
    input.fieldName === "brand" ||
    input.fieldName === "productLine"
  ) {
    return trimmedValue;
  }

  if (input.fieldName === "tradeInValue") {
    const numericText = trimmedValue.replace(
      /[$,\s]/g,
      ""
    );

    if (!/^\d+(?:\.\d+)?$/.test(numericText)) {
      return null;
    }

    const numericValue = Number(numericText);

    return Number.isFinite(numericValue) &&
      numericValue >= 0
      ? numericValue
      : null;
  }

  if (input.fieldName === "shaftFlex") {
    const normalizedValue = trimmedValue
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    return (
      SHAFT_FLEX_VALUE_BY_NORMALIZED_TEXT[
        normalizedValue
      ] ?? null
    );
  }

  if (input.fieldName === "category") {
    const normalizedValue = trimmedValue
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    return (
      CATEGORY_VALUE_BY_NORMALIZED_TEXT[
        normalizedValue
      ] ?? null
    );
  }

  const normalizedValue = trimmedValue
    .toUpperCase()
    .replace(/\s+/g, " ");

  return (
    CONDITION_VALUE_BY_NORMALIZED_TEXT[
      normalizedValue
    ] ?? null
  );
}

function findExactSourcePhrase(
  sourceText: string,
  rawTextMatch: string | null
): string | null {
  const trimmedPhrase = rawTextMatch?.trim();

  if (!trimmedPhrase) {
    return null;
  }

  const matchIndex = sourceText
    .toLowerCase()
    .indexOf(trimmedPhrase.toLowerCase());

  if (matchIndex < 0) {
    return null;
  }

  return sourceText.slice(
    matchIndex,
    matchIndex + trimmedPhrase.length
  );
}

function getCandidateValueKey(
  value: string | number
): string {
  return typeof value === "number"
    ? `number:${value}`
    : `string:${value}`;
}

function isSupportedFieldName(
  value: string
): value is FieldRepairFieldName {
  return SUPPORTED_FIELD_NAMES.has(
    value as FieldRepairFieldName
  );
}
