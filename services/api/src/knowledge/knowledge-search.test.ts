import { afterEach, describe, expect, it, vi } from "vitest";

import { operationalLogger } from "../lib/operational-logger.js";
import { prisma } from "../lib/prisma.js";
import { runKnowledgeRetrievalEvals } from "./knowledge-evals.js";
import { ingestDemoKnowledgeBase } from "./knowledge-ingestion.js";
import { searchKnowledgeBase } from "./knowledge-search.js";
const TEST_KNOWLEDGE_SOURCE_NAME = "test-knowledge-search-source";

afterEach(async () => {
  vi.restoreAllMocks();

  await prisma.knowledgeDocument.deleteMany({
    where: {
      sourceName: TEST_KNOWLEDGE_SOURCE_NAME
    }
  });

  await prisma.knowledgeIngestionRun.deleteMany({
    where: {
      sourceName: TEST_KNOWLEDGE_SOURCE_NAME
    }
  });
});

describe("knowledge base ingestion and search", () => {
  it("ingests demo knowledge documents and chunks", async () => {
    const summary = await ingestDemoKnowledgeBase({ sourceName: TEST_KNOWLEDGE_SOURCE_NAME });

    expect(summary).toMatchObject({
      status: "SUCCEEDED",
      sourceName: TEST_KNOWLEDGE_SOURCE_NAME,
      documentsCreated: 3,
      chunksCreated: 71,
      errorMessage: null
    });

    const documentCount = await prisma.knowledgeDocument.count({
      where: {
        sourceName: TEST_KNOWLEDGE_SOURCE_NAME
      }
    });
    const chunkCount = await prisma.knowledgeChunk.count({
      where: {
        document: {
          sourceName: TEST_KNOWLEDGE_SOURCE_NAME
        }
      }
    });

    expect(documentCount).toBe(3);
    expect(chunkCount).toBeGreaterThanOrEqual(11);
  });

  it("returns TaylorMade Stealth 2 grounding for messy shorthand", async () => {
    await ingestDemoKnowledgeBase({ sourceName: TEST_KNOWLEDGE_SOURCE_NAME });

    const result = await searchKnowledgeBase({
      query: "TM stealth2 drv 10.5 stiff no hc sky mark",
      maxResults: 5,
      sourceName: TEST_KNOWLEDGE_SOURCE_NAME
    });

    expect(result.queryMetadata).toMatchObject({
      retrievalMode: "PGVECTOR_DETERMINISTIC_EMBEDDINGS",
      productionVectorEmbeddings: false,
      retrievalDiagnostics: {
        degraded: false,
        fallbackUsed: false,
        fallbackReason: null,
        pgvectorFailure: null
      }
    });
    expect(result.results[0]).toMatchObject({
      brand: "TaylorMade",
      productLine: "Stealth 2",
      category: "DRIVER",
      citation: {
        sourceName: TEST_KNOWLEDGE_SOURCE_NAME
      }
    });
    expect(result.results[0]?.matchedTerms.join(" ").toLowerCase()).toContain(
      "stealth2"
    );
  });

  it("returns Callaway Ai Smoke fairway grounding for Cally shorthand", async () => {
    await ingestDemoKnowledgeBase({ sourceName: TEST_KNOWLEDGE_SOURCE_NAME });

    const result = await searchKnowledgeBase({
      query: "Cally AiSmoke 3w reg",
      maxResults: 5,
      sourceName: TEST_KNOWLEDGE_SOURCE_NAME
    });

    expect(result.results[0]).toMatchObject({
      brand: "Callaway",
      productLine: "Ai Smoke",
      category: "FAIRWAY_WOOD",
      scoreBreakdown: {
        components: {
          brand: {
            score: 1,
            weight: 0.25
          },
          productLine: {
            score: 1,
            weight: 0.3
          },
          category: {
            score: 1,
            weight: 0.15
          },
          shaft: {
            score: 1,
            weight: 0.15
          },
          vector: {
            weight: 0.05
          }
        }
      }
    });
    expect(result.results[0]?.score).toBeGreaterThan(0.85);
    expect(result.results[0]?.scoreBreakdown.vectorScore).toEqual(
      expect.any(Number)
    );
    expect(
      result.results[0]?.scoreBreakdown.components.vector.score
    ).toBeCloseTo(result.results[0]?.scoreBreakdown.vectorScore ?? 0, 3);
    expect(result.results[0]?.scoringExplanation.join(" ")).toContain(
      "Brand matched alias"
    );
    expect(result.citations[0]).toMatchObject({
      sourceName: TEST_KNOWLEDGE_SOURCE_NAME
    });
  });

  it("returns PING G430 Max driver grounding for x-stiff shorthand", async () => {
    await ingestDemoKnowledgeBase({ sourceName: TEST_KNOWLEDGE_SOURCE_NAME });

    const result = await searchKnowledgeBase({
      query: "Ping g430 max xstiff 9",
      maxResults: 5,
      sourceName: TEST_KNOWLEDGE_SOURCE_NAME
    });

    expect(result.results[0]).toMatchObject({
      brand: "PING",
      productLine: "G430 Max",
      category: "DRIVER"
    });
    expect(result.results[0]?.score).toBeGreaterThan(0);
    expect(result.results[0]?.scoreBreakdown.components.vector.weight).toBe(0.05);
  });

  it("returns expanded guided fixture grounding for wedge, putter, and iron set inputs", async () => {
    await ingestDemoKnowledgeBase({ sourceName: TEST_KNOWLEDGE_SOURCE_NAME });

    const cases = [
      {
        query: "Cleveland RTX 6 ZipCore wedge Tour X-Stiff groove wear",
        brand: "Cleveland",
        productLine: "RTX 6 ZipCore",
        category: "WEDGE"
      },
      {
        query: "Odyssey White Hot OG putter headcover included",
        brand: "Odyssey",
        productLine: "White Hot OG",
        category: "PUTTER"
      },
      {
        query: "Mizuno JPX 923 Hot Metal iron set Regular 5-PW",
        brand: "Mizuno",
        productLine: "JPX 923 Hot Metal",
        category: "IRON_SET"
      },
      {
        query: "PING G425 irons 5-PW Regular",
        brand: "PING",
        productLine: "G425",
        category: "IRON_SET"
      }
    ];

    for (const testCase of cases) {
      const result = await searchKnowledgeBase({
        query: testCase.query,
        brand: testCase.brand,
        category: testCase.category,
        maxResults: 3,
        sourceName: TEST_KNOWLEDGE_SOURCE_NAME
      });

      expect(result.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            brand: testCase.brand,
            productLine: testCase.productLine,
            category: testCase.category
          })
        ])
      );
      expect(result.results[0]?.score).toBeGreaterThan(0);
    }
  });

  it("reports an expected pgvector compatibility failure and returns diagnostic fallback metadata", async () => {
    await ingestDemoKnowledgeBase({ sourceName: TEST_KNOWLEDGE_SOURCE_NAME });
    const reportDegradation = vi.fn();
    const query = "TM stealth2 drv 10.5 stiff no hc";

    const result = await searchKnowledgeBase(
      {
        query,
        maxResults: 5,
        sourceName: TEST_KNOWLEDGE_SOURCE_NAME
      },
      {
        async searchWithPgvector() {
          throw {
            code: "P2010",
            meta: {
              code: "42883",
              message: "The vector distance operator is unavailable."
            }
          };
        },
        reportDegradation
      }
    );

    expect(result.queryMetadata).toMatchObject({
      retrievalMode: "DETERMINISTIC_LOCAL_RAG_READY",
      retrievalDiagnostics: {
        degraded: true,
        fallbackUsed: true,
        fallbackReason: "PGVECTOR_UNAVAILABLE",
        pgvectorFailure: {
          classification: "UNSUPPORTED_DATABASE_FEATURE",
          prismaCode: "P2010",
          databaseCode: "42883"
        }
      }
    });
    expect(result.results[0]).toMatchObject({
      brand: "TaylorMade",
      productLine: "Stealth 2"
    });
    expect(reportDegradation).toHaveBeenCalledWith({
      eventName: "knowledge_retrieval_degraded",
      metricName: "knowledge_retrieval_fallback_total",
      metricValue: 1,
      requestedMode: "PGVECTOR_DETERMINISTIC_EMBEDDINGS",
      fallbackMode: "DETERMINISTIC_LOCAL_RAG_READY",
      fallbackReason: "PGVECTOR_UNAVAILABLE",
      failureClassification: "UNSUPPORTED_DATABASE_FEATURE",
      prismaCode: "P2010",
      databaseCode: "42883",
      maxResults: 5,
      filtersApplied: ["sourceName"]
    });
    expect(JSON.stringify(reportDegradation.mock.calls)).not.toContain(query);
  });

  it("reports an empty vector result set before using deterministic retrieval", async () => {
    await ingestDemoKnowledgeBase({ sourceName: TEST_KNOWLEDGE_SOURCE_NAME });
    const warn = vi
      .spyOn(operationalLogger, "warn")
      .mockImplementation(() => undefined);

    const result = await searchKnowledgeBase(
      {
        query: "PING G430 max driver",
        sourceName: TEST_KNOWLEDGE_SOURCE_NAME
      },
      {
        searchWithPgvector: async () => null
      }
    );

    expect(result.queryMetadata.retrievalDiagnostics).toEqual({
      degraded: true,
      fallbackUsed: true,
      fallbackReason: "NO_VECTOR_RESULTS",
      pgvectorFailure: null
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackReason: "NO_VECTOR_RESULTS",
        failureClassification: null,
        prismaCode: null,
        databaseCode: null
      }),
      "Knowledge retrieval degraded to deterministic fallback"
    );
  });

  it("rethrows unexpected pgvector database failures without reporting a fallback", async () => {
    const reportDegradation = vi.fn();
    const unexpectedError = {
      code: "P2010",
      meta: {
        code: "42883",
        message: "An unrelated database function is unavailable."
      }
    };

    await expect(
      searchKnowledgeBase(
        {
          query: "Titleist TSR2 driver"
        },
        {
          async searchWithPgvector() {
            throw unexpectedError;
          },
          reportDegradation
        }
      )
    ).rejects.toBe(unexpectedError);
    expect(reportDegradation).not.toHaveBeenCalled();
  });

  it("passes deterministic retrieval evals", async () => {
    await ingestDemoKnowledgeBase({ sourceName: TEST_KNOWLEDGE_SOURCE_NAME });

    const evalSummary = await runKnowledgeRetrievalEvals({
      sourceName: TEST_KNOWLEDGE_SOURCE_NAME
    });

    expect(evalSummary).toMatchObject({
      casesEvaluated: 16,
      passCount: 16,
      failedCases: [],
      evalMetadata: {
        evaluator: "deterministic.swingops.knowledge-retrieval-eval.v2",
        retrievalMode: "PGVECTOR_DETERMINISTIC_EMBEDDINGS",
        productionVectorEmbeddings: false
      }
    });
    expect(evalSummary.results.every((result) => result.citationPresent)).toBe(
      true
    );
    expect(
      evalSummary.results.every((result) => result.structuredMetadataPresent)
    ).toBe(true);
  });
});
