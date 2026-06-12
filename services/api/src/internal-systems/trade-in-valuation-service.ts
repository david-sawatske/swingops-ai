import type { InventoryProductLookupResult } from "./inventory-service.js";
import { lookupInventoryProduct, type InventoryLookupInput } from "./inventory-service.js";
import { demoValuationRanges } from "./trade-in-valuation-demo-data.js";

export type TradeInValuationConfidence = "HIGH" | "MEDIUM" | "LOW";

export type TradeInValuationAdjustment = {
  reason: string;
  amountImpact: string;
};

export type TradeInValuationInput = InventoryLookupInput & {
  inventoryMatch?: InventoryProductLookupResult | null;
  conditionNotes?: string[];
  accessoriesNotes?: string[];
};

export type TradeInValuationResult = {
  lowValue: number;
  highValue: number;
  confidence: TradeInValuationConfidence;
  valueFactors: string[];
  adjustments: TradeInValuationAdjustment[];
  reviewRequired: boolean;
  reviewReasons: string[];
};

export type TradeInAdjustmentExplanationResult = {
  adjustments: TradeInValuationAdjustment[];
  valueFactors: string[];
  reviewReasons: string[];
};

type AdjustmentRule = {
  id: string;
  patterns: string[];
  reason: string;
  lowImpact: number;
  highImpact: number;
};

const conditionAdjustmentRules: AdjustmentRule[] = [
  {
    id: "sky-mark",
    patterns: ["sky mark", "skymark", "crown mark"],
    reason: "Crown sky mark reduces the demo range.",
    lowImpact: -18,
    highImpact: -24
  },
  {
    id: "face-wear",
    patterns: ["face wear", "worn face"],
    reason: "Face wear reduces the demo range.",
    lowImpact: -10,
    highImpact: -16
  },
  {
    id: "paint-wear",
    patterns: ["paint wear", "paint chip", "paint chips"],
    reason: "Paint wear reduces the demo range.",
    lowImpact: -8,
    highImpact: -12
  },
  {
    id: "worn-grips",
    patterns: ["worn grips", "grips worn", "needs grips"],
    reason: "Worn grips reduce the demo range.",
    lowImpact: -15,
    highImpact: -22
  }
];

const accessoryAdjustmentRules: AdjustmentRule[] = [
  {
    id: "missing-headcover",
    patterns: ["no hc", "no headcover", "missing headcover"],
    reason: "Missing headcover reduces the demo range.",
    lowImpact: -8,
    highImpact: -12
  },
  {
    id: "headcover-included",
    patterns: ["hc included", "headcover included", "with headcover"],
    reason: "Included headcover supports the unadjusted accessory range.",
    lowImpact: 0,
    highImpact: 0
  },
  {
    id: "missing-wrench",
    patterns: ["no wrench", "missing wrench"],
    reason: "Missing wrench reduces the demo range for adjustable clubs.",
    lowImpact: -5,
    highImpact: -8
  }
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function notesContain(notes: string[], patterns: string[]): boolean {
  const normalizedNotes = normalizeText(notes.join(" "));

  return patterns.some((pattern) => normalizedNotes.includes(normalizeText(pattern)));
}

function clampValue(value: number): number {
  return Math.max(Math.round(value), 0);
}

function applyRules(input: {
  rules: AdjustmentRule[];
  notes: string[];
}): {
  lowAdjustment: number;
  highAdjustment: number;
  adjustments: TradeInValuationAdjustment[];
} {
  return input.rules.reduce(
    (summary, rule) => {
      if (!notesContain(input.notes, rule.patterns)) {
        return summary;
      }

      summary.lowAdjustment += rule.lowImpact;
      summary.highAdjustment += rule.highImpact;
      summary.adjustments.push({
        reason: rule.reason,
        amountImpact:
          rule.lowImpact === 0 && rule.highImpact === 0
            ? "$0"
            : `${rule.lowImpact < 0 ? "-" : "+"}$${Math.abs(rule.lowImpact)} to ${
                rule.highImpact < 0 ? "-" : "+"
              }$${Math.abs(rule.highImpact)}`
      });

      return summary;
    },
    {
      lowAdjustment: 0,
      highAdjustment: 0,
      adjustments: [] as TradeInValuationAdjustment[]
    }
  );
}

function hasUnclearCondition(notes: string[]): boolean {
  if (notes.length === 0) {
    return true;
  }

  return notesContain(notes, ["condition unclear", "unclear condition", "unknown condition"]);
}

function getConfidence(input: {
  inventoryConfidence: number;
  reviewRequired: boolean;
  adjustmentCount: number;
}): TradeInValuationConfidence {
  if (input.reviewRequired || input.inventoryConfidence < 0.72) {
    return "LOW";
  }

  if (input.inventoryConfidence < 0.86 || input.adjustmentCount > 1) {
    return "MEDIUM";
  }

  return "HIGH";
}

export function estimateTradeInValuation(
  input: TradeInValuationInput
): TradeInValuationResult {
  const inventoryMatch = input.inventoryMatch ?? lookupInventoryProduct(input);
  const productId = inventoryMatch.productId;
  const baseRange = demoValuationRanges.find((range) => range.productId === productId);
  const conditionNotes = input.conditionNotes ?? [];
  const accessoriesNotes = input.accessoriesNotes ?? [];

  if (!productId || !baseRange) {
    return {
      lowValue: 0,
      highValue: 0,
      confidence: "LOW",
      valueFactors: ["No seeded demo valuation range was available for the internal product match."],
      adjustments: [],
      reviewRequired: true,
      reviewReasons: ["No internal product match was available for valuation."]
    };
  }

  const conditionSummary = applyRules({
    rules: conditionAdjustmentRules,
    notes: conditionNotes
  });
  const accessorySummary = applyRules({
    rules: accessoryAdjustmentRules,
    notes: accessoriesNotes
  });

  const reviewReasons: string[] = [];

  if (inventoryMatch.confidence < 0.72) {
    reviewReasons.push("Inventory match confidence is below the valuation threshold.");
  }

  if (hasUnclearCondition(conditionNotes)) {
    reviewReasons.push("Condition notes are missing or unclear.");
  }

  const adjustedLowValue = clampValue(
    baseRange.lowValue + conditionSummary.lowAdjustment + accessorySummary.lowAdjustment
  );
  const adjustedHighValue = clampValue(
    baseRange.highValue + conditionSummary.highAdjustment + accessorySummary.highAdjustment
  );
  const adjustments = [
    ...conditionSummary.adjustments,
    ...accessorySummary.adjustments
  ];

  const reviewRequired = reviewReasons.length > 0;
  const confidence = getConfidence({
    inventoryConfidence: inventoryMatch.confidence,
    reviewRequired,
    adjustmentCount: adjustments.length
  });

  return {
    lowValue: Math.min(adjustedLowValue, adjustedHighValue),
    highValue: Math.max(adjustedLowValue, adjustedHighValue),
    confidence,
    valueFactors: [
      ...baseRange.evidence,
      `Inventory match confidence ${inventoryMatch.confidence}.`,
      adjustments.length > 0
        ? "Condition and accessory notes changed the demo range."
        : "No condition or accessory penalties were applied."
    ],
    adjustments,
    reviewRequired,
    reviewReasons
  };
}

export function explainTradeInValuationAdjustments(
  input: TradeInValuationInput
): TradeInAdjustmentExplanationResult {
  const estimate = estimateTradeInValuation(input);

  return {
    adjustments: estimate.adjustments,
    valueFactors: estimate.valueFactors,
    reviewReasons: estimate.reviewReasons
  };
}
