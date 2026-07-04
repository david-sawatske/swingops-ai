import type {
  ExecuteEndToEndAgenticTradeInDemoResponse,
  GlobalReviewQueueItem,
  ResolveReviewQueueItemWithCorrectionsRequest,
  ReviewConditionGrade,
  ReviewCorrectionCategory,
  ReviewCorrectionShaftFlex,
} from "../../../../types/workflow";

export type GuidedValidationReviewStepProps = {
  actionError: string | null;
  actionSuccess: string | null;
  activeReviewQueueItemId: string | null;
  currentRunReviewQueueItems: GlobalReviewQueueItem[];
  onContinue: () => void;
  onOpenReviewQueue: () => void;
  onReviewQueueNotesChange: (reviewQueueItemId: string, reviewerNotes: string) => void;
  onResolveReviewQueueItemWithCorrections: (input: {
    reviewQueueItemId: string;
    request: ResolveReviewQueueItemWithCorrectionsRequest;
    workflowRunId?: string | null;
    intakeBatchId?: string | null;
  }) => void;
  result: ExecuteEndToEndAgenticTradeInDemoResponse | null;
  reviewQueueNotesById: Record<string, string>;
};

export type DemoResult = NonNullable<GuidedValidationReviewStepProps["result"]>;
export type ParsedItem = DemoResult["parsedItems"][number];
export type ValidationCheck = DemoResult["validationChecks"][number];
export type RetryEvent = DemoResult["retryEvents"][number];
export type ReviewOutcome = DemoResult["reviewOutcomes"][number];
export type DemoReviewQueueItem = DemoResult["reviewQueueItemsCreated"][number];
export type ReviewQueueItem = DemoReviewQueueItem | GlobalReviewQueueItem;
export type PriorReviewLearningSuggestion =
  DemoResult["priorReviewLearningSuggestionsByItem"][number]["suggestions"][number];


export type ReviewCorrectionDraft = {
  brand: string;
  productLine: string;
  category: ReviewCorrectionCategory | "";
  shaftFlex: ReviewCorrectionShaftFlex | "";
  conditionGrade: ReviewConditionGrade | "";
  demoValue: string;
  sourceTextMatches: Record<string, string>;
  demoValuationNote: string;
  reviewerNotes: string;
};

export type RecordReviewCard = {
  id: string;
  index: number;
  label: string;
  status: "ready" | "needs-review" | "resolved";
  statusLabel: string;
  parsedRecord: Record<string, unknown>;
  reviewItem: ReviewQueueItem | null;
  reviewOutcome: ReviewOutcome | null;
  inventoryEvidence: Record<string, unknown> | null;
  valuationEvidence: Record<string, unknown> | null;
  sourceEvidence: string;
  priorReviewSuggestions: PriorReviewLearningSuggestion[];
  missingFields: string[];
  reviewReasons: string[];
  validationChecks: ValidationCheck[];
  retryEvents: RetryEvent[];
  suggestedAction: string;
};
