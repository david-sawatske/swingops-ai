import type { KnowledgeChunkType, KnowledgeSourceType, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
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

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function buildDeterministicEmbeddingMetadata(input: {
  text: string;
  aliases: string[];
  brand: string | null;
  productLine: string | null;
  category: string | null;
}): Prisma.InputJsonObject {
  const normalizedText = normalizeToken([
    input.text,
    input.brand ?? "",
    input.productLine ?? "",
    input.category ?? "",
    ...input.aliases
  ].join(" "));

  const tokens = normalizedText.split(" ").filter(Boolean);
  const tokenCounts = tokens.reduce<Record<string, number>>((accumulator, token) => {
    accumulator[token] = (accumulator[token] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    embeddingStrategy: "deterministic-local-token-profile",
    productionVectorEmbeddings: false,
    tokenProfile: tokenCounts,
    tokenCount: tokens.length
  };
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
      const documentSourceName = sourceName;
      const cleanedText = cleanKnowledgeText(document.rawText);
      const createdDocument = await prisma.knowledgeDocument.create({
        data: {
          sourceType: document.sourceType as KnowledgeSourceType,
          title: document.title,
          sourceName: documentSourceName,
          rawText: document.rawText,
          cleanedText,
          metadataJson: {
            sourceKind: "messy-golf-retail-reference-material",
            chunkCount: document.chunks.length
          }
        }
      });

      for (const [chunkIndex, chunk] of document.chunks.entries()) {
        const aliases = chunk.aliases ?? [];
        const searchText = buildSearchText({
          chunk,
          cleanedDocumentText: cleanedText
        });

        await prisma.knowledgeChunk.create({
          data: {
            documentId: createdDocument.id,
            chunkIndex,
            chunkText: cleanKnowledgeText(chunk.text),
            chunkType: chunk.chunkType as KnowledgeChunkType,
            brand: chunk.brand ?? null,
            productLine: chunk.productLine ?? null,
            category: chunk.category ?? null,
            metadataJson: toMetadataJson(chunk),
            embeddingJson: buildDeterministicEmbeddingMetadata({
              text: searchText,
              aliases,
              brand: chunk.brand ?? null,
              productLine: chunk.productLine ?? null,
              category: chunk.category ?? null
            }),
            searchText
          }
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

    return {
      ingestionRunId: ingestionRun.id,
      status: "SUCCEEDED",
      sourceName: completedRun?.sourceName ?? sourceName,
      documentsCreated:
        completedRun?.documentsCreated ?? DEMO_KNOWLEDGE_DOCUMENTS.length,
      chunksCreated: completedRun?.chunksCreated ?? chunksCreated,
      errorMessage: completedRun?.errorMessage ?? null
    };
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

    return {
      ingestionRunId: ingestionRun.id,
      status: "FAILED",
      sourceName: failedRun?.sourceName ?? sourceName,
      documentsCreated: failedRun?.documentsCreated ?? 0,
      chunksCreated: failedRun?.chunksCreated ?? 0,
      errorMessage: failedRun?.errorMessage ?? message
    };
  }
}
