import type {
  ProductReferenceCategory,
  ProductReferenceRecord
} from "./product-reference-types.js";
import {
  demoProductReferenceProvider
} from "./demo-product-reference-provider.js";
import type {
  ProductReferenceProvider
} from "./product-reference-provider.js";

export type ProductReferenceMatchKind =
  | "CANONICAL_EXACT"
  | "ALIAS_EXACT"
  | "CANONICAL_PHRASE"
  | "ALIAS_PHRASE"
  | "FAMILY";

export type ProductResolutionEvidence = {
  field:
    | "brand"
    | "category"
    | "productText"
    | "rawText"
    | "year";
  sourceText: string;
  detail: string;
};

export type ProductResolutionCandidate = {
  productId: string;
  sku: string;
  brand: string;
  productLine: string;
  category: ProductReferenceCategory;
  year: number;
  score: number;
  matchKind: ProductReferenceMatchKind;
  matchedPhrase: string;
  evidence: ProductResolutionEvidence[];
};

export type ProductResolutionInput = {
  brand?: string | null;
  category?: string | null;
  productText?: string | null;
  rawText: string;
  year?: number | null;
};

type ProductResolutionBase = {
  originalProductText: string | null;
  rawText: string;
  normalizedInput: {
    brand: string | null;
    category: ProductReferenceCategory | null;
    productText: string | null;
    year: number | null;
  };
  providerRecordCount: number;
  reason: string;
};

export type MatchedProductResolution =
  ProductResolutionBase & {
    status: "MATCHED";
    match: ProductResolutionCandidate;
    candidates: ProductResolutionCandidate[];
  };

export type AmbiguousProductResolution =
  ProductResolutionBase & {
    status: "AMBIGUOUS";
    candidates: ProductResolutionCandidate[];
  };

export type UnresolvedProductResolution =
  ProductResolutionBase & {
    status: "UNRESOLVED";
    candidates: ProductResolutionCandidate[];
  };

export type ProductResolution =
  | MatchedProductResolution
  | AmbiguousProductResolution
  | UnresolvedProductResolution;

type IdentifierMatch = {
  score: number;
  matchKind: ProductReferenceMatchKind;
  matchedPhrase: string;
  evidenceField: "productText" | "rawText";
  sourceText: string;
};

const MINIMUM_CANDIDATE_SCORE = 0.65;
const MINIMUM_AUTHORITATIVE_SCORE = 0.86;
const AMBIGUOUS_SCORE_MARGIN = 0.05;

const brandAliases = new Map<string, string>([
  ["tm", "taylormade"],
  ["taylor made", "taylormade"],
  ["taylormade", "taylormade"],
  ["cally", "callaway"],
  ["callaway", "callaway"],
  ["ping", "ping"],
  ["titleist", "titleist"],
  ["cleveland", "cleveland"],
  ["odyssey", "odyssey"],
  ["mizuno", "mizuno"],
  ["scotty cameron", "scotty cameron"]
]);

const categoryAliases =
  new Map<string, ProductReferenceCategory>([
    ["driver", "DRIVER"],
    ["drv", "DRIVER"],
    ["1w", "DRIVER"],
    ["fairway", "FAIRWAY_WOOD"],
    ["fairway wood", "FAIRWAY_WOOD"],
    ["fw", "FAIRWAY_WOOD"],
    ["fwy", "FAIRWAY_WOOD"],
    ["3w", "FAIRWAY_WOOD"],
    ["5w", "FAIRWAY_WOOD"],
    ["7w", "FAIRWAY_WOOD"],
    ["9w", "FAIRWAY_WOOD"],
    ["hybrid", "HYBRID"],
    ["hy", "HYBRID"],
    ["rescue", "HYBRID"],
    ["iron", "IRON_SET"],
    ["irons", "IRON_SET"],
    ["iron set", "IRON_SET"],
    ["wedge", "WEDGE"],
    ["putter", "PUTTER"]
  ]);

