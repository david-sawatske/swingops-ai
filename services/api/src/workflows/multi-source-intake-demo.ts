import type { AiReadyIntakeRecord, Prisma, ReviewQueueItem, ToolCallLog } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export type MultiSourceIntakeSourceType =
  | "FREE_TEXT"
  | "POORLY_FORMED_CSV"
  | "EMAIL"
  | "LOG";

export type MultiSourceIntakeRecord = {
  id: string;
  sourceId: string;
  sourceType: MultiSourceIntakeSourceType;
  brand: string | null;
  productLine: string | null;
  category: string | null;
  shaftFlex: string | null;
  conditionGrade: string | null;
  tradeInValue: number | null;
  customerName: string | null;
  customerEmail: string | null;
  storeId: string | null;
  eventTimestamp: string | null;
  attachmentsMentioned: string[];
  missingFields: string[];
  confidence: number;
  reviewNeeded: boolean;
  normalizedText: string;
};

export type MultiSourceIntakeSourceResult = {
  id: string;
  sourceType: MultiSourceIntakeSourceType;
  sourceName: string;
  rawContent: string;
  cleanedText: string;
  extractedRecords: MultiSourceIntakeRecord[];
  inferredSchema: {
    fieldName: string;
    type: "string" | "number" | "boolean" | "datetime" | "string[]";
    nullable: boolean;
    description: string;
    examples: string[];
  }[];
  metadata: {
    detectedBrands: string[];
    detectedCategories: string[];
    detectedStoreIds: string[];
    customerEmails: string[];
    attachmentNames: string[];
    eventTimestamps: string[];
    operationalTags: string[];
  };
  qualitySignals: {
    signal: string;
    severity: "INFO" | "WARNING" | "REVIEW";
    message: string;
  }[];
  missingFields: string[];
  confidence: number;
  embeddingReadiness: {
    ready: boolean;
    chunkCount: number;
    reason: string;
    suggestedChunkStrategy: string;
  };
  ragIndexReadiness: {
    ready: boolean;
    indexName: string;
    metadataFields: string[];
    reason: string;
  };
};

export type MultiSourceIntakeAuditEvent = {
  orderIndex: number;
  label: string;
  status: "SUCCEEDED" | "NEEDS_REVIEW" | "INFO";
  summary: string;
  details: unknown;
};

export type MultiSourceIntakeDemoResult = {
  sourcesProcessed: number;
  recordsExtracted: number;
  assetsCreated: number;
  reviewNeeded: number;
  sourceResults: MultiSourceIntakeSourceResult[];
  inferredDatasetSchema: MultiSourceIntakeSourceResult["inferredSchema"];
  cleanedDatasetPreview: MultiSourceIntakeRecord[];
  metadataSummary: {
    sourceTypes: MultiSourceIntakeSourceType[];
    detectedBrands: string[];
    detectedCategories: string[];
    detectedStoreIds: string[];
    customerEmails: string[];
    attachmentNames: string[];
    eventTimestamps: string[];
    operationalTags: string[];
  };
  ragReadinessSummary: {
    readySourceCount: number;
    totalSourceCount: number;
    readyRecordCount: number;
    totalRecordCount: number;
    embeddingReady: boolean;
    ragIndexReady: boolean;
    summary: string;
  };
  auditTrail: MultiSourceIntakeAuditEvent[];
  finalSummary: string;
  persistedIds: {
    intakeBatchId: string;
    intakeItemIds: string[];
    workflowRunId: string;
    reviewQueueItemIds: string[];
    toolCallLogIds: string[];
    aiReadyIntakeRecordIds: string[];
  };
};

export type MultiSourceIntakeSourceInput = {
  sourceType: MultiSourceIntakeSourceType;
  sourceName?: string;
  rawContent: string;
};

type MultiSourceInput = {
  id: string;
  sourceType: MultiSourceIntakeSourceType;
  sourceName: string;
  rawContent: string;
};

