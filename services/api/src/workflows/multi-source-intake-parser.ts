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

function detectStoreId(text: string): string | null {
  const storeMatch = text.match(/\bstore(?:=|:|\s)?\s*(STORE-)?(\d{3})\b/i);
  if (storeMatch) {
    return storeMatch[1] ? `${storeMatch[1].toUpperCase()}${storeMatch[2]}` : storeMatch[2] ?? null;
  }

  return null;
}

type PoorlyFormedCsvRowValues = {
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
  const category = detectCategory(line);
  const resolution =
    resolveLineProductReference(
      line,
      provider
    );

  if (resolution.status !== "UNRESOLVED") {
    return true;
  }

  if (!category) {
    return false;
  }

  return /\b(?:brand|model|product|club|shaft|flex|condition|cond|value|trade|driver|fairway|wood|hybrid|rescue|iron|irons|wedge|putter)\b/i.test(
    line
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
  const detectedBrand =
    detectBrand(fragment);
  const detectedCategory =
    detectCategory(fragment);
  const productIdentity =
    resolveParsedProductIdentity({
      rawText: fragment,
      detectedBrand,
      detectedCategory,
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
  const shaftFlex =
    isShaftFlexApplicable(category)
      ? detectShaftFlexWithEvidence(
          fragment
        ).value
      : null;
  const conditionGrade =
    detectApprovedConditionGradeWithEvidence(
      fragment
    ).value;
  const csvRowValues =
    parsePoorlyFormedCsvRowValues(
      source,
      fragment
    );
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
    source.sourceType ===
    "POORLY_FORMED_CSV"
      ? csvRowValues?.storeId ??
        detectStoreId(fragment)
      : detectStoreId(sourceContext);
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
