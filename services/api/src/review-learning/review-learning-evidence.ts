import { prisma } from "../lib/prisma.js";

export type PriorReviewLearningEvidenceStrength = "WEAK" | "MEDIUM" | "STRONG";

export type PriorReviewLearningEvidence = {
  fieldName: string;
  correctedValue: string | null;
  proposedValue: string | null;
  rawTextMatch: string | null;
  evidenceText: string | null;
  confidence: number;
  strength: PriorReviewLearningEvidenceStrength;
  reasonCodes: string[];
  summary: string;
  learningEventId: string;
  createdAt: string;
};

export type PriorReviewLearningEvidenceInput = {
  rawText: string;
  parsedFields?: {
    brand?: string | null;
    productLine?: string | null;
    category?: string | null;
    shaftFlex?: string | null;
    conditionGrade?: string | null;
    storeId?: string | null;
  };
  sourceType?: string | null | undefined;
  excludeWorkflowRunId?: string | null;
  limit?: number;
};

type HumanReviewLearningEventLike = {
  id: string;
  workflowRunId: string | null;
  fieldName: string;
  rawTextMatch: string | null;
  proposedValue: string | null;
  correctedValue: string | null;
  evidenceText: string | null;
  createdAt: Date | string;
};

type FieldScore = {
  confidence: number;
  reasonCodes: string[];
};

const FIELD_LABELS: Record<string, string> = {
  brand: "brand",
  productLine: "productLine",
  category: "category",
  shaftFlex: "shaftFlex",
  conditionGrade: "conditionGrade",
  demoValue: "tradeInValue",
  tradeInValue: "tradeInValue",
  storeId: "storeId"
};

const CATEGORY_PATTERNS = [
  {
    category: "IRON_SET",
    pattern: /\b(?:[3-9]\s*-\s*(?:pw|gw|sw)|irons?|iron\s+set)\b/i,
    reasonCode: "CATEGORY_SET_COMPOSITION_MATCH"
  },
  {
    category: "FAIRWAY_WOOD",
    pattern: /\b(?:[357]\s*w|fairway|fw)\b/i,
    reasonCode: "CATEGORY_FAIRWAY_TOKEN_MATCH"
  },
  {
    category: "DRIVER",
    pattern: /\b(?:driver|drv|1\s*w)\b/i,
    reasonCode: "CATEGORY_DRIVER_TOKEN_MATCH"
  },
  {
    category: "HYBRID",
    pattern: /\b(?:hybrid|hy|rescue)\b/i,
    reasonCode: "CATEGORY_HYBRID_TOKEN_MATCH"
  },
  {
    category: "WEDGE",
    pattern: /\b(?:wedge|gw|sw|lw|(?:5[02468]|6[024])\s*(?:deg|degree)?)\b/i,
    reasonCode: "CATEGORY_WEDGE_TOKEN_MATCH"
  },
  {
    category: "PUTTER",
    pattern: /\b(?:putter|pt)\b/i,
    reasonCode: "CATEGORY_PUTTER_TOKEN_MATCH"
  }
];

function normalizePhrase(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compact(value: unknown) {
  return normalizePhrase(value).replace(/\s+/g, "");
}

function tokenSet(value: unknown) {
  return new Set(normalizePhrase(value).split(" ").filter(Boolean));
}

function containsCompactPhrase(text: string, phrase: string | null) {
  const normalizedPhrase = compact(phrase);

  return normalizedPhrase.length >= 2 && compact(text).includes(normalizedPhrase);
}

function normalizeConditionPhrase(value: unknown) {
  return normalizePhrase(value)
    .replace(/\bcond\b/g, "condition")
    .replace(/\bavg\b/g, "average")
    .replace(/\bba\b/g, "below average")
    .replace(/\baa\b/g, "above average");
}

function containsConditionPhrase(text: string, phrase: string | null) {
  const normalizedPhrase = compact(normalizeConditionPhrase(phrase));

  return (
    normalizedPhrase.length >= 2 &&
    compact(normalizeConditionPhrase(text)).includes(normalizedPhrase)
  );
}

function hasShaftFlexAnchor(value: unknown) {
  return /\b(?:shaft|flex|stf|stiff|regular|reg|senior|lite|ladies|women|x\s*stiff|x\s*flex|tour\s*x|s\s*flex|r\s*flex|l\s*flex|sr|x|s|r|l)\b/i.test(
    normalizePhrase(value)
  );
}

function hasConditionGradeAnchor(value: unknown) {
  return /\b(?:cond|condition|avg|average|below\s*avg|below\s*average|ba|above\s*avg|above\s*average|aa|mint|poor|9\.5|9\.0|8\.0|7\.0|6\.0|9|8|7|6)\b/i.test(
    normalizePhrase(value)
  );
}

function countTokenOverlap(left: unknown, right: unknown) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  let overlap = 0;

  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  });

  return overlap;
}