const DEFAULT_MULTI_SOURCE_INPUTS: MultiSourceInput[] = [
  {
    id: "source_free_text",
    sourceType: "FREE_TEXT",
    sourceName: "Counter notebook notes",
    rawContent: [
      "Sat counter notes - trade pile",
      "1) TM stealth2 drv 10.5 ventus stiff condition 8.0 Average cust: Mark R.",
      "2) Ping g425 irons 5-pw reg flex condition 7.0 Below Average needs manager look.",
      "3) Cleveland RTX 6 ZipCore wedge senior flex condition 9.0 Above Average value $72 serial CLV-001.",
      "4) Odyssey White Hot OG putter ladies flex condition 8.0 Average value $95 serial ODS-002.",
      "Store 104 / associate jules"
    ].join("\n")
  },
  {
    id: "source_csv",
    sourceType: "POORLY_FORMED_CSV",
    sourceName: "Store export with broken rows",
    rawContent: [
      "brand|model,cat,shaft,condition_grade,value,store",
      "Titleist; TSR2; 3w ; Tensei S ; 8.0 Average ; $145 ; 104",
      "Cally,Rogue ST Max driver,HZRDUS X,7.0 Below Average,190,STORE-207",
      "PING|G425 irons|reg|6.0 Poor||104",
      "Cleveland|RTX 6 ZipCore wedge|Senior|9.0 Above Average|$72|104",
      "Odyssey|White Hot OG putter|Ladies|8.0 Average|$95|104",
      "Mizuno|JPX 923 Hot Metal irons|Tour X-Stiff|9.0 Above Average|$390|STORE-104",
      "PING|G430 Max driver|Tour X-Stiff|9.5 Mint|$240|STORE-207"
    ].join("\n")
  },
  {
    id: "source_email",
    sourceType: "EMAIL",
    sourceName: "Customer trade-in email",
    rawContent: [
      "From: Hannah Lee <hannah.lee@example.com>",
      "To: tradeins@swingops.example",
      "Subject: Trade values for two clubs - receipt attached",
      "",
      "Hi team, I am bringing in a Callaway Rogue ST Max 9 degree driver with HZRDUS x-stiff.",
      "Condition grade is 7.0 Below Average.",
      "Also a TaylorMade Stealth 2 10.5 driver with Ventus stiff and condition 8.0 Average.",
      "One more: Cleveland RTX 6 ZipCore wedge with Senior flex, condition 9.0 Above Average, estimated value 72.",
      "Also Odyssey White Hot OG putter with Ladies flex, condition 8.0 Average, value 95.",
      "Attached: trade_sheet_8821.pdf, driver_photos.zip",
      "Preferred store: 207"
    ].join("\n")
  },
  {
    id: "source_log",
    sourceType: "LOG",
    sourceName: "Import worker event log",
    rawContent: [
      "2026-05-18T14:33:02Z INFO import start store=104 batch=nightly_tradeins",
      "2026-05-18T14:33:04Z WARN malformed payload brand=Titleist model=TSR cat=3w shaft='Tensei S' condition='8.0 Average' value=145",
      "2026-05-18T14:33:07Z ERROR row=18 missing category payload={brand:'PING', model:'G425', condition:'6.0 Poor', notes:'irons 5-PW reg'}",
      "2026-05-18T14:33:11Z INFO normalized sku match Callaway Rogue ST Max driver store=207",
      "2026-05-18T14:33:14Z INFO normalized payload brand=Cleveland model=RTX 6 ZipCore cat=wedge shaft='Senior' condition='9.0 Above Average' value=72",
      "2026-05-18T14:33:18Z INFO normalized payload brand=Mizuno model=JPX 923 Hot Metal cat=irons shaft='Tour X-Stiff' condition='9.0 Above Average' value=390"
    ].join("\n")
  },
];

