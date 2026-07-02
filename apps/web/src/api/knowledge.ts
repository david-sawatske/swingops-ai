import { apiPost } from "./client";
import type {
  KnowledgeEvalSummary,
  KnowledgeIngestionSummary,
  KnowledgeSearchResponse,
} from "../types/knowledge";

export async function ingestDemoKnowledgeBase(): Promise<KnowledgeIngestionSummary> {
  return apiPost<KnowledgeIngestionSummary, Record<string, never>>(
    "/knowledge/ingest-demo",
    {},
  );
}

export async function searchKnowledgeBase(
  query: string,
): Promise<KnowledgeSearchResponse> {
  return apiPost<KnowledgeSearchResponse, { query: string; maxResults: number }>(
    "/knowledge/search",
    {
      query,
      maxResults: 5,
    },
  );
}

export async function runKnowledgeRetrievalEvals(): Promise<KnowledgeEvalSummary> {
  return apiPost<KnowledgeEvalSummary, Record<string, never>>(
    "/knowledge/evals/run",
    {},
  );
}
