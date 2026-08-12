export const OPERATIONAL_DATA_ORIGINS = [
  "LIVE_DEMO",
  "GOLDEN_DEMONSTRATION",
  "SEEDED_BASELINE",
] as const;

export type OperationalDataOriginValue =
  (typeof OPERATIONAL_DATA_ORIGINS)[number];

export const PRIOR_REVIEW_EVIDENCE_ORIGINS = [
  "LIVE_DEMO",
  "GOLDEN_DEMONSTRATION",
] as const satisfies readonly OperationalDataOriginValue[];
