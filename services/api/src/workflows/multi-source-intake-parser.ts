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

function detectProductLine(text: string): string | null {
  if (/\bstealth\s*2\b|\bstealth2\b/i.test(text)) {
    return "Stealth 2";
  }

  if (/\btsr2?\b/i.test(text)) {
    return "TSR";
  }

  if (/\brogue\s*st\s*max\b/i.test(text)) {
    return "Rogue ST Max";
  }

  if (/\bg425\b/i.test(text)) {
    return "G425";
  }

  if (/\bg430\s*max\b/i.test(text)) {
    return "G430 Max";
  }

  if (/\bg430\b/i.test(text)) {
    return "G430";
  }

  if (/\brtx\s*6(?:\s*zip\s*core|\s*zipcore)?\b|\brtx6\b|\brtx\s*zip\s*core\b/i.test(text)) {
    return "RTX 6 ZipCore";
  }

  if (/\bwhite\s*hot\s*og\b|\bwh\s*og\b/i.test(text)) {
    return "White Hot OG";
  }

  if (/\bjpx\s*923(?:\s*hot\s*metal)?\b|\bhot\s*metal\b/i.test(text)) {
    return "JPX 923 Hot Metal";
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

function detectShaftFlex(text: string): string | null {
  if (/\btour\s*x\s*-?\s*stiff\b|\btx\s*flex\b|\btour\s*x\b/i.test(text)) {
    return "TOUR_X_STIFF";
  }

  if (/\bx\s*-?\s*stiff\b|\bx\s*flex\b/i.test(text)) {
    return "X_STIFF";
  }

  if (/\bstiff\b|\bs flex\b|\btensei s\b/i.test(text)) {
    return "STIFF";
  }

  if (/\bsenior\b|\bsr\s*flex\b|\ba\s*flex\b/i.test(text)) {
    return "SENIOR";
  }

  if (/\blad(y|ies)\b|\bl\s*flex\b/i.test(text)) {
    return "LADIES";
  }

  if (/\breg\b|\bregular\b/i.test(text)) {
    return "REGULAR";
  }

  return null;
}

const CONDITION_GRADES = [
  "9.5 Mint",
  "9.0 Above Average",
  "8.0 Average",
  "7.0 Below Average",
  "6.0 Poor"
] as const;

function detectConditionGrade(text: string): string | null {
  const conditionGrade = CONDITION_GRADES.find((grade) =>
    new RegExp(`\\b${grade.replace(".", "\\.")}\\b`, "i").test(text)
  );

  return conditionGrade ?? null;
}

function detectTradeInValue(text: string): number | null {
  const dollarMatch = text.match(/\$(\d{2,4})\b/);
  if (dollarMatch?.[1]) {
    return Number(dollarMatch[1]);
  }

  const valueMatch = text.match(/\bvalue\s*(?:pending review|is|=)?\s*(\d{2,4})\b/i);
  if (valueMatch?.[1]) {
    return Number(valueMatch[1]);
  }

  const estimatedMatch = text.match(/\bestimated value\s*(\d{2,4})\b/i);
  if (estimatedMatch?.[1]) {
    return Number(estimatedMatch[1]);
  }

  return null;
}

function detectStoreId(text: string): string | null {
  const storeMatch = text.match(/\bstore(?:=|:|\s)?\s*(STORE-)?(\d{3})\b/i);
  if (storeMatch) {
    return storeMatch[1] ? `${storeMatch[1].toUpperCase()}${storeMatch[2]}` : storeMatch[2] ?? null;
  }

  return null;
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

export function splitSourceIntoRecordFragments(source: MultiSourceParserInput): string[] {
  const lines = source.rawContent
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (source.sourceType === "EMAIL") {
    return lines.filter((line) =>
      /\b(callaway|taylormade|titleist|ping|cleveland|odyssey|mizuno|rogue|stealth|tsr|g425|g430|rtx|white hot|jpx|hot metal)\b/i.test(line)
    );
  }

  if (source.sourceType === "LOG") {
    return lines.filter((line) =>
      /\b(brand=|payload=|candidate|callaway|titleist|ping|taylormade|cleveland|odyssey|mizuno|rtx|white hot|jpx|hot metal|g430)\b/i.test(line)
    );
  }

  if (source.sourceType === "POORLY_FORMED_CSV") {
    return lines.filter((line) =>
      /\b(titleist|cally|callaway|ping|taylormade|cleveland|odyssey|mizuno|rogue|tsr|g425|g430|rtx|white hot|jpx|hot metal)\b/i.test(line)
    );
  }

  return lines.filter((line) =>
    /\b(tm|taylormade|titleist|cally|callaway|ping|cleveland|odyssey|mizuno|stealth|rogue|tsr|g425|g430|rtx|white hot|jpx|hot metal)\b/i.test(line)
  );
}

export function buildRecord(source: MultiSourceParserInput, fragment: string, index: number): MultiSourceIntakeRecord {
  const sourceContext = `${source.rawContent}\n${fragment}`;
  const brand = detectBrand(fragment);
  const productLine = detectProductLine(fragment);
  const category = detectCategory(fragment);
  const shaftFlex = detectShaftFlex(fragment);
  const conditionGrade = detectConditionGrade(fragment);
  const tradeInValue = detectTradeInValue(fragment);
  const customerName = detectCustomerName(sourceContext);
  const customerEmail = detectCustomerEmail(sourceContext);
  const storeId = detectStoreId(sourceContext);
  const eventTimestamp = detectTimestamps(fragment)[0] ?? null;
  const attachmentsMentioned = detectAttachments(sourceContext);

  const missingFields = [
    brand ? null : "brand",
    productLine ? null : "productLine",
    category ? null : "category",
    shaftFlex ? null : "shaftFlex",
    conditionGrade ? null : "conditionGrade",
    tradeInValue === null ? "tradeInValue" : null
  ].filter((field): field is string => Boolean(field));

  const confidence = Math.max(
    0.35,
    Number((1 - missingFields.length * 0.095 - (/\bmaybe|unclear|malformed|missing|pending review|ERROR\b/i.test(fragment) ? 0.12 : 0)).toFixed(2))
  );

  return {
    id: `${source.id}_record_${index + 1}`,
    sourceId: source.id,
    sourceType: source.sourceType,
    brand,
    productLine,
    category,
    shaftFlex,
    conditionGrade,
    tradeInValue,
    customerName,
    customerEmail,
    storeId,
    eventTimestamp,
    attachmentsMentioned,
    missingFields,
    confidence,
    reviewNeeded: missingFields.length > 0 || confidence < 0.72,
    normalizedText: [
      brand,
      productLine,
      category,
      shaftFlex,
      conditionGrade,
      tradeInValue === null ? null : `value ${tradeInValue}`,
      storeId ? `store ${storeId}` : null
    ].filter(Boolean).join(" | ")
  };
}
