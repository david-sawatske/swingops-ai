export type GolfTermNormalizationField =
  | "shaftFlex"
  | "category"
  | "conditionGrade"
  | "tradeInValue";

export type GolfTermNormalizationAction =
  | "NORMALIZE"
  | "BLOCK_REPAIR"
  | "ROUTE_TO_REVIEW";

export type GolfTermNormalizationEntry = {
  id: string;
  field: GolfTermNormalizationField;
  aliases: string[];
  canonicalValue: string | number | null;
  action: GolfTermNormalizationAction;
  requiresContext: boolean;
  notes: string;
};

export type FieldRepairSuggestionForNormalization = {
  fieldName: string;
  sourcePhrase: string;
  candidateValue: string | number;
};

export const GOLF_TERM_NORMALIZATION_MATRIX: GolfTermNormalizationEntry[] = [
  {
    id: "shaft-regular",
    field: "shaftFlex",
    aliases: ["R", "reg", "regular", "r flex", "reg flex", "shaft regular"],
    canonicalValue: "REGULAR",
    action: "NORMALIZE",
    requiresContext: true,
    notes:
      "Single-letter R is accepted only when source context clearly identifies shaft flex evidence."
  },
  {
    id: "shaft-stiff",
    field: "shaftFlex",
    aliases: ["S", "stf", "stiff", "s flex", "shaft stiff"],
    canonicalValue: "STIFF",
    action: "NORMALIZE",
    requiresContext: true,
    notes: "Stiff aliases must be shaft-flex evidence, not unrelated text."
  },
  {
    id: "shaft-x-stiff",
    field: "shaftFlex",
    aliases: ["X", "x-stiff", "x stiff", "x flex", "shaft x-stiff"],
    canonicalValue: "X_STIFF",
    action: "NORMALIZE",
    requiresContext: true,
    notes: "X aliases must be shaft-flex evidence."
  },
  {
    id: "shaft-tour-x-stiff",
    field: "shaftFlex",
    aliases: ["TX", "tour x", "tour x-stiff", "tour x stiff", "tx flex"],
    canonicalValue: "TOUR_X_STIFF",
    action: "NORMALIZE",
    requiresContext: true,
    notes: "Tour X-Stiff is an approved project value for review-facing normalized records."
  },
  {
    id: "shaft-senior",
    field: "shaftFlex",
    aliases: ["Senior", "senior flex", "sr flex", "a flex"],
    canonicalValue: "SENIOR",
    action: "NORMALIZE",
    requiresContext: true,
    notes: "Senior aliases are accepted when used as shaft-flex evidence."
  },
  {
    id: "shaft-ladies",
    field: "shaftFlex",
    aliases: ["Ladies", "Lady", "ladies flex", "lady flex", "l flex"],
    canonicalValue: "LADIES",
    action: "NORMALIZE",
    requiresContext: true,
    notes: "Ladies aliases are accepted when used as shaft-flex evidence."
  },
  {
    id: "negative-evidence",
    field: "shaftFlex",
    aliases: ["unknown", "unclear", "pending", "not listed", "?", "tbd"],
    canonicalValue: null,
    action: "BLOCK_REPAIR",
    requiresContext: false,
    notes:
      "Negative evidence blocks model repair suggestions instead of forcing missing values into an enum."
  },
  {
    id: "category-driver",
    field: "category",
    aliases: ["driver", "drv", "dr", "1w"],
    canonicalValue: "DRIVER",
    action: "NORMALIZE",
    requiresContext: false,
    notes: "Driver aliases can map directly to DRIVER."
  },
  {
    id: "category-fairway",
    field: "category",
    aliases: ["3w", "5w", "7w", "9w", "fairway", "fairway wood", "fw"],
    canonicalValue: "FAIRWAY_WOOD",
    action: "NORMALIZE",
    requiresContext: false,
    notes: "Fairway wood aliases map to FAIRWAY_WOOD."
  },
  {
    id: "category-hybrid",
    field: "category",
    aliases: ["hybrid", "rescue", "hy"],
    canonicalValue: "HYBRID",
    action: "NORMALIZE",
    requiresContext: false,
    notes: "Hybrid and rescue terminology maps to HYBRID."
  },
  {
    id: "category-utility-wood",
    field: "category",
    aliases: ["utility", "utility wood", "UW", "Apex UW"],
    canonicalValue: null,
    action: "ROUTE_TO_REVIEW",
    requiresContext: false,
    notes:
      "Utility wood evidence is not wedge evidence. Route to review until a supported canonical category decision is explicit."
  },
  {
    id: "category-wedge",
    field: "category",
    aliases: ["wedge", "PW", "GW", "SW", "LW", "50", "52", "54", "56", "58", "60"],
    canonicalValue: "WEDGE",
    action: "NORMALIZE",
    requiresContext: true,
    notes:
      "Wedge loft aliases are limited to common wedge loft ranges and must not capture utility wood lofts such as 19 degree."
  },
  {
    id: "category-putter",
    field: "category",
    aliases: ["putter"],
    canonicalValue: "PUTTER",
    action: "NORMALIZE",
    requiresContext: false,
    notes: "Putter aliases map directly to PUTTER."
  },
  {
    id: "condition-approved-grades",
    field: "conditionGrade",
    aliases: [
      "9.5 Mint",
      "9.0 Above Average",
      "8.0 Average",
      "7.0 Below Average",
      "6.0 Poor",
      "cond avg",
      "condition avg",
      "condition mint",
      "condition poor"
    ],
    canonicalValue: null,
    action: "NORMALIZE",
    requiresContext: true,
    notes:
      "Only approved condition grade values are normalized. Free-text wear notes remain evidence, not condition values."
  },
  {
    id: "trade-value-negative-evidence",
    field: "tradeInValue",
    aliases: ["pending", "pending review", "tbd", "?", "not listed"],
    canonicalValue: null,
    action: "BLOCK_REPAIR",
    requiresContext: false,
    notes:
      "A pending or missing value phrase blocks numeric model repair unless source text includes an explicit amount."
  }
] as const;

