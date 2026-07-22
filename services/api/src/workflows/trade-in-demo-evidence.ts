import type { InventoryProductLookupResult } from "../internal-systems/inventory-service.js";
import { estimateTradeInValuation } from "../internal-systems/trade-in-valuation-service.js";
import { ensureDemoKnowledgeBaseReady } from "../knowledge/knowledge-ingestion.js";
import { searchKnowledgeBase } from "../knowledge/knowledge-search.js";
import {
  buildPriorReviewLearningSuggestionsFromEvidence,
  findPriorReviewLearningEvidence,
} from "../review-learning/review-learning-evidence.js";

import type {
  AgenticTradeInInventoryMatch,
  AgenticTradeInKnowledgeMatch,
  AgenticTradeInPriorReviewEvidence,
  AgenticTradeInPriorReviewSuggestions,
  AgenticTradeInValuationEvidence,
} from "./end-to-end-agentic-trade-in-demo.types.js";
import { filterPriorReviewLearningSuggestionsForSourceSafety } from "./field-repair-advisory-candidates.js";
import { buildInventoryLookupFromProductResolution } from "./product-resolution-inventory-adapter.js";
import type { ParsedTradeInDemoItem } from "./trade-in-demo-parser.js";

export const TRADE_IN_DEMO_MAX_KNOWLEDGE_RESULTS_PER_ITEM = 3;

export type TradeInDemoEvidenceBundle = {
  priorReviewLearningEvidenceByItem: AgenticTradeInPriorReviewEvidence[];
  priorReviewLearningSuggestionsByItem: AgenticTradeInPriorReviewSuggestions[];
  knowledgeMatchesByItem: AgenticTradeInKnowledgeMatch[];
  inventoryMatchesByItem: AgenticTradeInInventoryMatch[];
  valuationEvidenceByItem: AgenticTradeInValuationEvidence[];
};

function buildKnowledgeQuery(item: ParsedTradeInDemoItem): string {
  return [
    item.brand,
    item.productLine,
    item.category,
    item.loft,
    item.clubNumber,
    item.shaftBrand,
    item.shaftModel,
    item.shaftFlex,
    ...item.conditionNotes,
    ...item.accessoriesNotes,
    item.rawLine,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildTradeInInventoryLookupInput(
  item: ParsedTradeInDemoItem,
): Record<string, string> {
  return {
    ...(item.brand ? { brand: item.brand } : {}),
    ...(item.productLine ? { productLine: item.productLine } : {}),
    ...(item.category ? { category: item.category } : {}),
    ...(item.shaftBrand ? { shaftBrand: item.shaftBrand } : {}),
    ...(item.shaftModel ? { shaftModel: item.shaftModel } : {}),
    rawText: item.rawLine,
  };
}

function buildValuationInput(input: {
  item: ParsedTradeInDemoItem;
  inventoryMatch: InventoryProductLookupResult;
}) {
  return {
    ...buildTradeInInventoryLookupInput(input.item),
    inventoryMatch: input.inventoryMatch,
    conditionNotes: input.item.conditionNotes,
    accessoriesNotes: input.item.accessoriesNotes,
  };
}

export async function collectTradeInDemoEvidence(input: {
  parsedItems: ParsedTradeInDemoItem[];
  workflowRunId: string;
  maxKnowledgeResultsPerItem: number;
}): Promise<TradeInDemoEvidenceBundle> {
  await ensureDemoKnowledgeBaseReady();

  const priorReviewLearningEvidenceByItem: AgenticTradeInPriorReviewEvidence[] =
    [];

  for (const item of input.parsedItems) {
    const evidence = await findPriorReviewLearningEvidence({
      rawText: item.rawLine,
      sourceType: "FREE_TEXT",
      excludeWorkflowRunId: input.workflowRunId,
      parsedFields: {
        brand: item.brand,
        productLine: item.productLine,
        category: item.category,
        shaftFlex: item.shaftFlex,
      },
    });

    priorReviewLearningEvidenceByItem.push({
      parsedItemId: item.id,
      evidence,
    });
  }

  const parsedItemById = new Map(
    input.parsedItems.map((item) => [item.id, item]),
  );
  const priorReviewLearningSuggestionsByItem =
    priorReviewLearningEvidenceByItem.map((item) => ({
      parsedItemId: item.parsedItemId,
      suggestions: filterPriorReviewLearningSuggestionsForSourceSafety({
        sourceText: parsedItemById.get(item.parsedItemId)?.rawLine ?? "",
        suggestions: buildPriorReviewLearningSuggestionsFromEvidence(
          item.evidence,
        ),
      }),
    }));

  const knowledgeMatchesByItem: AgenticTradeInKnowledgeMatch[] = [];

  for (const item of input.parsedItems) {
    const query = buildKnowledgeQuery(item);
    const search = await searchKnowledgeBase({
      query,
      ...(item.brand ? { brand: item.brand } : {}),
      ...(item.category ? { category: item.category } : {}),
      maxResults: input.maxKnowledgeResultsPerItem,
    });

    knowledgeMatchesByItem.push({
      parsedItemId: item.id,
      query,
      search,
    });
  }

  const inventoryMatchesByItem = input.parsedItems.map((item) => ({
    parsedItemId: item.id,
    lookup: buildInventoryLookupFromProductResolution({
      resolution: item.productResolution,
      fallback: {
        brand: item.brand,
        productLine: item.productLine,
        category: item.productResolution.normalizedInput.category,
      },
    }),
  }));

  const valuationEvidenceByItem = input.parsedItems.map((item) => {
    const inventoryMatch = inventoryMatchesByItem.find(
      (match) => match.parsedItemId === item.id,
    );

    return {
      parsedItemId: item.id,
      estimate: estimateTradeInValuation(
        buildValuationInput({
          item,
          inventoryMatch: inventoryMatch!.lookup,
        }),
      ),
    };
  });

  return {
    priorReviewLearningEvidenceByItem,
    priorReviewLearningSuggestionsByItem,
    knowledgeMatchesByItem,
    inventoryMatchesByItem,
    valuationEvidenceByItem,
  };
}

export function buildTradeInDemoEvidenceStepOutput(
  evidence: TradeInDemoEvidenceBundle,
  parsedItemCount: number,
) {
  return {
    parsedItemCount,
    knowledgeResultCount: evidence.knowledgeMatchesByItem.reduce(
      (count, item) => count + item.search.results.length,
      0,
    ),
    inventoryMatchCount: evidence.inventoryMatchesByItem.filter(
      (item) => item.lookup.productId !== null,
    ).length,
    valuationRangeCount: evidence.valuationEvidenceByItem.filter(
      (item) => item.estimate.highValue > 0,
    ).length,
    priorReviewEvidenceCount: evidence.priorReviewLearningEvidenceByItem.reduce(
      (count, item) => count + item.evidence.length,
      0,
    ),
  };
}
