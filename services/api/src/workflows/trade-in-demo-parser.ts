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
import type {
  ProductResolution
} from "../product-reference/product-reference-resolver.js";
import {
  resolveParsedProductIdentity
} from "./product-resolution-parser.js";
import type {
  ParserEvidence,
  ParserFieldEvidence
} from "./parser-evidence.js";

export type ParsedTradeInDemoItem = {
  id: string;
  rawLine: string;
  brand: string | null;
  productLine: string | null;
  model: string | null;
  category: string | null;
  loft: string | null;
  clubNumber: string | null;
  shaftBrand: string | null;
  shaftModel: string | null;
  shaftFlex: string | null;
  conditionGrade: string | null;
  tradeInValue: number | null;
  parserEvidence?: ParserEvidence;
  productResolution: ProductResolution;
  conditionNotes: string[];
  accessoriesNotes: string[];
  uncertaintyNotes: string[];
  confidence: number;
  missingFields: string[];
};

const BRAND_PATTERNS: {
  brand: string;
  aliases: RegExp[];
}[] = [
  {
    brand: "TaylorMade",
    aliases: [/\btaylormade\b/i, /\btm\b/i]
  },
  {
    brand: "Titleist",
    aliases: [/\btitleist\b/i]
  },
  {
    brand: "Callaway",
    aliases: [/\bcallaway\b/i, /\bcally\b/i]
  },
  {
    brand: "PING",
    aliases: [/\bping\b/i]
  },
  {
    brand: "Cleveland",
    aliases: [/\bcleveland\b/i]
  },
  {
    brand: "Odyssey",
    aliases: [/\bodyssey\b/i]
  },
  {
    brand: "Mizuno",
    aliases: [/\bmizuno\b/i]
  }
];

const CATEGORY_PATTERNS: {
  category: string;
  aliases: RegExp[];
}[] = [
  {
    category: "DRIVER",
    aliases: [/\bdriver\b/i, /\bdrv\b/i, /\bdr\b/i, /\bDRIVER\b/]
  },
  {
    category: "FAIRWAY_WOOD",
    aliases: [
      /\bfairway\b/i,
      /\bfw\b/i,
      /\b3w\b/i,
      /\b5w\b/i,
      /\b7w\b/i,
      /\b9w\b/i,
      /\bwood\b/i,
      /\bFAIRWAY_WOOD\b/
    ]
  },
  {
    category: "IRON_SET",
    aliases: [/\birons?\b/i, /\b[4-9]-pw\b/i, /\b[5-9]-gw\b/i, /\bIRON_SET\b/]
  },
  {
    category: "HYBRID",
    aliases: [/\bhy\b/i, /\bhybrid\b/i, /\brescue\b/i, /\bHYBRID\b/]
  },
  {
    category: "WEDGE",
    aliases: [/\bwedge\b/i, /\b(?:46|48|50|52|54|56|58|60)\s*(?:deg|degree|°)?\b/i, /\bWEDGE\b/]
  },
  {
    category: "PUTTER",
    aliases: [/\bputter\b/i, /\bPUTTER\b/]
  }
];

