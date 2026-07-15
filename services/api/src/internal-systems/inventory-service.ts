import {
  demoInventoryProducts,
  type DemoInventoryProduct,
  type InventoryProductCategory
} from "./inventory-demo-data.js";

export type InventoryLookupInput = {
  brand?: string | null | undefined;
  productLine?: string | null | undefined;
  category?: string | null | undefined;
  year?: number | null | undefined;
  shaftBrand?: string | null | undefined;
  shaftModel?: string | null | undefined;
  rawText?: string | null | undefined;
};

export type SimilarInventoryProduct = {
  productId: string;
  sku: string;
  brand: string;
  productLine: string;
  category: InventoryProductCategory;
  confidence: number;
  reason: string;
};

export type InventoryProductLookupResult = {
  productId: string | null;
  sku: string | null;
  brand: string | null;
  productLine: string | null;
  category: InventoryProductCategory | null;
  year: number | null;
  confidence: number;
  matchReasons: string[];
  similarProducts: SimilarInventoryProduct[];
};

export type InventorySimilarProductsResult = {
  query: InventoryLookupInput;
  similarProducts: SimilarInventoryProduct[];
};

type ScoredProduct = {
  product: DemoInventoryProduct;
  score: number;
  reasons: string[];
};

const MINIMUM_MATCH_CONFIDENCE = 0.38;
const AMBIGUOUS_MATCH_SCORE_MARGIN = 0.05;

const brandAliases = new Map<string, string>([
  ["tm", "taylormade"],
  ["taylor made", "taylormade"],
  ["cally", "callaway"],
  ["titleist", "titleist"],
  ["ping", "ping"]
]);

