import type { KnowledgeChunkType } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import {
  buildDeterministicKnowledgeEmbedding,
  KNOWLEDGE_EMBEDDING_DIMENSION,
  KNOWLEDGE_EMBEDDING_MODEL,
  KNOWLEDGE_EMBEDDING_PROVIDER,
  toPgvectorLiteral
} from "./knowledge-embeddings.js";

export type KnowledgeRetrievalMode =
  | "PGVECTOR_DETERMINISTIC_EMBEDDINGS"
  | "DETERMINISTIC_LOCAL_RAG_READY";

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
      sourceName: string | null;
    };
    retrievalMode: KnowledgeRetrievalMode;
    productionVectorEmbeddings: false;
    embeddingProvider: string | null;
    embeddingModel: string | null;
    embeddingDimension: number | null;
  };
  citations: KnowledgeSearchResultItem["citation"][];
  summary: string;
};

type KnowledgeChunkWithDocument = Awaited<
  ReturnType<typeof prisma.knowledgeChunk.findMany>
>[number] & {
  document: {
    id: string;
    title: string;
    sourceName: string;
  };
};

type PgvectorKnowledgeRow = {
  id: string;
  document_id: string;
  document_title: string;
  source_name: string;
  chunk_index: number;
  chunk_text: string;
  chunk_type: KnowledgeChunkType;
  brand: string | null;
  product_line: string | null;
  category: string | null;
  metadata_json: unknown;
  search_text: string;
  embedding_provider: string | null;
  embedding_model: string | null;
  embedding_dimension: number | null;
  vector_score: number;
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
    sourceName: string | null;
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
    const aliasTokens = tokensFor(alias);
    const aliasOverlap = aliasTokens.filter((token) => input.queryTokens.includes(token));

    if (aliasOverlap.length > 0) {
      score += 0.38 + aliasOverlap.length * 0.07;
      matchedTerms.push(...aliasOverlap, alias);
      scoringExplanation.push(`Alias overlap matched ${aliasOverlap.join(", ")} from "${alias}".`);
    }
  }

  if (input.chunk.brand && hasPhrase(input.normalizedQuery, input.chunk.brand)) {
    score += 0.3;
    matchedTerms.push(input.chunk.brand);
    scoringExplanation.push(`Brand matched ${input.chunk.brand}.`);
  }

  if (input.chunk.productLine && hasPhrase(input.normalizedQuery, input.chunk.productLine)) {
    score += 0.38;
    matchedTerms.push(input.chunk.productLine);
    scoringExplanation.push(`Product line matched ${input.chunk.productLine}.`);
  }

  if (input.chunk.category && input.queryTokens.includes(normalize(input.chunk.category))) {
    score += 0.2;
    matchedTerms.push(input.chunk.category);
    scoringExplanation.push(`Category token matched ${input.chunk.category}.`);
  }

  const searchableTokens = new Set(tokensFor(searchable));
  const tokenMatches = input.queryTokens.filter((token) => searchableTokens.has(token));
  if (tokenMatches.length > 0) {
    score += tokenMatches.length * 0.055;
    matchedTerms.push(...tokenMatches);
    scoringExplanation.push(`Token overlap matched ${unique(tokenMatches).join(", ")}.`);
  }

  for (const flag of getConditionFlags(input.chunk.metadataJson)) {
    const flagTokens = tokensFor(flag);
    if (flagTokens.some((token) => input.queryTokens.includes(token))) {
      score += 0.13;
      matchedTerms.push(flag);
      scoringExplanation.push(`Condition or policy flag matched ${flag}.`);
    }
  }

  if (input.filters.brand && input.chunk.brand && normalize(input.filters.brand) === normalize(input.chunk.brand)) {
    score += 0.16;
    scoringExplanation.push("Brand filter matched.");
  }

  if (
    input.filters.category &&
    input.chunk.category &&
    normalize(input.filters.category) === normalize(input.chunk.category)
  ) {
    score += 0.16;
    scoringExplanation.push("Category filter matched.");
  }

  if (input.filters.chunkType && input.filters.chunkType === input.chunk.chunkType) {
    score += 0.16;
    scoringExplanation.push("Chunk type filter matched.");
  }

  return {
    score: Math.min(0.98, Number(score.toFixed(3))),
    matchedTerms: unique(matchedTerms.map((term) => term.trim()).filter(Boolean)),
    scoringExplanation
  };
}

function buildFilters(input: KnowledgeSearchInput) {
  return {
    brand: input.brand ?? null,
    category: input.category ?? null,
    chunkType: input.chunkType ?? null,
    sourceName: input.sourceName ?? null
  };
}

