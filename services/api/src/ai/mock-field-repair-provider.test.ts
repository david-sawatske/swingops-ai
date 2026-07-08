import { describe, expect, it } from "vitest";

import {
  buildMainRunFieldRepairExecutionInput,
  validateMainRunFieldRepairModelOutput
} from "../workflows/main-run-field-repair.js";
import { mockProvider } from "./providers/mock.provider.js";

describe("mock provider field repair behavior", () => {
  it("returns deterministic field repair suggestions for supported source evidence", async () => {
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
            currentFields: {
              brand: "Titleist",
              productLine: "TSR",
              category: "FAIRWAY_WOOD",
              shaftFlex: null,
              conditionGrade: null,
              tradeInValue: null
            }
          }
        ]
      })
    });

    const validation = validateMainRunFieldRepairModelOutput(result.outputJson);

    expect(validation).toMatchObject({
      jsonValid: true,
      validationPassed: true,
      output: {
        suggestions: expect.arrayContaining([
          expect.objectContaining({
            recordId: "record-1",
            fieldName: "shaftFlex",
            sourcePhrase: "s flex",
            candidateValue: "STIFF",
            reviewRequired: false
          }),
          expect.objectContaining({
            recordId: "record-1",
            fieldName: "conditionGrade",
            sourcePhrase: "condition avg",
            candidateValue: "8.0 Average",
            reviewRequired: false
          }),
          expect.objectContaining({
            recordId: "record-1",
            fieldName: "tradeInValue",
            sourcePhrase: "value $150",
            candidateValue: 150,
            reviewRequired: false
          })
        ])
      }
    });
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
            currentFields: {
              shaftFlex: null,
              conditionGrade: null,
              tradeInValue: null
            }
          }
        ]
      })
    });

    const validation = validateMainRunFieldRepairModelOutput(result.outputJson);

    expect(validation).toMatchObject({
      jsonValid: true,
      validationPassed: true,
      output: {
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
