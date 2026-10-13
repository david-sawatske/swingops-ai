import type {
  AdminOpsBaselineFixtures,
  BaselineAiReadyRecordFixture,
  BaselineModelCallAttemptFixture,
  BaselineModelCallFixture,
  BaselineReviewQueueItemFixture,
  BaselineScenario,
  BaselineSourceType,
} from "./admin-ops-baseline-types.js";
import {
  demoInventoryProducts,
  type DemoInventoryProduct,
} from "../internal-systems/inventory-demo-data.js";
import { demoValuationRanges } from "../internal-systems/trade-in-valuation-demo-data.js";
import { validateAdminOpsBaselineFixtures } from "./admin-ops-baseline-validation.js";

export const ADMIN_OPS_BASELINE_ID_PREFIX = "admin_ops_baseline";

const HOUR_MS = 60 * 60 * 1_000;
const DATA_ORIGIN = "SEEDED_BASELINE" as const;

const SOURCE_DEFINITIONS = {
  FREE_TEXT: {
    name: "Store counter notes",
    active: 18,
    ready: 12,
  },
  POORLY_FORMED_CSV: {
    name: "Nightly trade-in CSV export",
    active: 12,
    ready: 9,
  },
  EMAIL: {
    name: "Trade-in desk email",
    active: 10,
    ready: 8,
  },
  LOG: {
    name: "Operations intake log",
    active: 8,
    ready: 2,
  },
} as const;

const CATEGORY_TARGETS = {
  DRIVER: 14,
  PUTTER: 8,
  WEDGE: 8,
  FAIRWAY_WOOD: 7,
  IRON_SET: 6,
  HYBRID: 4,
} as const;

function buildCategorySequence(): Array<keyof typeof CATEGORY_TARGETS | null> {
  const categories = Object.keys(CATEGORY_TARGETS) as Array<
    keyof typeof CATEGORY_TARGETS
  >;
  const assigned = Object.fromEntries(
    categories.map((category) => [category, 0]),
  ) as Record<keyof typeof CATEGORY_TARGETS, number>;
  const nonBlankTotal = Object.values(CATEGORY_TARGETS).reduce(
    (total, count) => total + count,
    0,
  );
  const sequence: Array<keyof typeof CATEGORY_TARGETS | null> = [];

  for (let index = 0; index < nonBlankTotal; index += 1) {
    const category = categories
      .filter((candidate) => assigned[candidate] < CATEGORY_TARGETS[candidate])
      .sort((left, right) => {
        const leftDeficit =
          (CATEGORY_TARGETS[left] * (index + 1)) / nonBlankTotal -
          assigned[left];
        const rightDeficit =
          (CATEGORY_TARGETS[right] * (index + 1)) / nonBlankTotal -
          assigned[right];

        return rightDeficit - leftDeficit;
      })[0];

    if (!category) {
      throw new Error("Baseline category distribution could not be completed.");
    }

    assigned[category] += 1;
    sequence.push(category);
  }

  return [...sequence, null];
}

const CATEGORY_SEQUENCE = buildCategorySequence();

const STORE_LABELS: Record<string, string> = {
  "104": "North Metro",
  "207": "West Metro",
  "312": "Southwest",
};

const SHAFT_FLEX_SEQUENCE = [
  "REGULAR",
  "STIFF",
  "SENIOR",
  "X_STIFF",
  "LADIES",
  "TOUR_X_STIFF",
] as const;

const SHAFT_FLEX_SOURCE_LABELS = {
  REGULAR: ["Regular", "reg", "R-flex"],
  STIFF: ["Stiff", "stf", "S-flex"],
  SENIOR: ["Senior", "A-flex", "senior flex"],
  X_STIFF: ["X-Stiff", "xstf", "X-flex"],
  LADIES: ["Ladies", "L-flex", "ladies flex"],
  TOUR_X_STIFF: ["Tour X-Stiff", "TX", "tour-x"],
} as const;

const CONDITION_PROFILES = [
  {
    grade: "9.5 Mint",
    note: "like-new face and sole; original headcover included",
    valuationPosition: 0.94,
  },
  {
    grade: "9.0 Above Average",
    note: "clean crown with light face wear",
    valuationPosition: 0.8,
  },
  {
    grade: "8.0 Average",
    note: "normal face and sole wear from regular play",
    valuationPosition: 0.58,
  },
  {
    grade: "7.0 Below Average",
    note: "visible sole wear and several cosmetic marks",
    valuationPosition: 0.3,
  },
  {
    grade: "6.0 Poor",
    note: "heavy cosmetic wear; playable but requires inspection",
    valuationPosition: 0.08,
  },
] as const;

const REVIEW_SIGNAL_MESSAGES: Partial<Record<BaselineScenario, string>> = {
  AMBIGUOUS_CATALOG_IDENTITY:
    "The source supports a product family but not one authoritative catalog item.",
  UNKNOWN_PRODUCT_LINE:
    "The brand and category are usable, but the product line could not be verified.",
  NEGATIVE_EVIDENCE:
    "Unknown and pending values block an unsupported automated repair.",
  STORE_INSPECTION:
    "Physical-item details must be verified before valuation can proceed.",
  MALFORMED_CSV_ROW:
    "Recoverable columns were retained while incomplete fields remain queued for review.",
  DEGRADED_LOG_PAYLOAD:
    "The source log omitted fields after a known formatting regression.",
};

function getReviewSignalMessage(
  scenario: BaselineScenario,
  missingFields: readonly string[],
): string {
  if (scenario === "DEGRADED_LOG_PAYLOAD" && missingFields.length === 0) {
    return "Required fields were recovered, but the record remains held for source verification because it was produced during a known log-formatting regression.";
  }

  return (
    REVIEW_SIGNAL_MESSAGES[scenario] ??
    "Source evidence requires bounded human verification."
  );
}

const VALUATION_BY_PRODUCT_ID = new Map(
  demoValuationRanges.map((range) => [range.productId, range]),
);

const REVIEW_MISSING_FIELDS = [
  ["productLine", "category"],
  ["productLine"],
  ["conditionGrade", "shaftFlex", "tradeInValue"],
  ["conditionGrade", "shaftFlex", "tradeInValue"],
  ["conditionGrade", "shaftFlex", "tradeInValue"],
  ["conditionGrade", "shaftFlex", "tradeInValue"],
  ["conditionGrade", "productLine"],
  ["conditionGrade", "shaftFlex"],
  ["conditionGrade"],
  [],
  ["conditionGrade", "shaftFlex", "tradeInValue"],
  ["conditionGrade", "shaftFlex"],
  ["tradeInValue"],
  [],
  [],
  [],
  [
    "brand",
    "productLine",
    "category",
    "shaftFlex",
    "conditionGrade",
    "tradeInValue",
  ],
] as const;

