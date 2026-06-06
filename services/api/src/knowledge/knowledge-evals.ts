import type { KnowledgeChunkType } from "@prisma/client";

import {
  searchKnowledgeBase,
  type KnowledgeRetrievalMode
} from "./knowledge-search.js";

type KnowledgeRetrievalEvalCase = {
  name: string;
  query: string;
  expectedBrand: string;
  expectedProductLine: string;
  expectedCategory: string;
  expectedChunkType?: KnowledgeChunkType;
  expectedTerms: string[];
};

export type KnowledgeRetrievalEvalResult = {
  name: string;
  query: string;
  pass: boolean;
  retrievalMode: KnowledgeRetrievalMode;
  topResultScore: number | null;
  citationPresent: boolean;
  structuredMetadataPresent: boolean;
  failures: string[];
};

export type KnowledgeRetrievalEvalSummary = {
  casesEvaluated: number;
  passCount: number;
  failedCases: KnowledgeRetrievalEvalResult[];
  results: KnowledgeRetrievalEvalResult[];
  evalMetadata: {
    evaluator: "deterministic.swingops.knowledge-retrieval-eval.v2";
    retrievalMode: KnowledgeRetrievalMode;
    productionVectorEmbeddings: false;
    embeddingProvider: string | null;
    embeddingModel: string | null;
    embeddingDimension: number | null;
  };
};

const EVAL_CASES: KnowledgeRetrievalEvalCase[] = [
  {
    name: "TaylorMade Stealth 2 driver shorthand",
    query: "TM stealth2 drv 10.5 stiff no hc sky mark",
    expectedBrand: "TaylorMade",
    expectedProductLine: "Stealth 2",
    expectedCategory: "DRIVER",
    expectedTerms: ["stealth2", "drv", "no hc"]
  },
  {
    name: "TaylorMade Stealth 2 semantic wording",
    query: "stealth two ten five stiff no cover crown mark",
    expectedBrand: "TaylorMade",
    expectedProductLine: "Stealth 2",
    expectedCategory: "DRIVER",
    expectedTerms: ["stealth", "two", "stiff", "no cover"]
  },
  {
    name: "Callaway Ai Smoke fairway shorthand",
    query: "Cally AiSmoke 3w reg",
    expectedBrand: "Callaway",
    expectedProductLine: "Ai Smoke",
    expectedCategory: "FAIRWAY_WOOD",
    expectedTerms: ["aismoke", "3w", "reg"]
  },
  {
    name: "PING G430 Max driver shorthand",
    query: "Ping g430 max xstiff 9",
    expectedBrand: "PING",
    expectedProductLine: "G430 Max",
    expectedCategory: "DRIVER",
    expectedTerms: ["g430", "max", "9"]
  },
  {
    name: "Titleist TSR2 versus TS2 ambiguity",
    query: "titleist tsr two driver no cover crown scratch",
    expectedBrand: "Titleist",
    expectedProductLine: "TSR2",
    expectedCategory: "DRIVER",
    expectedTerms: ["titleist", "driver", "no cover", "crown scratch"]
  }
];

function normalize(value: string | null): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function evaluateCase(
  evalCase: KnowledgeRetrievalEvalCase,
  searchResult: Awaited<ReturnType<typeof searchKnowledgeBase>>
): KnowledgeRetrievalEvalResult {
  const topResult = searchResult.results[0] ?? null;
  const failures: string[] = [];

  if (!topResult) {
    failures.push("No top result returned.");
  }

  if (topResult && normalize(topResult.brand) !== normalize(evalCase.expectedBrand)) {
    failures.push(`Expected brand ${evalCase.expectedBrand}, received ${topResult.brand ?? "null"}.`);
  }

  if (
    topResult &&
    normalize(topResult.productLine) !== normalize(evalCase.expectedProductLine)
  ) {
    failures.push(
      `Expected product line ${evalCase.expectedProductLine}, received ${topResult.productLine ?? "null"}.`
    );
  }

  if (topResult && normalize(topResult.category) !== normalize(evalCase.expectedCategory)) {
    failures.push(`Expected category ${evalCase.expectedCategory}, received ${topResult.category ?? "null"}.`);
  }

  if (
    topResult &&
    evalCase.expectedChunkType &&
    topResult.chunkType !== evalCase.expectedChunkType
  ) {
    failures.push(`Expected chunk type ${evalCase.expectedChunkType}, received ${topResult.chunkType}.`);
  }

  const matchedTerms = normalize((topResult?.matchedTerms ?? []).join(" "));
  const missingTerms = evalCase.expectedTerms.filter(
    (term) => !matchedTerms.includes(normalize(term))
  );

  if (missingTerms.length > 0) {
    failures.push(`Missing expected matched terms: ${missingTerms.join(", ")}.`);
  }

  const citationPresent = Boolean(topResult?.citation.sourceName && topResult.citation.documentTitle);
  const structuredMetadataPresent =
    typeof topResult?.metadata === "object" &&
    topResult.metadata !== null &&
    !Array.isArray(topResult.metadata);

  if (!citationPresent) {
    failures.push("Top result did not include citation fields.");
  }

  if (!structuredMetadataPresent) {
    failures.push("Top result did not include structured metadata.");
  }

  return {
    name: evalCase.name,
    query: evalCase.query,
    pass: failures.length === 0,
    retrievalMode: searchResult.queryMetadata.retrievalMode,
    topResultScore: topResult?.score ?? null,
    citationPresent,
    structuredMetadataPresent,
    failures
  };
}

export async function runKnowledgeRetrievalEvals(input: {
  sourceName?: string;
} = {}): Promise<KnowledgeRetrievalEvalSummary> {
  const results: KnowledgeRetrievalEvalResult[] = [];
  let retrievalMode: KnowledgeRetrievalMode = "DETERMINISTIC_LOCAL_RAG_READY";
  let embeddingProvider: string | null = null;
  let embeddingModel: string | null = null;
  let embeddingDimension: number | null = null;

  for (const evalCase of EVAL_CASES) {
    const searchResult = await searchKnowledgeBase({
      query: evalCase.query,
      maxResults: 5,
      ...(input.sourceName === undefined ? {} : { sourceName: input.sourceName })
    });

    retrievalMode = searchResult.queryMetadata.retrievalMode;
    embeddingProvider = searchResult.queryMetadata.embeddingProvider;
    embeddingModel = searchResult.queryMetadata.embeddingModel;
    embeddingDimension = searchResult.queryMetadata.embeddingDimension;

    results.push(evaluateCase(evalCase, searchResult));
  }

  const failedCases = results.filter((result) => !result.pass);

  return {
    casesEvaluated: results.length,
    passCount: results.length - failedCases.length,
    failedCases,
    results,
    evalMetadata: {
      evaluator: "deterministic.swingops.knowledge-retrieval-eval.v2",
      retrievalMode,
      productionVectorEmbeddings: false,
      embeddingProvider,
      embeddingModel,
      embeddingDimension
    }
  };
}
