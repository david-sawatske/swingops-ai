import { compactParserEvidenceSourceText } from "./parser-evidence.js";
import type { ParserFieldEvidence } from "./parser-evidence.js";

type NormalizedParserFieldValue = string | number;

export type NormalizedParserFieldResult<T extends NormalizedParserFieldValue> = {
  value: T | null;
  evidence?: ParserFieldEvidence;
};

type TextParserMatchCandidate<T extends string> = {
  value: T;
  aliases: RegExp[];
};

function createContextualShaftCodePattern(
  ...codes: string[]
): RegExp {
  const codeAlternatives = codes.join("|");

  return new RegExp(
    "\\b(?:shaft(?:\\s+flex)?|flex)" +
      "(?:\\s+(?:marked|marking|label(?:ed)?|code(?:d)?|listed|noted|is))?" +
      "\\s*(?:[:=]|as)?\\s*" +
      "(?:" +
      codeAlternatives +
      ")\\b",
    "i"
  );
}

const SHAFT_FLEX_CANDIDATES: TextParserMatchCandidate<string>[] = [
  {
    value: "TOUR_X_STIFF",
    aliases: [
      createContextualShaftCodePattern("TX"),
      /\bshaft\s+(?:flex\s+)?tour\s*x\s*-?\s*stiff\b/i,
      /\btour\s*x\s*-?\s*stiff\b/i,
      /\btx\s*flex\b/i,
      /\btour\s*x\b/i,
      /\bTOUR_X_STIFF\b/
    ]
  },
  {
    value: "X_STIFF",
    aliases: [
      createContextualShaftCodePattern("X"),
      /\bshaft\s+(?:flex\s+)?x\s*-?\s*stiff\b/i,
      /\bx\s*-?\s*stiff\b/i,
      /\bx\s*flex\b/i,
      /\bX_STIFF\b/
    ]
  },
  {
    value: "STIFF",
    aliases: [
      createContextualShaftCodePattern("S"),
      /\bshaft\s+(?:flex\s+)?(?:stf|stiff)\b/i,
      /\bstf\b/i,
      /\bstiff\b/i,
      /\bs\s*flex\b/i,
      /\btensei\s+s\b/i,
      /\bSTIFF\b/
    ]
  },
  {
    value: "REGULAR",
    aliases: [
      createContextualShaftCodePattern("R"),
      /\bshaft\s+(?:flex\s+)?(?:reg|regular)\b/i,
      /\breg\s*flex\b/i,
      /\br\s*flex\b/i,
      /\breg\b/i,
      /\bregular\b/i,
      /\bREGULAR\b/
    ]
  },
  {
    value: "SENIOR",
    aliases: [
      createContextualShaftCodePattern("SR", "A"),
      /\bshaft\s+(?:flex\s+)?senior\b/i,
      /\bsenior\s*flex\b/i,
      /\bsenior\b/i,
      /\bsr\s*flex\b/i,
      /\ba\s*flex\b/i,
      /\bSENIOR\b/
    ]
  },
  {
    value: "LADIES",
    aliases: [
      createContextualShaftCodePattern("L"),
      /\bshaft\s+(?:flex\s+)?lad(?:y|ies)\b/i,
      /\blad(?:y|ies)\s*flex\b/i,
      /\blad(y|ies)\b/i,
      /\bl\s*flex\b/i,
      /\bLADIES\b/
    ]
  }
];