const NEGATIVE_EVIDENCE_PATTERN =
  /\b(?:unknown|unclear|pending|not\s+listed|tbd|not\s+sure)\b|\?/i;

const UTILITY_WOOD_PATTERN = /\b(?:uw|utility\s*wood|utility)\b/i;
const SINGLE_R_FLEX_PATTERN = /\br\b/i;
const EXPLICIT_REGULAR_PATTERN =
  /\b(?:reg|regular)\b|\br\s*flex\b|\bshaft\b[^.,;|]*\br\b|\bflex\b[^.,;|]*\br\b/i;

export type DeterministicGolfTermAdvisoryMatch = {
  policyId: string;
  fieldName: "conditionGrade";
  sourcePhrase: string;
  candidateValue:
    | "9.5 Mint"
    | "9.0 Above Average"
    | "8.0 Average"
    | "7.0 Below Average"
    | "6.0 Poor";
  confidence: number;
  reason: string;
};

const CONDITION_GRADE_ADVISORY_POLICIES = [
  {
    policyId: "condition-context-mint",
    candidateValue: "9.5 Mint" as const,
    pattern:
      /\b(?:overall(?:\s+condition)?|cosmetics?|condition|cond)(?:\s+grade)?\s*(?:is|=|:)?\s*mint\b/gi
  },
  {
    policyId: "condition-context-above-average",
    candidateValue: "9.0 Above Average" as const,
    pattern:
      /\b(?:overall(?:\s+condition)?|cosmetics?|condition|cond)(?:\s+grade)?\s*(?:is|=|:)?\s*(?:above\s+(?:avg|average)|aa)\b/gi
  },
  {
    policyId: "condition-context-average",
    candidateValue: "8.0 Average" as const,
    pattern:
      /\b(?:overall(?:\s+condition)?|cosmetics?|condition|cond)(?:\s+grade)?\s*(?:is|=|:)?\s*(?:avg|average)\b/gi
  },
  {
    policyId: "condition-context-below-average",
    candidateValue: "7.0 Below Average" as const,
    pattern:
      /\b(?:overall(?:\s+condition)?|cosmetics?|condition|cond)(?:\s+grade)?\s*(?:is|=|:)?\s*(?:below\s+(?:avg|average)|ba)\b/gi
  },
  {
    policyId: "condition-context-poor",
    candidateValue: "6.0 Poor" as const,
    pattern:
      /\b(?:overall(?:\s+condition)?|cosmetics?|condition|cond)(?:\s+grade)?\s*(?:is|=|:)?\s*poor\b/gi
  }
] as const;

const CONDITION_GRADE_NEGATIVE_EVIDENCE_PATTERN =
  /(?:\b(?:condition|cond|grade|cosmetics?)\b[^.,;|]{0,48}\b(?:unknown|unclear|pending|not\s+listed|tbd|not\s+sure)\b)|(?:\b(?:unknown|unclear|pending|not\s+listed|tbd|not\s+sure)\b[^.,;|]{0,48}\b(?:condition|cond|grade|cosmetics?)\b)/i;

const NON_CONDITION_FIELD_NEGATIVE_EVIDENCE_PATTERN =
  /(?:\b(?:trade\s*-?\s*in\s+value|trade\s+value|estimated\s+value|value|shaft(?:\s+flex)?|flex|model|product(?:\s+line)?|category|cat)\b\s*(?:=|:|is)?\s*\b(?:unknown|unclear|pending|not\s+listed|tbd|not\s+sure)\b)|(?:\b(?:unknown|unclear|pending|not\s+listed|tbd|not\s+sure)\b\s+\b(?:trade\s*-?\s*in\s+value|trade\s+value|estimated\s+value|value|shaft(?:\s+flex)?|flex|model|product(?:\s+line)?|category|cat)\b)/gi;