function hasSameCategoryPattern(inputText: string, evidenceText: string, correctedValue: string | null) {
  return CATEGORY_PATTERNS.some((categoryPattern) => {
    if (correctedValue && categoryPattern.category !== correctedValue) {
      return false;
    }

    return categoryPattern.pattern.test(inputText) && categoryPattern.pattern.test(evidenceText);
  });
}

function categoryReasonCode(inputText: string, correctedValue: string | null) {
  return CATEGORY_PATTERNS.find(
    (categoryPattern) =>
      (!correctedValue || categoryPattern.category === correctedValue) &&
      categoryPattern.pattern.test(inputText)
  )?.reasonCode;
}

function hasNumericValueMatch(
  inputText: string,
  rawTextMatch: string | null,
  correctedValue: string | null
) {
  const rawNumbers: string[] = normalizePhrase(rawTextMatch).match(/\d+/g) ?? [];
  const correctedNumbers: string[] =
    normalizePhrase(correctedValue).match(/\d+/g) ?? [];
  const inputNumbers: string[] = normalizePhrase(inputText).match(/\d+/g) ?? [];

  return [...rawNumbers, ...correctedNumbers].some((value) =>
    inputNumbers.includes(value)
  );
}

function scoreRawTextParsingField(input: {
  fieldName: string;
  inputText: string;
  event: HumanReviewLearningEventLike;
  fieldReasonCode: string;
}): FieldScore {
  const reasonCodes: string[] = [];

  if (input.fieldName === "shaftFlex") {
    const rawAnchorIsFlexSpecific = hasShaftFlexAnchor(input.event.rawTextMatch);
    const inputHasFlexText = hasShaftFlexAnchor(input.inputText);

    if (!rawAnchorIsFlexSpecific || !inputHasFlexText) {
      return {
        confidence: 0,
        reasonCodes: ["SHAFT_FLEX_REQUIRES_RAW_FLEX_TEXT"]
      };
    }
  }

  if (input.fieldName === "conditionGrade") {
    const rawAnchorIsConditionSpecific = hasConditionGradeAnchor(
      input.event.rawTextMatch
    );
    const inputHasConditionText = hasConditionGradeAnchor(input.inputText);

    if (!rawAnchorIsConditionSpecific || !inputHasConditionText) {
      return {
        confidence: 0,
        reasonCodes: ["CONDITION_GRADE_REQUIRES_RAW_CONDITION_TEXT"]
      };
    }
  }

  const evidencePhraseMatched =
    input.fieldName === "conditionGrade"
      ? containsConditionPhrase(input.inputText, input.event.rawTextMatch)
      : containsCompactPhrase(input.inputText, input.event.rawTextMatch);
  const evidenceTextMatched =
    input.fieldName === "conditionGrade"
      ? containsConditionPhrase(input.inputText, input.event.evidenceText)
      : containsCompactPhrase(input.inputText, input.event.evidenceText);

  if (evidencePhraseMatched) {
    reasonCodes.push("RAW_TEXT_MATCH", input.fieldReasonCode);
  }

  if (evidenceTextMatched) {
    reasonCodes.push("EVIDENCE_TEXT_MATCH", input.fieldReasonCode);
  }

  if (
    input.fieldName === "conditionGrade" &&
    /\b(?:cond|condition)\b/i.test(input.inputText)
  ) {
    reasonCodes.push("CONDITION_CONTEXT_MATCH");
  }

  if (
    input.fieldName === "shaftFlex" &&
    /\b(?:shaft|flex|stf|stiff|regular|senior|ladies|x)\b/i.test(
      input.inputText
    )
  ) {
    reasonCodes.push("SHAFT_FLEX_CONTEXT_MATCH");
  }

  if (evidencePhraseMatched) {
    return {
      confidence: reasonCodes.length > 2 ? 0.94 : 0.9,
      reasonCodes
    };
  }

  if (evidenceTextMatched) {
    return {
      confidence: 0.78,
      reasonCodes
    };
  }

  return {
    confidence: 0,
    reasonCodes
  };
}