function buildSummary(input: {
  resultCount: number;
  retrievalMode: KnowledgeRetrievalMode;
}): string {
  if (input.resultCount === 0) {
    return "No local knowledge-base chunks matched this query. Run demo ingestion first or broaden the query.";
  }

  if (input.retrievalMode === "PGVECTOR_DETERMINISTIC_EMBEDDINGS") {
    return `Knowledge-base search returned ${input.resultCount} grounded chunk${input.resultCount === 1 ? "" : "s"} using Postgres pgvector with deterministic local embeddings.`;
  }

  return `Knowledge-base search returned ${input.resultCount} grounded chunk${input.resultCount === 1 ? "" : "s"} using deterministic local retrieval fallback.`;
}

function toSearchResult(input: {
  query: string;
  normalizedQuery: string;
  queryTokens: string[];
  filters: ReturnType<typeof buildFilters>;
  retrievalMode: KnowledgeRetrievalMode;
  results: KnowledgeSearchResultItem[];
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddingDimension: number | null;
}): KnowledgeSearchResult {
  return {
    query: input.query,
    results: input.results,
    queryMetadata: {
      normalizedQuery: input.normalizedQuery,
      tokens: input.queryTokens,
      filters: input.filters,
      retrievalMode: input.retrievalMode,
      productionVectorEmbeddings: false,
      embeddingProvider: input.embeddingProvider,
      embeddingModel: input.embeddingModel,
      embeddingDimension: input.embeddingDimension
    },
    citations: input.results.map((result) => result.citation),
    summary: buildSummary({
      resultCount: input.results.length,
      retrievalMode: input.retrievalMode
    })
  };
}

function toDeterministicResultItem(input: {
  chunk: KnowledgeChunkWithDocument;
  scored: ReturnType<typeof scoreChunk>;
}): KnowledgeSearchResultItem {
  return {
    chunkId: input.chunk.id,
    documentId: input.chunk.documentId,
    documentTitle: input.chunk.document.title,
    sourceName: input.chunk.document.sourceName,
    chunkText: input.chunk.chunkText,
    chunkType: input.chunk.chunkType,
    brand: input.chunk.brand,
    productLine: input.chunk.productLine,
    category: input.chunk.category,
    score: input.scored.score,
    matchedTerms: input.scored.matchedTerms,
    scoringExplanation: input.scored.scoringExplanation,
    metadata: input.chunk.metadataJson,
    citation: {
      sourceName: input.chunk.document.sourceName,
      documentTitle: input.chunk.document.title,
      chunkIndex: input.chunk.chunkIndex
    }
  };
}

function toPgvectorResultItem(input: {
  row: PgvectorKnowledgeRow;
  scored: ReturnType<typeof scoreChunk>;
}): KnowledgeSearchResultItem {
  const blendedScore = Math.min(
    0.99,
    Number((input.row.vector_score * 0.72 + input.scored.score * 0.28).toFixed(3))
  );

  return {
    chunkId: input.row.id,
    documentId: input.row.document_id,
    documentTitle: input.row.document_title,
    sourceName: input.row.source_name,
    chunkText: input.row.chunk_text,
    chunkType: input.row.chunk_type,
    brand: input.row.brand,
    productLine: input.row.product_line,
    category: input.row.category,
    score: blendedScore,
    matchedTerms: input.scored.matchedTerms,
    scoringExplanation: [
      `pgvector cosine similarity score ${input.row.vector_score.toFixed(3)} using deterministic local embeddings.`,
      ...input.scored.scoringExplanation
    ],
    metadata: input.row.metadata_json,
    citation: {
      sourceName: input.row.source_name,
      documentTitle: input.row.document_title,
      chunkIndex: input.row.chunk_index
    }
  };
}

