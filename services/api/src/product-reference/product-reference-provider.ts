import type {
  ProductReferenceAlias,
  ProductReferenceCategory,
  ProductReferenceData,
  ProductReferenceDetection,
  ProductReferenceRecord,
  ProductReferenceSearchInput,
  ProductReferenceSearchResult,
} from "./product-reference-types.js";

export type ProductReferenceProvider = {
  searchCandidates: (
    input: ProductReferenceSearchInput,
  ) => ProductReferenceSearchResult;
  detectBrand: (text: string) => ProductReferenceDetection<string> | null;
  detectCategory: (
    text: string,
  ) => ProductReferenceDetection<ProductReferenceCategory> | null;
  findByProductId: (productId: string) => ProductReferenceRecord | null;
  findBySku: (sku: string) => ProductReferenceRecord | null;
};

const DEFAULT_SEARCH_LIMIT = 25;
const MAXIMUM_SEARCH_LIMIT = 100;

const GENERIC_SEARCH_TOKENS = new Set([
  "club",
  "clubs",
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
  "golf",
]);

export function normalizeProductReferenceText(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .replace(/([a-z])(\d)/gi, "$1 $2")
    .replace(/(\d)([a-z])/gi, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string | null | undefined): string[] {
  return normalizeProductReferenceText(value).match(/[a-z]+|\d+/g) ?? [];
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findAliasMatch(text: string, alias: string) {
  const tokens = tokenize(alias);

  if (tokens.length === 0) {
    return null;
  }

  const pattern = tokens.map(escapeRegularExpression).join("[^a-zA-Z0-9]*");
  const match = text.match(new RegExp(`\\b${pattern}\\b`, "i"));

  if (!match?.[0] || match.index === undefined) {
    return null;
  }

  return {
    matchedText: match[0],
    index: match.index,
    tokenCount: tokens.length,
  };
}

function cloneProductReference(
  product: ProductReferenceRecord,
): ProductReferenceRecord {
  return {
    ...product,
    aliases: [...product.aliases],
    shaftFamilies: [...product.shaftFamilies],
  };
}

function validateUniqueProductReferences(
  products: readonly ProductReferenceRecord[],
): void {
  const productIds = new Set<string>();
  const skus = new Set<string>();

  for (const product of products) {
    if (productIds.has(product.productId)) {
      throw new Error(`Duplicate product reference ID: ${product.productId}`);
    }

    if (skus.has(product.sku)) {
      throw new Error(`Duplicate product reference SKU: ${product.sku}`);
    }

    productIds.add(product.productId);
    skus.add(product.sku);
  }
}

function mergeAliases<TValue extends string>(
  configuredAliases: readonly ProductReferenceAlias<TValue>[],
  inferredAliases: readonly ProductReferenceAlias<TValue>[],
): ProductReferenceAlias<TValue>[] {
  const aliasesByKey = new Map<string, ProductReferenceAlias<TValue>>();

  for (const entry of [...inferredAliases, ...configuredAliases]) {
    const normalizedAlias = normalizeProductReferenceText(entry.alias);

    if (!normalizedAlias) {
      continue;
    }

    aliasesByKey.set(
      `${normalizeProductReferenceText(entry.value)}:${normalizedAlias}`,
      { ...entry },
    );
  }

  return [...aliasesByKey.values()];
}

function detectReferenceValue<TValue extends string>(
  text: string,
  aliases: readonly ProductReferenceAlias<TValue>[],
): ProductReferenceDetection<TValue> | null {
  const matches = aliases
    .map((entry) => {
      const match = findAliasMatch(text, entry.alias);

      return match ? { entry, match } : null;
    })
    .filter(
      (
        candidate,
      ): candidate is {
        entry: ProductReferenceAlias<TValue>;
        match: NonNullable<ReturnType<typeof findAliasMatch>>;
      } => candidate !== null,
    )
    .sort(
      (first, second) =>
        second.entry.confidence - first.entry.confidence ||
        second.match.tokenCount - first.match.tokenCount ||
        second.match.matchedText.length - first.match.matchedText.length ||
        first.match.index - second.match.index,
    );
  const bestMatch = matches[0];

  return bestMatch
    ? {
        value: bestMatch.entry.value,
        matchedText: bestMatch.match.matchedText,
        confidence: bestMatch.entry.confidence,
      }
    : null;
}

function addToIndex<TKey>(
  index: Map<TKey, Set<ProductReferenceRecord>>,
  key: TKey,
  record: ProductReferenceRecord,
) {
  const matches = index.get(key) ?? new Set<ProductReferenceRecord>();
  matches.add(record);
  index.set(key, matches);
}

function intersectRecords(
  first: ReadonlySet<ProductReferenceRecord>,
  second: ReadonlySet<ProductReferenceRecord>,
): Set<ProductReferenceRecord> {
  return new Set([...first].filter((record) => second.has(record)));
}

function containsNormalizedPhrase(haystack: string, needle: string): boolean {
  return Boolean(needle) && ` ${haystack} `.includes(` ${needle} `);
}

function scoreSearchCandidate(input: {
  record: ProductReferenceRecord;
  searchText: string;
  queryTokens: ReadonlySet<string>;
  detectedBrand: string | null;
  detectedCategory: ProductReferenceCategory | null;
  year: number | null;
}): number {
  const canonicalProduct = normalizeProductReferenceText(
    input.record.productLine,
  );
  const aliases = input.record.aliases.map(normalizeProductReferenceText);
  const recordTokens = new Set([
    ...tokenize(input.record.productLine),
    ...input.record.aliases.flatMap(tokenize),
  ]);
  const tokenMatches = [...input.queryTokens].filter((token) =>
    recordTokens.has(token),
  ).length;
  let score = tokenMatches * 10;

  if (containsNormalizedPhrase(input.searchText, canonicalProduct)) {
    score += 100;
  }

  if (
    aliases.some((alias) => containsNormalizedPhrase(input.searchText, alias))
  ) {
    score += 95;
  }

  if (
    input.detectedBrand &&
    normalizeProductReferenceText(input.record.brand) ===
      normalizeProductReferenceText(input.detectedBrand)
  ) {
    score += 6;
  }

  if (
    input.detectedCategory &&
    input.record.category === input.detectedCategory
  ) {
    score += 6;
  }

  if (input.year && input.record.year === input.year) {
    score += 2;
  }

  return score;
}

export function createInMemoryProductReferenceProvider(
  products: readonly ProductReferenceRecord[],
  referenceData: ProductReferenceData = {
    brandAliases: [],
    categoryAliases: [],
  },
): ProductReferenceProvider {
  validateUniqueProductReferences(products);

  const records = products.map(cloneProductReference);
  const productsById = new Map(
    records.map((product) => [product.productId, product]),
  );
  const productsBySku = new Map(
    records.map((product) => [product.sku, product]),
  );
  const inferredBrandAliases = records.map((product) => ({
    value: product.brand,
    alias: product.brand,
    confidence: 1,
  }));
  const inferredCategoryAliases = records.map((product) => ({
    value: product.category,
    alias: product.category.replaceAll("_", " "),
    confidence: 1,
  }));
  const brandAliases = mergeAliases(
    referenceData.brandAliases,
    inferredBrandAliases,
  );
  const categoryAliases = mergeAliases(
    referenceData.categoryAliases,
    inferredCategoryAliases,
  );
  const brandIndex = new Map<string, Set<ProductReferenceRecord>>();
  const categoryIndex = new Map<
    ProductReferenceCategory,
    Set<ProductReferenceRecord>
  >();
  const tokenIndex = new Map<string, Set<ProductReferenceRecord>>();

  for (const record of records) {
    addToIndex(brandIndex, normalizeProductReferenceText(record.brand), record);
    addToIndex(categoryIndex, record.category, record);

    const identityTokens = new Set([
      ...tokenize(record.productLine),
      ...record.aliases.flatMap(tokenize),
      ...tokenize(record.sku),
    ]);

    for (const token of identityTokens) {
      if (!GENERIC_SEARCH_TOKENS.has(token)) {
        addToIndex(tokenIndex, token, record);
      }
    }
  }

  const detectBrand = (text: string) =>
    detectReferenceValue(text, brandAliases);
  const detectCategory = (text: string) =>
    detectReferenceValue(text, categoryAliases);

  return {
    searchCandidates(input) {
      const detectedBrand = input.brand
        ? detectBrand(input.brand)
        : detectBrand(input.rawText);
      const detectedCategory = input.category
        ? detectCategory(input.category)
        : detectCategory(input.rawText);
      const brandMatches = detectedBrand
        ? brandIndex.get(normalizeProductReferenceText(detectedBrand.value))
        : undefined;
      const categoryMatches = detectedCategory
        ? categoryIndex.get(detectedCategory.value)
        : undefined;
      let candidatePool = new Set<ProductReferenceRecord>();

      if (brandMatches && categoryMatches) {
        candidatePool = intersectRecords(brandMatches, categoryMatches);
      } else if (brandMatches) {
        candidatePool = new Set(brandMatches);
      } else if (categoryMatches) {
        candidatePool = new Set(categoryMatches);
      }

      const searchText = normalizeProductReferenceText(
        [input.productText, input.rawText].filter(Boolean).join(" "),
      );
      const queryTokens = new Set(
        tokenize(searchText).filter(
          (token) => !GENERIC_SEARCH_TOKENS.has(token),
        ),
      );

      if (candidatePool.size === 0) {
        for (const token of queryTokens) {
          for (const record of tokenIndex.get(token) ?? []) {
            candidatePool.add(record);
          }
        }
      }

      const rankedCandidates = [...candidatePool]
        .map((record) => ({
          record,
          score: scoreSearchCandidate({
            record,
            searchText,
            queryTokens,
            detectedBrand: detectedBrand?.value ?? null,
            detectedCategory: detectedCategory?.value ?? null,
            year: input.year ?? null,
          }),
        }))
        .sort(
          (first, second) =>
            second.score - first.score ||
            first.record.productId.localeCompare(second.record.productId),
        );
      const requestedLimit = Math.floor(input.limit ?? DEFAULT_SEARCH_LIMIT);
      const limit = Math.min(Math.max(requestedLimit, 1), MAXIMUM_SEARCH_LIMIT);

      return {
        candidates: rankedCandidates
          .slice(0, limit)
          .map(({ record }) => cloneProductReference(record)),
        totalMatches: rankedCandidates.length,
      };
    },
    detectBrand,
    detectCategory,
    findByProductId(productId) {
      const product = productsById.get(productId);

      return product ? cloneProductReference(product) : null;
    },
    findBySku(sku) {
      const product = productsBySku.get(sku);

      return product ? cloneProductReference(product) : null;
    },
  };
}