const REVIEW_SCENARIOS: BaselineScenario[] = [
  "AMBIGUOUS_CATALOG_IDENTITY",
  "UNKNOWN_PRODUCT_LINE",
  "NEGATIVE_EVIDENCE",
  "STORE_INSPECTION",
  "NEGATIVE_EVIDENCE",
  "STORE_INSPECTION",
  "MALFORMED_CSV_ROW",
  "MALFORMED_CSV_ROW",
  "MALFORMED_CSV_ROW",
  "AMBIGUOUS_CATALOG_IDENTITY",
  "STORE_INSPECTION",
  "DEGRADED_LOG_PAYLOAD",
  "DEGRADED_LOG_PAYLOAD",
  "DEGRADED_LOG_PAYLOAD",
  "DEGRADED_LOG_PAYLOAD",
  "DEGRADED_LOG_PAYLOAD",
  "DEGRADED_LOG_PAYLOAD",
];

const REPLACEMENT_ACTIVE_INDEXES = [0, 1, 2, 15, 16, 21, 29, 30];
const RESOLVED_ACTIVE_INDEXES = [...REPLACEMENT_ACTIVE_INDEXES, 3];

type ActiveRecordDefinition = {
  activeIndex: number;
  sourceType: BaselineSourceType;
  sourceOrdinal: number;
  ready: boolean;
  reviewOrdinal: number | null;
  storeId: string;
  category: string | null;
  scenario: BaselineScenario;
  workflowIndex: number;
};

function dateBefore(anchor: Date, milliseconds: number): Date {
  return new Date(anchor.getTime() - milliseconds);
}

function id(type: string, value: number): string {
  return `${ADMIN_OPS_BASELINE_ID_PREFIX}_${type}_${String(value).padStart(2, "0")}`;
}

function getStoreId(sourceType: BaselineSourceType, ordinal: number): string {
  if (sourceType === "FREE_TEXT") {
    return "104";
  }

  if (sourceType === "POORLY_FORMED_CSV") {
    return ordinal < 3 ? "104" : "207";
  }

  if (sourceType === "EMAIL") {
    return ordinal < 7 ? "207" : "312";
  }

  return "312";
}

function getWorkflowIndex(
  sourceType: BaselineSourceType,
  ready: boolean,
  sourceOrdinal: number,
): number {
  if (ready) {
    if (sourceType === "FREE_TEXT") {
      return Math.floor(sourceOrdinal / 4);
    }

    if (sourceType === "POORLY_FORMED_CSV") {
      return sourceOrdinal < 5 ? 3 : 4;
    }

    if (sourceType === "EMAIL") {
      return sourceOrdinal < 4 ? 5 : 6;
    }

    return 7;
  }

  const reviewOrdinal = sourceOrdinal - SOURCE_DEFINITIONS[sourceType].ready;

  if (sourceType === "FREE_TEXT") {
    return reviewOrdinal < 3 ? 8 : 9;
  }

  if (sourceType === "POORLY_FORMED_CSV") {
    return 10;
  }

  if (sourceType === "EMAIL") {
    return 11;
  }

  return 12;
}

function buildActiveDefinitions(): ActiveRecordDefinition[] {
  const readyDefinitions: Omit<
    ActiveRecordDefinition,
    "activeIndex" | "category" | "workflowIndex"
  >[] = [];
  const reviewDefinitions: Omit<
    ActiveRecordDefinition,
    "activeIndex" | "category" | "workflowIndex"
  >[] = [];
  let reviewOrdinal = 0;

  for (const sourceType of Object.keys(
    SOURCE_DEFINITIONS,
  ) as BaselineSourceType[]) {
    const definition = SOURCE_DEFINITIONS[sourceType];

    for (
      let sourceOrdinal = 0;
      sourceOrdinal < definition.active;
      sourceOrdinal += 1
    ) {
      const ready = sourceOrdinal < definition.ready;
      const scenario: BaselineScenario = ready
        ? sourceOrdinal % 2 === 0
          ? "CLEAN_COUNTER_NOTE"
          : "RECOGNIZED_SHORTHAND"
        : (REVIEW_SCENARIOS[reviewOrdinal] ?? "STORE_INSPECTION");
      const record = {
        sourceType,
        sourceOrdinal,
        ready,
        reviewOrdinal: ready ? null : reviewOrdinal,
        storeId: getStoreId(sourceType, sourceOrdinal),
        scenario,
      };

      if (ready) {
        readyDefinitions.push(record);
      } else {
        reviewDefinitions.push(record);
        reviewOrdinal += 1;
      }
    }
  }

  return [...readyDefinitions, ...reviewDefinitions].map(
    (definition, activeIndex) => ({
      ...definition,
      activeIndex,
      category: CATEGORY_SEQUENCE[activeIndex] ?? null,
      workflowIndex: getWorkflowIndex(
        definition.sourceType,
        definition.ready,
        definition.sourceOrdinal,
      ),
    }),
  );
}

function getRecordCreatedAt(anchor: Date, index: number): Date {
  const ageHours =
    index < 9
      ? [1.5, 3.25, 5.75, 8, 10.5, 13.75, 17, 20.5, 23][index]
      : 28 + (index - 9) * 3.55 + (index % 4) * 0.4;

  return dateBefore(anchor, (ageHours ?? 1) * HOUR_MS);
}

type BaselineProductProfile = {
  alternateProductLine: string | null;
  brand: string | null;
  category: string | null;
  conditionGrade: string;
  conditionNote: string;
  equipmentDetail: string;
  highValue: number | null;
  lowValue: number | null;
  productId: string | null;
  productLine: string | null;
  productSourceText: string;
  referenceYear: number | null;
  shaftFamily: string | null;
  shaftFlex: (typeof SHAFT_FLEX_SEQUENCE)[number] | null;
  shaftSourceText: string | null;
  sku: string | null;
  tradeInValue: number;
};

function formatCategory(category: string | null): string {
  return category?.replace(/_/g, " ").toLowerCase() ?? "club";
}

