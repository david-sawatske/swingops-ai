import { describe, expect, it } from "vitest";

import {
  MAIN_RUN_FIELD_REPAIR_AGENT_NAME,
  MAIN_RUN_FIELD_REPAIR_OUTPUT_SCHEMA,
  MAIN_RUN_FIELD_REPAIR_POLICY_KEY,
  buildMainRunFieldRepairExecutionInput,
  validateMainRunFieldRepairModelOutput,
  type MainRunFieldRepairRecordInput
} from "./main-run-field-repair.js";


function buildValidationRecord(
  overrides: Partial<MainRunFieldRepairRecordInput> = {}
): MainRunFieldRepairRecordInput {
  return {
    recordId: "record-1",
    sourceText: "Titleist TSR 3w Tensei s flex",
    missingFields: ["shaftFlex"],
    confidence: 0.61,
    selectionReason: {
      lowConfidence: true,
      confidence: 0.61,
      missingFields: ["shaftFlex"],
      uncertaintyNotes: ["product generation uncertain"],
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
      shaftFlex: null
    },
    fieldApplicability: {
      shaftFlex: "REQUIRED"
    },
    parserEvidence: null,
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
        evidenceId: "record-1:product-resolution",
        evidenceType: "PRODUCT_RESOLUTION",
        summary: "Two deterministic candidates remained.",
        payload: null
      }
    ],
    ...overrides
  };
}

