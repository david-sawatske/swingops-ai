export const KNOWLEDGE_EMBEDDING_PROVIDER = "swingops.local";
export const KNOWLEDGE_EMBEDDING_MODEL =
  "deterministic-token-hash-embedding-v1";
export const KNOWLEDGE_EMBEDDING_DIMENSION = 64;

export type KnowledgeEmbeddingMetadata = {
  embeddingStrategy: "deterministic-local-token-hash";
  productionVectorEmbeddings: false;
  embeddingProvider: typeof KNOWLEDGE_EMBEDDING_PROVIDER;
  embeddingModel: typeof KNOWLEDGE_EMBEDDING_MODEL;
  embeddingDimension: typeof KNOWLEDGE_EMBEDDING_DIMENSION;
  tokenCount: number;
  uniqueTokenCount: number;
};

export type KnowledgeEmbeddingResult = {
  vector: number[];
  metadata: KnowledgeEmbeddingMetadata;
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function tokensForKnowledgeEmbedding(value: string): string[] {
  return normalize(value).split(" ").filter(Boolean);
}

function hashToken(token: string): number {
  let hash = 2166136261;

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function tokenWeight(token: string): number {
  if (token.length <= 2) {
    return 0.55;
  }

  if (/^[0-9]+$/.test(token)) {
    return 0.7;
  }

  return 1;
}

export function buildDeterministicKnowledgeEmbedding(
  text: string
): KnowledgeEmbeddingResult {
  const tokens = tokensForKnowledgeEmbedding(text);
  const vector = Array.from({ length: KNOWLEDGE_EMBEDDING_DIMENSION }, () => 0);

  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % KNOWLEDGE_EMBEDDING_DIMENSION;
    const sign = hash % 2 === 0 ? 1 : -1;

    vector[index] = (vector[index] ?? 0) + sign * tokenWeight(token);
  }

  const magnitude = Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0)
  );
  const normalizedVector =
    magnitude === 0
      ? vector
      : vector.map((value) => Number((value / magnitude).toFixed(6)));

  return {
    vector: normalizedVector,
    metadata: {
      embeddingStrategy: "deterministic-local-token-hash",
      productionVectorEmbeddings: false,
      embeddingProvider: KNOWLEDGE_EMBEDDING_PROVIDER,
      embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
      embeddingDimension: KNOWLEDGE_EMBEDDING_DIMENSION,
      tokenCount: tokens.length,
      uniqueTokenCount: new Set(tokens).size
    }
  };
}

export function toPgvectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => value.toFixed(6)).join(",")}]`;
}