function getEquipmentDetail(category: string | null, index: number): string {
  if (category === "DRIVER") {
    return `${["9°", "10.5°", "12°"][index % 3]} loft; ${index % 2 === 0 ? "headcover included" : "headcover not received"}`;
  }

  if (category === "FAIRWAY_WOOD") {
    return `${index % 2 === 0 ? "3 wood · 15°" : "5 wood · 18°"}; ${index % 3 === 0 ? "headcover included" : "standard length"}`;
  }

  if (category === "HYBRID") {
    return `${index % 2 === 0 ? "3 hybrid · 19°" : "4 hybrid · 22°"}; stock length`;
  }

  if (category === "IRON_SET") {
    return `${index % 2 === 0 ? "5–PW" : "4–PW"}; ${index % 3 === 0 ? "matching serial sequence" : "set makeup verified"}`;
  }

  if (category === "WEDGE") {
    return `${["52°", "54°", "56°", "58°"][index % 4]}; ${index % 2 === 0 ? "standard bounce" : "mid bounce"}`;
  }

  if (category === "PUTTER") {
    return `${index % 2 === 0 ? "34-inch" : "35-inch"}; ${index % 3 === 0 ? "original headcover included" : "standard grip"}`;
  }

  return "configuration not available from source";
}

function chooseCatalogProduct(
  category: string,
  activeIndex: number,
): DemoInventoryProduct {
  const matches = demoInventoryProducts.filter(
    (product) => product.category === category,
  );
  const product = matches[activeIndex % matches.length];

  if (!product) {
    throw new Error(`No demo inventory product exists for ${category}.`);
  }

  return product;
}

function getProductProfile(
  category: string | null,
  activeIndex: number,
): BaselineProductProfile {
  const condition =
    CONDITION_PROFILES[(activeIndex * 3 + 1) % CONDITION_PROFILES.length] ??
    CONDITION_PROFILES[2];

  if (!condition) {
    throw new Error("Baseline condition profile is missing.");
  }

  if (category === null) {
    return {
      alternateProductLine: null,
      brand: null,
      productLine: null,
      category: null,
      conditionGrade: condition.grade,
      conditionNote: condition.note,
      equipmentDetail: getEquipmentDetail(category, activeIndex),
      highValue: null,
      lowValue: null,
      productId: null,
      productSourceText: "unidentified trade-in item",
      referenceYear: null,
      shaftFamily: null,
      shaftFlex:
        SHAFT_FLEX_SEQUENCE[activeIndex % SHAFT_FLEX_SEQUENCE.length] ??
        "REGULAR",
      shaftSourceText: "unknown",
      sku: null,
      tradeInValue: 25,
    };
  }

  const categoryProducts = demoInventoryProducts.filter(
    (product) => product.category === category,
  );
  const product = chooseCatalogProduct(category, activeIndex);
  const alternateProduct =
    categoryProducts[(activeIndex + 1) % categoryProducts.length] ?? null;
  const valuation = VALUATION_BY_PRODUCT_ID.get(product.productId);

  if (!valuation) {
    throw new Error(`No demo valuation range exists for ${product.productId}.`);
  }

  const shaftFlex =
    category === "PUTTER"
      ? null
      : (SHAFT_FLEX_SEQUENCE[activeIndex % SHAFT_FLEX_SEQUENCE.length] ??
        "REGULAR");
  const shaftSourceText = shaftFlex
    ? (SHAFT_FLEX_SOURCE_LABELS[shaftFlex][activeIndex % 3] ?? shaftFlex)
    : null;
  const valueRange = valuation.highValue - valuation.lowValue;
  const tradeInValue =
    Math.round(
      (valuation.lowValue + valueRange * condition.valuationPosition) / 5,
    ) * 5;

  return {
    alternateProductLine: alternateProduct?.productLine ?? null,
    brand: product.brand,
    productLine: product.productLine,
    category,
    conditionGrade: condition.grade,
    conditionNote: condition.note,
    equipmentDetail: getEquipmentDetail(category, activeIndex),
    highValue: valuation.highValue,
    lowValue: valuation.lowValue,
    productId: product.productId,
    productSourceText:
      product.aliases[activeIndex % product.aliases.length] ??
      `${product.brand} ${product.productLine}`,
    referenceYear: product.year,
    shaftFamily:
      product.shaftFamilies[activeIndex % product.shaftFamilies.length] ?? null,
    shaftFlex,
    shaftSourceText,
    sku: product.sku,
    tradeInValue,
  };
}