function buildAdvisoryCandidateRecord():
  MainRunFieldRepairRecordInput {
  return buildValidationRecord({
    sourceText: "PING G425 shaft firm",
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
    productResolution: {
      status: "MATCHED",
      reason: "One deterministic product matched.",
      matchedProductId:
        "prod_ping_g425_iron_set_2021",
      matchedSku: "PING-G425-IRON-2021",
      candidateProductIds: [
        "prod_ping_g425_iron_set_2021"
      ]
    },
    advisoryCandidates: [
      {
        candidateId:
          "prior-review:learning-event-1:shaftFlex",
        sourceType: "PRIOR_REVIEW",
        sourceEvidenceId:
          "record-1:prior-review",
        sourceReferenceId: "learning-event-1",
        suggestion: {
          recordId: "record-1",
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
        evidenceId:
          "record-1:product-resolution",
        evidenceType: "PRODUCT_RESOLUTION",
        summary:
          "One deterministic product matched.",
        payload: null
      },
      {
        evidenceId: "record-1:prior-review",
        evidenceType: "PRIOR_REVIEW",
        summary:
          "One strong prior-review suggestion matched.",
        payload: null
      }
    ]
  });
}

describe("main run field repair contract", () => {
  it("builds a provider execution input with policy, authority, and evidence metadata", () => {
    const inputJson = buildMainRunFieldRepairExecutionInput({
      workflowRunId: "workflow-run-1",
      records: [
        {
          recordId: "record-1",
          sourceText: "Titleist TSR 3w Tensei s flex",
          missingFields: ["shaftFlex"],
          confidence: 0.61,
          selectionReason: {
            lowConfidence: true,
            confidence: 0.61,
            missingFields: ["shaftFlex"],
            uncertaintyNotes: ["product generation uncertain"],
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
            shaftFlex: null
          },
          fieldApplicability: {
            shaftFlex: "REQUIRED"
          },
          parserEvidence: {
            brand: {
              sourcePhrase: "Titleist"
            }
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
              evidenceId: "record-1:product-resolution",
              evidenceType: "PRODUCT_RESOLUTION",
              summary: "Two deterministic candidates remained.",
              payload: {
                candidateCount: 2
              }
            }
          ]
        }
      ]
    });

    expect(inputJson).toMatchObject({
      policyKey: MAIN_RUN_FIELD_REPAIR_POLICY_KEY,
      agentName: MAIN_RUN_FIELD_REPAIR_AGENT_NAME,
      workflowRunId: "workflow-run-1",
      records: [
        {
          recordId: "record-1",
          sourceText: "Titleist TSR 3w Tensei s flex",
          missingFields: ["shaftFlex"],
          selectionReason: {
            lowConfidence: true,
            reviewReasonCodes: [
              "LOW_CONFIDENCE",
              "MISSING_REQUIRED_FIELDS",
              "PRODUCT_AMBIGUOUS"
            ]
          },
          fieldApplicability: {
            shaftFlex: "REQUIRED"
          },
          productResolution: {
            status: "AMBIGUOUS",
            candidateProductIds: [
              "prod_titleist_tsr2_fairway",
              "prod_titleist_tsr3_fairway"
            ]
          },
          evidence: [
            {
              evidenceId: "record-1:product-resolution",
              evidenceType: "PRODUCT_RESOLUTION"
            }
          ]
        }
      ],
      authorityOrder: [
        "HUMAN_CORRECTION",
        "DETERMINISTIC_POLICY",
        "PRODUCT_RESOLUTION",
        "INVENTORY_AND_VALUATION",
        "KNOWLEDGE",
        "PRIOR_REVIEW",
        "MODEL"
      ]
    });
  });

  it("serializes evidence-backed advisory candidates and provider handling rules", () => {
    const inputJson =
      buildMainRunFieldRepairExecutionInput({
        workflowRunId: "workflow-run-1",
        records: [
          buildAdvisoryCandidateRecord()
        ]
      });

    expect(inputJson).toMatchObject({
      records: [
        {
          recordId: "record-1",
          advisoryCandidates: [
            {
              candidateId:
                "prior-review:learning-event-1:shaftFlex",
              sourceType: "PRIOR_REVIEW",
              sourceEvidenceId:
                "record-1:prior-review",
              suggestion: {
                recordId: "record-1",
                fieldName: "shaftFlex",
                sourcePhrase: "shaft firm",
                candidateValue: "STIFF",
                confidence: 0.94,
                reviewRequired: true
              }
            }
          ]
        }
      ],
      advisoryCandidatePolicy: {
        requiredOutcome:
          "When a non-ambiguous record has advisoryCandidates, return REPAIR_SUGGESTED."
      }
    });
  });

  it("publishes a strict provider-neutral field-repair output schema", () => {
    expect(MAIN_RUN_FIELD_REPAIR_OUTPUT_SCHEMA).toMatchObject({
      name: "main_run_field_repair",
      version: "1.0.0",
      strict: true,
      schema: {
        type: "object",
        required: ["recordOutcomes", "suggestions"],
        additionalProperties: false
      }
    });
  });

  it("uses typed single-value enums for strict output discriminators", () => {
    const constPaths: string[] = [];
    const discriminatorSchemas: Record<string, unknown>[] = [];

    function visitSchema(value: unknown, path: string): void {
      if (!value || typeof value !== "object") {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          visitSchema(item, `${path}[${index}]`);
        });
        return;
      }

      const objectValue = value as Record<string, unknown>;

      if ("const" in objectValue) {
        constPaths.push(path);
      }

      const properties =
        objectValue.properties &&
        typeof objectValue.properties === "object" &&
        !Array.isArray(objectValue.properties)
          ? (objectValue.properties as Record<string, unknown>)
          : null;

      for (const discriminatorName of ["fieldName", "outcomeType"]) {
        const discriminator = properties?.[discriminatorName];

        if (
          discriminator &&
          typeof discriminator === "object" &&
          !Array.isArray(discriminator)
        ) {
          discriminatorSchemas.push(
            discriminator as Record<string, unknown>
          );
        }
      }

      for (const [key, childValue] of Object.entries(objectValue)) {
        visitSchema(childValue, `${path}.${key}`);
      }
    }

    visitSchema(MAIN_RUN_FIELD_REPAIR_OUTPUT_SCHEMA.schema, "$");

    expect(constPaths).toEqual([]);
    expect(discriminatorSchemas.length).toBeGreaterThan(0);

    for (const discriminator of discriminatorSchemas) {
      expect(discriminator.type).toBe("string");
      expect(discriminator.enum).toEqual([
        expect.any(String)
      ]);
    }

    expect(
      new Set(
        discriminatorSchemas.flatMap((discriminator) =>
          Array.isArray(discriminator.enum)
            ? discriminator.enum.filter(
                (value): value is string => typeof value === "string"
              )
            : []
        )
      )
    ).toEqual(
      new Set([
        "brand",
        "productLine",
        "category",
        "shaftFlex",
        "conditionGrade",
        "tradeInValue",
        "REPAIR_SUGGESTED",
        "CANDIDATE_COMPARISON",
        "NO_SAFE_REPAIR"
      ])
    );
  });

  it("validates direct structured field repair output", () => {
    const result = validateMainRunFieldRepairModelOutput({
      suggestions: [
        {
          recordId: "record-1",
          fieldName: "shaftFlex",
          sourcePhrase: "s flex",
          candidateValue: "STIFF",
          confidence: 0.91,
          reason: "Source phrase uses a known shaft-flex abbreviation.",
          reviewRequired: false
        }
      ]
    });

    expect(result).toMatchObject({
      jsonValid: true,
      validationPassed: true,
      output: {
        suggestions: [
          {
            recordId: "record-1",
            fieldName: "shaftFlex",
            sourcePhrase: "s flex",
            candidateValue: "STIFF",
            confidence: 0.91,
            reviewRequired: false
          }
        ]
      },
      validationErrors: []
    });
  });

  it("unwraps parsed JSON from hosted provider text responses", () => {
    const result = validateMainRunFieldRepairModelOutput({
      provider: "OPENAI",
      model: "gpt-4.1-mini",
      text: "{\"suggestions\":[]}",
      parsedJson: {
        suggestions: []
      }
    });

    expect(result).toMatchObject({
      jsonValid: true,
      validationPassed: true,
      output: {
        suggestions: []
      }
    });
  });

  it("rejects suggestions without source evidence", () => {
    const result = validateMainRunFieldRepairModelOutput({
      suggestions: [
        {
          recordId: "record-1",
          fieldName: "shaftFlex",
          candidateValue: "STIFF",
          confidence: 0.95,
          reason: "Missing source phrase should fail validation.",
          reviewRequired: false
        }
      ]
    });

    expect(result.jsonValid).toBe(false);
    expect(result.validationPassed).toBe(false);
    expect(result.validationErrors.join(" ")).toContain("sourcePhrase");
  });

  it("rejects unapproved shaft-flex abbreviations", () => {
    const result = validateMainRunFieldRepairModelOutput({
      suggestions: [
        {
          recordId: "record-1",
          fieldName: "shaftFlex",
          sourcePhrase: "s flex",
          candidateValue: "S",
          confidence: 0.91,
          reason: "The source phrase contains an abbreviation.",
          reviewRequired: false
        }
      ]
    });

    expect(result.jsonValid).toBe(false);
    expect(result.validationPassed).toBe(false);
    expect(result.validationErrors.join(" ")).toContain("shaftFlex");
  });

  it("rejects unapproved condition grade free text", () => {
    const result = validateMainRunFieldRepairModelOutput({
      suggestions: [
        {
          recordId: "record-1",
          fieldName: "conditionGrade",
          sourcePhrase: "condition avg",
          candidateValue: "Average",
          confidence: 0.91,
          reason: "The source phrase contains average condition.",
          reviewRequired: false
        }
      ]
    });

    expect(result.jsonValid).toBe(false);
    expect(result.validationPassed).toBe(false);
    expect(result.validationErrors.join(" ")).toContain("conditionGrade");
  });

  it("keeps low-confidence suggestions review-required", () => {
    const result = validateMainRunFieldRepairModelOutput({
      suggestions: [
        {
          recordId: "record-1",
          fieldName: "shaftFlex",
          sourcePhrase: "maybe stiff",
          candidateValue: "STIFF",
          confidence: 0.62,
          reason: "The source phrase is uncertain.",
          reviewRequired: false
        }
      ]
    });

    expect(result.jsonValid).toBe(true);
    expect(result.output?.suggestions[0]).toMatchObject({
      confidence: 0.62,
      reviewRequired: true
    });
  });
  it("rejects schema-valid shaft repair when source phrase contains negative evidence", () => {
    const result = validateMainRunFieldRepairModelOutput({
      suggestions: [
        {
          recordId: "record-1",
          fieldName: "shaftFlex",
          sourcePhrase: "shaft unknown",
          candidateValue: "REGULAR",
          confidence: 0.91,
          reason: "The model incorrectly treated unknown shaft as regular.",
          reviewRequired: false
        }
      ]
    });

    expect(result.jsonValid).toBe(true);
    expect(result.validationPassed).toBe(false);
    expect(result.output).toBeNull();
    expect(result.validationErrors.join(" ")).toContain("negative evidence");
  });

  it("rejects schema-valid wedge repair when source phrase is utility wood evidence", () => {
    const result = validateMainRunFieldRepairModelOutput({
      suggestions: [
        {
          recordId: "record-1",
          fieldName: "category",
          sourcePhrase: "UW 19 degree",
          candidateValue: "WEDGE",
          confidence: 0.91,
          reason: "The model incorrectly mapped utility wood text to wedge.",
          reviewRequired: false
        }
      ]
    });

    expect(result.jsonValid).toBe(true);
    expect(result.validationPassed).toBe(false);
    expect(result.output).toBeNull();
    expect(result.validationErrors.join(" ")).toContain("utility wood evidence");
  });

  it("rejects ambiguous single-letter regular shaft repair without shaft-flex context", () => {
    const result = validateMainRunFieldRepairModelOutput({
      suggestions: [
        {
          recordId: "record-1",
          fieldName: "shaftFlex",
          sourcePhrase: "Ventus Blue R",
          candidateValue: "REGULAR",
          confidence: 0.91,
          reason: "The model treated an ambiguous single-letter R as shaft flex.",
          reviewRequired: false
        }
      ]
    });

    expect(result.jsonValid).toBe(true);
    expect(result.validationPassed).toBe(false);
    expect(result.output).toBeNull();
    expect(result.validationErrors.join(" ")).toContain("single-letter R is ambiguous");
  });


  it("derives compatibility suggestions from validated repair outcomes", () => {
    const record = buildValidationRecord();
    const result = validateMainRunFieldRepairModelOutput(
      {
        recordOutcomes: [
          {
            outcomeType: "REPAIR_SUGGESTED",
            recordId: "record-1",
            summary: "A source-supported shaft-flex repair is available.",
            evidenceIds: ["record-1:product-resolution"],
            reviewerQuestion: "Should Stiff be applied?",
            suggestions: [
              {
                recordId: "record-1",
                fieldName: "shaftFlex",
                sourcePhrase: "s flex",
                candidateValue: "STIFF",
                confidence: 0.91,
                reason: "The source explicitly identifies shaft flex.",
                reviewRequired: false
              }
            ]
          }
        ],
        suggestions: [
          {
            recordId: "record-1",
            fieldName: "conditionGrade",
            sourcePhrase: "Titleist",
            candidateValue: "8.0 Average",
            confidence: 0.99,
            reason:
              "This provider-only compatibility entry is not nested under the repair outcome.",
            reviewRequired: false
          }
        ]
      },
      {
        records: [record]
      }
    );

    expect(result).toMatchObject({
      jsonValid: true,
      validationPassed: true,
      output: {
        recordOutcomes: [
          {
            outcomeType: "REPAIR_SUGGESTED",
            recordId: "record-1",
            suggestions: [
              {
                fieldName: "shaftFlex",
                candidateValue: "STIFF"
              }
            ]
          }
        ],
        suggestions: [
          {
            recordId: "record-1",
            fieldName: "shaftFlex",
            sourcePhrase: "s flex",
            candidateValue: "STIFF"
          }
        ]
      },
      validationErrors: []
    });
  });

  it("validates an advisory comparison of supplied product candidates", () => {
    const result = validateMainRunFieldRepairModelOutput({
      recordOutcomes: [
        {
          outcomeType: "CANDIDATE_COMPARISON",
          recordId: "record-1",
          summary:
            "Two deterministic product candidates require generation confirmation.",
          evidenceIds: ["record-1:product-resolution"],
          reviewerQuestion:
            "Is this the TSR2 or TSR3 fairway model?",
          candidateProductIds: [
            "prod_titleist_tsr2_fairway",
            "prod_titleist_tsr3_fairway"
          ]
        }
      ],
      suggestions: []
    });

    expect(result).toMatchObject({
      jsonValid: true,
      validationPassed: true,
      output: {
        recordOutcomes: [
          {
            outcomeType: "CANDIDATE_COMPARISON",
            recordId: "record-1",
            candidateProductIds: [
              "prod_titleist_tsr2_fairway",
              "prod_titleist_tsr3_fairway"
            ]
          }
        ],
        suggestions: []
      }
    });
  });

  it("validates an explicit no-safe-repair reviewer outcome", () => {
    const result = validateMainRunFieldRepairModelOutput({
      recordOutcomes: [
        {
          outcomeType: "NO_SAFE_REPAIR",
          recordId: "record-1",
          summary:
            "Negative source evidence prevents a safe shaft-flex repair.",
          evidenceIds: ["record-1:parser"],
          reviewerQuestion:
            "What shaft flex is printed on the physical club label?",
          reasonCodes: [
            "NEGATIVE_SOURCE_EVIDENCE",
            "HUMAN_CONFIRMATION_REQUIRED"
          ]
        }
      ],
      suggestions: []
    });

    expect(result).toMatchObject({
      jsonValid: true,
      validationPassed: true,
      output: {
        recordOutcomes: [
          {
            outcomeType: "NO_SAFE_REPAIR",
            recordId: "record-1",
            reasonCodes: [
              "NEGATIVE_SOURCE_EVIDENCE",
              "HUMAN_CONFIRMATION_REQUIRED"
            ]
          }
        ],
        suggestions: []
      }
    });
  });


  it("requires one advisory outcome for every selected record", () => {
    const record = buildValidationRecord();
    const result = validateMainRunFieldRepairModelOutput(
      {
        recordOutcomes: [],
        suggestions: []
      },
      {
        records: [record]
      }
    );

    expect(result.jsonValid).toBe(true);
    expect(result.validationPassed).toBe(false);
    expect(result.validationErrors.join(" ")).toContain(
      "missing advisory outcome"
    );
  });

  it("rejects evidence and candidates not supplied for the selected record", () => {
    const record = buildValidationRecord();
    const result = validateMainRunFieldRepairModelOutput(
      {
        recordOutcomes: [
          {
            outcomeType: "CANDIDATE_COMPARISON",
            recordId: "record-1",
            summary: "Compare product candidates.",
            evidenceIds: ["unknown-evidence-id"],
            reviewerQuestion: "Which generation is shown?",
            candidateProductIds: [
              "prod_titleist_tsr2_fairway",
              "invented-product-id"
            ]
          }
        ],
        suggestions: []
      },
      {
        records: [record]
      }
    );

    expect(result.jsonValid).toBe(true);
    expect(result.validationPassed).toBe(false);
    expect(result.validationErrors.join(" ")).toContain(
      "unknown evidenceId"
    );
    expect(result.validationErrors.join(" ")).toContain(
      "unsupported candidateProductId"
    );
  });

  it("rejects model replacement of a deterministic matched product identity", () => {
    const record = buildValidationRecord({
      sourceText: "Titleist TSR2 fairway",
      missingFields: [],
      productResolution: {
        status: "MATCHED",
        reason: "One deterministic product matched.",
        matchedProductId: "prod_titleist_tsr2_fairway",
        matchedSku: "TSR2-FW",
        candidateProductIds: ["prod_titleist_tsr2_fairway"]
      }
    });
    const result = validateMainRunFieldRepairModelOutput(
      {
        recordOutcomes: [
          {
            outcomeType: "REPAIR_SUGGESTED",
            recordId: "record-1",
            summary: "Replace the matched product line.",
            evidenceIds: ["record-1:product-resolution"],
            reviewerQuestion: "Approve this replacement?",
            suggestions: [
              {
                recordId: "record-1",
                fieldName: "productLine",
                sourcePhrase: "TSR2",
                candidateValue: "TSR3",
                confidence: 0.9,
                reason: "The model preferred another product.",
                reviewRequired: true
              }
            ]
          }
        ],
        suggestions: []
      },
      {
        records: [record]
      }
    );

    expect(result.jsonValid).toBe(true);
    expect(result.validationPassed).toBe(false);
    expect(result.validationErrors.join(" ")).toContain(
      "cannot replace deterministic MATCHED product identity"
    );
  });

  it("accepts exact evidence-backed advisory candidates", () => {
    const record =
      buildAdvisoryCandidateRecord();
    const result =
      validateMainRunFieldRepairModelOutput(
        {
          recordOutcomes: [
            {
              outcomeType: "REPAIR_SUGGESTED",
              recordId: "record-1",
              summary:
                "A prior approved correction supports a reviewer decision.",
              evidenceIds: [
                "record-1:prior-review"
              ],
              reviewerQuestion:
                "Should Stiff be applied?",
              suggestions: [
                {
                  recordId: "record-1",
                  fieldName: "shaftFlex",
                  sourcePhrase: "shaft firm",
                  candidateValue: "STIFF",
                  confidence: 0.94,
                  reason:
                    "Prior approved review evidence supports this value.",
                  reviewRequired: true
                }
              ]
            }
          ],
          suggestions: []
        },
        {
          records: [record]
        }
      );

    expect(result).toMatchObject({
      jsonValid: true,
      validationPassed: true,
      output: {
        recordOutcomes: [
          {
            outcomeType: "REPAIR_SUGGESTED",
            recordId: "record-1",
            suggestions: [
              {
                fieldName: "shaftFlex",
                candidateValue: "STIFF",
                sourcePhrase: "shaft firm",
                confidence: 0.94,
                reviewRequired: true
              }
            ]
          }
        ],
        suggestions: [
          {
            fieldName: "shaftFlex",
            candidateValue: "STIFF"
          }
        ]
      },
      validationErrors: []
    });
  });

  it("rejects no-safe-repair when an evidence-backed candidate is available", () => {
    const result =
      validateMainRunFieldRepairModelOutput(
        {
          recordOutcomes: [
            {
              outcomeType: "NO_SAFE_REPAIR",
              recordId: "record-1",
              summary:
                "The model declined to surface the supplied candidate.",
              evidenceIds: [
                "record-1:prior-review"
              ],
              reviewerQuestion:
                "What shaft flex should be used?",
              reasonCodes: [
                "NO_EVIDENCE_TO_REPAIR"
              ]
            }
          ],
          suggestions: []
        },
        {
          records: [
            buildAdvisoryCandidateRecord()
          ]
        }
      );

    expect(result.jsonValid).toBe(true);
    expect(result.validationPassed).toBe(false);
    expect(
      result.validationErrors.join(" ")
    ).toContain(
      "requires REPAIR_SUGGESTED because evidence-backed advisory candidates were supplied"
    );
  });

  it("rejects altered candidates and missing source-evidence citation", () => {
    const result =
      validateMainRunFieldRepairModelOutput(
        {
          recordOutcomes: [
            {
              outcomeType: "REPAIR_SUGGESTED",
              recordId: "record-1",
              summary:
                "The provider altered the supplied candidate.",
              evidenceIds: [
                "record-1:product-resolution"
              ],
              reviewerQuestion:
                "Should Regular be applied?",
              suggestions: [
                {
                  recordId: "record-1",
                  fieldName: "shaftFlex",
                  sourcePhrase: "shaft firm",
                  candidateValue: "REGULAR",
                  confidence: 0.94,
                  reason:
                    "The provider changed the prior-review value.",
                  reviewRequired: true
                }
              ]
            }
          ],
          suggestions: []
        },
        {
          records: [
            buildAdvisoryCandidateRecord()
          ]
        }
      );

    expect(result.jsonValid).toBe(true);
    expect(result.validationPassed).toBe(false);

    const errors =
      result.validationErrors.join(" ");

    expect(errors).toContain(
      "missing required sourceEvidenceId=record-1:prior-review"
    );
    expect(errors).toContain(
      "missing or altered advisory candidate"
    );
    expect(errors).toContain(
      "suggestion was not supplied as an evidence-backed advisory candidate"
    );
  });

  it("rejects shaft-flex assistance for putter records", () => {
    const record = buildValidationRecord({
      sourceText: "Odyssey White Hot putter",
      missingFields: [],
      currentFields: {
        brand: "Odyssey",
        productLine: "White Hot",
        category: "PUTTER",
        shaftFlex: null
      },
      fieldApplicability: {
        shaftFlex: "NOT_APPLICABLE"
      },
      productResolution: {
        status: "UNRESOLVED",
        reason: "Putter generation was unresolved.",
        matchedProductId: null,
        matchedSku: null,
        candidateProductIds: []
      }
    });
    const result = validateMainRunFieldRepairModelOutput(
      {
        recordOutcomes: [
          {
            outcomeType: "REPAIR_SUGGESTED",
            recordId: "record-1",
            summary: "Suggest a putter shaft flex.",
            evidenceIds: ["record-1:product-resolution"],
            reviewerQuestion: "What shaft flex should be selected?",
            suggestions: [
              {
                recordId: "record-1",
                fieldName: "shaftFlex",
                sourcePhrase: "putter",
                candidateValue: "REGULAR",
                confidence: 0.8,
                reason: "The model guessed a shaft flex.",
                reviewRequired: true
              }
            ]
          }
        ],
        suggestions: []
      },
      {
        records: [record]
      }
    );

    expect(result.jsonValid).toBe(true);
    expect(result.validationPassed).toBe(false);
    expect(result.validationErrors.join(" ")).toContain(
      "not applicable for a putter"
    );
    expect(result.validationErrors.join(" ")).toContain(
      "must not request shaft-flex information"
    );
  });

});
