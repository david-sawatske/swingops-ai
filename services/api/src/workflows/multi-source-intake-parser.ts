import { isShaftFlexApplicable } from "./golf-field-applicability.js";
import {
  findTextParserEvidence,
  omitEmptyParserEvidence
} from "./parser-evidence.js";
import {
  detectApprovedConditionGradeWithEvidence,
  detectShaftFlexWithEvidence,
  detectTradeInValueWithEvidence
} from "./parser-normalizers.js";
import type {
  ProductReferenceProvider
} from "../product-reference/product-reference-provider.js";
import {
  resolveProductReference
} from "../product-reference/product-reference-resolver.js";
import {
  resolveParsedProductIdentity
} from "./product-resolution-parser.js";
import type {
  ParserEvidence,
  ParserFieldEvidence
} from "./parser-evidence.js";
import type {
  MultiSourceIntakeRecord,
  MultiSourceIntakeSourceType
} from "./multi-source-intake-types.js";

type MultiSourceParserInput = {
  id: string;
  sourceType: MultiSourceIntakeSourceType;
  sourceName: string;
  rawContent: string;
};

export function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function cleanText(rawContent: string): string {
  return rawContent
    .replace(/\r/g, "")
    .replace(/[|;]/g, " | ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detectBrand(text: string): string | null {
  if (/\btm\b|\btaylormade\b/i.test(text)) {
    return "TaylorMade";
  }

  if (/\btitleist\b/i.test(text)) {
    return "Titleist";
  }

  if (/\bcally\b|\bcallaway\b/i.test(text)) {
    return "Callaway";
  }

  if (/\bping\b/i.test(text)) {
    return "PING";
  }

  if (/\bcleveland\b/i.test(text)) {
    return "Cleveland";
  }

  if (/\bodyssey\b/i.test(text)) {
    return "Odyssey";
  }

  if (/\bmizuno\b/i.test(text)) {
    return "Mizuno";
  }

  return null;
}

function detectCategory(text: string): string | null {
  if (/\bdriver\b|\bdrv\b/i.test(text)) {
    return "DRIVER";
  }

  if (/\b(?:3|4|5|7|9)\s*-?\s*(?:w|wood)\b|\bfairway\b/i.test(text)) {
    return "FAIRWAY_WOOD";
  }

  if (/\b(?:hybrid|hy|rescue)\b/i.test(text)) {
    return "HYBRID";
  }

  if (/\bwedge\b|\b(?:46|48|50|52|54|56|58|60)\s*(?:deg|degree|°)?\b/i.test(text)) {
    return "WEDGE";
  }

  if (/\bputter\b/i.test(text)) {
    return "PUTTER";
  }

  if (/\birons?\b|\b[4-9]-pw\b/i.test(text)) {
    return "IRON_SET";
  }

  return null;
}


function getDetectedBrandSourcePattern(
  brand: string
): RegExp | null {
  if (brand === "TaylorMade") {
    return /\b(?:taylormade|tm)\b/i;
  }

  if (brand === "Titleist") {
    return /\btitleist\b/i;
  }

  if (brand === "Callaway") {
    return /\b(?:callaway|cally)\b/i;
  }

  if (brand === "PING") {
    return /\bping\b/i;
  }

  if (brand === "Cleveland") {
    return /\bcleveland\b/i;
  }

  if (brand === "Odyssey") {
    return /\bodyssey\b/i;
  }

  if (brand === "Mizuno") {
    return /\bmizuno\b/i;
  }

  return null;
}

function getDetectedCategorySourcePattern(
  category: string
): RegExp | null {
  if (category === "DRIVER") {
    return /\b(?:driver|drv)\b/i;
  }

  if (category === "FAIRWAY_WOOD") {
    return /\b(?:(?:3|4|5|7|9)\s*-?\s*(?:w|wood)|fairway)\b/i;
  }

  if (category === "HYBRID") {
    return /\b(?:hybrid|hy|rescue)\b/i;
  }

  if (category === "WEDGE") {
    return /\b(?:wedge|(?:46|48|50|52|54|56|58|60)\s*(?:deg|degree|°)?)\b/i;
  }

  if (category === "PUTTER") {
    return /\bputter\b/i;
  }

  if (category === "IRON_SET") {
    return /\b(?:irons?|[4-9]-pw)\b/i;
  }

  return null;
}

function detectSourceSupportedProductText(input: {
  sourceType: MultiSourceIntakeSourceType;
  text: string;
  detectedBrand: string | null;
  detectedCategory: string | null;
}): string | null {
  if (
    input.sourceType ===
      "POORLY_FORMED_CSV" ||
    !input.detectedBrand ||
    !input.detectedCategory
  ) {
    return null;
  }

  const brandPattern =
    getDetectedBrandSourcePattern(
      input.detectedBrand
    );
  const categoryPattern =
    getDetectedCategorySourcePattern(
      input.detectedCategory
    );

  if (!brandPattern || !categoryPattern) {
    return null;
  }

  const brandMatch =
    input.text.match(brandPattern);
  const categoryMatch =
    input.text.match(categoryPattern);

  if (
    !brandMatch?.[0] ||
    brandMatch.index === undefined ||
    !categoryMatch?.[0] ||
    categoryMatch.index === undefined
  ) {
    return null;
  }

  const productStart =
    brandMatch.index +
    brandMatch[0].length;
  const productEnd =
    categoryMatch.index;

  if (productEnd <= productStart) {
    return null;
  }

  const candidate =
    input.text
      .slice(
        productStart,
        productEnd
      )
      .replace(
        /^[\s,;:|/\-]+|[\s,;:|/\-]+$/g,
        ""
      )
      .trim();

  return normalizeDelimitedProductText(
    candidate
  );
}

function buildParserEvidence(
  text: string,
  values: {
    brand: string | null;
    productLineEvidence: ParserFieldEvidence | undefined;
    category: string | null;
    shaftFlex: string | null;
    conditionGrade: string | null;
    tradeInValue: number | null;
  },
): ParserEvidence {
  return omitEmptyParserEvidence({
    brand: findTextParserEvidence(text, values.brand, [
      { value: "TaylorMade", aliases: [/\btaylormade\b/i, /\btm\b/i] },
      { value: "Titleist", aliases: [/\btitleist\b/i] },
      { value: "Callaway", aliases: [/\bcallaway\b/i, /\bcally\b/i] },
      { value: "PING", aliases: [/\bping\b/i] },
      { value: "Cleveland", aliases: [/\bcleveland\b/i] },
      { value: "Odyssey", aliases: [/\bodyssey\b/i] },
      { value: "Mizuno", aliases: [/\bmizuno\b/i] },
    ]),
    ...(values.productLineEvidence
      ? {
          productLine:
            values.productLineEvidence
        }
      : {}),
    category: findTextParserEvidence(text, values.category, [
      { value: "DRIVER", aliases: [/\bdriver\b/i, /\bdrv\b/i] },
      { value: "FAIRWAY_WOOD", aliases: [/\b(?:3|4|5|7|9)\s*-?\s*(?:w|wood)\b/i, /\bfairway\b/i] },
      { value: "HYBRID", aliases: [/\bhybrid\b/i, /\bhy\b/i, /\brescue\b/i] },
      { value: "WEDGE", aliases: [/\bwedge\b/i, /\b(?:46|48|50|52|54|56|58|60)\s*(?:deg|degree|°)?\b/i] },
      { value: "PUTTER", aliases: [/\bputter\b/i] },
      { value: "IRON_SET", aliases: [/\birons?\b/i, /\b[4-9]-pw\b/i] },
    ]),
    shaftFlex: isShaftFlexApplicable(values.category)
      ? detectShaftFlexWithEvidence(text).evidence
      : undefined,
    conditionGrade: detectApprovedConditionGradeWithEvidence(text).evidence,
    tradeInValue: detectTradeInValueWithEvidence(text).evidence,
  });
}

function detectStoreIds(
  text: string
): string[] {
  const storePattern =
    /\bstore(?:=|:|\s)?\s*(STORE-)?(\d{3})\b/gi;
  const storeIds = new Set<string>();

  for (
    const match of text.matchAll(
      storePattern
    )
  ) {
    const numericStoreId =
      match[2];

    if (!numericStoreId) {
      continue;
    }

    storeIds.add(
      match[1]
        ? `STORE-${numericStoreId}`
        : numericStoreId
    );
  }

  return [...storeIds];
}

function detectStoreId(
  text: string
): string | null {
  return detectStoreIds(text)[0] ?? null;
}

function resolveRecordStoreId(input: {
  source: MultiSourceParserInput;
  fragment: string;
  csvStoreId: string | null;
}): string | null {
  if (
    input.source.sourceType ===
    "POORLY_FORMED_CSV"
  ) {
    return (
      input.csvStoreId ??
      detectStoreId(input.fragment)
    );
  }

  const fragmentStoreId =
    detectStoreId(input.fragment);

  if (fragmentStoreId) {
    return fragmentStoreId;
  }

  const sourceStoreIds =
    detectStoreIds(
      input.source.rawContent
    );

  return sourceStoreIds.length === 1
    ? sourceStoreIds[0] ?? null
    : null;
}

type PoorlyFormedCsvRowValues = {
  productText: string | null;
  shaftFlex: string | null;
  shaftFlexSourceText: string | null;
  tradeInValue: number | null;
  tradeInValueSourceText: string | null;
  storeId: string | null;
};

function normalizeDelimitedHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function stripDelimitedCell(value: string): string {
  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function normalizeDelimitedProductText(
  value: string | null
): string | null {
  const productText =
    value?.trim() ?? "";

  if (
    !productText ||
    /^(?:unknown(?:\s+(?:item|club|model))?|mystery\s+club|n\/?a|none|null|tbd|\?)$/i.test(
      productText
    )
  ) {
    return null;
  }

  return productText;
}

type StructuredLogValues = {
  brand: string | null;
  productText: string | null;
  category: string | null;
  shaftFlex: string | null;
  shaftFlexSourceText: string | null;
  conditionGrade: string | null;
  conditionGradeSourceText: string | null;
};

const STRUCTURED_LOG_FIELD_KEYS = [
  "brand",
  "make",
  "manufacturer",
  "model",
  "product",
  "productline",
  "clubmodel",
  "cat",
  "category",
  "type",
  "shaft",
  "shaftflex",
  "flex",
  "condition",
  "conditiongrade",
  "grade",
  "value",
  "tradevalue",
  "tradeinvalue",
  "estimatedvalue",
  "store",
  "storeid",
  "location",
  "locationid",
  "note",
  "notes"
] as const;

function escapeRegularExpressionText(
  value: string
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function extractStructuredLogFieldValue(
  fragment: string,
  aliases: string[]
): string | null {
  const aliasPattern = aliases
    .map(escapeRegularExpressionText)
    .join("|");
  const allKeysPattern =
    STRUCTURED_LOG_FIELD_KEYS
      .map(escapeRegularExpressionText)
      .join("|");
  const pattern = new RegExp(
    `\\b(?:${aliasPattern})\\s*[:=]\\s*(?:'([^']*)'|"([^"]*)"|(.+?))(?=\\s+\\b(?:${allKeysPattern})\\b\\s*[:=]|[,}]|$)`,
    "i"
  );
  const match = fragment.match(pattern);
  const value =
    match?.[1] ??
    match?.[2] ??
    match?.[3] ??
    "";

  return (
    stripDelimitedCell(value) ||
    null
  );
}

function stripOtherStructuredFieldNegativeEvidence(
  value: string,
  targetFieldAliases: string[]
): string {
  const normalizedTargetAliases =
    new Set(
      targetFieldAliases.map(
        normalizeDelimitedHeader
      )
    );
  const otherFieldPattern =
    STRUCTURED_LOG_FIELD_KEYS
      .filter(
        (fieldName) =>
          fieldName !== "note" &&
          fieldName !== "notes" &&
          !normalizedTargetAliases.has(
            normalizeDelimitedHeader(
              fieldName
            )
          )
      )
      .map(
        escapeRegularExpressionText
      )
      .join("|");
  const negativePattern =
    "unknown|unclear|pending|not\\s+listed|tbd|not\\s+sure";
  const fieldScopedNegativePattern =
    new RegExp(
      `(?:\\b(?:${otherFieldPattern})\\b\\s*(?:=|:|is)?\\s*\\b(?:${negativePattern})\\b)|(?:\\b(?:${negativePattern})\\b\\s+\\b(?:${otherFieldPattern})\\b)`,
      "gi"
    );

  return value.replace(
    fieldScopedNegativePattern,
    " "
  );
}

function parseStructuredLogValues(
  source: MultiSourceParserInput,
  fragment: string
): StructuredLogValues | null {
  if (source.sourceType !== "LOG") {
    return null;
  }

  const brandText =
    extractStructuredLogFieldValue(
      fragment,
      [
        "brand",
        "make",
        "manufacturer"
      ]
    );
  const productText =
    normalizeDelimitedProductText(
      extractStructuredLogFieldValue(
        fragment,
        [
          "model",
          "product",
          "productline",
          "clubmodel"
        ]
      )
    );
  const categoryText =
    extractStructuredLogFieldValue(
      fragment,
      [
        "cat",
        "category",
        "type"
      ]
    );
  const explicitShaftText =
    extractStructuredLogFieldValue(
      fragment,
      [
        "shaft",
        "shaftflex",
        "flex"
      ]
    );
  const explicitConditionText =
    extractStructuredLogFieldValue(
      fragment,
      [
        "condition",
        "conditiongrade",
        "grade"
      ]
    );
  const notesText =
    extractStructuredLogFieldValue(
      fragment,
      [
        "note",
        "notes"
      ]
    );

  const shaftNormalizationText =
    explicitShaftText
      ? `shaft ${explicitShaftText}`
      : notesText
        ? stripOtherStructuredFieldNegativeEvidence(
            notesText,
            [
              "shaft",
              "shaftflex",
              "flex"
            ]
          )
        : "";
  const conditionNormalizationText =
    explicitConditionText
      ? `condition ${explicitConditionText}`
      : notesText
        ? stripOtherStructuredFieldNegativeEvidence(
            notesText,
            [
              "condition",
              "conditiongrade",
              "grade"
            ]
          )
        : "";
  const detectedShaftFlex =
    detectShaftFlexWithEvidence(
      shaftNormalizationText
    );
  const detectedConditionGrade =
    detectApprovedConditionGradeWithEvidence(
      conditionNormalizationText
    );

  if (
    !brandText &&
    !productText &&
    !categoryText &&
    !explicitShaftText &&
    !explicitConditionText &&
    !notesText
  ) {
    return null;
  }

  return {
    brand:
      brandText
        ? detectBrand(brandText)
        : null,
    productText,
    category:
      categoryText
        ? detectCategory(categoryText)
        : null,
    shaftFlex:
      detectedShaftFlex.value,
    shaftFlexSourceText:
      detectedShaftFlex.evidence
        ?.sourceText ??
      null,
    conditionGrade:
      detectedConditionGrade.value,
    conditionGradeSourceText:
      detectedConditionGrade.evidence
        ?.sourceText ??
      null
  };
}

function stripOperationalLogTimestamps(
  value: string
): string {
  return value.replace(
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\b/g,
    " "
  );
}

function detectDelimitedSeparator(headerLine: string): string | null {
  const candidates = ["|", "\t", ";", ","];
  let selectedSeparator: string | null = null;
  let selectedCount = 0;

  for (const candidate of candidates) {
    const count = headerLine.split(candidate).length - 1;

    if (count > selectedCount) {
      selectedSeparator = candidate;
      selectedCount = count;
    }
  }

  return selectedSeparator;
}

function parsePoorlyFormedCsvRowValues(
  source: MultiSourceParserInput,
  fragment: string
): PoorlyFormedCsvRowValues | null {
  if (source.sourceType !== "POORLY_FORMED_CSV") {
    return null;
  }

  const lines = source.rawContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headerLine = lines[0];
  const separator = headerLine
    ? detectDelimitedSeparator(headerLine)
    : null;

  if (!headerLine || !separator) {
    return null;
  }

  const headers = headerLine
    .split(separator)
    .map((header) => normalizeDelimitedHeader(header));
  const cells = fragment
    .split(separator)
    .map(stripDelimitedCell);

  function findCell(headerAliases: string[]): string | null {
    const index = headers.findIndex((header) =>
      headerAliases.includes(header)
    );

    return index >= 0
      ? cells[index] ?? null
      : null;
  }

  const productText =
    normalizeDelimitedProductText(
      findCell([
        "product",
        "productline",
        "model",
        "clubmodel"
      ])
    );
  const shaftFlexSourceText =
    findCell([
      "shaft",
      "shaftflex",
      "flex"
    ]) || null;
  const shaftFlex =
    shaftFlexSourceText
      ? detectShaftFlexWithEvidence(
          `shaft flex ${shaftFlexSourceText}`
        ).value
      : null;

  const tradeInValueSourceText = findCell([
    "value",
    "tradevalue",
    "tradeinvalue",
    "estimatedvalue"
  ]);
  const normalizedValueText = tradeInValueSourceText
    ?.replace(/[$,\s]/g, "");
  const tradeInValue =
    normalizedValueText &&
    /^\d+(?:\.\d+)?$/.test(normalizedValueText)
      ? Number(normalizedValueText)
      : null;

  const storeSourceText = findCell([
    "store",
    "storeid",
    "location",
    "locationid"
  ]);
  const storeMatch = storeSourceText?.match(
    /^(STORE[-\s]*)?(\d{3})$/i
  );
  const storeId = storeMatch
    ? storeMatch[1]
      ? `STORE-${storeMatch[2]}`
      : storeMatch[2] ?? null
    : null;

  return {
    productText,
    shaftFlex,
    shaftFlexSourceText,
    tradeInValue,
    tradeInValueSourceText,
    storeId
  };
}

function detectCustomerName(text: string): string | null {
  const customerMatch = text.match(/\bCustomer:\s*([A-Za-z ]+)/i);
  if (customerMatch?.[1]) {
    return customerMatch[1].trim();
  }

  const counterMatch = text.match(/\bcust:\s*([A-Za-z .]+)/i);
  if (counterMatch?.[1]) {
    return counterMatch[1].trim();
  }

  return null;
}

function detectCustomerEmail(text: string): string | null {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}

function detectAttachments(text: string): string[] {
  const attachmentLine = text
    .split("\n")
    .find((line) => /^Attached:/i.test(line.trim()));

  if (!attachmentLine) {
    return [];
  }

  return attachmentLine
    .replace(/^Attached:\s*/i, "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function detectTimestamps(text: string): string[] {
  return text.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\b/g) ?? [];
}

function countDelimitedSeparators(
  line: string
): number {
  return ["|", "\t", ";", ","].reduce(
    (count, separator) =>
      count +
      line.split(separator).length -
      1,
    0
  );
}

function looksLikeDelimitedHeader(
  line: string
): boolean {
  if (countDelimitedSeparators(line) === 0) {
    return false;
  }

  const normalizedHeaderTokens = new Set(
    line
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
  );
  const expectedHeaderTokens = [
    "brand",
    "model",
    "product",
    "cat",
    "category",
    "shaft",
    "condition",
    "value",
    "store"
  ];

  return expectedHeaderTokens.filter(
    (token) =>
      normalizedHeaderTokens.has(token)
  ).length >= 2;
}

function resolveLineProductReference(
  line: string,
  provider?: ProductReferenceProvider
) {
  const resolutionInput = {
    rawText: line,
    brand: detectBrand(line),
    category: detectCategory(line)
  };

  return provider
    ? resolveProductReference(
        resolutionInput,
        provider
      )
    : resolveProductReference(
        resolutionInput
      );
}

function isLikelyEquipmentRecordLine(
  line: string,
  provider?: ProductReferenceProvider
): boolean {
  const brand = detectBrand(line);
  const category = detectCategory(line);
  const resolution =
    resolveLineProductReference(
      line,
      provider
    );

  if (resolution.status !== "UNRESOLVED") {
    return true;
  }

  const hasEquipmentLanguage =
    /\b(?:equipment|club|clubs|driver|fairway|wood|hybrid|rescue|iron|irons|wedge|putter)\b/i.test(
      line
    );
  const hasRecordContext =
    /\b(?:brought|bringing|trade(?:-?in)?|trade item|candidate equipment record|payload|row\s*=|pending review)\b/i.test(
      line
    );
  const hasShaftEvidence =
    detectShaftFlexWithEvidence(
      line
    ).value !== null ||
    /\b(?:shaft|flex)\b[^.,;|]*(?:unknown|unclear|missing|not known)\b/i.test(
      line
    );
  const hasConditionEvidence =
    detectApprovedConditionGradeWithEvidence(
      line
    ).value !== null;
  const hasTradeValueEvidence =
    detectTradeInValueWithEvidence(
      line
    ).value !== null;

  if (
    category &&
    hasEquipmentLanguage
  ) {
    return true;
  }

  const fieldSignalCount = [
    Boolean(brand),
    Boolean(category),
    hasShaftEvidence,
    hasConditionEvidence,
    hasTradeValueEvidence
  ].filter(Boolean).length;

  return (
    (
      hasEquipmentLanguage ||
      hasRecordContext
    ) &&
    fieldSignalCount >= 2
  );
}

function isEmailMetadataLine(
  line: string
): boolean {
  return /^(?:from|to|cc|bcc|subject|attached|preferred store)\s*:/i.test(
    line
  ) ||
    /^(?:hi|hello|thanks|thank you|regards|sincerely)\b/i.test(
      line
    );
}

export function splitSourceIntoRecordFragments(
  source: MultiSourceParserInput,
  provider?: ProductReferenceProvider
): string[] {
  const lines = source.rawContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (source.sourceType === "POORLY_FORMED_CSV") {
    const candidateRows =
      lines[0] &&
      looksLikeDelimitedHeader(lines[0])
        ? lines.slice(1)
        : lines;

    return candidateRows.filter(
      (line) =>
        countDelimitedSeparators(line) >= 2 ||
        isLikelyEquipmentRecordLine(
          line,
          provider
        )
    );
  }

  if (source.sourceType === "EMAIL") {
    return lines.filter(
      (line) =>
        !isEmailMetadataLine(line) &&
        isLikelyEquipmentRecordLine(
          line,
          provider
        )
    );
  }

  if (source.sourceType === "LOG") {
    return lines.filter(
      (line) =>
        isLikelyEquipmentRecordLine(
          line,
          provider
        ) ||
        (
          /\b(?:payload|brand|model|candidate|sku|normalized)\b/i.test(
            line
          ) &&
          /\b(?:cat|category|shaft|condition|value|notes)\b/i.test(
            line
          )
        )
    );
  }

  return lines.filter((line) =>
    isLikelyEquipmentRecordLine(
      line,
      provider
    )
  );
}

export function buildRecord(
  source: MultiSourceParserInput,
  fragment: string,
  index: number,
  provider?: ProductReferenceProvider
): MultiSourceIntakeRecord {
  const sourceContext =
    `${source.rawContent}\n${fragment}`;
  const csvRowValues =
    parsePoorlyFormedCsvRowValues(
      source,
      fragment
    );
  const structuredLogValues =
    parseStructuredLogValues(
      source,
      fragment
    );
  const fallbackCategoryText =
    source.sourceType === "LOG"
      ? stripOperationalLogTimestamps(
          fragment
        )
      : fragment;
  const detectedBrand =
    structuredLogValues?.brand ??
    detectBrand(fragment);
  const detectedCategory =
    structuredLogValues?.category ??
    detectCategory(
      fallbackCategoryText
    );
  const sourceSupportedProductText =
    csvRowValues?.productText ??
    structuredLogValues?.productText ??
    detectSourceSupportedProductText({
      sourceType:
        source.sourceType,
      text: fragment,
      detectedBrand,
      detectedCategory
    });
  const productIdentity =
    resolveParsedProductIdentity({
      rawText: fragment,
      detectedBrand,
      detectedCategory,
      ...(sourceSupportedProductText
        ? {
            productText:
              sourceSupportedProductText
          }
        : {}),
      ...(provider
        ? {
            provider
          }
        : {})
    });
  const brand = productIdentity.brand;
  const productLine =
    productIdentity.productLine;
  const category =
    productIdentity.category;
  const fallbackShaftFlex =
    detectShaftFlexWithEvidence(
      fragment
    );
  const detectedShaftFlex =
    structuredLogValues
      ?.shaftFlex &&
    structuredLogValues
      .shaftFlexSourceText
      ? {
          value:
            structuredLogValues
              .shaftFlex,
          evidence: {
            value:
              structuredLogValues
                .shaftFlex,
            sourceText:
              structuredLogValues
                .shaftFlexSourceText
          }
        }
      : fallbackShaftFlex;
  const shaftFlex =
    isShaftFlexApplicable(category)
      ? detectedShaftFlex.value ??
        csvRowValues?.shaftFlex ??
        null
      : null;
  const fallbackConditionGrade =
    detectApprovedConditionGradeWithEvidence(
      fragment
    );
  const detectedConditionGrade =
    structuredLogValues
      ?.conditionGrade &&
    structuredLogValues
      .conditionGradeSourceText
      ? {
          value:
            structuredLogValues
              .conditionGrade,
          evidence: {
            value:
              structuredLogValues
                .conditionGrade,
            sourceText:
              structuredLogValues
                .conditionGradeSourceText
          }
        }
      : fallbackConditionGrade;
  const conditionGrade =
    detectedConditionGrade.value;
  const detectedTradeInValue =
    detectTradeInValueWithEvidence(
      fragment
    );
  const tradeInValue =
    detectedTradeInValue.value ??
    csvRowValues?.tradeInValue ??
    null;
  let parserEvidence =
    buildParserEvidence(fragment, {
      brand,
      productLineEvidence:
        productIdentity.productLineEvidence,
      category,
      shaftFlex,
      conditionGrade,
      tradeInValue
    });

  if (
    structuredLogValues &&
    detectedShaftFlex.evidence &&
    isShaftFlexApplicable(category)
  ) {
    parserEvidence = {
      ...parserEvidence,
      shaftFlex:
        detectedShaftFlex.evidence
    };
  }

  if (
    structuredLogValues &&
    detectedConditionGrade.evidence
  ) {
    parserEvidence = {
      ...parserEvidence,
      conditionGrade:
        detectedConditionGrade.evidence
    };
  }

  if (
    !parserEvidence.shaftFlex &&
    csvRowValues?.shaftFlex &&
    csvRowValues.shaftFlexSourceText &&
    isShaftFlexApplicable(category)
  ) {
    parserEvidence = {
      ...parserEvidence,
      shaftFlex: {
        value:
          csvRowValues.shaftFlex,
        sourceText:
          csvRowValues
            .shaftFlexSourceText
      }
    };
  }

  if (
    !parserEvidence.tradeInValue &&
    csvRowValues?.tradeInValue !== null &&
    csvRowValues?.tradeInValue !==
      undefined &&
    csvRowValues.tradeInValueSourceText
  ) {
    parserEvidence = {
      ...parserEvidence,
      tradeInValue: {
        value:
          csvRowValues.tradeInValue,
        sourceText:
          csvRowValues
            .tradeInValueSourceText
      }
    };
  }

  const customerName =
    detectCustomerName(sourceContext);
  const customerEmail =
    detectCustomerEmail(sourceContext);
  const storeId =
    resolveRecordStoreId({
      source,
      fragment,
      csvStoreId:
        csvRowValues?.storeId ?? null
    });
  const eventTimestamp =
    detectTimestamps(fragment)[0] ??
    null;
  const attachmentsMentioned =
    detectAttachments(sourceContext);
  const hasProductResolutionIssue =
    productIdentity.productResolution
      .status !== "MATCHED";
  const hasExplicitUncertainty =
    /\bmaybe|unclear|malformed|missing|pending review|generation\s+(?:not\s+listed|unknown|unclear)|ERROR\b/i.test(
      fragment
    );

  const missingFields = [
    brand ? null : "brand",
    productLine ? null : "productLine",
    category ? null : "category",
    !isShaftFlexApplicable(category) ||
    shaftFlex
      ? null
      : "shaftFlex",
    conditionGrade
      ? null
      : "conditionGrade",
    tradeInValue === null
      ? "tradeInValue"
      : null
  ].filter(
    (field): field is string =>
      Boolean(field)
  );

  const confidence = Math.max(
    0.35,
    Number(
      (
        1 -
        missingFields.length * 0.095 -
        (
          hasProductResolutionIssue ||
          hasExplicitUncertainty
            ? 0.12
            : 0
        )
      ).toFixed(2)
    )
  );

  return {
    id:
      `${source.id}_record_${index + 1}`,
    sourceId: source.id,
    sourceType: source.sourceType,
    brand,
    productLine,
    category,
    shaftFlex,
    conditionGrade,
    tradeInValue,
    parserEvidence,
    productResolution:
      productIdentity.productResolution,
    customerName,
    customerEmail,
    storeId,
    eventTimestamp,
    attachmentsMentioned,
    missingFields,
    confidence,
    reviewNeeded:
      missingFields.length > 0 ||
      hasProductResolutionIssue ||
      confidence < 0.72,
    sourceText: fragment,
    normalizedText: [
      brand,
      productLine,
      category,
      shaftFlex,
      conditionGrade,
      tradeInValue === null
        ? null
        : `value ${tradeInValue}`,
      storeId
        ? `store ${storeId}`
        : null
    ]
      .filter(Boolean)
      .join(" | ")
  };
}