function getRawText(input: {
  createdAt: Date;
  missingFields: readonly string[];
  profile: BaselineProductProfile;
  storeId: string;
  sourceType: BaselineSourceType;
  scenario: BaselineScenario;
}) {
  const { profile } = input;
  const missingFields = new Set(input.missingFields);
  const storeLabel = STORE_LABELS[input.storeId] ?? `Store ${input.storeId}`;
  const product = [
    profile.brand,
    profile.productLine,
    formatCategory(profile.category),
  ]
    .filter(Boolean)
    .join(" ");
  const shaft = profile.shaftSourceText
    ? `shaft ${profile.shaftSourceText}${profile.shaftFamily ? ` (${profile.shaftFamily})` : ""}`
    : "putter shaft";
  const base = `${product}; ${profile.equipmentDetail}; ${shaft}; condition ${profile.conditionGrade} — ${profile.conditionNote}; preliminary trade value $${profile.tradeInValue}; Store ${input.storeId} ${storeLabel}`;

  if (input.scenario === "AMBIGUOUS_CATALOG_IDENTITY") {
    return `${profile.brand} ${formatCategory(profile.category)} with an unreadable model badge; catalog comparison required between ${profile.productLine} and ${profile.alternateProductLine}; ${shaft}; condition ${profile.conditionGrade}; preliminary value $${profile.tradeInValue}; Store ${input.storeId} ${storeLabel}`;
  }

  if (input.scenario === "UNKNOWN_PRODUCT_LINE") {
    return `${profile.brand} ${formatCategory(profile.category)} received without a legible sole label; product line unknown; ${shaft}; condition ${profile.conditionGrade}; preliminary value $${profile.tradeInValue}; Store ${input.storeId} ${storeLabel}`;
  }

  if (input.scenario === "NEGATIVE_EVIDENCE") {
    return `${product}; shaft unknown; condition pending; valuation TBD; do not estimate from appearance; Store ${input.storeId} ${storeLabel}`;
  }

  if (input.scenario === "STORE_INSPECTION") {
    return `${product}; transfer arrived without inspection worksheet; shaft label, condition grade, and offer value not verified; route to physical inspection at Store ${input.storeId} ${storeLabel}`;
  }

  if (input.scenario === "MALFORMED_CSV_ROW") {
    return `${input.storeId},${profile.brand ?? ""},${missingFields.has("productLine") ? "" : (profile.productLine ?? "")},${missingFields.has("category") ? "" : formatCategory(profile.category)},${missingFields.has("shaftFlex") ? "" : (profile.shaftSourceText ?? "")},${missingFields.has("conditionGrade") ? "" : profile.conditionGrade},${missingFields.has("tradeInValue") ? "" : profile.tradeInValue},"row shifted after optional notes column"`;
  }

  if (input.scenario === "DEGRADED_LOG_PAYLOAD") {
    return `${input.createdAt.toISOString()} WARN trade_record store=${input.storeId}|brand=${missingFields.has("brand") ? "?" : (profile.brand ?? "?")}|model=${missingFields.has("productLine") ? "?" : (profile.productLine ?? "?")}|category=${missingFields.has("category") ? "?" : formatCategory(profile.category)}|flex=${missingFields.has("shaftFlex") ? "?" : (profile.shaftSourceText ?? "n/a")}|condition=${missingFields.has("conditionGrade") ? "?" : `'${profile.conditionGrade}'`}|valuation=${missingFields.has("tradeInValue") ? "pending" : profile.tradeInValue}|parser_version=2.4.1`;
  }

  if (input.sourceType === "POORLY_FORMED_CSV") {
    return `${input.storeId},${profile.brand ?? ""},${profile.productLine ?? ""},${formatCategory(profile.category)},${profile.shaftSourceText ?? ""},${profile.conditionGrade},${profile.tradeInValue},"${profile.equipmentDetail}"`;
  }

  if (input.sourceType === "EMAIL") {
    return `Subject: Trade-in intake ${profile.sku ?? "needs catalog ID"}\n${base}. Photos are available in the store intake folder; please verify before close.`;
  }

  if (input.sourceType === "LOG") {
    return `${input.createdAt.toISOString()} INFO trade_record store=${input.storeId}|brand=${profile.brand ?? "?"}|model='${profile.productLine ?? "?"}'|category=${formatCategory(profile.category)}|flex='${profile.shaftSourceText ?? "n/a"}'|condition='${profile.conditionGrade}'|value=${profile.tradeInValue}|detail='${profile.equipmentDetail}'`;
  }

  if (input.scenario === "RECOGNIZED_SHORTHAND") {
    return `Counter note — ${profile.productSourceText}; ${profile.equipmentDetail}; ${shaft}; cond ${profile.conditionGrade}; est. $${profile.tradeInValue}; store ${input.storeId}.`;
  }

  return `Counter intake — ${base}.`;
}

