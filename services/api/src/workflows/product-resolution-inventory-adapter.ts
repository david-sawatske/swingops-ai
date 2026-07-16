import type {
  InventoryProductLookupResult,
  SimilarInventoryProduct
} from "../internal-systems/inventory-service.js";
import type {
  InventoryProductCategory
} from "../internal-systems/inventory-demo-data.js";
import type {
  ProductResolution,
  ProductResolutionCandidate
} from "../product-reference/product-reference-resolver.js";

export type ProductResolutionInventoryFallback = {
  brand: string | null;
  productLine: string | null;
  category: InventoryProductCategory | null;
};

function toSimilarInventoryProduct(
  candidate: ProductResolutionCandidate
): SimilarInventoryProduct {
  return {
    productId: candidate.productId,
    sku: candidate.sku,
    brand: candidate.brand,
    productLine: candidate.productLine,
    category: candidate.category,
    confidence: candidate.score,
    reason:
      `Reference candidate matched ${candidate.matchedPhrase} via ${candidate.matchKind}.`
  };
}

export function buildInventoryLookupFromProductResolution(input: {
  resolution: ProductResolution;
  fallback: ProductResolutionInventoryFallback;
}): InventoryProductLookupResult {
  const { resolution, fallback } = input;

  if (resolution.status === "MATCHED") {
    const match = resolution.match;

    return {
      productId: match.productId,
      sku: match.sku,
      brand: match.brand,
      productLine: match.productLine,
      category: match.category,
      year: match.year,
      confidence: match.score,
      matchReasons: [
        `Brand matched ${match.brand}.`,
        `Product line matched ${match.productLine}.`,
        `Reference provider supplied stable product ID ${match.productId} and SKU ${match.sku}.`
      ],
      similarProducts: resolution.candidates
        .filter(
          (candidate) =>
            candidate.productId !==
            match.productId
        )
        .map(toSimilarInventoryProduct)
    };
  }

  const candidates =
    resolution.candidates.map(
      toSimilarInventoryProduct
    );

  if (resolution.status === "AMBIGUOUS") {
    return {
      productId: null,
      sku: null,
      brand: fallback.brand,
      productLine:
        fallback.productLine ??
        resolution.originalProductText,
      category:
        fallback.category ??
        resolution.normalizedInput.category,
      year:
        resolution.normalizedInput.year,
      confidence:
        resolution.candidates[0]?.score ?? 0,
      matchReasons: [
        resolution.reason,
        "Product reference candidates require human confirmation before inventory or valuation use."
      ],
      similarProducts: candidates
    };
  }

  return {
    productId: null,
    sku: null,
    brand: fallback.brand,
    productLine:
      fallback.productLine ??
      resolution.originalProductText,
    category:
      fallback.category ??
      resolution.normalizedInput.category,
    year:
      resolution.normalizedInput.year,
    confidence: 0,
    matchReasons: [
      resolution.reason,
      "No stable product ID or SKU was assigned."
    ],
    similarProducts: candidates
  };
}