function scoreBrandField(input: {
  inputText: string;
  parsedFields: PriorReviewLearningEvidenceInput["parsedFields"];
  event: HumanReviewLearningEventLike;
}): FieldScore {
  const reasonCodes: string[] = [];
  const rawAliasMatched = containsCompactPhrase(input.inputText, input.event.rawTextMatch);
  const correctedValueMatched = containsCompactPhrase(input.inputText, input.event.correctedValue);
  const productContextOverlap = countTokenOverlap(
    input.parsedFields?.productLine,
    input.event.evidenceText ?? input.event.rawTextMatch
  );

  if (rawAliasMatched) {
    reasonCodes.push("BRAND_ALIAS_MATCH", "RAW_TEXT_MATCH");
  }

  if (correctedValueMatched) {
    reasonCodes.push("CORRECTED_BRAND_TEXT_MATCH");
  }

  if (productContextOverlap > 0) {
    reasonCodes.push("PRODUCT_CONTEXT_SUPPORT");
  }

  if (rawAliasMatched) {
    return {
      confidence: productContextOverlap > 0 ? 0.9 : 0.84,
      reasonCodes
    };
  }

  if (correctedValueMatched && productContextOverlap > 0) {
    return {
      confidence: 0.74,
      reasonCodes
    };
  }

  return {
    confidence: 0,
    reasonCodes
  };
}

function scoreProductLineField(input: {
  inputText: string;
  parsedFields: PriorReviewLearningEvidenceInput["parsedFields"];
  event: HumanReviewLearningEventLike;
}): FieldScore {
  const reasonCodes: string[] = [];
  const rawModelMatched = containsCompactPhrase(input.inputText, input.event.rawTextMatch);
  const correctedModelMatched = containsCompactPhrase(input.inputText, input.event.correctedValue);
  const brandSupport = countTokenOverlap(
    input.parsedFields?.brand,
    `${input.event.evidenceText ?? ""} ${input.event.rawTextMatch ?? ""}`
  );
  const categorySupport = input.parsedFields?.category
    ? containsCompactPhrase(`${input.event.evidenceText ?? ""} ${input.event.rawTextMatch ?? ""}`, input.parsedFields.category)
    : false;

  if (rawModelMatched) {
    reasonCodes.push("PRODUCT_ALIAS_MATCH", "RAW_TEXT_MATCH");
  }

  if (correctedModelMatched) {
    reasonCodes.push("CORRECTED_PRODUCT_TEXT_MATCH");
  }

  if (brandSupport > 0) {
    reasonCodes.push("BRAND_CONTEXT_SUPPORT");
  }

  if (categorySupport) {
    reasonCodes.push("CATEGORY_CONTEXT_SUPPORT");
  }

  if (rawModelMatched) {
    return {
      confidence: brandSupport > 0 || categorySupport ? 0.92 : 0.86,
      reasonCodes
    };
  }

  if (correctedModelMatched && brandSupport > 0) {
    return {
      confidence: 0.76,
      reasonCodes
    };
  }

  return {
    confidence: 0,
    reasonCodes
  };
}

function scoreCategoryField(input: {
  inputText: string;
  parsedFields: PriorReviewLearningEvidenceInput["parsedFields"];
  event: HumanReviewLearningEventLike;
}): FieldScore {
  const reasonCodes: string[] = [];
  const evidenceText = `${input.event.rawTextMatch ?? ""} ${input.event.evidenceText ?? ""}`;
  const rawCategoryMatched = containsCompactPhrase(input.inputText, input.event.rawTextMatch);
  const samePatternMatched = hasSameCategoryPattern(
    input.inputText,
    evidenceText,
    input.event.correctedValue
  );
  const matchedPatternReason = categoryReasonCode(input.inputText, input.event.correctedValue);
  const productTokenSupport = countTokenOverlap(input.parsedFields?.productLine, evidenceText);

  if (rawCategoryMatched) {
    reasonCodes.push("CATEGORY_RAW_TEXT_MATCH", "RAW_TEXT_MATCH");
  }

  if (samePatternMatched) {
    reasonCodes.push(matchedPatternReason ?? "CATEGORY_PATTERN_MATCH");
  }

  if (productTokenSupport > 0) {
    reasonCodes.push("PRODUCT_LINE_CONTEXT_SUPPORT");
  }

  if (samePatternMatched) {
    return {
      confidence: productTokenSupport > 0 ? 0.92 : 0.87,
      reasonCodes
    };
  }

  if (rawCategoryMatched) {
    return {
      confidence: 0.84,
      reasonCodes
    };
  }

  return {
    confidence: 0,
    reasonCodes
  };
}