function buildAiReadyRecord(
  definition: ActiveRecordDefinition,
  anchor: Date,
): BaselineAiReadyRecordFixture {
  const recordId = id("record", definition.activeIndex + 1);
  const profile = getProductProfile(
    definition.category,
    definition.activeIndex,
  );
  const missingFields =
    definition.reviewOrdinal === null
      ? []
      : [...(REVIEW_MISSING_FIELDS[definition.reviewOrdinal] ?? [])];
  const createdAt = getRecordCreatedAt(anchor, definition.activeIndex);
  const rawText = getRawText({
    createdAt,
    missingFields,
    profile,
    storeId: definition.storeId,
    sourceType: definition.sourceType,
    scenario: definition.scenario,
  });
  const catalogResolved = !missingFields.includes("productLine");
  const confidence = definition.ready
    ? 0.88 + (definition.activeIndex % 7) * 0.015
    : 0.48 + ((definition.reviewOrdinal ?? 0) % 6) * 0.05;

  return {
    id: recordId,
    intakeBatchId: id("batch", definition.workflowIndex + 1),
    intakeItemId: id("item", definition.activeIndex + 1),
    workflowRunId: id("workflow", definition.workflowIndex + 1),
    sourceRecordId: `store-${definition.storeId}-${String(definition.activeIndex + 1).padStart(3, "0")}`,
    sourceType: definition.sourceType,
    sourceName: `Store ${definition.storeId} ${STORE_LABELS[definition.storeId] ?? ""} · ${SOURCE_DEFINITIONS[definition.sourceType].name}`,
    rawText,
    cleanedText: rawText.replace(/\s+/g, " ").trim(),
    normalizedJson: {
      id: recordId,
      sourceId: id("batch", definition.workflowIndex + 1),
      sourceType: definition.sourceType,
      brand: profile.brand,
      productLine: missingFields.includes("productLine")
        ? null
        : profile.productLine,
      category: profile.category,
      shaftFlex: missingFields.includes("shaftFlex") ? null : profile.shaftFlex,
      conditionGrade: missingFields.includes("conditionGrade")
        ? null
        : profile.conditionGrade,
      tradeInValue: missingFields.includes("tradeInValue")
        ? null
        : profile.tradeInValue,
      customerName: null,
      customerEmail: null,
      storeId: definition.storeId,
      eventTimestamp: createdAt.toISOString(),
      attachmentsMentioned: [],
      missingFields,
      confidence,
      reviewNeeded: !definition.ready,
      sourceText: rawText,
      normalizedText: rawText.toLowerCase(),
    },
    inferredSchemaJson: null,
    metadataJson: {
      syntheticBaseline: true,
      catalogReference: catalogResolved
        ? {
            productId: profile.productId,
            sku: profile.sku,
            year: profile.referenceYear,
          }
        : null,
      candidateProductLines:
        definition.scenario === "AMBIGUOUS_CATALOG_IDENTITY"
          ? [profile.productLine, profile.alternateProductLine].filter(Boolean)
          : [],
      fieldAuthority: Object.fromEntries(
        (
          [
            "brand",
            "productLine",
            "category",
            "shaftFlex",
            "conditionGrade",
            "tradeInValue",
          ] as const
        ).map((field) => [
          field,
          missingFields.includes(field)
            ? "REQUIRES_VERIFICATION"
            : "VERIFIED_FROM_SOURCE",
        ]),
      ),
      expectedValuationRange:
        profile.lowValue === null || profile.highValue === null
          ? null
          : {
              low: profile.lowValue,
              high: profile.highValue,
            },
      storeLabel: STORE_LABELS[definition.storeId] ?? null,
      storeId: definition.storeId,
      scenario: definition.scenario,
    },
    qualitySignalsJson: definition.ready
      ? []
      : [
          {
            signal: definition.scenario,
            severity: "REVIEW",
            message: getReviewSignalMessage(definition.scenario, missingFields),
          },
        ],
    status: definition.ready ? "READY_FOR_RAG" : "NEEDS_REVIEW",
    reviewNeeded: !definition.ready,
    dataOrigin: DATA_ORIGIN,
    embeddingReady: definition.ready,
    ragReady: definition.ready,
    supersededByAiReadyIntakeRecordId: null,
    supersededAt: null,
    supersededReason: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildSupersededRecords(
  activeRecords: BaselineAiReadyRecordFixture[],
  anchor: Date,
): BaselineAiReadyRecordFixture[] {
  return REPLACEMENT_ACTIVE_INDEXES.map((activeIndex, historyIndex) => {
    const replacement = activeRecords[activeIndex];

    if (!replacement) {
      throw new Error("Baseline replacement record is missing.");
    }

    const createdAt = dateBefore(anchor, (historyIndex + 4) * 12 * HOUR_MS);
    const normalizedJson = {
      ...replacement.normalizedJson,
      id: id("history_record", historyIndex + 1),
      conditionGrade: null,
      missingFields: ["conditionGrade"],
      reviewNeeded: true,
    };

    return {
      ...replacement,
      id: id("history_record", historyIndex + 1),
      sourceRecordId: `${replacement.sourceRecordId}-previous`,
      sourceName: `${replacement.sourceName} · replaced candidate`,
      normalizedJson,
      metadataJson: {
        ...replacement.metadataJson,
        scenario: "HUMAN_CORRECTION",
      },
      qualitySignalsJson: [
        {
          signal: "HUMAN_CORRECTION",
          severity: "INFO",
          message: "A reviewed correction replaced this upstream candidate.",
        },
      ],
      status: "SUPERSEDED",
      reviewNeeded: false,
      embeddingReady: false,
      ragReady: false,
      supersededByAiReadyIntakeRecordId: replacement.id,
      supersededAt: replacement.createdAt,
      supersededReason:
        "Replaced by later reviewed workflow output; retained for provenance.",
      createdAt,
      updatedAt: replacement.createdAt,
    };
  });
}

function reviewReason(record: BaselineAiReadyRecordFixture) {
  const scenario = record.metadataJson.scenario;

  if (scenario === "AMBIGUOUS_CATALOG_IDENTITY") {
    return "AMBIGUOUS_INPUT" as const;
  }

  if (scenario === "NEGATIVE_EVIDENCE") {
    return "LOW_CONFIDENCE" as const;
  }

  return "MISSING_REQUIRED_FIELDS" as const;
}

function getAssignedReviewNote(
  record: BaselineAiReadyRecordFixture,
  index: number,
): string {
  const scenario = record.metadataJson.scenario;
  const storeId = String(
    record.normalizedJson.storeId ?? "the originating store",
  );

  if (scenario === "DEGRADED_LOG_PAYLOAD") {
    return `Assigned to source operations; Store ${storeId} is confirming the original intake log while the formatting regression is investigated.`;
  }

  if (scenario === "STORE_INSPECTION") {
    return `Assigned to Store ${storeId} for physical inspection; no estimated values have been promoted.`;
  }

  if (scenario === "AMBIGUOUS_CATALOG_IDENTITY") {
    return "Assigned to catalog verification to compare the supported product candidates.";
  }

  return index % 2 === 0
    ? `Assigned to Store ${storeId} for source verification.`
    : "Assigned to trade-in operations for evidence review.";
}

const RESOLVED_REVIEW_NOTES = [
  "Store inspection confirmed condition and the catalog-backed valuation range.",
  "Catalog specialist verified the product generation from sole and badge photos.",
  "Reviewer matched the shaft label to the approved flex vocabulary.",
  "Source owner confirmed the shifted CSV columns against the original export.",
  "Trade-in desk supplied the missing inspection worksheet and supporting photos.",
] as const;

function buildReviewQueueItems(
  activeRecords: BaselineAiReadyRecordFixture[],
  supersededRecords: BaselineAiReadyRecordFixture[],
): BaselineReviewQueueItemFixture[] {
  const resolved = RESOLVED_ACTIVE_INDEXES.map((activeIndex, index) => {
    const record = activeRecords[activeIndex];

    if (!record) {
      throw new Error("Baseline resolved review record is missing.");
    }

    return {
      id: id("review_resolved", index + 1),
      intakeItemId: record.intakeItemId,
      golfClubId: null,
      workflowRunId: record.workflowRunId,
      reason: "MISSING_REQUIRED_FIELDS" as const,
      status: "RESOLVED" as const,
      dataOrigin: DATA_ORIGIN,
      originalText: record.rawText,
      proposedGolfClubJson: record.normalizedJson,
      reviewerNotes:
        RESOLVED_REVIEW_NOTES[index % RESOLVED_REVIEW_NOTES.length] ??
        "Verified source details and preserved the reviewed replacement.",
      resolvedAt: record.createdAt,
      supersededByReviewQueueItemId: null,
      supersededAt: null,
      supersededReason: null,
      createdAt: dateBefore(record.createdAt, 2 * HOUR_MS),
      updatedAt: record.createdAt,
    };
  });
  const activeReviews = activeRecords
    .filter((record) => record.reviewNeeded)
    .map((record, index) => ({
      id: id("review_active", index + 1),
      intakeItemId: record.intakeItemId,
      golfClubId: null,
      workflowRunId: record.workflowRunId,
      reason: reviewReason(record),
      status: index < 10 ? ("OPEN" as const) : ("IN_REVIEW" as const),
      dataOrigin: DATA_ORIGIN,
      originalText: record.rawText,
      proposedGolfClubJson: record.normalizedJson,
      reviewerNotes: index < 10 ? null : getAssignedReviewNote(record, index),
      resolvedAt: null,
      supersededByReviewQueueItemId: null,
      supersededAt: null,
      supersededReason: null,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
    }));
  const supersededReviews = supersededRecords.map((record, index) => {
    const replacementReview = resolved[index];

    if (!replacementReview) {
      throw new Error("Baseline replacement review item is missing.");
    }

    return {
      id: id("review_history", index + 1),
      intakeItemId: record.intakeItemId,
      golfClubId: null,
      workflowRunId: record.workflowRunId,
      reason: "MISSING_REQUIRED_FIELDS" as const,
      status: "SUPERSEDED" as const,
      dataOrigin: DATA_ORIGIN,
      originalText: record.rawText,
      proposedGolfClubJson: record.normalizedJson,
      reviewerNotes:
        "Retained as read-only history after an authoritative reviewed record was saved.",
      resolvedAt: null,
      supersededByReviewQueueItemId: replacementReview.id,
      supersededAt: replacementReview.resolvedAt,
      supersededReason:
        "A later reviewed output replaced this upstream review candidate.",
      createdAt: record.createdAt,
      updatedAt: replacementReview.updatedAt,
    };
  });

  return [...activeReviews, ...resolved, ...supersededReviews];
}

function buildModelTelemetry(
  anchor: Date,
  workflowSteps: AdminOpsBaselineFixtures["workflowSteps"],
  activeRecords: BaselineAiReadyRecordFixture[],
): {
  modelCalls: BaselineModelCallFixture[];
  modelCallAttempts: BaselineModelCallAttemptFixture[];
} {
  const outcomeTypes = [
    ...Array<string>(32).fill("REPAIR_SUGGESTED"),
    ...Array<string>(14).fill("CANDIDATE_COMPARISON"),
    ...Array<string>(12).fill("NO_SAFE_REPAIR"),
  ];
  let outcomeIndex = 0;
  const modelCalls: BaselineModelCallFixture[] = [];
  const modelCallAttempts: BaselineModelCallAttemptFixture[] = [];
  const directLatencyMs = [
    4_200, 4_800, 5_100, 5_400, 5_700, 5_900, 6_100, 6_200, 6_350, 6_500, 6_650,
    6_800, 7_000, 7_200, 7_400, 7_700, 8_100, 9_900,
  ];
  const tokenTotals = [
    1_180, 1_240, 1_290, 1_330, 1_370, 1_400, 1_420, 1_440, 1_460, 1_480, 1_500,
    1_520, 1_540, 1_560, 1_600, 1_640, 1_280, 1_360, 1_460, 1_530,
  ];
  const callCosts = [
    0.0022, 0.0024, 0.002, 0.0026, 0.0027, 0.0028, 0.0029, 0.003, 0.0031,
    0.0032, 0.0033, 0.0034, 0.0035, 0.0036, 0.0037, 0.0038, 0.0026, 0.0027,
    0.0035, 0.0044,
  ];

  for (let index = 0; index < 20; index += 1) {
    const selectedRecordCount = index < 18 ? 3 : 2;
    const selectedOutcomes = outcomeTypes
      .slice(outcomeIndex, outcomeIndex + selectedRecordCount)
      .map((outcomeType, recordIndex) => ({
        recordId: `assessed-${index + 1}-${recordIndex + 1}`,
        outcomeType,
      }));
    outcomeIndex += selectedRecordCount;
    const timeoutFallback = index === 18;
    const rateLimitFallback = index === 19;
    const usesFallback = timeoutFallback || rateLimitFallback;
    const callId = id("model_call", index + 1);
    const workflowIndex = index % 13;
    const workflowStep = workflowSteps.find(
      (step) =>
        step.workflowRunId === id("workflow", workflowIndex + 1) &&
        step.stepType === "RETRIEVE_EVIDENCE",
    );

    if (!workflowStep) {
      throw new Error("Baseline model-call workflow step is missing.");
    }

    const startedAt = dateBefore(anchor, (index + 8) * 6 * HOUR_MS);
    const latencyMs = timeoutFallback
      ? 25_000
      : rateLimitFallback
        ? 15_720
        : (directLatencyMs[index] ?? 6_500);
    const estimatedCostUsd = callCosts[index] ?? 0.003;
    const provider = usesFallback ? "MOCK" : "OPENAI";
    const model = usesFallback ? "mock-golf-workflow-model" : "gpt-4.1-mini";
    const records = Array.from(
      { length: selectedRecordCount },
      (_, recordIndex) =>
        activeRecords[(index * 3 + recordIndex) % activeRecords.length],
    );
    const totalTokens = tokenTotals[index] ?? 1_430;
    const completionTokens = 240 + (index % 5) * 35;
    const selectedOutcomesWithRecordIds = selectedOutcomes.map(
      (outcome, recordIndex) => ({
        ...outcome,
        recordId: records[recordIndex]?.id ?? outcome.recordId,
      }),
    );

    modelCalls.push({
      id: callId,
      workflowRunId: id("workflow", workflowIndex + 1),
      workflowStepId: workflowStep.id,
      provider,
      model,
      status: "SUCCEEDED",
      dataOrigin: DATA_ORIGIN,
      promptTokens: totalTokens - completionTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      estimatedCostUsd,
      requestJson: {
        policyKey: "MAIN_RUN_FIELD_REPAIR",
        agentName: "main-run-field-repair-agent",
        outputSchema: {
          name: "main_run_field_repair",
          version: "1.0",
          strict: true,
        },
        inputJson: {
          records: records.map((record) => ({
            id: record?.id,
            sourceType: record?.sourceType,
            normalizedFields: record?.normalizedJson,
          })),
        },
        baselineScenario: timeoutFallback
          ? "PROVIDER_TIMEOUT"
          : rateLimitFallback
            ? "PROVIDER_RATE_LIMIT"
            : "VALIDATED_ASSISTANCE",
      },
      responseJson: {
        validation: {
          jsonValid: true,
          validationPassed: true,
          validationErrors: [],
        },
        providerExecution: {
          outputJson: {
            parsedJson: { recordOutcomes: selectedOutcomesWithRecordIds },
          },
        },
      },
      errorMessage: null,
      startedAt,
      completedAt: new Date(startedAt.getTime() + latencyMs),
      createdAt: startedAt,
    });

    if (usesFallback) {
      const failedLatency = timeoutFallback ? 10_000 : 1_000;
      modelCallAttempts.push({
        id: id("model_attempt", modelCallAttempts.length + 1),
        modelCallLogId: callId,
        provider: "OPENAI",
        model: "gpt-4.1-mini",
        attemptOrder: 1,
        status: timeoutFallback ? "TIMEOUT" : "RATE_LIMITED",
        reason: timeoutFallback
          ? "Provider attempt exceeded the configured deadline."
          : "Provider returned a retryable rate limit response.",
        errorMessage: timeoutFallback
          ? "Preferred provider timed out."
          : "Preferred provider was rate limited.",
        latencyMs: failedLatency,
        estimatedCostUsd: 0,
        startedAt,
        completedAt: new Date(startedAt.getTime() + failedLatency),
        createdAt: startedAt,
      });
      modelCallAttempts.push({
        id: id("model_attempt", modelCallAttempts.length + 1),
        modelCallLogId: callId,
        provider: "MOCK",
        model: "mock-golf-workflow-model",
        attemptOrder: 2,
        status: "SUCCESS",
        reason: "Fallback provider returned schema-valid advisory output.",
        errorMessage: null,
        latencyMs: latencyMs - failedLatency,
        estimatedCostUsd,
        startedAt: new Date(startedAt.getTime() + failedLatency),
        completedAt: new Date(startedAt.getTime() + latencyMs),
        createdAt: startedAt,
      });
    } else {
      modelCallAttempts.push({
        id: id("model_attempt", modelCallAttempts.length + 1),
        modelCallLogId: callId,
        provider: "OPENAI",
        model: "gpt-4.1-mini",
        attemptOrder: 1,
        status: "SUCCESS",
        reason: "Preferred provider returned schema-valid advisory output.",
        errorMessage: null,
        latencyMs,
        estimatedCostUsd,
        startedAt,
        completedAt: new Date(startedAt.getTime() + latencyMs),
        createdAt: startedAt,
      });
    }
  }

  return { modelCalls, modelCallAttempts };
}

export function buildAdminOpsBaselineFixtures(
  anchor: Date = new Date(),
): AdminOpsBaselineFixtures {
  const normalizedAnchor = new Date(anchor);

  if (Number.isNaN(normalizedAnchor.getTime())) {
    throw new Error("The Admin Ops baseline anchor must be a valid date.");
  }

  const definitions = buildActiveDefinitions();
  const activeRecords = definitions.map((definition) =>
    buildAiReadyRecord(definition, normalizedAnchor),
  );
  const supersededRecords = buildSupersededRecords(
    activeRecords,
    normalizedAnchor,
  );
  const workflowRuns = Array.from({ length: 14 }, (_, index) => {
    const failed = index === 13;
    const needsReview = index >= 8 && index < 13;
    const startedAt = dateBefore(normalizedAnchor, (index + 1) * 11 * HOUR_MS);
    const completedAt = new Date(
      startedAt.getTime() + (failed ? 90_000 : 420_000),
    );

    return {
      id: id("workflow", index + 1),
      intakeBatchId: id("batch", index + 1),
      intakeItemId: null,
      workflowName: failed
        ? "multi-source-intake-source-processing"
        : "guarded-trade-in-operational-run",
      status: failed
        ? ("FAILED" as const)
        : needsReview
          ? ("NEEDS_REVIEW" as const)
          : ("COMPLETED" as const),
      dataOrigin: DATA_ORIGIN,
      startedAt,
      completedAt,
      errorMessage: failed
        ? "Store 207 CSV header did not contain a recoverable record boundary."
        : null,
      failureJson: failed
        ? {
            classification: "SOURCE_PROCESSING_FAILURE",
            retryable: true,
            operatorAction:
              "Verify the export format and rerun the intake batch.",
          }
        : null,
      createdAt: startedAt,
      updatedAt: completedAt,
    };
  });
  const recordCountsByWorkflow = definitions.reduce<Record<number, number>>(
    (counts, definition) => ({
      ...counts,
      [definition.workflowIndex]: (counts[definition.workflowIndex] ?? 0) + 1,
    }),
    {},
  );
  const batchSourceByWorkflow = new Map(
    definitions.map((definition) => [
      definition.workflowIndex,
      definition.sourceType,
    ]),
  );
  const intakeBatches = workflowRuns.map((run, index) => ({
    id: id("batch", index + 1),
    name:
      index === 13
        ? "Store 207 · nightly CSV exception"
        : `${SOURCE_DEFINITIONS[batchSourceByWorkflow.get(index) ?? "FREE_TEXT"].name} · ${String(index + 1).padStart(2, "0")}`,
    description:
      index === 13
        ? "Source-processing failure retained for operational diagnosis."
        : `${recordCountsByWorkflow[index] ?? 0} records received through the ${SOURCE_DEFINITIONS[batchSourceByWorkflow.get(index) ?? "FREE_TEXT"].name.toLowerCase()} channel.`,
    sourceType: (() => {
      const sourceType = batchSourceByWorkflow.get(index);

      if (sourceType === "POORLY_FORMED_CSV" || index === 13) {
        return "BAD_CSV" as const;
      }

      if (sourceType === "EMAIL") {
        return "EMAIL" as const;
      }

      return sourceType === "LOG"
        ? ("MANUAL_ENTRY" as const)
        : ("FREEFORM_NOTES" as const);
    })(),
    status: run.status,
    itemCount: recordCountsByWorkflow[index] ?? 0,
    dataOrigin: DATA_ORIGIN,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  }));
  const intakeItems = activeRecords.map((record, index) => ({
    id: record.intakeItemId,
    intakeBatchId: record.intakeBatchId,
    rawText: record.rawText,
    sourceRowNumber: index + 1,
    status: record.reviewNeeded
      ? ("NEEDS_REVIEW" as const)
      : ("STRUCTURED" as const),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
  const workflowSteps = workflowRuns.flatMap((run, runIndex) => {
    const failed = run.status === "FAILED";
    const stepDefinitions = failed
      ? ([["Parse source envelope", "PARSE_INPUT", "FAILED"]] as const)
      : ([
          ["Parse source records", "PARSE_INPUT", "COMPLETED"],
          ["Normalize source fields", "NORMALIZE_DATA", "COMPLETED"],
          ["Retrieve bounded evidence", "RETRIEVE_EVIDENCE", "COMPLETED"],
          ["Finalize operational result", "FINALIZE_WORKFLOW", "COMPLETED"],
        ] as const);

    return stepDefinitions.map(([stepName, stepType, status], stepIndex) => ({
      id: id("step", runIndex * 4 + stepIndex + 1),
      workflowRunId: run.id,
      stepName,
      stepType,
      status,
      orderIndex: stepIndex + 1,
      inputJson: { syntheticBaseline: true },
      outputJson: failed ? null : { completed: true, validationPassed: true },
      errorMessage: failed ? run.errorMessage : null,
      retryCount: 0,
      startedAt: new Date(run.startedAt.getTime() + stepIndex * 60_000),
      completedAt: new Date(run.startedAt.getTime() + (stepIndex + 1) * 60_000),
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    }));
  });
  const reviewQueueItems = buildReviewQueueItems(
    activeRecords,
    supersededRecords,
  );
  const reviewedTradeInRecords = reviewQueueItems
    .filter((item) => item.status === "RESOLVED")
    .map((item, index) => {
      const normalized = item.proposedGolfClubJson;
      const approvedAt = item.resolvedAt ?? item.updatedAt;
      const correctedShaftFlex =
        typeof normalized.shaftFlex === "string"
          ? normalized.shaftFlex
          : "STIFF";
      const correctedConditionGrade =
        typeof normalized.conditionGrade === "string"
          ? normalized.conditionGrade
          : "8.0 Average";
      const correctedDemoValue =
        typeof normalized.tradeInValue === "number"
          ? normalized.tradeInValue
          : 145;

      return {
        id: id("reviewed_record", index + 1),
        reviewQueueItemId: item.id,
        workflowRunId: item.workflowRunId,
        intakeItemId: item.intakeItemId,
        originalText: item.originalText,
        correctedBrand:
          typeof normalized.brand === "string" ? normalized.brand : null,
        correctedProductLine:
          typeof normalized.productLine === "string"
            ? normalized.productLine
            : null,
        correctedCategory:
          typeof normalized.category === "string" ? normalized.category : null,
        correctedShaftFlex,
        correctedConditionGrade,
        conditionEvidenceText:
          index % 2 === 0
            ? "Store inspection photos and sole-wear notes supported the saved grade."
            : "The originating source owner confirmed the condition grade.",
        correctedDemoValue,
        demoValuationNote:
          "Catalog-backed demonstration range; not a live customer offer.",
        reviewerNotes:
          item.reviewerNotes ??
          "Verified correction retained with its source evidence.",
        approvedAt,
        dataOrigin: DATA_ORIGIN,
        createdAt: approvedAt,
        updatedAt: approvedAt,
      };
    });
  const modelTelemetry = buildModelTelemetry(
    normalizedAnchor,
    workflowSteps,
    activeRecords,
  );
  const evidenceStepsByWorkflow = new Map(
    workflowSteps
      .filter((step) => step.stepType === "RETRIEVE_EVIDENCE")
      .map((step) => [step.workflowRunId, step]),
  );
  let toolIndex = 0;
  const toolCalls: AdminOpsBaselineFixtures["toolCalls"] =
    activeRecords.flatMap((record, index) => {
      const workflowStep = evidenceStepsByWorkflow.get(record.workflowRunId);

      if (!workflowStep) {
        throw new Error("Baseline tool-call workflow step is missing.");
      }

      const tools: Array<[string, Record<string, unknown>]> = [];

      if (index < 44) {
        tools.push([
          "swingops.knowledgeBase.search",
          {
            resultCount: 2 + (index % 3),
            grounded: true,
            topMatchType: index % 4 === 0 ? "POLICY" : "PRODUCT_REFERENCE",
          },
        ]);
      }

      if (index < 42) {
        tools.push([
          "swingops.inventory.lookupProduct",
          {
            candidateCount:
              record.metadataJson.scenario === "AMBIGUOUS_CATALOG_IDENTITY"
                ? 2
                : 1,
            supported: true,
            sku:
              typeof record.metadataJson.catalogReference === "object" &&
              record.metadataJson.catalogReference !== null &&
              "sku" in record.metadataJson.catalogReference
                ? record.metadataJson.catalogReference.sku
                : null,
          },
        ]);
      }

      if (index < 38) {
        tools.push([
          "swingops.tradeInValuation.estimate",
          {
            rangeReturned: true,
            range: record.metadataJson.expectedValuationRange,
          },
        ]);
      }

      return tools.map(([toolName, outputJson]) => {
        toolIndex += 1;

        return {
          id: id("tool_call", toolIndex),
          workflowRunId: record.workflowRunId,
          workflowStepId: workflowStep.id,
          toolName,
          status: "SUCCEEDED" as const,
          dataOrigin: DATA_ORIGIN,
          inputJson: { recordId: record.id },
          outputJson,
          errorMessage: null,
          startedAt: record.createdAt,
          completedAt: new Date(record.createdAt.getTime() + 25),
          createdAt: record.createdAt,
        };
      });
    });

  for (let blockedIndex = 0; blockedIndex < 2; blockedIndex += 1) {
    const record = activeRecords[blockedIndex];

    if (!record) {
      throw new Error("Baseline blocked-tool record is missing.");
    }

    const workflowStep = evidenceStepsByWorkflow.get(record.workflowRunId);

    if (!workflowStep) {
      throw new Error("Baseline blocked-tool workflow step is missing.");
    }

    toolIndex += 1;
    toolCalls.push({
      id: id("tool_call", toolIndex),
      workflowRunId: record.workflowRunId,
      workflowStepId: workflowStep.id,
      toolName: "swingops.inventory.createSku",
      status: "BLOCKED",
      dataOrigin: DATA_ORIGIN,
      inputJson: { recordId: record.id, requestedMutation: true },
      outputJson: {
        policyDecision: "BLOCKED",
        reason: "Mutation tools are not authorized for this workflow.",
      },
      errorMessage: "Blocked by application-owned tool policy.",
      startedAt: record.createdAt,
      completedAt: new Date(record.createdAt.getTime() + 5),
      createdAt: record.createdAt,
    });
  }

  const fixtures: AdminOpsBaselineFixtures = {
    anchor: normalizedAnchor,
    intakeBatches,
    intakeItems,
    workflowRuns,
    workflowSteps,
    aiReadyRecords: [...activeRecords, ...supersededRecords],
    reviewQueueItems,
    reviewedTradeInRecords,
    humanReviewLearningEvents: [],
    modelCalls: modelTelemetry.modelCalls,
    modelCallAttempts: modelTelemetry.modelCallAttempts,
    toolCalls,
  };

  validateAdminOpsBaselineFixtures(fixtures);

  return fixtures;
}
