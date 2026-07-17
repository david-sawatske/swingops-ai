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
  const records = Array.isArray(inputJson.records)
    ? inputJson.records.filter(isRecord)
    : [];
  const recordResults = records.map((record) => {
    const suggestions = buildRecordSuggestions(record);

    return {
      suggestions,
      outcome: buildRecordOutcome(record, suggestions)
    };
  });

  return {
    recordOutcomes: recordResults.map((result) => result.outcome),
    suggestions: recordResults.flatMap((result) =>
      result.outcome.outcomeType === "REPAIR_SUGGESTED"
        ? result.suggestions
        : []
    )
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
  const advisorySuggestions =
    getRecordAdvisorySuggestions(record);

  if (advisorySuggestions.length > 0) {
    return advisorySuggestions;
  }

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

function getRecordAdvisorySuggestions(
  record: Record<string, unknown>
): Record<string, unknown>[] {
  if (!Array.isArray(record.advisoryCandidates)) {
    return [];
  }

  return record.advisoryCandidates
    .filter(isRecord)
    .flatMap((candidate) => {
      const suggestion = isRecord(candidate.suggestion)
        ? candidate.suggestion
        : null;

      if (!suggestion) {
        return [];
      }

      const recordId = getString(suggestion.recordId);
      const fieldName = getString(suggestion.fieldName);
      const sourcePhrase =
        getString(suggestion.sourcePhrase);
      const reason = getString(suggestion.reason);
      const candidateValue =
        suggestion.candidateValue;
      const confidence = suggestion.confidence;
      const reviewRequired =
        suggestion.reviewRequired;

      if (
        !recordId ||
        !fieldName ||
        !sourcePhrase ||
        !reason ||
        (
          typeof candidateValue !== "string" &&
          typeof candidateValue !== "number"
        ) ||
        (
          typeof candidateValue === "number" &&
          !Number.isFinite(candidateValue)
        ) ||
        typeof confidence !== "number" ||
        !Number.isFinite(confidence) ||
        typeof reviewRequired !== "boolean"
      ) {
        return [];
      }

      return [
        {
          recordId,
          fieldName,
          sourcePhrase,
          candidateValue,
          confidence,
          reason,
          reviewRequired
        }
      ];
    });
}

function buildRecordOutcome(
  record: Record<string, unknown>,
  suggestions: Record<string, unknown>[]
): Record<string, unknown> {
  const recordId = getString(record.recordId) ?? "unknown-record";
  const evidenceIds = getRecordEvidenceIds(record);
  const productResolution = isRecord(record.productResolution)
    ? record.productResolution
    : null;
  const productResolutionStatus = getString(productResolution?.status);
  const candidateProductIds = getStringArray(
    productResolution?.candidateProductIds
  );

  if (
    productResolutionStatus === "AMBIGUOUS" &&
    candidateProductIds.length >= 2
  ) {
    return {
      outcomeType: "CANDIDATE_COMPARISON",
      recordId,
      summary:
        "Deterministic product resolution returned multiple candidates that require reviewer confirmation.",
      evidenceIds,
      reviewerQuestion:
        "Which supplied product candidate matches the club generation shown in the source?",
      candidateProductIds
    };
  }

  if (suggestions.length > 0) {
    return {
      outcomeType: "REPAIR_SUGGESTED",
      recordId,
      summary:
        `${suggestions.length} source-supported field repair suggestion(s) are available for review.`,
      evidenceIds,
      reviewerQuestion:
        "Which source-supported field repair should be applied to this record?",
      suggestions
    };
  }

  return {
    outcomeType: "NO_SAFE_REPAIR",
    recordId,
    summary:
      "The supplied evidence did not support a policy-safe field repair.",
    evidenceIds,
    reviewerQuestion:
      "Which missing or uncertain value can be confirmed from the original source?",
    reasonCodes: getRecordReviewReasonCodes(record)
  };
}

function getRecordEvidenceIds(record: Record<string, unknown>): string[] {
  if (!Array.isArray(record.evidence)) {
    return [];
  }

  return record.evidence
    .filter(isRecord)
    .map((evidence) => getString(evidence.evidenceId))
    .filter((evidenceId): evidenceId is string => evidenceId !== null);
}

function getRecordReviewReasonCodes(
  record: Record<string, unknown>
): string[] {
  const selectionReason = isRecord(record.selectionReason)
    ? record.selectionReason
    : null;
  const reasonCodes = getStringArray(selectionReason?.reviewReasonCodes);

  return reasonCodes.length > 0
    ? reasonCodes
    : ["INSUFFICIENT_EVIDENCE"];
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