function normalizeText(
  value: string | null | undefined
): string {
  return (value ?? "")
    .replace(/([a-z])(\d)/gi, "$1 $2")
    .replace(/(\d)([a-z])/gi, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string): string {
  return value.replace(/\s+/g, "");
}

const GENERIC_PRODUCT_IDENTITY_TOKENS = new Set([
  "driver",
  "drv",
  "fairway",
  "wood",
  "fw",
  "fwy",
  "hybrid",
  "hy",
  "rescue",
  "iron",
  "irons",
  "set",
  "wedge",
  "putter",
  "golf"
]);

function tokenizeIdentityText(value: string): string[] {
  return normalizeText(value).match(/[a-z]+|\d+/g) ?? [];
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findSourcePhrase(
  sourceText: string,
  normalizedPhrase: string
): string {
  const phraseTokens =
    tokenizeIdentityText(normalizedPhrase);

  if (phraseTokens.length === 0) {
    return normalizedPhrase;
  }

  const pattern = phraseTokens
    .map(escapeRegularExpression)
    .join("[^a-zA-Z0-9]*");

  return sourceText.match(
    new RegExp(`\\b${pattern}\\b`, "i")
  )?.[0] ?? normalizedPhrase;
}

function findLongestSupportedFamilyPhrase(input: {
  rawText: string;
  identifier: string;
  product: ProductReferenceRecord;
}): string | null {
  const rawTokens =
    tokenizeIdentityText(input.rawText);
  const excludedTokens = new Set([
    ...GENERIC_PRODUCT_IDENTITY_TOKENS,
    ...tokenizeIdentityText(
      input.product.brand
    )
  ]);
  const identifierTokens =
    tokenizeIdentityText(input.identifier)
      .filter(
        (token) => !excludedTokens.has(token)
      );

  for (
    let phraseLength =
      identifierTokens.length;
    phraseLength >= 1;
    phraseLength -= 1
  ) {
    for (
      let identifierStart = 0;
      identifierStart <=
        identifierTokens.length -
          phraseLength;
      identifierStart += 1
    ) {
      const phraseTokens =
        identifierTokens.slice(
          identifierStart,
          identifierStart + phraseLength
        );
      const letterCount = phraseTokens
        .join("")
        .replace(/[^a-z]/g, "")
        .length;

      if (letterCount < 3) {
        continue;
      }

      for (
        let rawStart = 0;
        rawStart <=
          rawTokens.length - phraseLength;
        rawStart += 1
      ) {
        const rawPhrase =
          rawTokens.slice(
            rawStart,
            rawStart + phraseLength
          );
        const matches = phraseTokens.every(
          (token, index) =>
            token === rawPhrase[index]
        );

        if (matches) {
          return phraseTokens.join(" ");
        }
      }
    }
  }

  return null;
}

function normalizeBrand(
  value: string | null | undefined
): string {
  const normalized = normalizeText(value);

  return brandAliases.get(normalized) ?? normalized;
}

function normalizeCategory(
  value: string | null | undefined
): ProductReferenceCategory | null {
  const normalized = normalizeText(value);

  return (
    categoryAliases.get(normalized) ??
    categoryAliases.get(compact(normalized)) ??
    null
  );
}

function containsNormalizedPhrase(
  haystack: string,
  needle: string
): boolean {
  if (!needle) {
    return false;
  }

  return ` ${haystack} `.includes(` ${needle} `);
}

function exactNormalizedMatch(
  first: string,
  second: string
): boolean {
  return Boolean(first) &&
    compact(first) === compact(second);
}

function isSupportedFamilyEvidence(
  query: string,
  identifier: string
): boolean {
  const compactQuery = compact(query);
  const compactIdentifier = compact(identifier);

  if (compactQuery.length < 3) {
    return false;
  }

  return (
    containsNormalizedPhrase(identifier, query) ||
    compactIdentifier.startsWith(compactQuery) ||
    compactIdentifier.includes(compactQuery)
  );
}

function buildIdentifierMatch(input: {
  product: ProductReferenceRecord;
  productText: string;
  rawText: string;
  originalProductText: string | null;
  originalRawText: string;
}): IdentifierMatch | null {
  const canonical = normalizeText(
    input.product.productLine
  );
  const aliases = input.product.aliases.map((alias) => ({
    original: alias,
    normalized: normalizeText(alias)
  }));

  if (input.productText) {
    if (
      exactNormalizedMatch(
        input.productText,
        canonical
      )
    ) {
      return {
        score: 0.9,
        matchKind: "CANONICAL_EXACT",
        matchedPhrase:
          input.originalProductText ??
          input.product.productLine,
        evidenceField: "productText",
        sourceText:
          input.originalProductText ??
          input.product.productLine
      };
    }

    const exactAlias = aliases.find((alias) =>
      exactNormalizedMatch(
        input.productText,
        alias.normalized
      )
    );

    if (exactAlias) {
      return {
        score: 0.89,
        matchKind: "ALIAS_EXACT",
        matchedPhrase:
          input.originalProductText ??
          exactAlias.original,
        evidenceField: "productText",
        sourceText:
          input.originalProductText ??
          exactAlias.original
      };
    }

    if (
      containsNormalizedPhrase(
        input.productText,
        canonical
      )
    ) {
      return {
        score: 0.88,
        matchKind: "CANONICAL_PHRASE",
        matchedPhrase: input.product.productLine,
        evidenceField: "productText",
        sourceText:
          input.originalProductText ??
          input.product.productLine
      };
    }

    const phraseAlias = aliases.find((alias) =>
      containsNormalizedPhrase(
        input.productText,
        alias.normalized
      )
    );

    if (phraseAlias) {
      return {
        score: 0.87,
        matchKind: "ALIAS_PHRASE",
        matchedPhrase: phraseAlias.original,
        evidenceField: "productText",
        sourceText:
          input.originalProductText ??
          phraseAlias.original
      };
    }
  }

  if (
    containsNormalizedPhrase(
      input.rawText,
      canonical
    )
  ) {
    const sourcePhrase = findSourcePhrase(
      input.originalRawText,
      canonical
    );

    return {
      score: 0.88,
      matchKind: "CANONICAL_PHRASE",
      matchedPhrase: sourcePhrase,
      evidenceField: "rawText",
      sourceText: sourcePhrase
    };
  }

  const rawAlias = aliases.find((alias) =>
    containsNormalizedPhrase(
      input.rawText,
      alias.normalized
    )
  );

  if (rawAlias) {
    const sourcePhrase = findSourcePhrase(
      input.originalRawText,
      rawAlias.normalized
    );

    return {
      score: 0.87,
      matchKind: "ALIAS_PHRASE",
      matchedPhrase: sourcePhrase,
      evidenceField: "rawText",
      sourceText: sourcePhrase
    };
  }

  if (
    input.productText &&
    (
      isSupportedFamilyEvidence(
        input.productText,
        canonical
      ) ||
      aliases.some((alias) =>
        isSupportedFamilyEvidence(
          input.productText,
          alias.normalized
        )
      )
    )
  ) {
    return {
      score: 0.7,
      matchKind: "FAMILY",
      matchedPhrase:
        input.originalProductText ??
        input.product.productLine,
      evidenceField: "productText",
      sourceText:
        input.originalProductText ??
        input.product.productLine
    };
  }

  const rawFamilyPhrase = [
    canonical,
    ...aliases.map(
      (alias) => alias.normalized
    )
  ]
    .map((identifier) =>
      findLongestSupportedFamilyPhrase({
        rawText: input.rawText,
        identifier,
        product: input.product
      })
    )
    .filter(
      (phrase): phrase is string =>
        Boolean(phrase)
    )
    .sort(
      (first, second) =>
        tokenizeIdentityText(second).length -
          tokenizeIdentityText(first).length ||
        second.length - first.length
    )[0];

  if (rawFamilyPhrase) {
    const sourcePhrase = findSourcePhrase(
      input.originalRawText,
      rawFamilyPhrase
    );

    return {
      score: 0.7,
      matchKind: "FAMILY",
      matchedPhrase: sourcePhrase,
      evidenceField: "rawText",
      sourceText: sourcePhrase
    };
  }

  return null;
}

function inputHasProductIdentityUncertainty(
  rawText: string
): boolean {
  const identityText = normalizeText(rawText)
    .replace(
      /\b(?:condition|cond|shaft|flex|value|valuation)\s+(?:unknown|unclear|uncertain|pending)\b/g,
      " "
    )
    .replace(
      /\bserial(?:\s+number)?(?:\s+is)?\s+(?:unknown|unreadable|unclear|missing|pending)\b/g,
      " "
    )
    .replace(
      /\bgeneration\s+(?:not\s+listed|unknown|unclear|uncertain)\b/g,
      " generation uncertain "
    )
    .replace(/\s+/g, " ")
    .trim();

  const uncertaintyTerms =
    new Set(identityText.split(" "));

  return [
    "maybe",
    "possibly",
    "unclear",
    "uncertain"
  ].some(
    (term) => uncertaintyTerms.has(term)
  );
}

function roundScore(score: number): number {
  return Math.round(
    Math.min(Math.max(score, 0), 0.99) * 100
  ) / 100;
}

function scoreProduct(input: {
  product: ProductReferenceRecord;
  normalizedBrand: string;
  normalizedCategory:
    | ProductReferenceCategory
    | null;
  normalizedProductText: string;
  normalizedRawText: string;
  originalBrand: string | null;
  originalCategory: string | null;
  originalProductText: string | null;
  originalRawText: string;
  year: number | null;
}): ProductResolutionCandidate | null {
  const productBrand = normalizeBrand(
    input.product.brand
  );

  if (
    input.normalizedBrand &&
    productBrand !== input.normalizedBrand
  ) {
    return null;
  }

  if (
    input.normalizedCategory &&
    input.product.category !==
      input.normalizedCategory
  ) {
    return null;
  }

  const identifierMatch = buildIdentifierMatch({
    product: input.product,
    productText: input.normalizedProductText,
    rawText: input.normalizedRawText,
    originalProductText:
      input.originalProductText,
    originalRawText: input.originalRawText
  });

  if (!identifierMatch) {
    return null;
  }

  let score = identifierMatch.score;
  const evidence: ProductResolutionEvidence[] = [
    {
      field: identifierMatch.evidenceField,
      sourceText: identifierMatch.sourceText,
      detail:
        `Reference ${identifierMatch.matchKind.toLowerCase()
          .replaceAll("_", " ")} matched ` +
        `${input.product.productLine}.`
    }
  ];

  if (input.normalizedBrand) {
    score += 0.04;
    evidence.push({
      field: "brand",
      sourceText:
        input.originalBrand ??
        input.product.brand,
      detail:
        `Brand matched ${input.product.brand}.`
    });
  }

  if (input.normalizedCategory) {
    score += 0.04;
    evidence.push({
      field: "category",
      sourceText:
        input.originalCategory ??
        input.product.category,
      detail:
        `Category matched ${input.product.category}.`
    });
  }

  if (
    input.year &&
    input.year === input.product.year
  ) {
    score += 0.02;
    evidence.push({
      field: "year",
      sourceText: String(input.year),
      detail:
        `Model year matched ${input.product.year}.`
    });
  }

  return {
    productId: input.product.productId,
    sku: input.product.sku,
    brand: input.product.brand,
    productLine: input.product.productLine,
    category: input.product.category,
    year: input.product.year,
    score: roundScore(score),
    matchKind: identifierMatch.matchKind,
    matchedPhrase:
      identifierMatch.matchedPhrase,
    evidence
  };
}

function removeShadowedSpecificityCandidates(
  candidates: ProductResolutionCandidate[]
): ProductResolutionCandidate[] {
  return candidates.filter((candidate) => {
    if (candidate.matchKind === "FAMILY") {
      return true;
    }

    const candidatePhrase =
      normalizeText(candidate.matchedPhrase);
    const compactCandidatePhrase =
      compact(candidatePhrase);

    return !candidates.some((other) => {
      if (
        other.productId === candidate.productId ||
        other.matchKind === "FAMILY" ||
        normalizeBrand(other.brand) !==
          normalizeBrand(candidate.brand) ||
        other.category !== candidate.category ||
        other.score < candidate.score
      ) {
        return false;
      }

      const otherPhrase =
        normalizeText(other.matchedPhrase);
      const compactOtherPhrase =
        compact(otherPhrase);

      if (
        compactOtherPhrase.length <=
          compactCandidatePhrase.length
      ) {
        return false;
      }

      return (
        containsNormalizedPhrase(
          otherPhrase,
          candidatePhrase
        ) ||
        compactOtherPhrase.startsWith(
          compactCandidatePhrase
        )
      );
    });
  });
}

function buildBase(input: {
  productText: string | null;
  rawText: string;
  normalizedBrand: string;
  normalizedCategory:
    | ProductReferenceCategory
    | null;
  normalizedProductText: string;
  year: number | null;
  providerRecordCount: number;
  reason: string;
}): ProductResolutionBase {
  return {
    originalProductText: input.productText,
    rawText: input.rawText,
    normalizedInput: {
      brand: input.normalizedBrand || null,
      category: input.normalizedCategory,
      productText:
        input.normalizedProductText || null,
      year: input.year
    },
    providerRecordCount:
      input.providerRecordCount,
    reason: input.reason
  };
}

export function resolveProductReference(
  input: ProductResolutionInput,
  provider: ProductReferenceProvider =
    demoProductReferenceProvider
): ProductResolution {
  const products = provider.listProducts();
  const originalBrand =
    input.brand?.trim() || null;
  const originalCategory =
    input.category?.trim() || null;
  const originalProductText =
    input.productText?.trim() || null;
  const normalizedBrand =
    normalizeBrand(originalBrand);
  const normalizedCategory =
    normalizeCategory(originalCategory);
  const normalizedProductText =
    normalizeText(originalProductText);
  const normalizedRawText =
    normalizeText(input.rawText);
  const year = input.year ?? null;

  const scoredCandidates = products
    .map((product) =>
      scoreProduct({
        product,
        normalizedBrand,
        normalizedCategory,
        normalizedProductText,
        normalizedRawText,
        originalBrand,
        originalCategory,
        originalProductText,
        originalRawText: input.rawText,
        year
      })
    )
    .filter(
      (
        candidate
      ): candidate is ProductResolutionCandidate =>
        candidate !== null &&
        candidate.score >=
          MINIMUM_CANDIDATE_SCORE
    )
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.productId.localeCompare(
          second.productId
        )
    );

  const candidates =
    removeShadowedSpecificityCandidates(
      scoredCandidates
    );

  const bestCandidate = candidates[0];

  if (!bestCandidate) {
    return {
      ...buildBase({
        productText: originalProductText,
        rawText: input.rawText,
        normalizedBrand,
        normalizedCategory,
        normalizedProductText,
        year,
        providerRecordCount: products.length,
        reason:
          "No authoritative product reference matched the supplied identity evidence."
      }),
      status: "UNRESOLVED",
      candidates: []
    };
  }

  const secondCandidate = candidates[1];
  const candidatesAreNearTied =
    Boolean(secondCandidate) &&
    bestCandidate.score -
      secondCandidate!.score <=
      AMBIGUOUS_SCORE_MARGIN;
  const uncertainInputHasAlternatives =
    Boolean(secondCandidate) &&
    inputHasProductIdentityUncertainty(
      input.rawText
    );

  if (
    bestCandidate.matchKind === "FAMILY"
  ) {
    if (candidates.length > 1) {
      return {
        ...buildBase({
          productText: originalProductText,
          rawText: input.rawText,
          normalizedBrand,
          normalizedCategory,
          normalizedProductText,
          year,
          providerRecordCount:
            products.length,
          reason:
            "The source identified a product family but did not provide enough generation evidence for one authoritative product."
        }),
        status: "AMBIGUOUS",
        candidates
      };
    }

    return {
      ...buildBase({
        productText: originalProductText,
        rawText: input.rawText,
        normalizedBrand,
        normalizedCategory,
        normalizedProductText,
        year,
        providerRecordCount: products.length,
        reason:
          "A broad product-family candidate was found, but the source did not provide an exact canonical name or approved alias."
      }),
      status: "UNRESOLVED",
      candidates
    };
  }

  if (
    candidatesAreNearTied ||
    uncertainInputHasAlternatives
  ) {
    return {
      ...buildBase({
        productText: originalProductText,
        rawText: input.rawText,
        normalizedBrand,
        normalizedCategory,
        normalizedProductText,
        year,
        providerRecordCount: products.length,
        reason: candidatesAreNearTied
          ? "Multiple product references had nearly equal deterministic evidence and require human confirmation."
          : "The source expressed product-identity uncertainty while multiple reference candidates remained possible."
      }),
      status: "AMBIGUOUS",
      candidates
    };
  }

  if (
    bestCandidate.score <
    MINIMUM_AUTHORITATIVE_SCORE
  ) {
    return {
      ...buildBase({
        productText: originalProductText,
        rawText: input.rawText,
        normalizedBrand,
        normalizedCategory,
        normalizedProductText,
        year,
        providerRecordCount: products.length,
        reason:
          "Product candidates were found, but none had enough deterministic evidence for an authoritative match."
      }),
      status: "UNRESOLVED",
      candidates
    };
  }

  return {
    ...buildBase({
      productText: originalProductText,
      rawText: input.rawText,
      normalizedBrand,
      normalizedCategory,
      normalizedProductText,
      year,
      providerRecordCount: products.length,
      reason:
        "One product reference had authoritative deterministic identity evidence."
    }),
    status: "MATCHED",
    match: bestCandidate,
    candidates
  };
}
