import { describe, expect, it } from "vitest";

import type {
  FieldRepairRecordOutcome,
} from "../../../types/workflow";
import {
  getModelReviewAssistanceSummary,
  getModelReviewOutcomeLabel,
} from "./GuidedModelReviewAssistance";

const outcomes: FieldRepairRecordOutcome[] = [
  {
    outcomeType: "REPAIR_SUGGESTED",
    recordId: "record-1",
    summary: "A source-supported shaft-flex repair is available.",
    evidenceIds: ["record-1:parser"],
    reviewerQuestion: "Should Stiff be applied?",
    suggestions: [
      {
        recordId: "record-1",
        fieldName: "shaftFlex",
        sourcePhrase: "s flex",
        candidateValue: "STIFF",
        confidence: 0.91,
        reason: "The source explicitly identifies shaft flex.",
        reviewRequired: false,
      },
    ],
  },
  {
    outcomeType: "CANDIDATE_COMPARISON",
    recordId: "record-2",
    summary: "Two deterministic candidates remain.",
    evidenceIds: ["record-2:product-resolution"],
    reviewerQuestion: "Which supplied generation matches the source?",
    candidateProductIds: ["product-a", "product-b"],
  },
  {
    outcomeType: "NO_SAFE_REPAIR",
    recordId: "record-3",
    summary: "The source does not support a safe repair.",
    evidenceIds: ["record-3:parser"],
    reviewerQuestion: "Which value can be confirmed manually?",
    reasonCodes: ["INSUFFICIENT_EVIDENCE"],
  },
];

describe("GuidedModelReviewAssistance formatting", () => {
  it("uses reviewer-facing labels for every outcome type", () => {
    expect(getModelReviewOutcomeLabel("REPAIR_SUGGESTED")).toBe(
      "Repair suggested",
    );
    expect(getModelReviewOutcomeLabel("CANDIDATE_COMPARISON")).toBe(
      "Candidate comparison",
    );
    expect(getModelReviewOutcomeLabel("NO_SAFE_REPAIR")).toBe(
      "No safe repair",
    );
  });

  it("summarizes all validated record outcomes instead of suggestions alone", () => {
    expect(getModelReviewAssistanceSummary(outcomes)).toBe(
      "3 selected records assessed · 1 repair outcome · 1 candidate comparison · 1 no-safe-repair outcome",
    );
  });

  it("explains when no records were selected for assistance", () => {
    expect(getModelReviewAssistanceSummary([])).toBe(
      "No records met the model-assistance selection rules for this run.",
    );
  });
});
