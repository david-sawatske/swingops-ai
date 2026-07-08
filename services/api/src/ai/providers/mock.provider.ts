import type { ModelProviderAdapter } from "../model-provider.types.js";

const MAIN_RUN_FIELD_REPAIR_POLICY_KEY = "MAIN_RUN_FIELD_REPAIR";

export const mockProvider: ModelProviderAdapter = {
  provider: "MOCK",
  displayName: "Mock Provider",
  kind: "MOCK",
  enabled: true,
  models: [
    {
      provider: "MOCK",
      model: "mock-golf-workflow-model",
      reason:
        "Default mock model for local workflow development without external AI calls.",
      supportedTaskTypes: [
        "INTAKE_PARSING",
        "FIELD_NORMALIZATION",
        "VALIDATION",
        "REVIEW_SUMMARY"
      ],
      supportsJson: true,
      costTier: "FREE",
      latencyTier: "LOW",
      qualityTier: "LOW",
      enabled: true
    }
  ],
  async execute(input) {
    if (
      input.taskType === "FIELD_NORMALIZATION" &&
      input.inputJson.policyKey === MAIN_RUN_FIELD_REPAIR_POLICY_KEY
    ) {
      return {
        outputJson: buildDeterministicFieldRepairOutput(input.inputJson)
      };
    }

    return {
      outputJson: {
        mock: true,
        provider: "MOCK",
        model: input.model,
        taskType: input.taskType
      }
    };
  }
};

function buildDeterministicFieldRepairOutput(
  inputJson: Record<string, unknown>
): Record<string, unknown> {
  const records = Array.isArray(inputJson.records) ? inputJson.records : [];
  const suggestions = records.flatMap((record) => {
    if (!isRecord(record)) {
      return [];
    }

    return buildRecordSuggestions(record);
  });

  return {
    suggestions
  };
}

function buildRecordSuggestions(record: Record<string, unknown>) {
  const recordId = getString(record.recordId);
  const sourceText =
    getString(record.sourceText) ??
    getString(record.rawLine) ??
    getString(record.originalText) ??
    "";
  const missingFields = getStringArray(record.missingFields);
  const suggestions: Record<string, unknown>[] = [];

  if (missingFields.includes("shaftFlex")) {
    const shaftFlexSuggestion = findMockShaftFlexSuggestion(sourceText);

    if (shaftFlexSuggestion) {
      suggestions.push({
        ...(recordId ? { recordId } : {}),
        fieldName: "shaftFlex",
        ...shaftFlexSuggestion
      });
    }
  }

  if (missingFields.includes("conditionGrade")) {
    const conditionGradeSuggestion = findMockConditionGradeSuggestion(sourceText);

    if (conditionGradeSuggestion) {
      suggestions.push({
        ...(recordId ? { recordId } : {}),
        fieldName: "conditionGrade",
        ...conditionGradeSuggestion
      });
    }
  }

  if (missingFields.includes("tradeInValue")) {
    const tradeInValueSuggestion = findMockTradeInValueSuggestion(sourceText);

    if (tradeInValueSuggestion) {
      suggestions.push({
        ...(recordId ? { recordId } : {}),
        fieldName: "tradeInValue",
        ...tradeInValueSuggestion
      });
    }
  }

  return suggestions;
}

function findMockShaftFlexSuggestion(sourceText: string) {
  const patterns: {
    pattern: RegExp;
    candidateValue: string;
    confidence: number;
    reason: string;
  }[] = [
    {
      pattern: /\btour\s*x[-\s]?stiff\b/i,
      candidateValue: "TOUR_X_STIFF",
      confidence: 0.9,
      reason: "Source phrase matches the approved Tour X-Stiff shaft-flex value."
    },
    {
      pattern: /\bx[-\s]?stiff\b/i,
      candidateValue: "X_STIFF",
      confidence: 0.9,
      reason: "Source phrase matches the approved X-Stiff shaft-flex value."
    },
    {
      pattern: /\bs\s*flex\b/i,
      candidateValue: "STIFF",
      confidence: 0.89,
      reason: "Source phrase uses a known shaft-flex abbreviation."
    },
    {
      pattern: /\bstiff\b/i,
      candidateValue: "STIFF",
      confidence: 0.88,
      reason: "Source phrase matches the approved Stiff shaft-flex value."
    },
    {
      pattern: /\breg(?:ular)?\b/i,
      candidateValue: "REGULAR",
      confidence: 0.88,
      reason: "Source phrase matches the approved Regular shaft-flex value."
    },
    {
      pattern: /\bsenior\b/i,
      candidateValue: "SENIOR",
      confidence: 0.88,
      reason: "Source phrase matches the approved Senior shaft-flex value."
    },
    {
      pattern: /\blad(?:y|ies)?\b/i,
      candidateValue: "LADIES",
      confidence: 0.88,
      reason: "Source phrase matches the approved Ladies shaft-flex value."
    }
  ];

  for (const config of patterns) {
    const match = sourceText.match(config.pattern);

    if (match?.[0]) {
      return {
        sourcePhrase: match[0].trim(),
        candidateValue: config.candidateValue,
        confidence: config.confidence,
        reason: config.reason,
        reviewRequired: false
      };
    }
  }

  return null;
}

function findMockConditionGradeSuggestion(sourceText: string) {
  const match = sourceText.match(
    /\b(?:condition|cond)\s*[:=]?\s*(9\.5|9\.0|8\.0|7\.0|6\.0|mint|above\s*avg|above\s*average|average|avg|below\s*avg|below\s*average|poor)\b/i
  );

  if (!match?.[0] || !match[1]) {
    return null;
  }

  const normalized = normalizeConditionGrade(match[1]);

  if (!normalized) {
    return null;
  }

  return {
    sourcePhrase: match[0].trim(),
    candidateValue: normalized,
    confidence: 0.9,
    reason: "Source phrase matches an approved condition grade.",
    reviewRequired: false
  };
}

function findMockTradeInValueSuggestion(sourceText: string) {
  const match = sourceText.match(
    /\b(?:trade(?:-in)?\s*value|trade\s*value|value)\s*[:=]?\s*\$?(\d{2,4})\b/i
  );

  if (!match?.[0] || !match[1]) {
    return null;
  }

  return {
    sourcePhrase: match[0].trim(),
    candidateValue: Number(match[1]),
    confidence: 0.9,
    reason: "Source phrase includes an explicit trade-in value.",
    reviewRequired: false
  };
}

function normalizeConditionGrade(rawValue: string): string | null {
  const normalized = rawValue.toLowerCase().replace(/\s+/g, " ").trim();

  if (normalized === "9.5" || normalized === "mint") {
    return "9.5 Mint";
  }

  if (
    normalized === "9.0" ||
    normalized === "above avg" ||
    normalized === "above average"
  ) {
    return "9.0 Above Average";
  }

  if (normalized === "8.0" || normalized === "avg" || normalized === "average") {
    return "8.0 Average";
  }

  if (
    normalized === "7.0" ||
    normalized === "below avg" ||
    normalized === "below average"
  ) {
    return "7.0 Below Average";
  }

  if (normalized === "6.0" || normalized === "poor") {
    return "6.0 Poor";
  }

  return null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