const SHAFT_BRAND_PATTERNS: {
  shaftBrand: string;
  aliases: RegExp[];
}[] = [
  {
    shaftBrand: "Fujikura",
    aliases: [/\bfujikura\b/i, /\bventus\b/i]
  },
  {
    shaftBrand: "Mitsubishi",
    aliases: [/\bmit(s|subishi)?\b/i, /\btensei\b/i, /\bkai'?li\b/i]
  },
  {
    shaftBrand: "Project X",
    aliases: [/\bproject\s*x\b/i, /\bhzrdus\b/i]
  },
  {
    shaftBrand: "Graphite Design",
    aliases: [/\bgraphite\s*design\b/i, /\btour\s*ad\b/i]
  },
  {
    shaftBrand: "True Temper",
    aliases: [/\btrue\s*temper\b/i, /\bdynamic\s*gold\b/i]
  },
  {
    shaftBrand: "Nippon",
    aliases: [/\bnippon\b/i, /\bmodus\b/i]
  },
  {
    shaftBrand: "Odyssey",
    aliases: [/\bstroke\s*lab\b/i]
  }
];

const SHAFT_MODEL_PATTERNS: {
  shaftModel: string;
  aliases: RegExp[];
}[] = [
  {
    shaftModel: "Ventus",
    aliases: [/\bventus\b/i]
  },
  {
    shaftModel: "Tensei",
    aliases: [/\btensei\b/i]
  },
  {
    shaftModel: "HZRDUS",
    aliases: [/\bhzrdus\b/i]
  },
  {
    shaftModel: "Tour AD",
    aliases: [/\btour\s*ad\b/i]
  },
  {
    shaftModel: "Dynamic Gold",
    aliases: [/\bdynamic\s*gold\b/i]
  },
  {
    shaftModel: "Modus",
    aliases: [/\bmodus\b/i]
  },
  {
    shaftModel: "Stroke Lab",
    aliases: [/\bstroke\s*lab\b/i]
  }
];


const CONDITION_NOTE_PATTERNS: {
  note: string;
  aliases: RegExp[];
}[] = [
  {
    note: "9.5 Mint",
    aliases: [/\b9\.5\s*Mint\b/i]
  },
  {
    note: "9.0 Above Average",
    aliases: [/\b9\.0\s*Above\s*Average\b/i]
  },
  {
    note: "8.0 Average",
    aliases: [/\b8\.0\s*Average\b/i]
  },
  {
    note: "7.0 Below Average",
    aliases: [/\b7\.0\s*Below\s*Average\b/i]
  },
  {
    note: "6.0 Poor",
    aliases: [/\b6\.0\s*Poor\b/i]
  },
  {
    note: "sky mark",
    aliases: [/\bsky\s*mark\b/i, /\bcrown\s*mark\b/i]
  },
  {
    note: "face wear",
    aliases: [/\bface\s*wear\b/i, /\bworn\s*face\b/i]
  },
  {
    note: "sole wear",
    aliases: [/\bsole\s*wear\b/i]
  },
  {
    note: "paint wear",
    aliases: [/\bpaint\s*wear\b/i, /\bpaint\s*chip/i]
  },
  {
    note: "worn grip",
    aliases: [/\bworn\s*grip\b/i, /\bslick\s*grip\b/i, /\bneeds?\s*grip\b/i]
  },
  {
    note: "dent",
    aliases: [/\bdent(ed)?\b/i]
  }
];

const ACCESSORY_NOTE_PATTERNS: {
  note: string;
  aliases: RegExp[];
}[] = [
  {
    note: "missing headcover",
    aliases: [/\bno\s*hc\b/i, /\bno\s*head\s*cover\b/i, /\bmissing\s*headcover\b/i, /\bmissing\s*head\s*cover\b/i]
  },
  {
    note: "headcover included",
    aliases: [/\bhc\s*included\b/i, /\bw\/\s*hc\b/i, /\bwith\s*head\s*cover\b/i, /\bwith\s*headcover\b/i]
  },
  {
    note: "missing wrench",
    aliases: [/\bno\s*wrench\b/i, /\bmissing\s*wrench\b/i]
  }
];

const UNCERTAINTY_PATTERNS: {
  note: string;
  aliases: RegExp[];
}[] = [
  {
    note: "model uncertain",
    aliases: [/\bmaybe\b/i, /\bpossibly\b/i, /\bnot\s*sure\b/i, /\blooks\s*like\b/i]
  },
  {
    note: "shaft uncertain",
    aliases: [/\bshaft\s*unknown\b/i, /\bunknown\s*shaft\b/i]
  },
  {
    note: "condition uncertain",
    aliases: [/\bcondition\s*unclear\b/i, /\bcond\s*unclear\b/i, /\brough\b/i]
  }
];

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function firstPatternMatch<T extends string>(
  line: string,
  patterns: { [key in T]: string } & { aliases: RegExp[] },
  key: T
): string | null {
  return patterns.aliases.some((alias) => alias.test(line)) ? patterns[key] : null;
}

function detectBrand(line: string): string | null {
  for (const pattern of BRAND_PATTERNS) {
    const match = firstPatternMatch(line, pattern, "brand");

    if (match) {
      return match;
    }
  }

  return null;
}

function detectCategory(line: string): string | null {
  for (const pattern of CATEGORY_PATTERNS) {
    const match = firstPatternMatch(line, pattern, "category");

    if (match) {
      return match;
    }
  }

  return null;
}

function detectShaftBrand(line: string): string | null {
  for (const pattern of SHAFT_BRAND_PATTERNS) {
    const match = firstPatternMatch(line, pattern, "shaftBrand");

    if (match) {
      return match;
    }
  }

  return null;
}

function detectShaftModel(line: string): string | null {
  for (const pattern of SHAFT_MODEL_PATTERNS) {
    const match = firstPatternMatch(line, pattern, "shaftModel");

    if (match) {
      return match;
    }
  }

  return null;
}


function detectLoft(line: string): string | null {
  const explicitLoftMatch = line.match(/\b(\d{1,2}(?:\.\d)?)\s*(?:deg|degree|°)\b/i);
  const shorthandLoftMatch = line.match(/\b(?:driver|drv|fairway|wood|3w|5w|7w|9w)\s+(\d{1,2}(?:\.\d)?)\b/i);
  const loftMatch = explicitLoftMatch ?? shorthandLoftMatch;

  if (!loftMatch) {
    return null;
  }

  const numericLoft = Number(loftMatch[1]);

  if (Number.isNaN(numericLoft) || numericLoft < 7 || numericLoft > 64) {
    return null;
  }

  return loftMatch[1] ?? null;
}

function detectClubNumber(line: string): string | null {
  const fairwayOrHybridMatch = line.match(/\b([2-9])\s*(?:w|wood|hy|hybrid)\b/i);

  if (fairwayOrHybridMatch) {
    return fairwayOrHybridMatch[1] ?? null;
  }

  const ironSetMatch = line.match(/\b([3-9])\s*-\s*(pw|gw|sw|lw|\d)\b/i);

  if (ironSetMatch) {
    const startClub = ironSetMatch[1];
    const endClub = ironSetMatch[2];

    if (!startClub || !endClub) {
      return null;
    }

    return `${startClub}-${endClub.toUpperCase()}`;
  }

  return null;
}

function collectNotes(
  line: string,
  patterns: { note: string; aliases: RegExp[] }[]
): string[] {
  return unique(
    patterns
      .filter((pattern) => pattern.aliases.some((alias) => alias.test(line)))
      .map((pattern) => pattern.note)
  );
}


function buildParserEvidence(
  line: string,
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
    brand: findTextParserEvidence(line, values.brand, [
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
    category: findTextParserEvidence(line, values.category, [
      { value: "DRIVER", aliases: [/\bdriver\b/i, /\bdrv\b/i, /\bdr\b/i, /\bDRIVER\b/] },
      { value: "FAIRWAY_WOOD", aliases: [/\bfairway\b/i, /\bfw\b/i, /\b3w\b/i, /\b5w\b/i, /\b7w\b/i, /\b9w\b/i, /\bwood\b/i, /\bFAIRWAY_WOOD\b/] },
      { value: "IRON_SET", aliases: [/\birons?\b/i, /\b[4-9]-pw\b/i, /\b[5-9]-gw\b/i, /\bIRON_SET\b/] },
      { value: "HYBRID", aliases: [/\bhy\b/i, /\bhybrid\b/i, /\brescue\b/i, /\bHYBRID\b/] },
      { value: "WEDGE", aliases: [/\bwedge\b/i, /\b\d{2}\s*deg\b/i, /\bWEDGE\b/] },
      { value: "PUTTER", aliases: [/\bputter\b/i, /\bPUTTER\b/] },
    ]),
    shaftFlex: isShaftFlexApplicable(values.category)
      ? detectShaftFlexWithEvidence(line).evidence
      : undefined,
    conditionGrade: detectApprovedConditionGradeWithEvidence(line).evidence,
    tradeInValue: detectTradeInValueWithEvidence(line).evidence,
  });
}

function buildMissingFields(input: {
  brand: string | null;
  productLine: string | null;
  category: string | null;
  shaftFlex: string | null;
  conditionNotes: string[];
}): string[] {
  const missingFields: string[] = [];

  if (!input.brand) {
    missingFields.push("brand");
  }

  if (!input.productLine) {
    missingFields.push("productLine");
  }

  if (!input.category) {
    missingFields.push("category");
  }

  if (isShaftFlexApplicable(input.category) && !input.shaftFlex) {
    missingFields.push("shaftFlex");
  }

  if (input.conditionNotes.length === 0) {
    missingFields.push("conditionNotes");
  }

  return missingFields;
}

function calculateConfidence(input: {
  brand: string | null;
  productLine: string | null;
  category: string | null;
  shaftFlex: string | null;
  conditionNotes: string[];
  accessoriesNotes: string[];
  uncertaintyNotes: string[];
  missingFields: string[];
}): number {
  let score = 0.25;

  if (input.brand) {
    score += 0.18;
  }

  if (input.productLine) {
    score += 0.18;
  }

  if (input.category) {
    score += 0.16;
  }

  if (input.shaftFlex) {
    score += 0.08;
  }

  if (input.conditionNotes.length > 0) {
    score += 0.08;
  }

  if (input.accessoriesNotes.length > 0) {
    score += 0.04;
  }

  score -= input.uncertaintyNotes.length * 0.08;
  score -= Math.max(0, input.missingFields.length - 1) * 0.03;

  return Math.max(0.2, Math.min(0.98, Number(score.toFixed(2))));
}

function parseLine(
  rawLine: string,
  index: number,
  provider?: ProductReferenceProvider
): ParsedTradeInDemoItem {
  const cleanedLine = rawLine
    .replace(/^[-*•\d.)\s]+/, "")
    .trim();
  const detectedBrand =
    detectBrand(cleanedLine);
  const detectedCategory =
    detectCategory(cleanedLine);
  const productIdentity =
    resolveParsedProductIdentity({
      rawText: cleanedLine,
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
  const shaftBrand =
    detectShaftBrand(cleanedLine);
  const shaftModel =
    detectShaftModel(cleanedLine);
  const shaftFlex =
    isShaftFlexApplicable(category)
      ? detectShaftFlexWithEvidence(
          cleanedLine
        ).value
      : null;
  const conditionGrade =
    detectApprovedConditionGradeWithEvidence(
      cleanedLine
    ).value;
  const tradeInValue =
    detectTradeInValueWithEvidence(
      cleanedLine
    ).value;
  const parserEvidence =
    buildParserEvidence(cleanedLine, {
      brand,
      productLineEvidence:
        productIdentity.productLineEvidence,
      category,
      shaftFlex,
      conditionGrade,
      tradeInValue
    });
  const conditionNotes = unique([
    ...(conditionGrade
      ? [conditionGrade]
      : []),
    ...collectNotes(
      cleanedLine,
      CONDITION_NOTE_PATTERNS
    )
  ]);
  const accessoriesNotes = collectNotes(
    cleanedLine,
    ACCESSORY_NOTE_PATTERNS
  );

  const uncertaintyNotes = unique([
    ...collectNotes(
      cleanedLine,
      UNCERTAINTY_PATTERNS
    ),
    ...productIdentity.uncertaintyNotes
  ]);

  const missingFields = buildMissingFields({
    brand,
    productLine,
    category,
    shaftFlex,
    conditionNotes
  });
  const confidence = calculateConfidence({
    brand,
    productLine,
    category,
    shaftFlex,
    conditionNotes,
    accessoriesNotes,
    uncertaintyNotes,
    missingFields
  });

  return {
    id: `parsed_item_${index + 1}`,
    rawLine: cleanedLine,
    brand,
    productLine,
    model: productLine,
    category,
    loft: detectLoft(cleanedLine),
    clubNumber:
      detectClubNumber(cleanedLine),
    shaftBrand,
    shaftModel,
    shaftFlex,
    conditionGrade,
    tradeInValue,
    parserEvidence,
    productResolution:
      productIdentity.productResolution,
    conditionNotes,
    accessoriesNotes,
    uncertaintyNotes,
    confidence,
    missingFields
  };
}

export function parseTradeInDemoText(
  rawInput: string,
  provider?: ProductReferenceProvider
): ParsedTradeInDemoItem[] {
  return rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) =>
      parseLine(line, index, provider)
    );
}
