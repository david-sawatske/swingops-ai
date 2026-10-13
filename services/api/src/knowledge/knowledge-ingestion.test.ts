import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import { KNOWLEDGE_EMBEDDING_MODEL } from "./knowledge-embeddings.js";
import {
  ensureDemoKnowledgeBaseReady,
  ingestDemoKnowledgeBase,
} from "./knowledge-ingestion.js";
import { DEMO_KNOWLEDGE_SOURCE_NAME } from "./knowledge-seed-data.js";

afterEach(async () => {
  await prisma.knowledgeDocument.deleteMany({
    where: {
      sourceName: DEMO_KNOWLEDGE_SOURCE_NAME,
    },
  });

  await prisma.knowledgeIngestionRun.deleteMany({
    where: {
      sourceName: DEMO_KNOWLEDGE_SOURCE_NAME,
    },
  });
});

describe("demo knowledge base readiness", () => {
  it("reuses chunks embedded with the current embedding model", async () => {
    await ingestDemoKnowledgeBase();

    const readiness = await ensureDemoKnowledgeBaseReady();

    expect(readiness).toMatchObject({
      status: "READY",
      ingested: false,
    });
  });

  it("re-ingests chunks embedded with an older embedding model", async () => {
    await ingestDemoKnowledgeBase();
    await prisma.knowledgeChunk.updateMany({
      where: {
        document: {
          sourceName: DEMO_KNOWLEDGE_SOURCE_NAME,
        },
      },
      data: {
        embeddingModel: "deterministic-token-hash-embedding-v1",
      },
    });

    const readiness = await ensureDemoKnowledgeBaseReady();
    const staleChunkCount = await prisma.knowledgeChunk.count({
      where: {
        document: {
          sourceName: DEMO_KNOWLEDGE_SOURCE_NAME,
        },
        NOT: {
          embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
        },
      },
    });

    expect(readiness).toMatchObject({
      status: "READY",
      ingested: true,
    });
    expect(staleChunkCount).toBe(0);
  });
});
