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

export type KnowledgeScoreComponentBreakdown = {
  score: number | null;
  weight: number;
  explanation: string | null;
};

export type KnowledgeScoreBreakdown = {
  weightedScore: number;
  vectorScore: number | null;
  components: {
    brand: KnowledgeScoreComponentBreakdown;
    productLine: KnowledgeScoreComponentBreakdown;
    category: KnowledgeScoreComponentBreakdown;
    shaft: KnowledgeScoreComponentBreakdown;
    notes: KnowledgeScoreComponentBreakdown;
    vector: KnowledgeScoreComponentBreakdown;
  };
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
  scoreBreakdown: KnowledgeScoreBreakdown;
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

const TRADE_IN_SCORE_WEIGHTS = {
  brand: 0.25,
  productLine: 0.3,
  category: 0.15,
  shaft: 0.15,
  notes: 0.1,
  vector: 0.05
} as const;

const BRAND_ALIASES: Record<string, string[]> = {
  Callaway: ["callaway", "cally"],
  Cleveland: ["cleveland", "cleve"],
  Mizuno: ["mizuno"],
  Odyssey: ["odyssey", "ody"],
  PING: ["ping"],
  TaylorMade: ["taylormade", "tm"],
  Titleist: ["titleist"]
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  DRIVER: ["driver", "drv", "dr"],
  FAIRWAY_WOOD: ["fairway wood", "fairway", "fw", "wood", "3w", "3 wood", "5w", "5 wood"],
  HYBRID: ["hybrid", "hy", "rescue"],
  IRON_SET: ["iron set", "irons", "iron", "set", "4-pw", "5-pw", "4 pw", "5 pw"],
  PUTTER: ["putter", "putters", "pt"],
  WEDGE: ["wedge", "wedges", "gw", "sw", "lw"]
};

const SHAFT_FLEX_ALIASES: Record<string, string[]> = {
  regular: ["regular", "reg", "r flex", "r-flex"],
  stiff: ["stiff", "s flex", "s-flex", "stf"],
  "x-stiff": ["x-stiff", "xstiff", "x flex", "x-flex", "extra stiff", "tour x-stiff", "tour x stiff", "tourxstiff", "x"],
  senior: ["senior", "sr", "a flex", "lite flex", "lite"],
  ladies: ["ladies", "lady", "l flex", "women"]
};

const NOTE_ALIASES = [
  "missing headcover",
  "no hc",
  "no cover",
  "headcover missing",
  "sky mark",
  "crown mark",
  "topline mark",
  "paint mark",
  "crown scratch",
  "crown scratches",
  "paint wear",
  "cosmetic crown wear",
  "face wear",
  "worn face",
  "impact wear",
  "ball marks",
  "dent",
  "dented",
  "sole dent",
  "crown dent",
  "grip wear",
  "worn grip",
  "slick grip",
  "needs grip",
  "missing serial number",
  "serial missing",
  "no serial",
  "uncertain serial",
  "uncertain model",
  "model ambiguity",
  "older newer ambiguity",
  "unclear generation",
  "high value",
  "current generation",
  "ambiguous condition",
  "newer driver",
  "mismatched shaft",
  "wrong shaft",
  "aftermarket shaft",
  "shaft mismatch"
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function compactNormalize(value: string): string {
  return normalize(value).replace(/\s+/g, "");
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

function component(input: {
  score: number | null;
  weight: number;
  explanation: string | null;
}): KnowledgeScoreComponentBreakdown {
  return {
    score: input.score === null ? null : Math.min(1, Math.max(0, Number(input.score.toFixed(3)))),
    weight: input.weight,
    explanation: input.explanation
  };
}

function queryHasAlias(input: {
  normalizedQuery: string;
  compactQuery: string;
  alias: string;
}): boolean {
  const normalizedAlias = normalize(input.alias);
  const compactAlias = compactNormalize(input.alias);

  return (
    normalizedAlias.length > 0 &&
    (input.normalizedQuery.includes(normalizedAlias) ||
      input.compactQuery.includes(compactAlias))
  );
}

function firstMatchingAlias(input: {
  normalizedQuery: string;
  compactQuery: string;
  aliases: string[];
}): string | null {
  return (
    input.aliases.find((alias) =>
      queryHasAlias({
        normalizedQuery: input.normalizedQuery,
        compactQuery: input.compactQuery,
        alias
      })
    ) ?? null
  );
}

function scoreBrandComponent(input: {
  normalizedQuery: string;
  compactQuery: string;
  brand: string | null;
}): { component: KnowledgeScoreComponentBreakdown; matchedTerms: string[] } {
  if (!input.brand) {
    return {
      component: component({
        score: 0,
        weight: TRADE_IN_SCORE_WEIGHTS.brand,
        explanation: "No brand metadata was available for this chunk."
      }),
      matchedTerms: []
    };
  }

  if (
    queryHasAlias({
      normalizedQuery: input.normalizedQuery,
      compactQuery: input.compactQuery,
      alias: input.brand
    })
  ) {
    return {
      component: component({
        score: 1,
        weight: TRADE_IN_SCORE_WEIGHTS.brand,
        explanation: `Brand matched ${input.brand}.`
      }),
      matchedTerms: [input.brand]
    };
  }

  const alias = firstMatchingAlias({
    normalizedQuery: input.normalizedQuery,
    compactQuery: input.compactQuery,
    aliases: BRAND_ALIASES[input.brand] ?? []
  });

  if (alias) {
    return {
      component: component({
        score: 1,
        weight: TRADE_IN_SCORE_WEIGHTS.brand,
        explanation: `Brand matched alias ${alias} → ${input.brand}.`
      }),
      matchedTerms: [alias, input.brand]
    };
  }

  return {
    component: component({
      score: 0,
      weight: TRADE_IN_SCORE_WEIGHTS.brand,
      explanation: `Brand did not match ${input.brand}.`
    }),
    matchedTerms: []
  };
}

function scoreProductLineComponent(input: {
  normalizedQuery: string;
  compactQuery: string;
  productLine: string | null;
  aliases: string[];
}): { component: KnowledgeScoreComponentBreakdown; matchedTerms: string[] } {
  if (!input.productLine) {
    return {
      component: component({
        score: 0,
        weight: TRADE_IN_SCORE_WEIGHTS.productLine,
        explanation: "No product-line metadata was available for this chunk."
      }),
      matchedTerms: []
    };
  }

  if (
    queryHasAlias({
      normalizedQuery: input.normalizedQuery,
      compactQuery: input.compactQuery,
      alias: input.productLine
    })
  ) {
    return {
      component: component({
        score: 1,
        weight: TRADE_IN_SCORE_WEIGHTS.productLine,
        explanation: `Product line matched ${input.productLine}.`
      }),
      matchedTerms: [input.productLine]
    };
  }

  const directAlias = firstMatchingAlias({
    normalizedQuery: input.normalizedQuery,
    compactQuery: input.compactQuery,
    aliases: input.aliases
  });

  if (directAlias) {
    return {
      component: component({
        score: 1,
        weight: TRADE_IN_SCORE_WEIGHTS.productLine,
        explanation: `Product line matched alias ${directAlias} → ${input.productLine}.`
      }),
      matchedTerms: [directAlias, input.productLine]
    };
  }

  const productCompact = compactNormalize(input.productLine);
  const alias = input.aliases.find(
    (candidateAlias) =>
      input.compactQuery.includes(productCompact) &&
      compactNormalize(candidateAlias).includes(productCompact)
  );

  if (alias) {
    const matchedAliasPart =
      tokensFor(alias).find((token) => input.compactQuery.includes(compactNormalize(token))) ??
      input.productLine;

    return {
      component: component({
        score: 1,
        weight: TRADE_IN_SCORE_WEIGHTS.productLine,
        explanation: `Product line matched alias ${matchedAliasPart} → ${input.productLine}.`
      }),
      matchedTerms: [matchedAliasPart, input.productLine]
    };
  }

  const productTokens = tokensFor(input.productLine);
  const matchedProductTokens = productTokens.filter((token) =>
    input.normalizedQuery.includes(token)
  );

  if (matchedProductTokens.length > 0) {
    const partialScore = matchedProductTokens.length / productTokens.length;

    return {
      component: component({
        score: partialScore,
        weight: TRADE_IN_SCORE_WEIGHTS.productLine,
        explanation: `Product line partially matched ${matchedProductTokens.join(", ")} → ${input.productLine}.`
      }),
      matchedTerms: matchedProductTokens
    };
  }

  return {
    component: component({
      score: 0,
      weight: TRADE_IN_SCORE_WEIGHTS.productLine,
      explanation: `Product line did not match ${input.productLine}.`
    }),
    matchedTerms: []
  };
}

function scoreCategoryComponent(input: {
  normalizedQuery: string;
  compactQuery: string;
  category: string | null;
}): { component: KnowledgeScoreComponentBreakdown; matchedTerms: string[] } {
  if (!input.category) {
    return {
      component: component({
        score: 0,
        weight: TRADE_IN_SCORE_WEIGHTS.category,
        explanation: "No category metadata was available for this chunk."
      }),
      matchedTerms: []
    };
  }

  const aliases = [input.category, ...(CATEGORY_ALIASES[input.category] ?? [])];
  const alias = firstMatchingAlias({
    normalizedQuery: input.normalizedQuery,
    compactQuery: input.compactQuery,
    aliases
  });

  if (alias) {
    const categoryLabel = input.category === "FAIRWAY_WOOD" ? "fairway wood" : input.category.toLowerCase();

    return {
      component: component({
        score: 1,
        weight: TRADE_IN_SCORE_WEIGHTS.category,
        explanation: `Category matched ${alias} → ${categoryLabel}.`
      }),
      matchedTerms: [alias, input.category]
    };
  }

  return {
    component: component({
      score: 0,
      weight: TRADE_IN_SCORE_WEIGHTS.category,
      explanation: `Category did not match ${input.category}.`
    }),
    matchedTerms: []
  };
}

function scoreShaftComponent(input: {
  normalizedQuery: string;
  compactQuery: string;
  searchable: string;
  conditionFlags: string[];
}): { component: KnowledgeScoreComponentBreakdown; matchedTerms: string[] } {
  for (const [canonicalFlex, aliases] of Object.entries(SHAFT_FLEX_ALIASES)) {
    const queryAlias = firstMatchingAlias({
      normalizedQuery: input.normalizedQuery,
      compactQuery: input.compactQuery,
      aliases
    });

    if (!queryAlias) {
      continue;
    }

    const chunkHasFlex = aliases.some((alias) =>
      queryHasAlias({
        normalizedQuery: input.searchable,
        compactQuery: compactNormalize(input.searchable),
        alias
      })
    );

    const flagHasFlex = input.conditionFlags.some((flag) =>
      aliases.some((alias) => compactNormalize(flag) === compactNormalize(alias))
    );

    if (chunkHasFlex || flagHasFlex) {
      return {
        component: component({
          score: 1,
          weight: TRADE_IN_SCORE_WEIGHTS.shaft,
          explanation: `Shaft matched ${queryAlias} → ${canonicalFlex}.`
        }),
        matchedTerms: [queryAlias, canonicalFlex]
      };
    }
  }

  return {
    component: component({
      score: 0,
      weight: TRADE_IN_SCORE_WEIGHTS.shaft,
      explanation: "No shaft-flex match contributed to this score."
    }),
    matchedTerms: []
  };
}

function scoreNotesComponent(input: {
  normalizedQuery: string;
  compactQuery: string;
  conditionFlags: string[];
}): { component: KnowledgeScoreComponentBreakdown; matchedTerms: string[] } {
  const noteFlags = input.conditionFlags.filter(
    (flag) =>
      NOTE_ALIASES.some((alias) => compactNormalize(alias) === compactNormalize(flag)) &&
      !Object.values(SHAFT_FLEX_ALIASES).some((aliases) =>
        aliases.some((alias) => compactNormalize(alias) === compactNormalize(flag))
      )
  );

  const matchedNotes = noteFlags.filter((flag) =>
    queryHasAlias({
      normalizedQuery: input.normalizedQuery,
      compactQuery: input.compactQuery,
      alias: flag
    })
  );

  const directNoteAlias = NOTE_ALIASES.filter((alias) =>
    queryHasAlias({
      normalizedQuery: input.normalizedQuery,
      compactQuery: input.compactQuery,
      alias
    })
  );

  const matches = unique([...matchedNotes, ...directNoteAlias]);

  if (matches.length > 0) {
    return {
      component: component({
        score: 1,
        weight: TRADE_IN_SCORE_WEIGHTS.notes,
        explanation: `Notes matched ${matches.join(", ")}.`
      }),
      matchedTerms: matches
    };
  }

  return {
    component: component({
      score: 0,
      weight: TRADE_IN_SCORE_WEIGHTS.notes,
      explanation: "No condition, accessory, or review-note match contributed to this score."
    }),
    matchedTerms: []
  };
}

function scoreChunk(input: {
  normalizedQuery: string;
  queryTokens: string[];
  vectorScore: number | null;
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
  scoreBreakdown: KnowledgeScoreBreakdown;
  matchedTerms: string[];
  scoringExplanation: string[];
} {
  const compactQuery = compactNormalize(input.normalizedQuery);
  const searchable = normalize(input.chunk.searchText);
  const searchableTokens = new Set(tokensFor(searchable));
  const aliases = getAliases(input.chunk.metadataJson);
  const conditionFlags = getConditionFlags(input.chunk.metadataJson);

  const brand = scoreBrandComponent({
    normalizedQuery: input.normalizedQuery,
    compactQuery,
    brand: input.chunk.brand
  });

  const productLine = scoreProductLineComponent({
    normalizedQuery: input.normalizedQuery,
    compactQuery,
    productLine: input.chunk.productLine,
    aliases
  });

  const category = scoreCategoryComponent({
    normalizedQuery: input.normalizedQuery,
    compactQuery,
    category: input.chunk.category
  });

  const shaft = scoreShaftComponent({
    normalizedQuery: input.normalizedQuery,
    compactQuery,
    searchable,
    conditionFlags
  });

  const notes = scoreNotesComponent({
    normalizedQuery: input.normalizedQuery,
    compactQuery,
    conditionFlags
  });

  const vector = component({
    score: input.vectorScore,
    weight: TRADE_IN_SCORE_WEIGHTS.vector,
    explanation:
      input.vectorScore === null
        ? "No pgvector score was available, deterministic fallback scoring was used."
        : `Vector similarity contributed ${input.vectorScore.toFixed(3)} at 5% weight.`
  });

  const weightedScore = Number(
    (
      brand.component.score! * brand.component.weight +
      productLine.component.score! * productLine.component.weight +
      category.component.score! * category.component.weight +
      shaft.component.score! * shaft.component.weight +
      notes.component.score! * notes.component.weight +
      (vector.score ?? 0) * vector.weight
    ).toFixed(3)
  );

  const aliasMatches = aliases.flatMap((alias) =>
    tokensFor(alias).filter((token) => input.queryTokens.includes(token))
  );
  const tokenMatches = input.queryTokens.filter((token) => searchableTokens.has(token));

  const matchedTerms = unique(
    [
      ...brand.matchedTerms,
      ...productLine.matchedTerms,
      ...category.matchedTerms,
      ...shaft.matchedTerms,
      ...notes.matchedTerms,
      ...aliasMatches,
      ...tokenMatches
    ]
      .map((term) => term.trim())
      .filter(Boolean)
  );

  const scoringExplanation = [
    brand.component.explanation,
    productLine.component.explanation,
    category.component.explanation,
    shaft.component.explanation,
    notes.component.explanation,
    vector.explanation
  ].filter((value): value is string => Boolean(value));

  return {
    score: Math.min(0.99, weightedScore),
    scoreBreakdown: {
      weightedScore: Math.min(0.99, weightedScore),
      vectorScore: input.vectorScore,
      components: {
        brand: brand.component,
        productLine: productLine.component,
        category: category.component,
        shaft: shaft.component,
        notes: notes.component,
        vector
      }
    },
    matchedTerms,
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
    scoreBreakdown: input.scored.scoreBreakdown,
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
    score: input.scored.score,
    scoreBreakdown: input.scored.scoreBreakdown,
    matchedTerms: input.scored.matchedTerms,
    scoringExplanation: input.scored.scoringExplanation,
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
        vectorScore: null,
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
        vectorScore: row.vector_score,
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