const SHARED_SCHEMA: MultiSourceIntakeSourceResult["inferredSchema"] = [
  {
    fieldName: "brand",
    type: "string",
    nullable: true,
    description: "Normalized equipment brand.",
    examples: ["TaylorMade", "Titleist", "Callaway", "PING", "Cleveland", "Odyssey", "Mizuno"]
  },
  {
    fieldName: "productLine",
    type: "string",
    nullable: true,
    description: "Normalized product family or model line.",
    examples: ["Stealth 2", "TSR", "Rogue ST Max", "G425", "G430 Max", "RTX 6 ZipCore", "White Hot OG", "JPX 923 Hot Metal"]
  },
  {
    fieldName: "category",
    type: "string",
    nullable: true,
    description: "Normalized equipment category.",
    examples: ["DRIVER", "FAIRWAY_WOOD", "IRON_SET", "WEDGE", "PUTTER"]
  },
  {
    fieldName: "shaftFlex",
    type: "string",
    nullable: true,
    description: "Normalized shaft flex when present.",
    examples: ["STIFF", "X_STIFF", "REGULAR", "SENIOR", "LADIES", "TOUR_X_STIFF"]
  },
  {
    fieldName: "conditionGrade",
    type: "string",
    nullable: true,
    description: "Normalized condition grade supplied by the intake source.",
    examples: ["9.5 Mint", "9.0 Above Average", "8.0 Average", "7.0 Below Average", "6.0 Poor"]
  },
  {
    fieldName: "tradeInValue",
    type: "number",
    nullable: true,
    description: "Estimated trade-in value when present.",
    examples: ["210", "145"]
  },
  {
    fieldName: "customerEmail",
    type: "string",
    nullable: true,
    description: "Customer email extracted from source metadata.",
    examples: ["hannah.lee@example.com"]
  },
  {
    fieldName: "storeId",
    type: "string",
    nullable: true,
    description: "Store identifier extracted from notes, logs, emails, or statements.",
    examples: ["104", "207", "STORE-207"]
  },
  {
    fieldName: "eventTimestamp",
    type: "datetime",
    nullable: true,
    description: "Operational timestamp extracted from logs or statements.",
    examples: ["2026-05-18T14:33:04Z"]
  },
  {
    fieldName: "reviewNeeded",
    type: "boolean",
    nullable: false,
    description: "Human review flag for incomplete or low-confidence records.",
    examples: ["true", "false"]
  }
];

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function cleanText(rawContent: string): string {
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

function detectTimestamps(text: string): string[] {
  return text.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\b/g) ?? [];
}

