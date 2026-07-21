import {
  FIELD_REPAIR_AUTO_ACCEPT_CONFIDENCE_THRESHOLD,
  type FieldRepairSuggestion
} from "./main-run-field-repair.js";
import { isShaftFlexApplicable } from "./golf-field-applicability.js";
import type { ParsedTradeInDemoItem } from "./trade-in-demo-parser.js";
import type { RetryEvent } from "./workflow-quality-types.js";

export const TARGETED_FIELD_RETRY_MAX_ATTEMPTS = 1;
export const TARGETED_FIELD_RETRY_POLICY =
  "one targeted retry before human review";

export type TargetedFieldRetryResult = {
  parsedItems: ParsedTradeInDemoItem[];
  retryEvent: RetryEvent;
};

type ShaftFlexSuggestion = Extract<
  FieldRepairSuggestion,
  { fieldName: "shaftFlex" }
>;

function hasShaftFlexIssue(item: ParsedTradeInDemoItem): boolean {
  return (
    isShaftFlexApplicable(item.category) &&
    (
      !item.shaftFlex ||
      item.missingFields.includes("shaftFlex") ||
      item.uncertaintyNotes.some((note) => /\bshaft\b/i.test(note)) ||
      /\b(?:shaft(?:\s+flex)?|flex)\b[^.,;|]{0,48}\b(?:unknown|unclear|pending|not\s+listed|tbd|not\s+sure)\b/i.test(
        item.rawLine
      )
    )
  );
}

export function findTargetedFieldRetryCandidate(
  parsedItems: ParsedTradeInDemoItem[]
): ParsedTradeInDemoItem | null {
  return parsedItems.find(hasShaftFlexIssue) ?? null;
}

export function buildSkippedTargetedFieldRetry(
  parsedItems: ParsedTradeInDemoItem[]
): TargetedFieldRetryResult {
  return {
    parsedItems,
    retryEvent: {
      id: "retry-shaft-flex-not-needed",
      reason: "No recoverable shaft/flex issue was found.",
      targetField: "shaftFlex",
      recordId: null,
      policy: TARGETED_FIELD_RETRY_POLICY,
      status: "SKIPPED",
      attemptCount: 0,
      maxAttempts: TARGETED_FIELD_RETRY_MAX_ATTEMPTS,
      modelCallLogId: null,
      before: null,
      after: null,
      message:
        "Targeted retry was skipped because validation did not find an incomplete shaft/flex field."
    }
  };
}

export function completeTargetedFieldRetry(input: {
  parsedItems: ParsedTradeInDemoItem[];
  recordId: string;
  modelCallLogId: string;
  validationPassed: boolean;
  validationErrors: string[];
  suggestions: FieldRepairSuggestion[];
}): TargetedFieldRetryResult {
  const retryCandidate = input.parsedItems.find(
    (item) => item.id === input.recordId
  );

  if (!retryCandidate || !hasShaftFlexIssue(retryCandidate)) {
    throw new Error(
      `Targeted shaft-flex retry candidate was not found: ${input.recordId}.`
    );
  }

  const eligibleSuggestions = input.validationPassed
    ? input.suggestions.filter(
        (suggestion): suggestion is ShaftFlexSuggestion =>
          suggestion.recordId === retryCandidate.id &&
          suggestion.fieldName === "shaftFlex" &&
          suggestion.reviewRequired === false &&
          suggestion.confidence >=
            FIELD_REPAIR_AUTO_ACCEPT_CONFIDENCE_THRESHOLD &&
          retryCandidate.rawLine
            .toLowerCase()
            .includes(suggestion.sourcePhrase.toLowerCase())
      )
    : [];
  const eligibleValues = new Set(
    eligibleSuggestions.map((suggestion) => suggestion.candidateValue)
  );
  const selectedSuggestion =
    eligibleValues.size === 1 ? eligibleSuggestions[0] ?? null : null;
  const conflictsWithExistingValue = Boolean(
    selectedSuggestion &&
      retryCandidate.shaftFlex &&
      retryCandidate.shaftFlex !== selectedSuggestion.candidateValue
  );
  const canResolve = Boolean(
    selectedSuggestion && !conflictsWithExistingValue
  );
  const repairedItem: ParsedTradeInDemoItem = canResolve
    ? {
        ...retryCandidate,
        shaftFlex: selectedSuggestion!.candidateValue,
        parserEvidence: {
          ...(retryCandidate.parserEvidence ?? {}),
          shaftFlex: {
            value: selectedSuggestion!.candidateValue,
            sourceText: selectedSuggestion!.sourcePhrase
          }
        },
        missingFields: retryCandidate.missingFields.filter(
          (field) => field !== "shaftFlex"
        ),
        uncertaintyNotes: retryCandidate.uncertaintyNotes.filter(
          (note) => !/\bshaft\b/i.test(note)
        )
      }
    : retryCandidate;
  const parsedItems = input.parsedItems.map((item) =>
    item.id === repairedItem.id ? repairedItem : item
  );
  const unresolvedReason = !input.validationPassed
    ? "the retry output did not pass validation"
    : conflictsWithExistingValue
      ? "the retry suggestion conflicted with the existing shaft-flex value"
      : eligibleValues.size > 1
        ? "the retry returned conflicting safe candidates"
        : "the retry did not return a safe, high-confidence shaft-flex value";

  return {
    parsedItems,
    retryEvent: {
      id: `${retryCandidate.id}-retry-shaft-flex`,
      reason: "missing or uncertain shaft/flex data",
      targetField: "shaftFlex",
      recordId: retryCandidate.id,
      policy: TARGETED_FIELD_RETRY_POLICY,
      status: canResolve ? "RESOLVED" : "UNRESOLVED",
      attemptCount: 1,
      maxAttempts: TARGETED_FIELD_RETRY_MAX_ATTEMPTS,
      modelCallLogId: input.modelCallLogId,
      before: {
        shaftFlex: retryCandidate.shaftFlex,
        missingFields: retryCandidate.missingFields,
        uncertaintyNotes: retryCandidate.uncertaintyNotes
      },
      after: {
        shaftFlex: repairedItem.shaftFlex,
        missingFields: repairedItem.missingFields,
        uncertaintyNotes: repairedItem.uncertaintyNotes,
        validationPassed: input.validationPassed,
        validationErrors: input.validationErrors,
        eligibleSuggestionCount: eligibleSuggestions.length
      },
      message: canResolve
        ? "One targeted extraction retry produced a validated, high-confidence shaft-flex value and repaired the record before review."
        : `One targeted extraction retry ran, but ${unresolvedReason}, so the record remains in human review.`
    }
  };
}
