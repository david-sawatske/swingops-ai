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
    "name": "TaylorMade Stealth 2 driver shorthand",
    "query": "TM stealth2 drv 10.5 stiff no hc sky mark",
    "expectedBrand": "TaylorMade",
    "expectedProductLine": "Stealth 2",
    "expectedCategory": "DRIVER",
    "expectedTerms": [
      "stealth2",
      "drv"
    ]
  },
  {
    "name": "TaylorMade Stealth 2 semantic wording",
    "query": "stealth two ten five stiff no cover crown mark",
    "expectedBrand": "TaylorMade",
    "expectedProductLine": "Stealth 2",
    "expectedCategory": "DRIVER",
    "expectedTerms": [
      "stealth",
      "two"
    ]
  },
  {
    "name": "Callaway Ai Smoke fairway shorthand",
    "query": "Cally AiSmoke 3w reg",
    "expectedBrand": "Callaway",
    "expectedProductLine": "Ai Smoke",
    "expectedCategory": "FAIRWAY_WOOD",
    "expectedTerms": [
      "aismoke",
      "3w"
    ]
  },
  {
    "name": "PING G430 Max driver shorthand",
    "query": "Ping g430 max xstiff 9",
    "expectedBrand": "PING",
    "expectedProductLine": "G430 Max",
    "expectedCategory": "DRIVER",
    "expectedTerms": [
      "g430",
      "max"
    ]
  },
  {
    "name": "Titleist TSR2 driver generation",
    "query": "titleist tsr two driver no cover crown scratch",
    "expectedBrand": "Titleist",
    "expectedProductLine": "TSR2",
    "expectedCategory": "DRIVER",
    "expectedTerms": [
      "titleist",
      "driver"
    ]
  },
  {
    "name": "PING G430 hybrid shorthand",
    "query": "PING G430 hybrid senior",
    "expectedBrand": "PING",
    "expectedProductLine": "G430 Hybrid",
    "expectedCategory": "HYBRID",
    "expectedTerms": [
      "g430",
      "hybrid"
    ]
  },
  {
    "name": "TaylorMade Stealth 2 rescue shorthand",
    "query": "TM Stealth2 rescue stiff",
    "expectedBrand": "TaylorMade",
    "expectedProductLine": "Stealth 2 Rescue",
    "expectedCategory": "HYBRID",
    "expectedTerms": [
      "stealth2",
      "rescue"
    ]
  },
  {
    "name": "TaylorMade Qi10 rescue shorthand",
    "query": "TM Qi10 rescue regular",
    "expectedBrand": "TaylorMade",
    "expectedProductLine": "Qi10 Rescue",
    "expectedCategory": "HYBRID",
    "expectedTerms": [
      "qi10",
      "rescue"
    ]
  },
  {
    "name": "PING G425 hybrid shorthand",
    "query": "PING G425 hy regular",
    "expectedBrand": "PING",
    "expectedProductLine": "G425 Hybrid",
    "expectedCategory": "HYBRID",
    "expectedTerms": [
      "g425",
      "hy"
    ]
  },
  {
    "name": "Mizuno JPX 921 iron generation",
    "query": "Mizuno JPX921 Hot Metal irons 5-PW",
    "expectedBrand": "Mizuno",
    "expectedProductLine": "JPX 921 Hot Metal",
    "expectedCategory": "IRON_SET",
    "expectedTerms": [
      "jpx921",
      "hot metal"
    ]
  },
  {
    "name": "Cleveland RTX ZipCore older generation",
    "query": "Cleveland RTX ZipCore wedge groove wear",
    "expectedBrand": "Cleveland",
    "expectedProductLine": "RTX ZipCore",
    "expectedCategory": "WEDGE",
    "expectedTerms": [
      "rtx",
      "zipcore"
    ]
  },
  {
    "name": "Titleist Vokey SM9 wedge",
    "query": "Titleist Vokey SM9 56 degree",
    "expectedBrand": "Titleist",
    "expectedProductLine": "Vokey SM9",
    "expectedCategory": "WEDGE",
    "expectedTerms": [
      "vokey",
      "sm9"
    ]
  },
  {
    "name": "Odyssey White Hot Versa putter",
    "query": "Odyssey White Hot Versa putter",
    "expectedBrand": "Odyssey",
    "expectedProductLine": "White Hot Versa",
    "expectedCategory": "PUTTER",
    "expectedTerms": [
      "white hot versa",
      "putter"
    ]
  },
  {
    "name": "Scotty Cameron Newport 2 putter",
    "query": "Scotty Cameron Newport 2 putter",
    "expectedBrand": "Scotty Cameron",
    "expectedProductLine": "Special Select Newport 2",
    "expectedCategory": "PUTTER",
    "expectedTerms": [
      "newport 2",
      "putter"
    ]
  },
  {
    "name": "PING Anser 2 putter spacing",
    "query": "PING Anser2 putter",
    "expectedBrand": "PING",
    "expectedProductLine": "Anser 2",
    "expectedCategory": "PUTTER",
    "expectedTerms": [
      "anser2",
      "putter"
    ]
  },
  {
    "name": "TaylorMade Spider Tour putter",
    "query": "TM Spider Tour mallet",
    "expectedBrand": "TaylorMade",
    "expectedProductLine": "Spider Tour",
    "expectedCategory": "PUTTER",
    "expectedTerms": [
      "spider tour",
      "mallet"
    ]
  }
]

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
