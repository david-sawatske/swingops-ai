import { describe, expect, it } from "vitest";

import {
  MAIN_RUN_FIELD_REPAIR_POLICY_KEY,
  buildMainRunFieldRepairExecutionInput,
  validateMainRunFieldRepairModelOutput,
  type MainRunFieldRepairRecordInput
} from "../workflows/main-run-field-repair.js";
import { mockProvider } from "./providers/mock.provider.js";

describe("mock provider field repair behavior", () => {
  it("returns a candidate comparison without leaking compatibility suggestions", async () => {
    const result = await mockProvider.execute({
      model: "mock-golf-workflow-model",
      taskType: "FIELD_NORMALIZATION",
      inputJson: buildMainRunFieldRepairExecutionInput({
        workflowRunId: "workflow-run-1",
        records: [
          {
            recordId: "record-1",
            sourceText: "Titleist TSR 3w Tensei s flex condition avg value $150",
            missingFields: ["shaftFlex", "conditionGrade", "tradeInValue"],
            confidence: 0.61,
            selectionReason: {
              lowConfidence: true,
              confidence: 0.61,
              missingFields: ["shaftFlex", "conditionGrade", "tradeInValue"],
              uncertaintyNotes: [],
              reviewReasonCodes: [
                "LOW_CONFIDENCE",
                "MISSING_REQUIRED_FIELDS",
                "PRODUCT_AMBIGUOUS"
              ]
            },
            currentFields: {
              brand: "Titleist",
              productLine: "TSR",
              category: "FAIRWAY_WOOD",
              shaftFlex: null,
              conditionGrade: null,
              tradeInValue: null
            },
            fieldApplicability: {
              shaftFlex: "REQUIRED"
            },
            productResolution: {
              status: "AMBIGUOUS",
              reason: "Multiple deterministic candidates remained.",
              matchedProductId: null,
              matchedSku: null,
              candidateProductIds: [
                "prod_titleist_tsr2_fairway",
                "prod_titleist_tsr3_fairway"
              ]
            },
            evidence: [
              {
                evidenceId: "record-1:parser",
                evidenceType: "PARSER",
                summary: "Source text contains repairable field evidence.",
                payload: null
              }
            ]
          }
        ]
      })
    });

    const validation = validateMainRunFieldRepairModelOutput(result.outputJson);

    expect(validation).toMatchObject({
      jsonValid: true,
      validationPassed: true,
      output: {
        recordOutcomes: [
          expect.objectContaining({
            outcomeType: "CANDIDATE_COMPARISON",
            recordId: "record-1",
            candidateProductIds: [
              "prod_titleist_tsr2_fairway",
              "prod_titleist_tsr3_fairway"
            ]
          })
        ],
        suggestions: []
      }
    });
  });

  it("projects suggestions from a repair outcome", async () => {
    const result = await mockProvider.execute({
      model: "mock-golf-workflow-model",
      taskType: "FIELD_NORMALIZATION",
      inputJson: {
        policyKey: MAIN_RUN_FIELD_REPAIR_POLICY_KEY,
        records: [
          {
            recordId: "record-2",
            sourceText: "Ping G430 driver Alta CB regular flex",
            missingFields: ["shaftFlex"],
            productResolution: {
              status: "MATCHED",
              candidateProductIds: ["prod_ping_g430_driver"]
            },
            evidence: [
              {
                evidenceId: "record-2:parser"
              }
            ]
          }
        ]
      }
    });

    const validation =
      validateMainRunFieldRepairModelOutput(result.outputJson);

    expect(validation).toMatchObject({
      jsonValid: true,
      validationPassed: true,
      output: {
        recordOutcomes: [
          {
            outcomeType: "REPAIR_SUGGESTED",
            recordId: "record-2"
          }
        ],
        suggestions: [
          {
            recordId: "record-2",
            fieldName: "shaftFlex",
            candidateValue: "REGULAR"
          }
        ]
      }
    });
  });

  it("surfaces supplied advisory candidates exactly before local heuristics", async () => {
    const record: MainRunFieldRepairRecordInput = {
      recordId: "record-3",
      sourceText:
        "PING G425 shaft firm regular flex",
      missingFields: ["shaftFlex"],
      confidence: 0.7,
      selectionReason: {
        lowConfidence: true,
        confidence: 0.7,
        missingFields: ["shaftFlex"],
        uncertaintyNotes: [],
        reviewReasonCodes: [
          "LOW_CONFIDENCE",
          "MISSING_REQUIRED_FIELDS"
        ]
      },
      currentFields: {
        brand: "PING",
        productLine: "G425",
        category: "IRON_SET",
        shaftFlex: null
      },
      fieldApplicability: {
        shaftFlex: "REQUIRED"
      },
      parserEvidence: null,
      productResolution: {
        status: "MATCHED",
        reason:
          "One deterministic product matched.",
        matchedProductId:
          "prod_ping_g425_iron_set_2021",
        matchedSku:
          "PING-G425-IRON-2021",
        candidateProductIds: [
          "prod_ping_g425_iron_set_2021"
        ]
      },
      advisoryCandidates: [
        {
          candidateId:
            "prior-review:learning-event-3:shaftFlex",
          sourceType: "PRIOR_REVIEW",
          sourceEvidenceId:
            "record-3:prior-review",
          sourceReferenceId:
            "learning-event-3",
          suggestion: {
            recordId: "record-3",
            fieldName: "shaftFlex",
            sourcePhrase: "shaft firm",
            candidateValue: "STIFF",
            confidence: 0.94,
            reason:
              "Matched an approved prior correction.",
            reviewRequired: true
          }
        }
      ],
      evidence: [
        {
          evidenceId: "record-3:parser",
          evidenceType: "PARSER",
          summary:
            "Source text also contains a conflicting local heuristic phrase.",
          payload: null
        },
        {
          evidenceId:
            "record-3:prior-review",
          evidenceType: "PRIOR_REVIEW",
          summary:
            "A strong approved prior correction matched the source phrase.",
          payload: null
        }
      ]
    };

    const result = await mockProvider.execute({
      model: "mock-golf-workflow-model",
      taskType: "FIELD_NORMALIZATION",
      inputJson:
        buildMainRunFieldRepairExecutionInput({
          workflowRunId:
            "workflow-run-1",
          records: [record]
        })
    });

    const validation =
      validateMainRunFieldRepairModelOutput(
        result.outputJson,
        {
          records: [record]
        }
      );

    expect(validation).toMatchObject({
      jsonValid: true,
      validationPassed: true,
      output: {
        recordOutcomes: [
          {
            outcomeType:
              "REPAIR_SUGGESTED",
            recordId: "record-3",
            evidenceIds:
              expect.arrayContaining([
                "record-3:prior-review"
              ]),
            suggestions: [
              {
                recordId: "record-3",
                fieldName: "shaftFlex",
                sourcePhrase: "shaft firm",
                candidateValue: "STIFF",
                confidence: 0.94,
                reviewRequired: true
              }
            ]
          }
        ],
        suggestions: [
          {
            recordId: "record-3",
            fieldName: "shaftFlex",
            sourcePhrase: "shaft firm",
            candidateValue: "STIFF",
            confidence: 0.94,
            reviewRequired: true
          }
        ]
      },
      validationErrors: []
    });

    expect(
      validation.output?.suggestions
    ).toHaveLength(1);
    expect(
      validation.output?.suggestions
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidateValue: "REGULAR"
        })
      ])
    );
  });

  it("does not invent suggestions when source evidence is absent", async () => {
    const result = await mockProvider.execute({
      model: "mock-golf-workflow-model",
      taskType: "FIELD_NORMALIZATION",
      inputJson: buildMainRunFieldRepairExecutionInput({
        workflowRunId: "workflow-run-1",
        records: [
          {
            recordId: "record-1",
            sourceText: "unknown maybe 5w shaft unknown condition unclear value pending review",
            missingFields: ["shaftFlex", "conditionGrade", "tradeInValue"],
            confidence: 0.42,
            selectionReason: {
              lowConfidence: true,
              confidence: 0.42,
              missingFields: ["shaftFlex", "conditionGrade", "tradeInValue"],
              uncertaintyNotes: [
                "model uncertain",
                "shaft uncertain",
                "condition uncertain"
              ],
              reviewReasonCodes: [
                "LOW_CONFIDENCE",
                "MISSING_REQUIRED_FIELDS",
                "UNCERTAINTY_NOTES",
                "PRODUCT_UNRESOLVED"
              ]
            },
            currentFields: {
              shaftFlex: null,
              conditionGrade: null,
              tradeInValue: null
            },
            fieldApplicability: {
              shaftFlex: "REQUIRED"
            },
            productResolution: {
              status: "UNRESOLVED",
              reason: "No authoritative product reference matched.",
              matchedProductId: null,
              matchedSku: null,
              candidateProductIds: []
            },
            evidence: [
              {
                evidenceId: "record-1:product-resolution",
                evidenceType: "PRODUCT_RESOLUTION",
                summary: "No deterministic product candidate matched.",
                payload: null
              }
            ]
          }
        ]
      })
    });

    const validation = validateMainRunFieldRepairModelOutput(result.outputJson);

    expect(validation).toMatchObject({
      jsonValid: true,
      validationPassed: true,
      output: {
        recordOutcomes: [
          expect.objectContaining({
            outcomeType: "NO_SAFE_REPAIR",
            recordId: "record-1",
            reasonCodes: expect.arrayContaining([
              "LOW_CONFIDENCE",
              "MISSING_REQUIRED_FIELDS",
              "PRODUCT_UNRESOLVED"
            ])
          })
        ],
        suggestions: []
      }
    });
  });

  it("preserves the existing generic mock response for other tasks", async () => {
    const result = await mockProvider.execute({
      model: "mock-golf-workflow-model",
      taskType: "INTAKE_PARSING",
      inputJson: {
        workflowRunId: "workflow-run-1"
      }
    });

    expect(result.outputJson).toMatchObject({
      mock: true,
      provider: "MOCK",
      model: "mock-golf-workflow-model",
      taskType: "INTAKE_PARSING"
    });
  });
});
