-- Enable pgvector for Postgres-native semantic retrieval.
CREATE EXTENSION IF NOT EXISTS vector;

-- Store deterministic local embedding vectors for demo/dev/test retrieval.
ALTER TABLE "knowledge_chunks"
ADD COLUMN "embedding" vector(64),
ADD COLUMN "embedding_provider" TEXT,
ADD COLUMN "embedding_model" TEXT,
ADD COLUMN "embedding_dimension" INTEGER,
ADD COLUMN "embedded_at" TIMESTAMP(3);

-- Small local/demo datasets do not require ANN indexing, but this keeps the
-- schema ready for larger pgvector-backed retrieval without changing queries.
CREATE INDEX "knowledge_chunks_embedding_hnsw_idx"
ON "knowledge_chunks"
USING hnsw ("embedding" vector_cosine_ops)
WHERE "embedding" IS NOT NULL;

CREATE INDEX "knowledge_chunks_embedding_provider_idx"
ON "knowledge_chunks"("embedding_provider");

CREATE INDEX "knowledge_chunks_embedding_model_idx"
ON "knowledge_chunks"("embedding_model");