function splitSourceIntoRecordFragments(source: MultiSourceInput): string[] {
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

function buildRecord(source: MultiSourceInput, fragment: string, index: number): MultiSourceIntakeRecord {
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

function getOperationalTags(source: MultiSourceInput): string[] {
  return [
    source.sourceType === "POORLY_FORMED_CSV" ? "delimiter-normalization" : null,
    source.sourceType === "EMAIL" ? "customer-message" : null,
    source.sourceType === "LOG" ? "import-observability" : null,
    /missing|unclear|malformed|ERROR|pending review/i.test(source.rawContent)
      ? "review-signal"
      : null
  ].filter((tag): tag is string => Boolean(tag));
}

function buildSourceResult(source: MultiSourceInput): MultiSourceIntakeSourceResult {
  const cleanedText = cleanText(source.rawContent);
  const fragments = splitSourceIntoRecordFragments(source);
  const extractedRecords = fragments.map((fragment, index) =>
    buildRecord(source, fragment, index)
  );

  const metadata = {
    detectedBrands: unique(extractedRecords.map((record) => record.brand)),
    detectedCategories: unique(extractedRecords.map((record) => record.category)),
    detectedStoreIds: unique(extractedRecords.map((record) => record.storeId)),
    customerEmails: unique(extractedRecords.map((record) => record.customerEmail)),
    attachmentNames: unique(extractedRecords.flatMap((record) => record.attachmentsMentioned)),
    eventTimestamps: unique([
      ...detectTimestamps(source.rawContent),
      ...extractedRecords.map((record) => record.eventTimestamp)
    ]),
    operationalTags: getOperationalTags(source)
  };

  const missingFields = unique(extractedRecords.flatMap((record) => record.missingFields));
  const confidence =
    extractedRecords.length > 0
      ? Number(
          (
            extractedRecords.reduce((sum, record) => sum + record.confidence, 0) /
            extractedRecords.length
          ).toFixed(2)
        )
      : 0;

  const qualitySignals = [
    extractedRecords.length === 0
      ? {
          signal: "NO_RECORDS_EXTRACTED",
          severity: "REVIEW" as const,
          message: "No equipment records were extracted from this source."
        }
      : null,
    missingFields.length > 0
      ? {
          signal: "MISSING_FIELDS",
          severity: "REVIEW" as const,
          message: `Missing normalized fields: ${missingFields.join(", ")}.`
        }
      : null,
    /malformed|ERROR|unclear|pending review/i.test(source.rawContent)
      ? {
          signal: "SOURCE_QUALITY",
          severity: "WARNING" as const,
          message: "Source content includes malformed, unclear, or review-oriented language."
        }
      : null,
    {
      signal: "NORMALIZED",
      severity: "INFO" as const,
      message: `${extractedRecords.length} record(s) normalized into the shared intake schema.`
    }
  ].filter((signal): signal is MultiSourceIntakeSourceResult["qualitySignals"][number] =>
    Boolean(signal)
  );

  const readyRecordCount = extractedRecords.filter(
    (record) => record.normalizedText.length > 20 && record.brand && record.category
  ).length;

  return {
    id: source.id,
    sourceType: source.sourceType,
    sourceName: source.sourceName,
    rawContent: source.rawContent,
    cleanedText,
    extractedRecords,
    inferredSchema: SHARED_SCHEMA,
    metadata,
    qualitySignals,
    missingFields,
    confidence,
    embeddingReadiness: {
      ready: readyRecordCount > 0,
      chunkCount: Math.max(1, extractedRecords.length),
      reason:
        readyRecordCount > 0
          ? "Cleaned text and normalized records can be chunked with source metadata."
          : "Needs at least one normalized record with brand and category before embedding.",
      suggestedChunkStrategy:
        "Chunk by source record, attach sourceType, storeId, brand, category, confidence, and reviewNeeded metadata."
    },
    ragIndexReadiness: {
      ready: readyRecordCount > 0,
      indexName: "trade_in_intake_assets",
      metadataFields: [
        "sourceType",
        "sourceName",
        "brand",
        "category",
        "storeId",
        "confidence",
        "reviewNeeded"
      ],
      reason:
        readyRecordCount > 0
          ? "Records have enough normalized text and metadata for retrieval filtering."
          : "RAG index entry should wait for review or additional extraction."
    }
  };
}

function buildAuditTrail(input: {
  sourceResults: MultiSourceIntakeSourceResult[];
  recordsExtracted: number;
  reviewNeeded: number;
  assetsCreated: number;
  ragReadinessSummary: MultiSourceIntakeDemoResult["ragReadinessSummary"];
  finalSummary: string;
}): MultiSourceIntakeAuditEvent[] {
  return [
    {
      orderIndex: 1,
      label: "Raw multi-source input loaded",
      status: "INFO",
      summary: `${input.sourceResults.length} messy operational source types were loaded for deterministic normalization.`,
      details: {
        sourceTypes: input.sourceResults.map((source) => source.sourceType)
      }
    },
    {
      orderIndex: 2,
      label: "Source text cleaned",
      status: "SUCCEEDED",
      summary: "Delimiters, spacing, and extracted document text were cleaned into readable source previews.",
      details: input.sourceResults.map((source) => ({
        sourceType: source.sourceType,
        sourceName: source.sourceName,
        cleanedLength: source.cleanedText.length
      }))
    },
    {
      orderIndex: 3,
      label: "Structured records extracted",
      status: "SUCCEEDED",
      summary: `${input.recordsExtracted} normalized equipment/customer/store records were extracted.`,
      details: input.sourceResults.flatMap((source) => source.extractedRecords)
    },
    {
      orderIndex: 4,
      label: "Schema and metadata inferred",
      status: "SUCCEEDED",
      summary: "Shared dataset fields, source metadata, customer emails, attachments, timestamps, and operational tags were inferred.",
      details: {
        schema: SHARED_SCHEMA
      }
    },
    {
      orderIndex: 5,
      label: "Quality review signals calculated",
      status: input.reviewNeeded > 0 ? "NEEDS_REVIEW" : "SUCCEEDED",
      summary:
        input.reviewNeeded > 0
          ? `${input.reviewNeeded} record(s) need review because of missing fields or low confidence.`
          : "No records require review.",
      details: input.sourceResults.map((source) => ({
        sourceType: source.sourceType,
        qualitySignals: source.qualitySignals
      }))
    },
    {
      orderIndex: 6,
      label: "AI-ready assets summarized",
      status: "SUCCEEDED",
      summary: `${input.assetsCreated} cleaned dataset, schema, metadata, review, embedding, and RAG assets were created.`,
      details: input.ragReadinessSummary
    },
    {
      orderIndex: 7,
      label: "Final demo summary",
      status: "INFO",
      summary: input.finalSummary,
      details: {
        recordsExtracted: input.recordsExtracted,
        reviewNeeded: input.reviewNeeded
      }
    }
  ];
}

async function persistDemoAudit(input: {
  sourceResults: MultiSourceIntakeSourceResult[];
  cleanedDatasetPreview: MultiSourceIntakeRecord[];
  reviewRecords: MultiSourceIntakeRecord[];
  finalSummary: string;
}) {
  const intakeBatch = await prisma.intakeBatch.create({
    data: {
      name: "Multi-Source Intake Demo",
      description:
        "Deterministic demo batch showing messy operational sources normalized into AI-ready intake assets.",
      sourceType: "FREEFORM_NOTES",
      status: input.reviewRecords.length > 0 ? "NEEDS_REVIEW" : "COMPLETED",
      itemCount: input.cleanedDatasetPreview.length,
      items: {
        create: input.cleanedDatasetPreview.map((record, index) => ({
          rawText: record.normalizedText || record.sourceType,
          sourceRowNumber: index + 1,
          status: record.reviewNeeded ? "NEEDS_REVIEW" : "STRUCTURED"
        }))
      }
    },
    include: {
      items: {
        orderBy: {
          sourceRowNumber: "asc"
        }
      }
    }
  });

  const workflowRun = await prisma.workflowRun.create({
    data: {
      intakeBatchId: intakeBatch.id,
      workflowName: "multi-source-intake-demo",
      status: input.reviewRecords.length > 0 ? "NEEDS_REVIEW" : "COMPLETED",
      startedAt: new Date(),
      completedAt: input.reviewRecords.length > 0 ? null : new Date()
    }
  });

  const aiReadyIntakeRecords: AiReadyIntakeRecord[] = [];
  const intakeItemByRecordId = new Map(
    input.cleanedDatasetPreview.map((record, index) => [
      record.id,
      intakeBatch.items[index] ?? null
    ])
  );
  const sourceResultById = new Map(
    input.sourceResults.map((sourceResult) => [sourceResult.id, sourceResult])
  );

  for (const record of input.cleanedDatasetPreview) {
    const sourceResult = sourceResultById.get(record.sourceId);
    const intakeItem = intakeItemByRecordId.get(record.id) ?? null;
    const hasRagReadyShape = record.normalizedText.length > 20 && Boolean(record.brand && record.category);

    const aiReadyIntakeRecord = await prisma.aiReadyIntakeRecord.create({
      data: {
        intakeBatchId: intakeBatch.id,
        intakeItemId: intakeItem?.id ?? null,
        workflowRunId: workflowRun.id,
        sourceRecordId: record.id,
        sourceType: record.sourceType,
        sourceName: sourceResult?.sourceName ?? record.sourceType,
        rawText: sourceResult?.rawContent ?? record.normalizedText,
        cleanedText: sourceResult?.cleanedText ?? record.normalizedText,
        normalizedJson: toInputJson(record),
        inferredSchemaJson: toInputJson(sourceResult?.inferredSchema ?? SHARED_SCHEMA),
        metadataJson: toInputJson(sourceResult?.metadata ?? {}),
        qualitySignalsJson: toInputJson(sourceResult?.qualitySignals ?? []),
        status: record.reviewNeeded ? "NEEDS_REVIEW" : "READY_FOR_RAG",
        reviewNeeded: record.reviewNeeded,
        embeddingReady: hasRagReadyShape,
        ragReady: hasRagReadyShape && !record.reviewNeeded
      }
    });

    aiReadyIntakeRecords.push(aiReadyIntakeRecord);
  }

  const reviewQueueItems: ReviewQueueItem[] = [];
  for (const reviewRecord of input.reviewRecords) {
    const intakeItem = intakeBatch.items.find(
      (item) => item.sourceRowNumber === input.cleanedDatasetPreview.findIndex((record) => record.id === reviewRecord.id) + 1
    );

    const reviewQueueItem = await prisma.reviewQueueItem.create({
      data: {
        workflowRunId: workflowRun.id,
        intakeItemId: intakeItem?.id ?? null,
        reason:
          reviewRecord.missingFields.length > 0
            ? "MISSING_REQUIRED_FIELDS"
            : "LOW_CONFIDENCE",
        status: "OPEN",
        originalText: reviewRecord.normalizedText,
        proposedGolfClubJson: toInputJson({
          ...reviewRecord,
          reviewReasonSummary:
            reviewRecord.missingFields.length > 0
              ? `Missing ${reviewRecord.missingFields.join(", ")}`
              : `Confidence ${reviewRecord.confidence}`
        })
      }
    });

    reviewQueueItems.push(reviewQueueItem);
  }

  const toolCallLogs: ToolCallLog[] = [];
  const auditToolOutputs = [
    {
      toolName: "swingops.intakeAssets.cleanDataset",
      outputJson: {
        previewOnly: true,
        assetType: "cleaned_dataset",
        rowCount: input.cleanedDatasetPreview.length
      }
    },
    {
      toolName: "swingops.intakeAssets.inferSchema",
      outputJson: {
        previewOnly: true,
        assetType: "inferred_schema",
        fieldCount: SHARED_SCHEMA.length
      }
    },
    {
      toolName: "swingops.intakeAssets.prepareRagIndex",
      outputJson: {
        previewOnly: true,
        assetType: "rag_index_summary",
        sourceCount: input.sourceResults.length
      }
    }
  ];

  for (const auditToolOutput of auditToolOutputs) {
    const now = new Date();
    const toolCallLog = await prisma.toolCallLog.create({
      data: {
        workflowRunId: workflowRun.id,
        toolName: auditToolOutput.toolName,
        status: "SUCCEEDED",
        inputJson: toInputJson({
          workflowRunId: workflowRun.id,
          demo: "multi-source-intake-demo"
        }),
        outputJson: toInputJson({
          ...auditToolOutput.outputJson,
          persistedPurpose:
            "Audit-only deterministic demo asset summary. No external connector execution was attempted."
        }),
        startedAt: now,
        completedAt: now
      }
    });

    toolCallLogs.push(toolCallLog);
  }

  return {
    intakeBatch,
    workflowRun,
    reviewQueueItems,
    toolCallLogs,
    aiReadyIntakeRecords
  };
}

function getFallbackSourceName(sourceType: MultiSourceIntakeSourceType): string {
  if (sourceType === "FREE_TEXT") {
    return "Pasted free text source";
  }

  if (sourceType === "POORLY_FORMED_CSV") {
    return "Uploaded or pasted CSV-like source";
  }

  if (sourceType === "EMAIL") {
    return "Pasted email source";
  }

  return "Uploaded or pasted log source";
}

function buildCustomSourceInputs(sources: MultiSourceIntakeSourceInput[]): MultiSourceInput[] {
  return sources.map((source, index) => ({
    id: `custom_source_${index + 1}`,
    sourceType: source.sourceType,
    sourceName: source.sourceName?.trim() || getFallbackSourceName(source.sourceType),
    rawContent: source.rawContent.trim()
  }));
}

export async function executeMultiSourceIntakeDemo(input: {
  sourceTypes?: MultiSourceIntakeSourceType[];
  sources?: MultiSourceIntakeSourceInput[];
} = {}): Promise<MultiSourceIntakeDemoResult> {
  const requestedSourceTypes = input.sourceTypes;
  const selectedInputs =
    input.sources && input.sources.length > 0
      ? buildCustomSourceInputs(input.sources)
      : requestedSourceTypes && requestedSourceTypes.length > 0
        ? DEFAULT_MULTI_SOURCE_INPUTS.filter((source) =>
            requestedSourceTypes.includes(source.sourceType)
          )
        : DEFAULT_MULTI_SOURCE_INPUTS;

  const sourceResults = selectedInputs.map(buildSourceResult);
  const cleanedDatasetPreview = sourceResults.flatMap((source) => source.extractedRecords);
  const recordsExtracted = cleanedDatasetPreview.length;
  const reviewRecords = cleanedDatasetPreview.filter((record) => record.reviewNeeded);
  const reviewNeeded = reviewRecords.length;

  const metadataSummary = {
    sourceTypes: sourceResults.map((source) => source.sourceType),
    detectedBrands: unique(sourceResults.flatMap((source) => source.metadata.detectedBrands)),
    detectedCategories: unique(sourceResults.flatMap((source) => source.metadata.detectedCategories)),
    detectedStoreIds: unique(sourceResults.flatMap((source) => source.metadata.detectedStoreIds)),
    customerEmails: unique(sourceResults.flatMap((source) => source.metadata.customerEmails)),
    attachmentNames: unique(sourceResults.flatMap((source) => source.metadata.attachmentNames)),
    eventTimestamps: unique(sourceResults.flatMap((source) => source.metadata.eventTimestamps)),
    operationalTags: unique(sourceResults.flatMap((source) => source.metadata.operationalTags))
  };

  const readySourceCount = sourceResults.filter(
    (source) => source.embeddingReadiness.ready && source.ragIndexReadiness.ready
  ).length;
  const readyRecordCount = cleanedDatasetPreview.filter(
    (record) => record.normalizedText.length > 20 && record.brand && record.category
  ).length;

  const ragReadinessSummary = {
    readySourceCount,
    totalSourceCount: sourceResults.length,
    readyRecordCount,
    totalRecordCount: recordsExtracted,
    embeddingReady: readyRecordCount > 0,
    ragIndexReady: readySourceCount > 0,
    summary: `${readyRecordCount}/${recordsExtracted} records are ready to embed with source metadata; ${readySourceCount}/${sourceResults.length} sources are ready for the trade_in_intake_assets RAG index.`
  };

  const assetsCreated = 6;
  const finalSummary =
    `Processed ${sourceResults.length} source types into normalized records, inferred schema fields, metadata, review signals, and RAG-ready asset summaries.`;

  const persisted = await persistDemoAudit({
    sourceResults,
    cleanedDatasetPreview,
    reviewRecords,
    finalSummary
  });

  const resultWithoutAuditTrail = {
    sourcesProcessed: sourceResults.length,
    recordsExtracted,
    assetsCreated,
    reviewNeeded,
    sourceResults,
    inferredDatasetSchema: SHARED_SCHEMA,
    cleanedDatasetPreview,
    metadataSummary,
    ragReadinessSummary,
    finalSummary,
    persistedIds: {
      intakeBatchId: persisted.intakeBatch.id,
      intakeItemIds: persisted.intakeBatch.items.map((item) => item.id),
      workflowRunId: persisted.workflowRun.id,
      reviewQueueItemIds: persisted.reviewQueueItems.map((item) => item.id),
      toolCallLogIds: persisted.toolCallLogs.map((log) => log.id),
      aiReadyIntakeRecordIds: persisted.aiReadyIntakeRecords.map((record) => record.id)
    }
  };

  return {
    ...resultWithoutAuditTrail,
    auditTrail: buildAuditTrail(resultWithoutAuditTrail)
  };
}
