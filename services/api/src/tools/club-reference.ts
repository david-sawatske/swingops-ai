export type ClubReferenceCategory =
  | "DRIVER"
  | "FAIRWAY_WOOD"
  | "HYBRID"
  | "IRON_SET"
  | "WEDGE"
  | "PUTTER";

export type ClubReferenceRecord = {
  brand: string;
  model: string;
  category: ClubReferenceCategory;
  releaseYear: number;
  commonAliases: string[];
  confidenceNotes: string;
};

export type ClubReferenceMatch = ClubReferenceRecord & {
  matchScore: number;
  matchedTerms: string[];
};

export type ClubReferenceSearchResult = {
  query: string;
  matches: ClubReferenceMatch[];
  summary: string;
};

const CLUB_REFERENCE_DATASET: ClubReferenceRecord[] = [
  {
    brand: "Titleist",
    model: "TSR3",
    category: "FAIRWAY_WOOD",
    releaseYear: 2022,
    commonAliases: ["TSR", "TSR 3", "TSR3 fairway", "Titleist TSR"],
    confidenceNotes:
      "TSR3 is commonly confused with older TS-series Titleist woods when customer notes omit the R.",
  },
  {
    brand: "Titleist",
    model: "TS2",
    category: "FAIRWAY_WOOD",
    releaseYear: 2018,
    commonAliases: ["TS 2", "TS fairway", "Titleist TS", "Titleist TS2"],
    confidenceNotes:
      "TS2 is an older Titleist fairway model and can be ambiguous when notes say TSR maybe TS2.",
  },
  {
    brand: "TaylorMade",
    model: "Stealth 2",
    category: "DRIVER",
    releaseYear: 2023,
    commonAliases: ["Stealth2", "Stealth two", "TM Stealth 2", "TaylorMade Stealth2"],
    confidenceNotes:
      "Stealth 2 often appears in shorthand as TM Stealth or Stealth2 in trade-in notes.",
  },
  {
    brand: "Ping",
    model: "G425",
    category: "DRIVER",
    releaseYear: 2020,
    commonAliases: ["PING G425", "G 425", "G425 Max", "Ping 425"],
    confidenceNotes:
      "G425 appears across driver, fairway, hybrid, and iron families; category context matters.",
  },
  {
    brand: "Callaway",
    model: "JAWS Raw",
    category: "WEDGE",
    releaseYear: 2022,
    commonAliases: ["Jaws Raw", "JAWS", "Callaway Jaws", "Jaws wedge"],
    confidenceNotes:
      "JAWS Raw wedges may require loft/bounce/grind details before pricing or catalog matching.",
  },
  {
    brand: "Scotty Cameron",
    model: "Newport 2",
    category: "PUTTER",
    releaseYear: 2023,
    commonAliases: ["Newport II", "NP2", "Scotty NP2", "Cameron Newport 2"],
    confidenceNotes:
      "Newport 2 has many generations; year, finish, and condition can materially change valuation.",
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function scoreRecord(record: ClubReferenceRecord, query: string): ClubReferenceMatch | null {
  const normalizedQuery = normalize(query);
  const queryTerms = normalizedQuery.split(" ").filter(Boolean);
  const searchableValues = [
    record.brand,
    record.model,
    `${record.brand} ${record.model}`,
    record.category,
    ...record.commonAliases,
  ];

  const normalizedSearchableValues = searchableValues.map(normalize);
  const matchedTerms: string[] = [];
  let score = 0;

  for (const value of normalizedSearchableValues) {
    if (value && normalizedQuery.includes(value)) {
      matchedTerms.push(value);
      score += value.length >= 5 ? 0.45 : 0.25;
    }
  }

  for (const term of queryTerms) {
    if (
      normalizedSearchableValues.some((value) =>
        value.split(" ").some((part) => part === term),
      )
    ) {
      matchedTerms.push(term);
      score += 0.12;
    }
  }

  if (normalizedQuery.includes("maybe") || normalizedQuery.includes("possibly")) {
    score += 0.08;
  }

  const boundedScore = Math.min(0.98, Number(score.toFixed(2)));

  if (boundedScore <= 0) {
    return null;
  }

  return {
    ...record,
    matchScore: boundedScore,
    matchedTerms: unique(matchedTerms),
  };
}

export function searchClubReference(query: string): ClubReferenceSearchResult {
  const trimmedQuery = query.trim();

  const matches = CLUB_REFERENCE_DATASET.map((record) =>
    scoreRecord(record, trimmedQuery),
  )
    .filter((match): match is ClubReferenceMatch => match !== null)
    .sort((left, right) => right.matchScore - left.matchScore)
    .slice(0, 5);

  const summary =
    matches.length === 0
      ? "No strong club reference matches found in the local demo dataset."
      : `Club reference search found ${matches
          .slice(0, 3)
          .map((match) => `${match.brand} ${match.model}`)
          .join(", ")} as possible match${matches.length === 1 ? "" : "es"}.`;

  return {
    query: trimmedQuery,
    matches,
    summary,
  };
}
