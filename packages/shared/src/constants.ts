export const APP_NAME = "SwingOps AI";

export const CONFIDENCE_SCORE_MIN = 0;
export const CONFIDENCE_SCORE_MAX = 1;

export const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.75;

export const DEFAULT_WORKFLOW_NAME = "trade-in-intake-normalization";

export const WORKFLOW_STEP_ORDER = {
  parseInput: 1,
  normalizeData: 2,
  extractGolfClubFields: 3,
  validateStructuredOutput: 4,
  createReviewItem: 5,
  persistGolfClub: 6
} as const;

export const MOCK_MODEL_PROVIDER = {
  provider: "Mock",
  model: "mock-golf-intake-v1"
} as const;

export const SAMPLE_INPUT_PATHS = {
  freeformNotes: "data/sample-inputs/freeform-notes.txt",
  badTradeInCsv: "data/sample-inputs/bad-trade-in.csv",
  emailTradeIn: "data/sample-inputs/email-trade-in.txt"
} as const;
