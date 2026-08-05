export type ProductReferenceCategory =
  "DRIVER" | "FAIRWAY_WOOD" | "HYBRID" | "IRON_SET" | "WEDGE" | "PUTTER";

export type ProductReferenceRecord = {
  productId: string;
  sku: string;
  brand: string;
  productLine: string;
  category: ProductReferenceCategory;
  year: number;
  aliases: readonly string[];
  shaftFamilies: readonly string[];
};

export type ProductReferenceAlias<TValue extends string> = {
  value: TValue;
  alias: string;
  confidence: number;
};

export type ProductReferenceDetection<TValue extends string> = {
  value: TValue;
  matchedText: string;
  confidence: number;
};

export type ProductReferenceData = {
  brandAliases: readonly ProductReferenceAlias<string>[];
  categoryAliases: readonly ProductReferenceAlias<ProductReferenceCategory>[];
};

export type ProductReferenceSearchInput = {
  rawText: string;
  brand?: string | null;
  category?: string | null;
  productText?: string | null;
  year?: number | null;
  limit?: number;
};

export type ProductReferenceSearchResult = {
  candidates: readonly ProductReferenceRecord[];
  totalMatches: number;
};
