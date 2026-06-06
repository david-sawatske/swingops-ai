import type { KnowledgeChunkType } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export type KnowledgeSearchInput = {
  query: string;
  sourceName?: string;
  brand?: string;
  category?: string;
  chunkType?: KnowledgeChunkType;
  maxResults?: number;
};

export type KnowledgeSearchResultItem = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceName: string;
  chunkText: string;
  chunkType: KnowledgeChunkType;
  brand: string | null;
  productLine: string | null;
  category: string | null;
  score: number;
  matchedTerms: string[];
  scoringExplanation: string[];
  metadata: unknown;
  citation: {
    sourceName: string;
    documentTitle: string;
    chunkIndex: number;
  };
};

export type KnowledgeSearchResult = {
  query: string;
  results: KnowledgeSearchResultItem[];
  queryMetadata: {
    normalizedQuery: string;
    tokens: string[];
    filters: {
      brand: string | null;
      category: string | null;
      chunkType: KnowledgeChunkType | null;
    };
    retrievalMode: "DETERMINISTIC_LOCAL_RAG_READY";
    productionVectorEmbeddings: false;
  };
  citations: KnowledgeSearchResultItem["citation"][];
  summary: string;
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function tokensFor(value: string): string[] {
  return normalize(value).split(" ").filter(Boolean);
}

function hasPhrase(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalize(needle);
  return normalizedNeedle.length > 0 && haystack.includes(normalizedNeedle);
}

function getAliases(metadata: unknown): string[] {
  if (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    "aliases" in metadata &&
    Array.isArray(metadata.aliases)
  ) {
    return metadata.aliases.filter((value): value is string => typeof value === "string");
  }

  return [];
}

function getConditionFlags(metadata: unknown): string[] {
  if (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    "conditionFlags" in metadata &&
    Array.isArray(metadata.conditionFlags)
  ) {
    return metadata.conditionFlags.filter((value): value is string => typeof value === "string");
  }

  return [];
}

function scoreChunk(input: {
  normalizedQuery: string;
  queryTokens: string[];
  chunk: {
    chunkText: string;
    searchText: string;
    brand: string | null;
    productLine: string | null;
    category: string | null;
    chunkType: KnowledgeChunkType;
    metadataJson: unknown;
  };
  filters: {
    brand: string | null;
    category: string | null;
    chunkType: KnowledgeChunkType | null;
  };
}): {
  score: number;
  matchedTerms: string[];
  scoringExplanation: string[];
} {
  const searchable = normalize(input.chunk.searchText);
  const matchedTerms: string[] = [];
  const scoringExplanation: string[] = [];
  let score = 0;

  for (const alias of getAliases(input.chunk.metadataJson)) {
    if (hasPhrase(input.normalizedQuery, alias) || hasPhrase(searchable, alias)) {
      const aliasTokens = tokensFor(alias);
      const aliasOverlap = aliasTokens.filter((token) => input.queryTokens.includes(token));

      if (aliasOverlap.length > 0) {
        score += 0.45 + aliasOverlap.length * 0.08;
        matchedTerms.push(...aliasOverlap, alias);
        scoringExplanation.push(`Alias overlap matched ${aliasOverlap.join(", ")} from "${alias}".`);
      }
    }
  }

  if (input.chunk.brand && hasPhrase(input.normalizedQuery, input.chunk.brand)) {
    score += 0.35;
    matchedTerms.push(input.chunk.brand);
    scoringExplanation.push(`Brand matched ${input.chunk.brand}.`);
  }

  if (input.chunk.productLine && hasPhrase(input.normalizedQuery, input.chunk.productLine)) {
    score += 0.4;
    matchedTerms.push(input.chunk.productLine);
    scoringExplanation.push(`Product line matched ${input.chunk.productLine}.`);
  }

  if (input.chunk.category && input.queryTokens.includes(normalize(input.chunk.category))) {
    score += 0.25;
    matchedTerms.push(input.chunk.category);
    scoringExplanation.push(`Category token matched ${input.chunk.category}.`);
  }

  const searchableTokens = new Set(tokensFor(searchable));
  const tokenMatches = input.queryTokens.filter((token) => searchableTokens.has(token));
  if (tokenMatches.length > 0) {
    score += tokenMatches.length * 0.08;
    matchedTerms.push(...tokenMatches);
    scoringExplanation.push(`Token overlap matched ${unique(tokenMatches).join(", ")}.`);
  }

  for (const flag of getConditionFlags(input.chunk.metadataJson)) {
    const flagTokens = tokensFor(flag);
    if (flagTokens.some((token) => input.queryTokens.includes(token))) {
      score += 0.16;
      matchedTerms.push(flag);
      scoringExplanation.push(`Condition or policy flag matched ${flag}.`);
    }
  }

  if (input.filters.brand && input.chunk.brand && normalize(input.filters.brand) === normalize(input.chunk.brand)) {
    score += 0.18;
    scoringExplanation.push("Brand filter matched.");
  }

  if (
    input.filters.category &&
    input.chunk.category &&
    normalize(input.filters.category) === normalize(input.chunk.category)
  ) {
    score += 0.18;
    scoringExplanation.push("Category filter matched.");
  }

  if (input.filters.chunkType && input.filters.chunkType === input.chunk.chunkType) {
    score += 0.18;
    scoringExplanation.push("Chunk type filter matched.");
  }

  return {
    score: Math.min(0.99, Number(score.toFixed(2))),
    matchedTerms: unique(matchedTerms.map((term) => term.trim()).filter(Boolean)),
    scoringExplanation
  };
}

export async function searchKnowledgeBase(
  input: KnowledgeSearchInput
): Promise<KnowledgeSearchResult> {
  const maxResults = Math.min(Math.max(input.maxResults ?? 5, 1), 10);
  const normalizedQuery = normalize(input.query);
  const queryTokens = tokensFor(input.query);

  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      ...(input.brand ? { brand: { equals: input.brand, mode: "insensitive" } } : {}),
      ...(input.category ? { category: { equals: input.category, mode: "insensitive" } } : {}),
      ...(input.chunkType ? { chunkType: input.chunkType } : {}),
      ...(input.sourceName
        ? {
            document: {
              sourceName: input.sourceName
            }
          }
        : {})
    },
    include: {
      document: true
    },
    orderBy: [
      {
        createdAt: "asc"
      },
      {
        chunkIndex: "asc"
      }
    ]
  });

  const filters = {
    brand: input.brand ?? null,
    category: input.category ?? null,
    chunkType: input.chunkType ?? null,
      sourceName: input.sourceName ?? null
  };

  const results = chunks
    .map((chunk) => {
      const scored = scoreChunk({
        normalizedQuery,
        queryTokens,
        chunk,
        filters
      });

      return {
        chunk,
        scored
      };
    })
    .filter(({ scored }) => scored.score > 0)
    .sort((left, right) => right.scored.score - left.scored.score)
    .slice(0, maxResults)
    .map<KnowledgeSearchResultItem>(({ chunk, scored }) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentTitle: chunk.document.title,
      sourceName: chunk.document.sourceName,
      chunkText: chunk.chunkText,
      chunkType: chunk.chunkType,
      brand: chunk.brand,
      productLine: chunk.productLine,
      category: chunk.category,
      score: scored.score,
      matchedTerms: scored.matchedTerms,
      scoringExplanation: scored.scoringExplanation,
      metadata: chunk.metadataJson,
      citation: {
        sourceName: chunk.document.sourceName,
        documentTitle: chunk.document.title,
        chunkIndex: chunk.chunkIndex
      }
    }));

  return {
    query: input.query,
    results,
    queryMetadata: {
      normalizedQuery,
      tokens: queryTokens,
      filters,
      retrievalMode: "DETERMINISTIC_LOCAL_RAG_READY",
      productionVectorEmbeddings: false
    },
    citations: results.map((result) => result.citation),
    summary:
      results.length === 0
        ? "No local knowledge-base chunks matched this query. Run demo ingestion first or broaden the query."
        : `Knowledge-base search returned ${results.length} grounded chunk${results.length === 1 ? "" : "s"} using deterministic local retrieval.`
  };
}

export async function listKnowledgeChunks() {
  const chunks = await prisma.knowledgeChunk.findMany({
    include: {
      document: true
    },
    orderBy: [
      {
        createdAt: "desc"
      },
      {
        chunkIndex: "asc"
      }
    ],
    take: 100
  });

  return {
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      documentTitle: chunk.document.title,
      sourceName: chunk.document.sourceName,
      chunkIndex: chunk.chunkIndex,
      chunkText: chunk.chunkText,
      chunkType: chunk.chunkType,
      brand: chunk.brand,
      productLine: chunk.productLine,
      category: chunk.category,
      metadataJson: chunk.metadataJson,
      createdAt: chunk.createdAt.toISOString(),
      updatedAt: chunk.updatedAt.toISOString()
    }))
  };
}
