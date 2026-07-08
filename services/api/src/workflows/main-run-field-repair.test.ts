import { describe, expect, it } from "vitest";

import {
  MAIN_RUN_FIELD_REPAIR_AGENT_NAME,
  MAIN_RUN_FIELD_REPAIR_POLICY_KEY,
  buildMainRunFieldRepairExecutionInput,
  validateMainRunFieldRepairModelOutput
} from "./main-run-field-repair.js";

describe("main run field repair contract", () => {
  it("builds a provider execution input with policy and agent metadata", () => {
    const inputJson = buildMainRunFieldRepairExecutionInput({
      workflowRunId: "workflow-run-1",
      records: [
        {
          recordId: "record-1",
          sourceText: "Titleist TSR 3w Tensei s flex",
          missingFields: ["shaftFlex"],
          confidence: 0.61,
          currentFields: {
            brand: "Titleist",
            productLine: "TSR",
            category: "FAIRWAY_WOOD",
            shaftFlex: null
          },
          parserEvidence: {
            brand: {
              sourcePhrase: "Titleist"
            }
          }
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
          missingFields: ["shaftFlex"]
        }
      ]
    });
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

});