function scoreTradeValueField(input: {
  inputText: string;
  event: HumanReviewLearningEventLike;
}): FieldScore {
  if (!hasNumericValueMatch(input.inputText, input.event.rawTextMatch, input.event.correctedValue)) {
    return {
      confidence: 0,
      reasonCodes: []
    };
  }

  return {
    confidence: 0.76,
    reasonCodes: ["EXPLICIT_NUMERIC_VALUE_MATCH", "EVIDENCE_ONLY_VALUE_FIELD"]
  };
}

function scoreStoreField(input: {
  inputText: string;
  event: HumanReviewLearningEventLike;
  sourceType?: string | null | undefined;
}): FieldScore {
  const reasonCodes: string[] = [];
  const rawStoreMatched = containsCompactPhrase(input.inputText, input.event.rawTextMatch);
  const sourceContextMatched =
    input.sourceType && containsCompactPhrase(input.event.evidenceText ?? "", input.sourceType);

  if (rawStoreMatched) {
    reasonCodes.push("STORE_LOCATION_TOKEN_MATCH", "RAW_TEXT_MATCH");
  }

  if (sourceContextMatched) {
    reasonCodes.push("SOURCE_TYPE_CONTEXT_SUPPORT");
  }

  if (rawStoreMatched) {
    return {
      confidence: sourceContextMatched ? 0.88 : 0.82,
      reasonCodes
    };
  }

  return {
    confidence: 0,
    reasonCodes
  };
}

function scoreLearningEvent(input: {
  rawText: string;
  parsedFields?: PriorReviewLearningEvidenceInput["parsedFields"];
  sourceType?: string | null | undefined;
  event: HumanReviewLearningEventLike;
}): FieldScore {
  const fieldName = FIELD_LABELS[input.event.fieldName] ?? input.event.fieldName;

  if (fieldName === "reviewNeeded" || fieldName === "missingFields") {
    return {
      confidence: 0,
      reasonCodes: ["DERIVED_FIELD_NOT_REUSED"]
    };
  }

  if (fieldName === "shaftFlex") {
    return scoreRawTextParsingField({
      fieldName,
      inputText: input.rawText,
      event: input.event,
      fieldReasonCode: "SHAFT_FLEX_RAW_TOKEN_MATCH"
    });
  }

  if (fieldName === "conditionGrade") {
    return scoreRawTextParsingField({
      fieldName,
      inputText: input.rawText,
      event: input.event,
      fieldReasonCode: "CONDITION_GRADE_RAW_TOKEN_MATCH"
    });
  }

  if (fieldName === "category") {
    return scoreCategoryField({
      inputText: input.rawText,
      parsedFields: input.parsedFields,
      event: input.event
    });
  }

  if (fieldName === "productLine") {
    return scoreProductLineField({
      inputText: input.rawText,
      parsedFields: input.parsedFields,
      event: input.event
    });
  }

  if (fieldName === "brand") {
    return scoreBrandField({
      inputText: input.rawText,
      parsedFields: input.parsedFields,
      event: input.event
    });
  }

  if (fieldName === "tradeInValue" || fieldName === "demoValue") {
    return scoreTradeValueField({
      inputText: input.rawText,
      event: input.event
    });
  }

  if (fieldName === "storeId") {
    return scoreStoreField({
      inputText: input.rawText,
      event: input.event,
      sourceType: input.sourceType ?? null
    });
  }

  return {
    confidence: 0,
    reasonCodes: ["UNSUPPORTED_FIELD"]
  };
}

function strengthForConfidence(confidence: number): PriorReviewLearningEvidenceStrength {
  if (confidence >= 0.85) {
    return "STRONG";
  }

  if (confidence >= 0.7) {
    return "MEDIUM";
  }

  return "WEAK";
}

function fieldSummaryLabel(fieldName: string) {
  return FIELD_LABELS[fieldName] ?? fieldName;
}

function buildSummary(event: HumanReviewLearningEventLike, confidence: number) {
  const fieldName = fieldSummaryLabel(event.fieldName);
  const correctedValue = event.correctedValue ?? "the reviewed value";
  const rawTextMatch = event.rawTextMatch?.trim();

  if (rawTextMatch) {
    return `Prior review evidence suggested ${fieldName} = ${correctedValue} from similar raw text: ${rawTextMatch}.`;
  }

  return `Prior review evidence found for ${fieldName}.`;
}

