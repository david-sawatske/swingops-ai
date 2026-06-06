import type { KnowledgeChunkType, KnowledgeSourceType, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import {
  buildDeterministicKnowledgeEmbedding,
  KNOWLEDGE_EMBEDDING_DIMENSION,
  KNOWLEDGE_EMBEDDING_MODEL,
  KNOWLEDGE_EMBEDDING_PROVIDER,
  toPgvectorLiteral
} from "./knowledge-embeddings.js";
import {
  DEMO_KNOWLEDGE_DOCUMENTS,
  DEMO_KNOWLEDGE_SOURCE_NAME,
  type KnowledgeSeedChunk
} from "./knowledge-seed-data.js";

export type KnowledgeIngestionSummary = {
  ingestionRunId: string;
  status: "SUCCEEDED" | "FAILED";
  sourceName: string;
  documentsCreated: number;
  chunksCreated: number;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
  productionVectorEmbeddings: false;
  errorMessage: string | null;
};

export function cleanKnowledgeText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchText(input: {
  chunk: KnowledgeSeedChunk;
  cleanedDocumentText: string;
}): string {
  return cleanKnowledgeText(
    [
      input.chunk.text,
      input.chunk.brand ?? "",
      input.chunk.productLine ?? "",
      input.chunk.category ?? "",
      ...(input.chunk.aliases ?? []),
      ...(input.chunk.conditionFlags ?? []),
      input.cleanedDocumentText
    ].join(" ")
  );
}

function toMetadataJson(chunk: KnowledgeSeedChunk): Prisma.InputJsonObject {
  return {
    aliases: chunk.aliases ?? [],
    conditionFlags: chunk.conditionFlags ?? [],
    normalizationNotes:
      "Demo metadata extracted from messy golf-retail source notes for deterministic local retrieval."
  };
}

async function updateChunkEmbedding(input: {
  chunkId: string;
  vector: number[];
}) {
  await prisma.$executeRaw`
    UPDATE "knowledge_chunks"
    SET
      "embedding" = ${toPgvectorLiteral(input.vector)}::vector,
      "embedding_provider" = ${KNOWLEDGE_EMBEDDING_PROVIDER},
      "embedding_model" = ${KNOWLEDGE_EMBEDDING_MODEL},
      "embedding_dimension" = ${KNOWLEDGE_EMBEDDING_DIMENSION},
      "embedded_at" = NOW()
    WHERE "id" = ${input.chunkId}
  `;
}

async function clearExistingDemoKnowledge(sourceName: string) {
  const existingDocuments = await prisma.knowledgeDocument.findMany({
    where: {
      sourceName
    },
    select: {
      id: true
    }
  });

  if (existingDocuments.length > 0) {
    await prisma.knowledgeDocument.deleteMany({
      where: {
        sourceName
      }
    });
  }
}

function buildIngestionSummary(input: {
  ingestionRunId: string;
  status: "SUCCEEDED" | "FAILED";
  sourceName: string;
  documentsCreated: number;
  chunksCreated: number;
  errorMessage: string | null;
}): KnowledgeIngestionSummary {
  return {
    ...input,
    embeddingProvider: KNOWLEDGE_EMBEDDING_PROVIDER,
    embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
    embeddingDimension: KNOWLEDGE_EMBEDDING_DIMENSION,
    productionVectorEmbeddings: false
  };
}

export async function ingestDemoKnowledgeBase(input: {
  sourceName?: string;
} = {}): Promise<KnowledgeIngestionSummary> {
  const sourceName = input.sourceName ?? DEMO_KNOWLEDGE_SOURCE_NAME;
  const ingestionRun = await prisma.knowledgeIngestionRun.create({
    data: {
      sourceName,
      status: "STARTED"
    }
  });

  try {
    await clearExistingDemoKnowledge(sourceName);

    let chunksCreated = 0;

    for (const document of DEMO_KNOWLEDGE_DOCUMENTS) {
      const cleanedText = cleanKnowledgeText(document.rawText);
      const createdDocument = await prisma.knowledgeDocument.create({
        data: {
          sourceType: document.sourceType as KnowledgeSourceType,
          title: document.title,
          sourceName,
          rawText: document.rawText,
          cleanedText,
          metadataJson: {
            sourceKind: "messy-golf-retail-reference-material",
            chunkCount: document.chunks.length
          }
        }
      });

      for (const [chunkIndex, chunk] of document.chunks.entries()) {
        const searchText = buildSearchText({
          chunk,
          cleanedDocumentText: cleanedText
        });
        const embedding = buildDeterministicKnowledgeEmbedding(searchText);
        const createdChunk = await prisma.knowledgeChunk.create({
          data: {
            documentId: createdDocument.id,
            chunkIndex,
            chunkText: cleanKnowledgeText(chunk.text),
            chunkType: chunk.chunkType as KnowledgeChunkType,
            brand: chunk.brand ?? null,
            productLine: chunk.productLine ?? null,
            category: chunk.category ?? null,
            metadataJson: toMetadataJson(chunk),
            embeddingJson: embedding.metadata,
            embeddingProvider: KNOWLEDGE_EMBEDDING_PROVIDER,
            embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
            embeddingDimension: KNOWLEDGE_EMBEDDING_DIMENSION,
            embeddedAt: new Date(),
            searchText
          }
        });

        await updateChunkEmbedding({
          chunkId: createdChunk.id,
          vector: embedding.vector
        });

        chunksCreated += 1;
      }
    }

    await prisma.knowledgeIngestionRun.updateMany({
      where: {
        id: ingestionRun.id
      },
      data: {
        status: "SUCCEEDED",
        documentsCreated: DEMO_KNOWLEDGE_DOCUMENTS.length,
        chunksCreated,
        completedAt: new Date()
      }
    });

    const completedRun = await prisma.knowledgeIngestionRun.findUnique({
      where: {
        id: ingestionRun.id
      }
    });

    return buildIngestionSummary({
      ingestionRunId: ingestionRun.id,
      status: "SUCCEEDED",
      sourceName: completedRun?.sourceName ?? sourceName,
      documentsCreated:
        completedRun?.documentsCreated ?? DEMO_KNOWLEDGE_DOCUMENTS.length,
      chunksCreated: completedRun?.chunksCreated ?? chunksCreated,
      errorMessage: completedRun?.errorMessage ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion error";

    await prisma.knowledgeIngestionRun.updateMany({
      where: {
        id: ingestionRun.id
      },
      data: {
        status: "FAILED",
        errorMessage: message,
        completedAt: new Date()
      }
    });

    const failedRun = await prisma.knowledgeIngestionRun.findUnique({
      where: {
        id: ingestionRun.id
      }
    });

    return buildIngestionSummary({
      ingestionRunId: ingestionRun.id,
      status: "FAILED",
      sourceName: failedRun?.sourceName ?? sourceName,
      documentsCreated: failedRun?.documentsCreated ?? 0,
      chunksCreated: failedRun?.chunksCreated ?? 0,
      errorMessage: failedRun?.errorMessage ?? message
    });
  }
}