const categoryAliases = new Map<string, InventoryProductCategory>([
  ["driver", "DRIVER"],
  ["drv", "DRIVER"],
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

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string): string {
  return value.replace(/\s+/g, "");
}

function normalizeBrand(value: string | null | undefined): string {
  const normalized = normalizeText(value);
  return brandAliases.get(normalized) ?? normalized;
}

function normalizeCategory(value: string | null | undefined): InventoryProductCategory | null {
  const normalized = normalizeText(value);
  return categoryAliases.get(normalized) ?? null;
}

function includesNormalized(haystack: string, needle: string): boolean {
  if (!needle) {
    return false;
  }

  return haystack.includes(needle) || compact(haystack).includes(compact(needle));
}

function containsNormalizedPhrase(
  haystack: string,
  needle: string
): boolean {
  const normalizedHaystack = normalizeText(haystack);
  const normalizedNeedle = normalizeText(needle);

  if (!normalizedNeedle) {
    return false;
  }

  return ` ${normalizedHaystack} `.includes(
    ` ${normalizedNeedle} `
  );
}

function getProductIdentifiers(
  product: DemoInventoryProduct
): string[] {
  return [
    normalizeText(product.productLine),
    ...product.aliases.map(normalizeText)
  ];
}

function inputHasModelUncertainty(
  input: InventoryLookupInput
): boolean {
  const uncertaintyText = normalizeText(
    [input.productLine, input.rawText]
      .filter(Boolean)
      .join(" ")
  );

  const modelEvidenceText = uncertaintyText
    .replace(
      /\b(?:condition|cond|shaft|flex|value|valuation)\s+(?:unknown|unclear|uncertain|pending)\b/g,
      " "
    )
    .replace(
      /\bserial(?:\s+number)?(?:\s+is)?\s+(?:unknown|unreadable|unclear|missing|pending)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  const uncertaintyTerms = modelEvidenceText.split(" ");

  return [
    "maybe",
    "possibly",
    "unknown",
    "unclear",
    "uncertain"
  ].some((term) => uncertaintyTerms.includes(term));
}

function productFamiliesOverlap(
  first: DemoInventoryProduct,
  second: DemoInventoryProduct
): boolean {
  if (normalizeBrand(first.brand) !== normalizeBrand(second.brand)) {
    return false;
  }

  const firstLine = compact(normalizeText(first.productLine));
  const secondLine = compact(normalizeText(second.productLine));

  return (
    firstLine.includes(secondLine) ||
    secondLine.includes(firstLine)
  );
}

function roundConfidence(value: number): number {
  return Math.round(Math.min(Math.max(value, 0), 0.99) * 100) / 100;
}

function scoreProduct(input: InventoryLookupInput, product: DemoInventoryProduct): ScoredProduct {
  const reasons: string[] = [];
  let score = 0;
  const hasModelUncertainty = inputHasModelUncertainty(input);

  const inputBrand = normalizeBrand(input.brand);
  const productBrand = normalizeBrand(product.brand);
  const inputProductLine = normalizeText(input.productLine);
  const inputCategory = normalizeCategory(input.category);
  const inputShaftText = normalizeText([input.shaftBrand, input.shaftModel].filter(Boolean).join(" "));
  const rawText = normalizeText(input.rawText);
  const searchableText = normalizeText([
    input.brand,
    input.productLine,
    input.category,
    input.shaftBrand,
    input.shaftModel,
    input.rawText
  ].filter(Boolean).join(" "));

  if (inputBrand && inputBrand === productBrand) {
    score += 0.32;
    reasons.push(`Brand matched ${product.brand}.`);
  }

  const productIdentifiers = getProductIdentifiers(product);
  const compactInputProductLine = compact(inputProductLine);

  const exactProductLineMatched = inputProductLine
    ? productIdentifiers.some(
        (identifier) =>
          compact(identifier) === compactInputProductLine
      )
    : productIdentifiers.some((identifier) =>
        containsNormalizedPhrase(searchableText, identifier)
      );

  const partialProductLineMatched =
    !exactProductLineMatched &&
    (
      productIdentifiers.some((identifier) =>
        includesNormalized(searchableText, identifier)
      ) ||
      Boolean(
        inputProductLine &&
        productIdentifiers.some(
          (identifier) =>
            includesNormalized(identifier, inputProductLine) ||
            includesNormalized(inputProductLine, identifier)
        )
      )
    );

  if (exactProductLineMatched) {
    score += 0.34;
    reasons.push(`Product line matched ${product.productLine}.`);
  } else if (partialProductLineMatched) {
    score += 0.18;
    reasons.push(
      `Product family partially matched ${product.productLine}.`
    );
  }

  if (inputCategory && inputCategory === product.category) {
    score += 0.2;
    reasons.push(`Category matched ${product.category}.`);
  }

  if (input.year && input.year === product.year) {
    score += 0.06;
    reasons.push(`Model year matched ${product.year}.`);
  }

  const shaftMatched = product.shaftFamilies.some((shaftFamily) => {
    const normalizedFamily = normalizeText(shaftFamily);

    return (
      includesNormalized(inputShaftText, normalizedFamily) ||
      includesNormalized(rawText, normalizedFamily)
    );
  });

  if (shaftMatched) {
    score += 0.04;
    reasons.push("Shaft family matched internal product fit data.");
  }

  if (hasModelUncertainty && score > 0) {
    score -= 0.12;
    reasons.push("Input included model uncertainty, so match confidence was reduced.");
  }

  if (score > 0 && score < 0.45) {
    reasons.push("Partial match only. Similar products should be reviewed.");
  }

  return {
    product,
    score: roundConfidence(score),
    reasons
  };
}

function toSimilarProduct(scoredProduct: ScoredProduct): SimilarInventoryProduct {
  return {
    productId: scoredProduct.product.productId,
    sku: scoredProduct.product.sku,
    brand: scoredProduct.product.brand,
    productLine: scoredProduct.product.productLine,
    category: scoredProduct.product.category,
    confidence: scoredProduct.score,
    reason: scoredProduct.reasons[0] ?? "Similar internal product candidate."
  };
}

function getScoredProducts(input: InventoryLookupInput): ScoredProduct[] {
  return demoInventoryProducts
    .map((product) => scoreProduct(input, product))
    .filter((scoredProduct) => scoredProduct.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function lookupInventoryProduct(
  input: InventoryLookupInput
): InventoryProductLookupResult {
  const scoredProducts = getScoredProducts(input);
  const bestMatch = scoredProducts[0];

  if (!bestMatch || bestMatch.score < MINIMUM_MATCH_CONFIDENCE) {
    return {
      productId: null,
      sku: null,
      brand: input.brand ?? null,
      productLine: input.productLine ?? null,
      category: normalizeCategory(input.category),
      year: input.year ?? null,
      confidence: 0,
      matchReasons: ["No internal SKU match cleared the minimum demo confidence threshold."],
      similarProducts: scoredProducts.slice(0, 3).map(toSimilarProduct)
    };
  }

  const secondBestMatch = scoredProducts[1];
  const inputCategory = normalizeCategory(input.category);

  const candidatesAreTied =
    Boolean(secondBestMatch) &&
    bestMatch.score - secondBestMatch!.score <=
      AMBIGUOUS_MATCH_SCORE_MARGIN;

  const uncertainInputHasAlternatives =
    Boolean(secondBestMatch) &&
    inputHasModelUncertainty(input);

  const missingCategoryHasFamilyConflict =
    Boolean(secondBestMatch) &&
    !inputCategory &&
    secondBestMatch!.score >= 0.45 &&
    bestMatch.product.category !==
      secondBestMatch!.product.category &&
    productFamiliesOverlap(
      bestMatch.product,
      secondBestMatch!.product
    );

  if (
    secondBestMatch &&
    secondBestMatch.score >= MINIMUM_MATCH_CONFIDENCE &&
    (
      candidatesAreTied ||
      uncertainInputHasAlternatives ||
      missingCategoryHasFamilyConflict
    )
  ) {
    return {
      productId: null,
      sku: null,
      brand: input.brand ?? null,
      productLine: input.productLine ?? null,
      category: inputCategory,
      year: input.year ?? null,
      confidence: bestMatch.score,
      matchReasons: [
        "Multiple internal products had similar evidence and require generation confirmation."
      ],
      similarProducts: scoredProducts.slice(0, 3).map(toSimilarProduct)
    };
  }

  const similarProducts = scoredProducts
    .slice(1, 4)
    .filter((scoredProduct) => scoredProduct.score >= 0.28)
    .map(toSimilarProduct);

  return {
    productId: bestMatch.product.productId,
    sku: bestMatch.product.sku,
    brand: bestMatch.product.brand,
    productLine: bestMatch.product.productLine,
    category: bestMatch.product.category,
    year: bestMatch.product.year,
    confidence: bestMatch.score,
    matchReasons: bestMatch.reasons,
    similarProducts
  };
}

export function findSimilarInventoryProducts(
  input: InventoryLookupInput
): InventorySimilarProductsResult {
  return {
    query: input,
    similarProducts: getScoredProducts(input).slice(0, 5).map(toSimilarProduct)
  };
}
