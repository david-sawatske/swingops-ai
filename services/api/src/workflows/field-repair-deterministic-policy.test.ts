import {
  describe,
  expect,
  it
} from "vitest";

import {
  buildDeterministicPolicyFieldRepairAdvisoryCandidates,
  mergeFieldRepairAdvisoryCandidates,
  type MainRunFieldRepairAdvisoryCandidate
} from "./field-repair-advisory-candidates.js";
import {
  findDeterministicGolfTermAdvisoryMatches
} from "./golf-term-normalization.js";

function buildCandidateInput(
  sourceText: string,
  overrides: Partial<{
    missingFields: string[];
    productResolutionStatus:
      | "MATCHED"
      | "AMBIGUOUS"
      | "UNRESOLVED";
  }> = {}
) {
  return {
    recordId: "record-1",
    sourceText,
    missingFields:
      overrides.missingFields ?? [
        "conditionGrade"
      ],
    fieldApplicability: {
      shaftFlex:
        "REQUIRED" as const
    },
    productResolutionStatus:
      overrides.productResolutionStatus ??
      "MATCHED",
    sourceEvidenceId:
      "record-1:deterministic-policy"
  };
}

describe(
  "deterministic field-repair advisory policy",
  () => {
    it(
      "creates review-required candidates from explicit contextual condition phrases",
      () => {
        expect(
          buildDeterministicPolicyFieldRepairAdvisoryCandidates(
            buildCandidateInput(
              "Mizuno irons, overall avg, value 390"
            )
          )
        ).toEqual([
          expect.objectContaining({
            sourceType:
              "DETERMINISTIC_POLICY",
            sourceEvidenceId:
              "record-1:deterministic-policy",
            suggestion:
              expect.objectContaining({
                recordId: "record-1",
                fieldName:
                  "conditionGrade",
                sourcePhrase:
                  "overall avg",
                candidateValue:
                  "8.0 Average",
                confidence: 0.9,
                reviewRequired: true
              })
          })
        ]);

        expect(
          buildDeterministicPolicyFieldRepairAdvisoryCandidates(
            buildCandidateInput(
              "Odyssey putter, cosmetics mint"
            )
          )
        ).toEqual([
          expect.objectContaining({
            suggestion:
              expect.objectContaining({
                fieldName:
                  "conditionGrade",
                sourcePhrase:
                  "cosmetics mint",
                candidateValue:
                  "9.5 Mint",
                reviewRequired: true
              })
          })
        ]);
      }
    );

    it(
      "withholds candidates for negative, conflicting, non-missing, or ambiguous evidence",
      () => {
        expect(
          findDeterministicGolfTermAdvisoryMatches(
            "overall avg but condition unclear"
          )
        ).toEqual([]);

        expect(
          findDeterministicGolfTermAdvisoryMatches(
            "overall avg and cosmetics mint"
          )
        ).toEqual([]);

        expect(
          buildDeterministicPolicyFieldRepairAdvisoryCandidates(
            buildCandidateInput(
              "overall avg",
              {
                missingFields: []
              }
            )
          )
        ).toEqual([]);

        expect(
          buildDeterministicPolicyFieldRepairAdvisoryCandidates(
            buildCandidateInput(
              "overall avg",
              {
                productResolutionStatus:
                  "AMBIGUOUS"
              }
            )
          )
        ).toEqual([]);
      }
    );

    it(
      "withholds conflicting values across advisory sources",
      () => {
        const averageCandidate =
          buildDeterministicPolicyFieldRepairAdvisoryCandidates(
            buildCandidateInput(
              "overall avg"
            )
          )[0];

        expect(averageCandidate).toBeDefined();

        const conflictingCandidate:
          MainRunFieldRepairAdvisoryCandidate = {
            candidateId:
              "prior-review:event-1:conditionGrade",
            sourceType:
              "PRIOR_REVIEW",
            sourceEvidenceId:
              "record-1:prior-review",
            sourceReferenceId:
              "event-1",
            suggestion: {
              recordId: "record-1",
              fieldName:
                "conditionGrade",
              sourcePhrase:
                "overall avg",
              candidateValue:
                "9.0 Above Average",
              confidence: 0.94,
              reason:
                "Prior review supplied a conflicting value.",
              reviewRequired: true
            }
          };

        expect(
          mergeFieldRepairAdvisoryCandidates(
            [averageCandidate!],
            [conflictingCandidate]
          )
        ).toEqual([]);
      }
    );
    it(
      "keeps supported condition evidence when a different field is unresolved",
      () => {
        expect(
          findDeterministicGolfTermAdvisoryMatches(
            "Odyssey putter cosmetics mint value pending"
          )
        ).toEqual([
          expect.objectContaining({
            fieldName:
              "conditionGrade",
            sourcePhrase:
              "cosmetics mint",
            candidateValue:
              "9.5 Mint"
          })
        ]);

        expect(
          findDeterministicGolfTermAdvisoryMatches(
            "Cleveland wedge shaft unknown cosmetics poor"
          )
        ).toEqual([
          expect.objectContaining({
            fieldName:
              "conditionGrade",
            sourcePhrase:
              "cosmetics poor",
            candidateValue:
              "6.0 Poor"
          })
        ]);

        expect(
          findDeterministicGolfTermAdvisoryMatches(
            "condition unclear value pending"
          )
        ).toEqual([]);
      }
    );

  }
);
