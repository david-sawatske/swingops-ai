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

const SHAFT_FLEX_CANDIDATES: TextParserMatchCandidate<string>[] = [
  {
    value: "TOUR_X_STIFF",
    aliases: [
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
      /\bshaft\s+(?:flex\s+)?x\s*-?\s*stiff\b/i,
      /\bx\s*-?\s*stiff\b/i,
      /\bx\s*flex\b/i,
      /\bX_STIFF\b/
    ]
  },
  {
    value: "STIFF",
    aliases: [
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

function findTextParserMatch<T extends string>(
  text: string,
  candidates: TextParserMatchCandidate<T>[]
): NormalizedParserFieldResult<T> {
  for (const candidate of candidates) {
    for (const alias of candidate.aliases) {
      const match = text.match(alias);

      if (match?.[0]) {
        return {
          value: candidate.value,
          evidence: {
            value: candidate.value,
            sourceText: compactParserEvidenceSourceText(match[0])
          }
        };
      }
    }
  }

  return { value: null };
}

export function detectShaftFlexWithEvidence(text: string): NormalizedParserFieldResult<string> {
  return findTextParserMatch(text, SHAFT_FLEX_CANDIDATES);
}

export function detectApprovedConditionGradeWithEvidence(text: string): NormalizedParserFieldResult<string> {
  return findTextParserMatch(text, APPROVED_CONDITION_GRADE_CANDIDATES);
}

export function detectTradeInValueWithEvidence(text: string): NormalizedParserFieldResult<number> {
  for (const alias of TRADE_IN_VALUE_ALIASES) {
    const match = text.match(alias);
    const numberText = match?.[1] ?? match?.[0]?.match(/\d{2,4}/)?.[0];

    if (match?.[0] && numberText) {
      const value = Number(numberText);

      return {
        value,
        evidence: {
          value,
          sourceText: compactParserEvidenceSourceText(match[0])
        }
      };
    }
  }

  return { value: null };
}
