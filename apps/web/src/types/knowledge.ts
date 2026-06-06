export type KnowledgeIngestionSummary = {
  ingestionRunId: string;
  status: "SUCCEEDED" | "FAILED";
  sourceName: string;
  documentsCreated: number;
  chunksCreated: number;
  errorMessage: string | null;
};

export type KnowledgeSearchResultItem = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceName: string;
  chunkText: string;
  chunkType:
    | "CLUB_REFERENCE"
    | "TRADE_IN_POLICY"
    | "CONDITION_GUIDE"
    | "BRAND_ALIAS"
    | "SHAFT_FLEX_GUIDE";
  brand: string | null;
  productLine: string | null;
  category: string | null;
  score: number;
  matchedTerms: string[];
  scoringExplanation: string[];
  metadata: unknown;
  citation: {
    sourceName: string;
    documentTitle: string;
    chunkIndex: number;
  };
};

export type KnowledgeSearchResponse = {
  query: string;
  results: KnowledgeSearchResultItem[];
  queryMetadata: {
    normalizedQuery: string;
    tokens: string[];
    filters: {
      brand: string | null;
      category: string | null;
      chunkType:
        | "CLUB_REFERENCE"
        | "TRADE_IN_POLICY"
        | "CONDITION_GUIDE"
        | "BRAND_ALIAS"
        | "SHAFT_FLEX_GUIDE"
        | null;
      sourceName?: string | null;
    };
    retrievalMode: "DETERMINISTIC_LOCAL_RAG_READY";
    productionVectorEmbeddings: false;
  };
  citations: KnowledgeSearchResultItem["citation"][];
  summary: string;
};

export type KnowledgeEvalSummary = {
  casesEvaluated: number;
  passCount: number;
  failedCases: {
    name: string;
    query: string;
    pass: boolean;
    topResultScore: number | null;
    citationPresent: boolean;
    structuredMetadataPresent: boolean;
    failures: string[];
  }[];
  results: {
    name: string;
    query: string;
    pass: boolean;
    topResultScore: number | null;
    citationPresent: boolean;
    structuredMetadataPresent: boolean;
    failures: string[];
  }[];
  evalMetadata: {
    evaluator: "deterministic.swingops.knowledge-retrieval-eval.v1";
    retrievalMode: "DETERMINISTIC_LOCAL_RAG_READY";
    productionVectorEmbeddings: false;
  };
};
