import { describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import { runWorkflowEvals } from "./workflow-eval-runner.js";

describe("workflow eval runner", () => {
  it("passes the initial deterministic scenario matrix", async () => {
    const result = await runWorkflowEvals();

    expect(result.summary).toEqual({
      total: 4,
      passed: 4,
      failed: 0
    });

    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scenarioId: "unknown-shaft-and-value-no-defaults",
          status: "PASSED",
          observed: expect.objectContaining({
            parsedRecordCount: 1,
            aiReadyRecordCount: 1,
            reviewItemCount: 1
          })
        }),
        expect.objectContaining({
          scenarioId: "parser-variant-field-evidence",
          status: "PASSED",
          observed: expect.objectContaining({
            parsedRecordCount: 1,
            reviewItemCount: 0
          })
        }),
        expect.objectContaining({
          scenarioId: "prior-review-suggestion-not-auto-applied",
          status: "PASSED",
          executionMode: "GUARDED_AGENT_WORKFLOW",
          observed: expect.objectContaining({
            parsedRecordCount: 1,
            reviewItemCount: 1,
            priorReviewSuggestionCount: 1
          })
        })
      ])
    );

    const unknownScenario = result.results.find(
      (scenario) => scenario.scenarioId === "unknown-shaft-and-value-no-defaults"
    );
    const unknownRecord = unknownScenario?.observed.records[0];

    expect(unknownRecord).toEqual(
      expect.objectContaining({
        shaftFlex: null,
        tradeInValue: null,
        reviewNeeded: true
      })
    );
    expect(unknownRecord?.parserEvidence?.shaftFlex).toBeUndefined();
    expect(unknownRecord?.parserEvidence?.tradeInValue).toBeUndefined();

    const evidenceScenario = result.results.find(
      (scenario) => scenario.scenarioId === "parser-variant-field-evidence"
    );
    const evidenceRecord = evidenceScenario?.observed.records[0];

    expect(evidenceRecord?.parserEvidence).toEqual(
      expect.objectContaining({
        shaftFlex: {
          value: "STIFF",
          sourceText: "shaft stiff"
        },
        conditionGrade: {
          value: "8.0 Average",
          sourceText: "cond avg"
        },
        tradeInValue: {
          value: 150,
          sourceText: "trade value $150"
        }
      })
    );

    const priorSuggestionScenario = result.results.find(
      (scenario) =>
        scenario.scenarioId === "prior-review-suggestion-not-auto-applied"
    );
    const priorSuggestionRecord = priorSuggestionScenario?.observed.records[0];

    expect(priorSuggestionRecord).toEqual(
      expect.objectContaining({
        shaftFlex: null,
        reviewNeeded: true
      })
    );
    expect(priorSuggestionRecord?.parserEvidence?.shaftFlex).toBeUndefined();

    const seededEvents = await prisma.humanReviewLearningEvent.findMany({
      where: {
        reviewerNotes:
          "Temporary learning event created for workflow quality checks."
      }
    });

    expect(seededEvents).toHaveLength(0);
  });
});
