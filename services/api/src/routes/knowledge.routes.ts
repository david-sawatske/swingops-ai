import type { KnowledgeChunkType } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ingestDemoKnowledgeBase } from "../knowledge/knowledge-ingestion.js";
import { runKnowledgeRetrievalEvals } from "../knowledge/knowledge-evals.js";
import {
  listKnowledgeChunks,
  searchKnowledgeBase
} from "../knowledge/knowledge-search.js";

const knowledgeChunkTypeSchema = z.enum([
  "CLUB_REFERENCE",
  "TRADE_IN_POLICY",
  "CONDITION_GUIDE",
  "BRAND_ALIAS",
  "SHAFT_FLEX_GUIDE"
]);

const knowledgeSearchBodySchema = z
  .object({
    query: z.string().min(1),
    brand: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    chunkType: knowledgeChunkTypeSchema.optional(),
    maxResults: z.number().int().min(1).max(10).optional()
  })
  .strict();

export async function knowledgeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/knowledge/ingest-demo", async () => {
    return ingestDemoKnowledgeBase();
  });

  app.get("/knowledge/chunks", async () => {
    return listKnowledgeChunks();
  });

  app.post("/knowledge/search", async (request, reply) => {
    const parsedBody = knowledgeSearchBodySchema.safeParse(request.body ?? {});

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid knowledge search request",
        details: parsedBody.error.flatten()
      });
    }

    return searchKnowledgeBase({
      query: parsedBody.data.query,
      ...(parsedBody.data.brand === undefined
        ? {}
        : { brand: parsedBody.data.brand }),
      ...(parsedBody.data.category === undefined
        ? {}
        : { category: parsedBody.data.category }),
      ...(parsedBody.data.chunkType === undefined
        ? {}
        : { chunkType: parsedBody.data.chunkType as KnowledgeChunkType }),
      ...(parsedBody.data.maxResults === undefined
        ? {}
        : { maxResults: parsedBody.data.maxResults })
    });
  });

  app.post("/knowledge/evals/run", async () => {
    return runKnowledgeRetrievalEvals();
  });
}
