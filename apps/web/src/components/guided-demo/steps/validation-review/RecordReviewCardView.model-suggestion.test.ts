import {
  describe,
  expect,
  it,
} from "vitest";

import {
  applyModelReviewSuggestionToDraft,
  getOpenPriorReviewSuggestions,
  isPriorReviewSuggestionLoadedInDraft,
} from "./RecordReviewCardView";

const baseDraft = {
  brand: "Mizuno",
  productLine: "JPX 923 Hot Metal",
  category: "IRON_SET" as const,
  shaftFlex: "REGULAR" as const,
  conditionGrade: "" as const,
  demoValue: "390",
  sourceTextMatches: {},
  demoValuationNote: "",
  reviewerNotes:
    "Confirmed corrected values in guided review.",
};

describe(
  "model review suggestion application",
  () => {
    it(
      "applies a condition grade and its exact source phrase to the correction draft",
      () => {
        const draft =
          applyModelReviewSuggestionToDraft(
            baseDraft,
            {
              recordId: "parsed_item_1",
              fieldName:
                "conditionGrade",
              sourcePhrase:
                "overall avg",
              candidateValue:
                "8.0 Average",
              confidence: 0.9,
              reason:
                "Deterministic policy matched explicit condition evidence.",
              reviewRequired: true,
            },
          );

        expect(
          draft.conditionGrade,
        ).toBe("8.0 Average");
        expect(
          draft.sourceTextMatches,
        ).toEqual({
          conditionGrade:
            "overall avg",
        });
        expect(draft.brand).toBe(
          baseDraft.brand,
        );
        expect(draft.demoValue).toBe(
          baseDraft.demoValue,
        );
      },
    );

    it(
      "maps a trade-in value suggestion to the review draft value field",
      () => {
        const draft =
          applyModelReviewSuggestionToDraft(
            {
              ...baseDraft,
              demoValue: "",
            },
            {
              recordId: "parsed_item_2",
              fieldName:
                "tradeInValue",
              sourcePhrase:
                "estimated value $145",
              candidateValue: 145,
              confidence: 0.92,
              reason:
                "The source includes an explicit numeric value.",
              reviewRequired: true,
            },
          );

        expect(
          draft.demoValue,
        ).toBe("145");
        expect(
          draft.sourceTextMatches,
        ).toEqual({
          demoValue:
            "estimated value $145",
        });
      },
    );

    it(
      "recognizes when a model action has already loaded the matching prior-approved correction",
      () => {
        const draft =
          applyModelReviewSuggestionToDraft(
            {
              ...baseDraft,
              shaftFlex: "",
            },
            {
              recordId:
                "parsed_item_1",
              fieldName:
                "shaftFlex",
              sourcePhrase:
                "shaft firm",
              candidateValue:
                "STIFF",
              confidence: 0.94,
              reason:
                "Prior approved evidence supports Stiff.",
              reviewRequired: true,
            },
          );

        expect(
          isPriorReviewSuggestionLoadedInDraft(
            draft,
            {
              fieldName:
                "shaftFlex",
              rawTextMatch:
                "shaft firm",
              suggestedValue:
                "STIFF",
            },
          ),
        ).toBe(true);

        expect(
          isPriorReviewSuggestionLoadedInDraft(
            {
              ...draft,
              shaftFlex:
                "REGULAR",
            },
            {
              fieldName:
                "shaftFlex",
              rawTextMatch:
                "shaft firm",
              suggestedValue:
                "STIFF",
            },
          ),
        ).toBe(false);
      },
    );


    it(
      "removes a matching model-loaded correction from the pending prior-review steps",
      () => {
        const draft =
          applyModelReviewSuggestionToDraft(
            {
              ...baseDraft,
              shaftFlex: "",
            },
            {
              recordId:
                "parsed_item_1",
              fieldName:
                "shaftFlex",
              sourcePhrase:
                "shaft firm",
              candidateValue:
                "STIFF",
              confidence: 0.94,
              reason:
                "Prior approved evidence supports Stiff.",
              reviewRequired: true,
            },
          );

        const priorSuggestion = {
          fieldName:
            "shaftFlex",
          rawTextMatch:
            "shaft firm",
          suggestedValue:
            "STIFF",
          strength:
            "STRONG",
          confidenceImpact:
            "Strong prior review match.",
        } as Parameters<
          typeof getOpenPriorReviewSuggestions
        >[0][number];

        expect(
          getOpenPriorReviewSuggestions(
            [priorSuggestion],
            new Set<string>(),
            draft,
          ),
        ).toEqual([]);

        expect(
          getOpenPriorReviewSuggestions(
            [priorSuggestion],
            new Set<string>(),
            {
              ...draft,
              shaftFlex:
                "REGULAR",
            },
          ),
        ).toEqual([
          priorSuggestion,
        ]);
      },
    );
  },
);
