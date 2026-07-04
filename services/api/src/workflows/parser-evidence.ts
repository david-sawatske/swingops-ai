export type ParserFieldEvidence = {
  value: string | number;
  sourceText: string;
};

export type ParserEvidence = {
  brand?: ParserFieldEvidence;
  productLine?: ParserFieldEvidence;
  category?: ParserFieldEvidence;
  shaftFlex?: ParserFieldEvidence;
  conditionGrade?: ParserFieldEvidence;
  tradeInValue?: ParserFieldEvidence;
};

type TextParserEvidenceCandidate<T extends string> = {
  value: T;
  aliases: RegExp[];
};

export function compactParserEvidenceSourceText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function findTextParserEvidence<T extends string>(
  text: string,
  value: T | null,
  candidates: TextParserEvidenceCandidate<T>[],
): ParserFieldEvidence | undefined {
  if (!value) {
    return undefined;
  }

  const candidate = candidates.find((item) => item.value === value);

  if (!candidate) {
    return undefined;
  }

  for (const alias of candidate.aliases) {
    const match = text.match(alias);

    if (match?.[0]) {
      return {
        value,
        sourceText: compactParserEvidenceSourceText(match[0]),
      };
    }
  }

  return undefined;
}

export function findNumberParserEvidence(
  text: string,
  value: number | null,
  aliases: RegExp[],
): ParserFieldEvidence | undefined {
  if (value === null) {
    return undefined;
  }

  for (const alias of aliases) {
    const match = text.match(alias);
    const numberText = match?.[1] ?? match?.[0]?.match(/\d{2,4}/)?.[0];

    if (match?.[0] && numberText && Number(numberText) === value) {
      return {
        value,
        sourceText: compactParserEvidenceSourceText(match[0]),
      };
    }
  }

  return undefined;
}

export function omitEmptyParserEvidence(
  evidence: Partial<Record<keyof ParserEvidence, ParserFieldEvidence | undefined>>,
): ParserEvidence {
  return Object.fromEntries(
    Object.entries(evidence).filter(([, value]) => Boolean(value?.sourceText)),
  ) as ParserEvidence;
}