async function searchWithDeterministicFallback(input: {
  searchInput: KnowledgeSearchInput;
  maxResults: number;
  normalizedQuery: string;
  queryTokens: string[];
  filters: ReturnType<typeof buildFilters>;
}): Promise<KnowledgeSearchResult> {
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      ...(input.searchInput.brand ? { brand: { equals: input.searchInput.brand, mode: "insensitive" } } : {}),
      ...(input.searchInput.category ? { category: { equals: input.searchInput.category, mode: "insensitive" } } : {}),
      ...(input.searchInput.chunkType ? { chunkType: input.searchInput.chunkType } : {}),
      ...(input.searchInput.sourceName
        ? {
            document: {
              sourceName: input.searchInput.sourceName
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

  const results = chunks
    .map((chunk) => {
      const scored = scoreChunk({
        normalizedQuery: input.normalizedQuery,
        queryTokens: input.queryTokens,
        chunk,
        filters: input.filters
      });

      return {
        chunk,
        scored
      };
    })
    .filter(({ scored }) => scored.score > 0)
    .sort((left, right) => right.scored.score - left.scored.score)
    .slice(0, input.maxResults)
    .map(toDeterministicResultItem);

  return toSearchResult({
    query: input.searchInput.query,
    normalizedQuery: input.normalizedQuery,
    queryTokens: input.queryTokens,
    filters: input.filters,
    retrievalMode: "DETERMINISTIC_LOCAL_RAG_READY",
    results,
    embeddingProvider: null,
    embeddingModel: null,
    embeddingDimension: null
  });
}

async function searchWithPgvector(input: {
  searchInput: KnowledgeSearchInput;
  maxResults: number;
  normalizedQuery: string;
  queryTokens: string[];
  filters: ReturnType<typeof buildFilters>;
}): Promise<KnowledgeSearchResult | null> {
  const embedding = buildDeterministicKnowledgeEmbedding(input.searchInput.query);
  const queryVector = toPgvectorLiteral(embedding.vector);

  const rows = await prisma.$queryRaw<PgvectorKnowledgeRow[]>`
    SELECT
      kc."id",
      kc."document_id",
      kd."title" AS "document_title",
      kd."source_name",
      kc."chunk_index",
      kc."chunk_text",
      kc."chunk_type",
      kc."brand",
      kc."product_line",
      kc."category",
      kc."metadata_json",
      kc."search_text",
      kc."embedding_provider",
      kc."embedding_model",
      kc."embedding_dimension",
      GREATEST(0, 1 - (kc."embedding" <=> ${queryVector}::vector))::float AS "vector_score"
    FROM "knowledge_chunks" kc
    INNER JOIN "knowledge_documents" kd ON kd."id" = kc."document_id"
    WHERE kc."embedding" IS NOT NULL
      AND (${input.searchInput.sourceName ?? null}::text IS NULL OR kd."source_name" = ${input.searchInput.sourceName ?? null})
      AND (${input.searchInput.brand ?? null}::text IS NULL OR LOWER(kc."brand") = LOWER(${input.searchInput.brand ?? null}))
      AND (${input.searchInput.category ?? null}::text IS NULL OR LOWER(kc."category") = LOWER(${input.searchInput.category ?? null}))
      AND (${input.searchInput.chunkType ?? null}::"KnowledgeChunkType" IS NULL OR kc."chunk_type" = ${input.searchInput.chunkType ?? null}::"KnowledgeChunkType")
    ORDER BY kc."embedding" <=> ${queryVector}::vector ASC, kc."chunk_index" ASC
    LIMIT ${Math.max(input.maxResults * 3, input.maxResults)}
  `;

  if (rows.length === 0) {
    return null;
  }

  const results = rows
    .map((row) => {
      const scored = scoreChunk({
        normalizedQuery: input.normalizedQuery,
        queryTokens: input.queryTokens,
        chunk: {
          chunkText: row.chunk_text,
          searchText: row.search_text,
          brand: row.brand,
          productLine: row.product_line,
          category: row.category,
          chunkType: row.chunk_type,
          metadataJson: row.metadata_json
        },
        filters: input.filters
      });

      return toPgvectorResultItem({
        row,
        scored
      });
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, input.maxResults);

  const firstRow = rows[0] ?? null;

  return toSearchResult({
    query: input.searchInput.query,
    normalizedQuery: input.normalizedQuery,
    queryTokens: input.queryTokens,
    filters: input.filters,
    retrievalMode: "PGVECTOR_DETERMINISTIC_EMBEDDINGS",
    results,
    embeddingProvider: firstRow?.embedding_provider ?? KNOWLEDGE_EMBEDDING_PROVIDER,
    embeddingModel: firstRow?.embedding_model ?? KNOWLEDGE_EMBEDDING_MODEL,
    embeddingDimension: firstRow?.embedding_dimension ?? KNOWLEDGE_EMBEDDING_DIMENSION
  });
}

export async function searchKnowledgeBase(
  input: KnowledgeSearchInput
): Promise<KnowledgeSearchResult> {
  const maxResults = Math.min(Math.max(input.maxResults ?? 5, 1), 10);
  const normalizedQuery = normalize(input.query);
  const queryTokens = tokensFor(input.query);
  const filters = buildFilters(input);

  try {
    const pgvectorResult = await searchWithPgvector({
      searchInput: input,
      maxResults,
      normalizedQuery,
      queryTokens,
      filters
    });

    if (pgvectorResult) {
      return pgvectorResult;
    }
  } catch {
    // pgvector may be unavailable in older local databases or test environments.
    // Keep the existing deterministic fallback path so the app remains usable.
  }

  return searchWithDeterministicFallback({
    searchInput: input,
    maxResults,
    normalizedQuery,
    queryTokens,
    filters
  });
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
      embeddingProvider: chunk.embeddingProvider,
      embeddingModel: chunk.embeddingModel,
      embeddingDimension: chunk.embeddingDimension,
      embeddedAt: chunk.embeddedAt?.toISOString() ?? null,
      createdAt: chunk.createdAt.toISOString(),
      updatedAt: chunk.updatedAt.toISOString()
    }))
  };
}