function getConditionGradeSafetyText(
  sourceText: string
): string {
  return sourceText.replace(
    NON_CONDITION_FIELD_NEGATIVE_EVIDENCE_PATTERN,
    " "
  );
}

type IndexedDeterministicGolfTermAdvisoryMatch =
  DeterministicGolfTermAdvisoryMatch & {
    index: number;
  };

function collectDeterministicGolfTermAdvisoryMatches(
  sourceText: string
): IndexedDeterministicGolfTermAdvisoryMatch[] {
  return CONDITION_GRADE_ADVISORY_POLICIES.flatMap(
    (policy) =>
      Array.from(
        sourceText.matchAll(
          new RegExp(
            policy.pattern.source,
            policy.pattern.flags
          )
        )
      ).flatMap((match) => {
        if (
          !match[0] ||
          match.index === undefined
        ) {
          return [];
        }

        return [
          {
            policyId: policy.policyId,
            fieldName:
              "conditionGrade" as const,
            sourcePhrase: match[0],
            candidateValue:
              policy.candidateValue,
            confidence: 0.9,
            reason:
              "Deterministic normalization policy matched an explicit contextual condition phrase.",
            index: match.index
          }
        ];
      })
  );
}

export function hasDeterministicGolfTermAdvisoryNegativeEvidence(
  sourceText: string,
  fieldName:
    DeterministicGolfTermAdvisoryMatch["fieldName"]
): boolean {
  return (
    fieldName === "conditionGrade" &&
    CONDITION_GRADE_NEGATIVE_EVIDENCE_PATTERN.test(
      getConditionGradeSafetyText(
        sourceText
      )
    )
  );
}

export function hasDeterministicGolfTermAdvisoryConflict(
  sourceText: string,
  fieldName:
    DeterministicGolfTermAdvisoryMatch["fieldName"]
): boolean {
  const candidateValues = new Set(
    collectDeterministicGolfTermAdvisoryMatches(
      sourceText
    )
      .filter(
        (match) =>
          match.fieldName === fieldName
      )
      .map(
        (match) =>
          match.candidateValue
      )
  );

  return candidateValues.size > 1;
}

export function findDeterministicGolfTermAdvisoryMatches(
  sourceText: string
): DeterministicGolfTermAdvisoryMatch[] {
  if (
    hasDeterministicGolfTermAdvisoryNegativeEvidence(
      sourceText,
      "conditionGrade"
    )
  ) {
    return [];
  }

  const matches =
    collectDeterministicGolfTermAdvisoryMatches(
      sourceText
    );
  const uniqueValues = new Set(
    matches.map(
      (match) =>
        match.candidateValue
    )
  );

  if (
    matches.length === 0 ||
    uniqueValues.size !== 1
  ) {
    return [];
  }

  const selectedMatch = [...matches].sort(
    (left, right) =>
      right.sourcePhrase.length -
        left.sourcePhrase.length ||
      left.index - right.index
  )[0];

  if (!selectedMatch) {
    return [];
  }

  const {
    index: _index,
    ...advisoryMatch
  } = selectedMatch;

  return [advisoryMatch];
}

export function getGolfTermNormalizationMatrix(): GolfTermNormalizationEntry[] {
  return [...GOLF_TERM_NORMALIZATION_MATRIX];
}

export function getFieldRepairSuggestionMatrixValidationErrors(
  suggestion: FieldRepairSuggestionForNormalization
): string[] {
  const errors: string[] = [];
  const sourcePhrase = suggestion.sourcePhrase.trim();

  if (NEGATIVE_EVIDENCE_PATTERN.test(sourcePhrase)) {
    errors.push(
      `${suggestion.fieldName} repair blocked because source phrase contains negative evidence: "${sourcePhrase}".`
    );
  }

  if (
    suggestion.fieldName === "category" &&
    suggestion.candidateValue === "WEDGE" &&
    UTILITY_WOOD_PATTERN.test(sourcePhrase)
  ) {
    errors.push(
      `category repair blocked because utility wood evidence is not wedge evidence: "${sourcePhrase}".`
    );
  }

  if (
    suggestion.fieldName === "shaftFlex" &&
    suggestion.candidateValue === "REGULAR" &&
    SINGLE_R_FLEX_PATTERN.test(sourcePhrase) &&
    !EXPLICIT_REGULAR_PATTERN.test(sourcePhrase)
  ) {
    errors.push(
      `shaftFlex repair blocked because single-letter R is ambiguous without shaft-flex context: "${sourcePhrase}".`
    );
  }

  return errors;
}