const APPROVED_CONDITION_GRADE_CANDIDATES: TextParserMatchCandidate<string>[] = [
  {
    value: "9.5 Mint",
    aliases: [
      /\b9\.5\s*Mint\b/i,
      /\b(?:condition|cond)(?:\s*grade|_grade)?\s*(?:=|:)?\s*mint\b/i
    ]
  },
  {
    value: "9.0 Above Average",
    aliases: [
      /\b9\.0\s*Above\s*Average\b/i,
      /\b(?:condition|cond)(?:\s*grade|_grade)?\s*(?:=|:)?\s*(?:above\s*(?:avg|average)|aa)\b/i
    ]
  },
  {
    value: "8.0 Average",
    aliases: [
      /\b8\.0\s*Average\b/i,
      /\b(?:condition|cond)(?:\s*grade|_grade)?\s*(?:=|:)?\s*(?:avg|average)\b/i
    ]
  },
  {
    value: "7.0 Below Average",
    aliases: [
      /\b7\.0\s*Below\s*Average\b/i,
      /\b(?:condition|cond)(?:\s*grade|_grade)?\s*(?:=|:)?\s*(?:below\s*(?:avg|average)|ba)\b/i
    ]
  },
  {
    value: "6.0 Poor",
    aliases: [
      /\b6\.0\s*Poor\b/i,
      /\b(?:condition|cond)(?:\s*grade|_grade)?\s*(?:=|:)?\s*poor\b/i
    ]
  }
];

const TRADE_IN_VALUE_ALIASES = [
  /\b(?:trade\s*-?\s*in\s+value|trade\s+value|estimated\s+value|value)\s*(?:=|is|:)?\s*\$?(\d{2,4})\b/i,
  /\$(\d{2,4})\b/
];

type ParserMatch<T extends NormalizedParserFieldValue> = {
  value: T;
  sourceText: string;
  index: number;
  end: number;
};

const SHAFT_FLEX_NEGATIVE_EVIDENCE_PATTERN =
  /(?:\b(?:shaft(?:\s+flex)?|flex)\b[^.,;|]{0,48}\b(?:unknown|unclear|pending|not\s+listed|tbd|not\s+sure)\b)|(?:\b(?:unknown|unclear|pending|not\s+listed|tbd|not\s+sure)\b[^.,;|]{0,48}\b(?:shaft(?:\s+flex)?|flex)\b)/i;

const CONDITION_GRADE_NEGATIVE_EVIDENCE_PATTERN =
  /(?:\b(?:condition|cond|grade)\b[^.,;|]{0,48}\b(?:unknown|unclear|pending|not\s+listed|tbd|not\s+sure)\b)|(?:\b(?:unknown|unclear|pending|not\s+listed|tbd|not\s+sure)\b[^.,;|]{0,48}\b(?:condition|cond|grade)\b)/i;

const NEGATIVE_EVIDENCE_TERM_PATTERN =
  "unknown|unclear|pending|not\\s+listed|tbd|not\\s+sure";

const NON_SHAFT_FIELD_PATTERN =
  "generation|model|product(?:\\s+line)?|category|condition|cond|grade|value|valuation|store";

const NON_CONDITION_FIELD_PATTERN =
  "generation|model|product(?:\\s+line)?|category|shaft(?:\\s+flex)?|flex|value|valuation|store";

function stripOtherFieldScopedNegativeEvidence(
  text: string,
  otherFieldPattern: string
): string {
  const scopedNegativePattern =
    new RegExp(
      `(?:\\b(?:${otherFieldPattern})\\b\\s*(?:=|:|is)?\\s*["']?\\b(?:${NEGATIVE_EVIDENCE_TERM_PATTERN})\\b["']?)|(?:["']?\\b(?:${NEGATIVE_EVIDENCE_TERM_PATTERN})\\b["']?\\s+\\b(?:${otherFieldPattern})\\b)`,
      "gi"
    );

  return text.replace(
    scopedNegativePattern,
    (match) => " ".repeat(match.length)
  );
}

function getAllPatternMatches(
  text: string,
  pattern: RegExp
): RegExpExecArray[] {
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);

  return Array.from(text.matchAll(matcher));
}

function getParserMatches<
  T extends NormalizedParserFieldValue
>(
  text: string,
  pattern: RegExp,
  value: T
): ParserMatch<T>[] {
  return getAllPatternMatches(
    text,
    pattern
  ).flatMap((match) => {
    if (!match[0] || match.index === undefined) {
      return [];
    }

    return [
      {
        value,
        sourceText:
          compactParserEvidenceSourceText(match[0]),
        index: match.index,
        end: match.index + match[0].length
      }
    ];
  });
}

