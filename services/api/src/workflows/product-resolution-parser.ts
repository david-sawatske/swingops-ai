import type {
  ProductReferenceProvider
} from "../product-reference/product-reference-provider.js";
import {
  resolveProductReference,
  type ProductResolution
} from "../product-reference/product-reference-resolver.js";
import type {
  ParserFieldEvidence
} from "./parser-evidence.js";

export type ParsedProductIdentity = {
  brand: string | null;
  productLine: string | null;
  category: string | null;
  productLineEvidence: ParserFieldEvidence | undefined;
  productResolution: ProductResolution;
  uncertaintyNotes: string[];
};

function getConsensusValue(
  values: (string | null | undefined)[]
): string | null {
  const normalizedValues = [
    ...new Set(
      values.filter(
        (value): value is string =>
          Boolean(value)
      )
    )
  ];

  return normalizedValues.length === 1
    ? normalizedValues[0] ?? null
    : null;
}

function getAmbiguousProductLine(
  resolution: Extract<
    ProductResolution,
    { status: "AMBIGUOUS" }
  >
): string | null {
  const familyCandidate =
    resolution.candidates.find(
      (candidate) =>
        candidate.matchKind === "FAMILY"
    );

  return (
    resolution.originalProductText ??
    familyCandidate?.matchedPhrase ??
    resolution.candidates[0]?.matchedPhrase ??
    null
  );
}

function buildProductLineEvidence(input: {
  value: string | null;
  sourceText: string | null;
}): ParserFieldEvidence | undefined {
  if (!input.value || !input.sourceText) {
    return undefined;
  }

  return {
    value: input.value,
    sourceText: input.sourceText
  };
}

export function resolveParsedProductIdentity(input: {
  rawText: string;
  detectedBrand: string | null;
  detectedCategory: string | null;
  productText?: string | null;
  provider?: ProductReferenceProvider;
}): ParsedProductIdentity {
  const resolutionInput = {
    brand: input.detectedBrand,
    category: input.detectedCategory,
    rawText: input.rawText,
    ...(input.productText === undefined
      ? {}
      : {
          productText: input.productText
        })
  };

  const resolution = input.provider
    ? resolveProductReference(
        resolutionInput,
        input.provider
      )
    : resolveProductReference(
        resolutionInput
      );

  if (resolution.status === "MATCHED") {
    return {
      brand: resolution.match.brand,
      productLine:
        resolution.match.productLine,
      category: resolution.match.category,
      productLineEvidence:
        buildProductLineEvidence({
          value:
            resolution.match.productLine,
          sourceText:
            resolution.match.matchedPhrase
        }),
      productResolution: resolution,
      uncertaintyNotes: []
    };
  }

  if (resolution.status === "AMBIGUOUS") {
    const productLine =
      getAmbiguousProductLine(resolution);
    const familyCandidate =
      resolution.candidates.find(
        (candidate) =>
          candidate.matchKind === "FAMILY"
      );

    return {
      brand:
        getConsensusValue(
          resolution.candidates.map(
            (candidate) => candidate.brand
          )
        ) ?? input.detectedBrand,
      productLine,
      category:
        getConsensusValue(
          resolution.candidates.map(
            (candidate) =>
              candidate.category
          )
        ) ?? input.detectedCategory,
      productLineEvidence:
        buildProductLineEvidence({
          value: productLine,
          sourceText:
            resolution.originalProductText ??
            familyCandidate?.matchedPhrase ??
            resolution.candidates[0]
              ?.matchedPhrase ??
            null
        }),
      productResolution: resolution,
      uncertaintyNotes: [
        "model uncertain"
      ]
    };
  }

  return {
    brand: input.detectedBrand,
    productLine:
      resolution.originalProductText,
    category: input.detectedCategory,
    productLineEvidence:
      buildProductLineEvidence({
        value:
          resolution.originalProductText,
        sourceText:
          resolution.originalProductText
      }),
    productResolution: resolution,
    uncertaintyNotes: [
      "product reference unresolved"
    ]
  };
}
