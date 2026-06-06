-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('FREE_TEXT', 'CSV', 'PDF_TEXT', 'POLICY_NOTE');

-- CreateEnum
CREATE TYPE "KnowledgeChunkType" AS ENUM ('CLUB_REFERENCE', 'TRADE_IN_POLICY', 'CONDITION_GUIDE', 'BRAND_ALIAS', 'SHAFT_FLEX_GUIDE');

-- CreateEnum
CREATE TYPE "KnowledgeIngestionRunStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "source_type" "KnowledgeSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "cleaned_text" TEXT NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "chunk_type" "KnowledgeChunkType" NOT NULL,
    "brand" TEXT,
    "product_line" TEXT,
    "category" TEXT,
    "metadata_json" JSONB,
    "embedding_json" JSONB,
    "search_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_ingestion_runs" (
    "id" TEXT NOT NULL,
    "status" "KnowledgeIngestionRunStatus" NOT NULL DEFAULT 'STARTED',
    "source_name" TEXT NOT NULL,
    "documents_created" INTEGER NOT NULL DEFAULT 0,
    "chunks_created" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "knowledge_ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_documents_source_type_idx" ON "knowledge_documents"("source_type");

-- CreateIndex
CREATE INDEX "knowledge_documents_source_name_idx" ON "knowledge_documents"("source_name");

-- CreateIndex
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks"("document_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_chunk_type_idx" ON "knowledge_chunks"("chunk_type");

-- CreateIndex
CREATE INDEX "knowledge_chunks_brand_idx" ON "knowledge_chunks"("brand");

-- CreateIndex
CREATE INDEX "knowledge_chunks_product_line_idx" ON "knowledge_chunks"("product_line");

-- CreateIndex
CREATE INDEX "knowledge_chunks_category_idx" ON "knowledge_chunks"("category");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_document_id_chunk_index_key" ON "knowledge_chunks"("document_id", "chunk_index");

-- CreateIndex
CREATE INDEX "knowledge_ingestion_runs_status_idx" ON "knowledge_ingestion_runs"("status");

-- CreateIndex
CREATE INDEX "knowledge_ingestion_runs_source_name_idx" ON "knowledge_ingestion_runs"("source_name");

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