export function findMatchingEvidenceFromEvents(input: {
  rawText: string;
  parsedFields?: PriorReviewLearningEvidenceInput["parsedFields"];
  sourceType?: string | null | undefined;
  events: HumanReviewLearningEventLike[];
}): PriorReviewLearningEvidence[] {
  return input.events
    .map((event) => {
      const score = scoreLearningEvent({
        rawText: input.rawText,
        parsedFields: input.parsedFields,
        sourceType: input.sourceType ?? null,
        event
      });

      return {
        event,
        score
      };
    })
    .filter(({ score }) => score.confidence >= 0.7)
    .map(({ event, score }) => ({
      fieldName: fieldSummaryLabel(event.fieldName),
      correctedValue: event.correctedValue ?? null,
      proposedValue: event.proposedValue ?? null,
      rawTextMatch: event.rawTextMatch ?? null,
      evidenceText: event.evidenceText ?? null,
      confidence: Number(score.confidence.toFixed(2)),
      strength: strengthForConfidence(score.confidence),
      reasonCodes: score.reasonCodes,
      summary: buildSummary(event, score.confidence),
      learningEventId: event.id,
      createdAt:
        event.createdAt instanceof Date
          ? event.createdAt.toISOString()
          : event.createdAt
    }))
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 5);
}

export async function findPriorReviewLearningEvidence(
  input: PriorReviewLearningEvidenceInput
): Promise<PriorReviewLearningEvidence[]> {
  const events = await prisma.humanReviewLearningEvent.findMany({
    where: {
      ...(input.excludeWorkflowRunId
        ? {
            NOT: {
              workflowRunId: input.excludeWorkflowRunId
            }
          }
        : {})
    },
    orderBy: {
      createdAt: "desc"
    },
    take: input.limit ?? 100
  });

  return findMatchingEvidenceFromEvents({
    rawText: input.rawText,
    parsedFields: input.parsedFields,
    sourceType: input.sourceType ?? null,
    events
  });
}


export type ReviewLearningApplicableParsedItem = {
  shaftFlex: string | null;
  missingFields: string[];
  confidence: number;
  uncertaintyNotes: string[];
};

function normalizeShaftFlexCorrection(value: string | null | undefined) {
  const normalizedValue = value
    ?.trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue === "TOUR_X" || normalizedValue === "TOUR_X_STIFF") {
    return "TOUR_X_STIFF";
  }

  if (normalizedValue === "X" || normalizedValue === "X_STIFF" || normalizedValue === "X_FLEX") {
    return "X_STIFF";
  }

  if (normalizedValue === "STIFF" || normalizedValue === "S" || normalizedValue === "S_FLEX") {
    return "STIFF";
  }

  if (normalizedValue === "REGULAR" || normalizedValue === "REG" || normalizedValue === "R" || normalizedValue === "R_FLEX") {
    return "REGULAR";
  }

  if (normalizedValue === "SENIOR" || normalizedValue === "SR" || normalizedValue === "A" || normalizedValue === "A_FLEX") {
    return "SENIOR";
  }

  if (normalizedValue === "LADIES" || normalizedValue === "LADY" || normalizedValue === "L" || normalizedValue === "L_FLEX") {
    return "LADIES";
  }

  return null;
}

export function applyPriorReviewLearningEvidenceToParsedItem<T extends ReviewLearningApplicableParsedItem>(
  item: T,
  evidence: PriorReviewLearningEvidence[],
): T {
  const shaftFlexEvidence = evidence.find(
    (event) =>
      event.fieldName === "shaftFlex" &&
      event.confidence >= 0.7 &&
      event.strength !== "WEAK" &&
      Boolean(event.rawTextMatch) &&
      Boolean(normalizeShaftFlexCorrection(event.correctedValue)),
  );

  if (!item.shaftFlex && shaftFlexEvidence) {
    const correctedShaftFlex = normalizeShaftFlexCorrection(
      shaftFlexEvidence.correctedValue,
    );

    if (correctedShaftFlex) {
      item.shaftFlex = correctedShaftFlex;
      item.missingFields = item.missingFields.filter(
        (fieldName) => fieldName !== "shaftFlex",
      );
      item.confidence = Math.min(0.99, Number((item.confidence + 0.08).toFixed(2)));
      item.uncertaintyNotes = [
        ...item.uncertaintyNotes,
        `Applied prior human review evidence for shaftFlex from source text "${shaftFlexEvidence.rawTextMatch}".`,
      ];
    }
  }

  return item;
}