function selectNonOverlappingParserMatches<
  T extends NormalizedParserFieldValue
>(
  matches: ParserMatch<T>[]
): ParserMatch<T>[] {
  const selected: ParserMatch<T>[] = [];

  for (
    const match of [...matches].sort(
      (left, right) =>
        right.sourceText.length - left.sourceText.length ||
        left.index - right.index
    )
  ) {
    const overlapsSelectedMatch = selected.some(
      (selectedMatch) =>
        match.index < selectedMatch.end &&
        match.end > selectedMatch.index
    );

    if (!overlapsSelectedMatch) {
      selected.push(match);
    }
  }

  return selected.sort(
    (left, right) =>
      left.index - right.index ||
      right.sourceText.length - left.sourceText.length
  );
}

function findTextParserMatch<T extends string>(
  text: string,
  candidates: TextParserMatchCandidate<T>[],
  negativeEvidencePattern?: RegExp
): NormalizedParserFieldResult<T> {
  if (negativeEvidencePattern?.test(text)) {
    return { value: null };
  }

  const matches = candidates.flatMap((candidate) =>
    candidate.aliases.flatMap((alias) =>
      getParserMatches(
        text,
        alias,
        candidate.value
      )
    )
  );
  const selectedMatches =
    selectNonOverlappingParserMatches(matches);
  const uniqueValues = new Set(
    selectedMatches.map((match) => match.value)
  );

  if (
    selectedMatches.length === 0 ||
    uniqueValues.size !== 1
  ) {
    return { value: null };
  }

  const selectedMatch = selectedMatches[0]!;

  return {
    value: selectedMatch.value,
    evidence: {
      value: selectedMatch.value,
      sourceText: selectedMatch.sourceText
    }
  };
}

export function detectShaftFlexWithEvidence(text: string): NormalizedParserFieldResult<string> {
  const shaftScopedText =
    stripOtherFieldScopedNegativeEvidence(
      text,
      NON_SHAFT_FIELD_PATTERN
    );

  return findTextParserMatch(
    shaftScopedText,
    SHAFT_FLEX_CANDIDATES,
    SHAFT_FLEX_NEGATIVE_EVIDENCE_PATTERN
  );
}

export function detectApprovedConditionGradeWithEvidence(text: string): NormalizedParserFieldResult<string> {
  const conditionScopedText =
    stripOtherFieldScopedNegativeEvidence(
      text,
      NON_CONDITION_FIELD_PATTERN
    );

  return findTextParserMatch(
    conditionScopedText,
    APPROVED_CONDITION_GRADE_CANDIDATES,
    CONDITION_GRADE_NEGATIVE_EVIDENCE_PATTERN
  );
}

export function detectTradeInValueWithEvidence(text: string): NormalizedParserFieldResult<number> {
  const matches = TRADE_IN_VALUE_ALIASES.flatMap(
    (alias) =>
      getAllPatternMatches(
        text,
        alias
      ).flatMap((match) => {
        const numberText =
          match[1] ??
          match[0]?.match(/\d{2,4}/)?.[0];

        if (
          !match[0] ||
          match.index === undefined ||
          !numberText
        ) {
          return [];
        }

        const value = Number(numberText);

        return [
          {
            value,
            sourceText:
              compactParserEvidenceSourceText(
                match[0]
              ),
            index: match.index,
            end: match.index + match[0].length
          }
        ];
      })
  );
  const selectedMatches =
    selectNonOverlappingParserMatches(matches);
  const uniqueValues = new Set(
    selectedMatches.map((match) => match.value)
  );

  if (
    selectedMatches.length === 0 ||
    uniqueValues.size !== 1
  ) {
    return { value: null };
  }

  const selectedMatch = selectedMatches[0]!;

  return {
    value: selectedMatch.value,
    evidence: {
      value: selectedMatch.value,
      sourceText: selectedMatch.sourceText
    }
  };
}
