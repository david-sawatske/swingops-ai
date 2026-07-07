import type { WorkflowEvalScenario } from "./workflow-eval-types.js";

export const WORKFLOW_EVAL_SCENARIOS: WorkflowEvalScenario[] = [
  {
    id: "clean-fully-parsed-record",
    name: "Clean fully parsed record",
    description:
      "A complete source line should become a structured record without review routing.",
    sourceType: "FREE_TEXT",
    executionMode: "MULTI_SOURCE_INTAKE",
    workflowStage: "Source intake",
    protectedBehavior: "Complete records can move forward without unnecessary review.",
    sampleInput:
      "TaylorMade Stealth 2 driver shaft stiff condition 8.0 Average trade value $150 store 104",
    expectedBehavior: [
      "One record is parsed.",
      "The required shaft, condition, and trade-in value fields are present.",
      "No review item is created."
    ],
    failureImpact:
      "A failure here means clean source content is being slowed down or marked incomplete.",
    sources: [
      {
        sourceType: "FREE_TEXT",
        sourceName: "Quality check clean counter note",
        rawContent:
          "TaylorMade Stealth 2 driver shaft stiff condition 8.0 Average trade value $150 store 104"
      }
    ],
    expectations: {
      parsedRecordCount: 1,
      aiReadyRecordCount: 1,
      reviewItemCount: 0,
      missingFields: [
        {
          recordIndex: 0,
          excludes: ["shaftFlex", "conditionGrade", "tradeInValue"]
        }
      ]
    }
  },
  {
    id: "unknown-shaft-and-value-no-defaults",
    name: "Unknown shaft and value stay blank",
    description:
      "Unknown source text should route to review without inventing shaft flex or trade-in value.",
    sourceType: "FREE_TEXT",
    executionMode: "MULTI_SOURCE_INTAKE",
    workflowStage: "Review routing",
    protectedBehavior: "Unknown fields stay blank until a reviewer chooses a value.",
    sampleInput:
      "PING G425 4-PW shaft unknown condition unclear value pending review store 104",
    expectedBehavior: [
      "One record is parsed.",
      "shaftFlex remains blank.",
      "tradeInValue remains blank.",
      "A review item is created."
    ],
    failureImpact:
      "A failure here means the workflow may be defaulting fields that were not supported by source text.",
    sources: [
      {
        sourceType: "FREE_TEXT",
        sourceName: "Quality check unknown counter note",
        rawContent:
          "PING G425 4-PW shaft unknown condition unclear value pending review store 104"
      }
    ],
    expectations: {
      parsedRecordCount: 1,
      aiReadyRecordCount: 1,
      reviewItemCount: 1,
      missingFields: [
        {
          recordIndex: 0,
          includes: ["shaftFlex", "conditionGrade", "tradeInValue"]
        }
      ],
      noInventedValues: [
        {
          recordIndex: 0,
          fieldName: "shaftFlex"
        },
        {
          recordIndex: 0,
          fieldName: "tradeInValue"
        }
      ]
    }
  },
  {
    id: "parser-variant-field-evidence",
    name: "Parser variants include field evidence",
    description:
      "Normalized shorthand should keep the source phrase that produced each field.",
    sourceType: "LOG",
    executionMode: "MULTI_SOURCE_INTAKE",
    workflowStage: "Parser evidence",
    protectedBehavior: "Normalized values remain traceable to exact source phrases.",
    sampleInput:
      "payload brand=TaylorMade model=Stealth 2 cat=driver shaft stiff cond avg trade value $150 store=104",
    expectedBehavior: [
      "shaftFlex normalizes to STIFF from \"shaft stiff\".",
      "conditionGrade normalizes to 8.0 Average from \"cond avg\".",
      "tradeInValue normalizes to 150 from \"trade value $150\"."
    ],
    failureImpact:
      "A failure here means the workflow may show a normalized value without enough evidence for review.",
    sources: [
      {
        sourceType: "LOG",
        sourceName: "Quality check parser variant log",
        rawContent:
          "2026-05-18T14:33:04Z INFO payload brand=TaylorMade model=Stealth 2 cat=driver shaft stiff cond avg trade value $150 store=104"
      }
    ],
    expectations: {
      parsedRecordCount: 1,
      aiReadyRecordCount: 1,
      reviewItemCount: 0,
      fieldEvidence: [
        {
          recordIndex: 0,
          fieldName: "shaftFlex",
          expectedValue: "STIFF",
          expectedSourceTextIncludes: "shaft stiff"
        },
        {
          recordIndex: 0,
          fieldName: "conditionGrade",
          expectedValue: "8.0 Average",
          expectedSourceTextIncludes: "cond avg"
        },
        {
          recordIndex: 0,
          fieldName: "tradeInValue",
          expectedValue: 150,
          expectedSourceTextIncludes: "trade value $150"
        }
      ]
    }
  },
  {
    id: "prior-review-suggestion-not-auto-applied",
    name: "Prior review suggestion stays reviewable",
    description:
      "Prior human correction evidence should appear as a suggestion without silently mutating parsed fields.",
    sourceType: "FREE_TEXT",
    executionMode: "GUARDED_AGENT_WORKFLOW",
    workflowStage: "Review learning",
    protectedBehavior: "Prior corrections can guide review, but they do not auto-apply.",
    sampleInput:
      "PING G425 4-PW shaft firm condition unclear value pending review",
    expectedBehavior: [
      "A prior correction for \"shaft firm\" is found.",
      "One suggestion is surfaced.",
      "shaftFlex remains blank.",
      "The record still requires review."
    ],
    failureImpact:
      "A failure here means review learning may either disappear or silently change values without approval.",
    rawInput: "PING G425 4-PW shaft firm condition unclear value pending review",
    setup: {
      priorReviewLearningEvents: [
        {
          fieldName: "shaftFlex",
          rawTextMatch: "shaft firm",
          proposedValue: "Missing",
          correctedValue: "Stiff",
          evidenceText:
            "PING G425 shaft firm condition unclear value pending review",
          confidenceImpact:
            "Suggest prior correction when similar shaft wording appears."
        }
      ]
    },
    expectations: {
      parsedRecordCount: 1,
      reviewItemCount: 1,
      priorReviewSuggestionCount: 1,
      noInventedValues: [
        {
          recordIndex: 0,
          fieldName: "shaftFlex"
        }
      ]
    }
  }
];

export function listWorkflowEvalScenarioSummaries() {
  return WORKFLOW_EVAL_SCENARIOS.map((scenario) => ({
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    sourceType: scenario.sourceType,
    executionMode: scenario.executionMode,
    workflowStage: scenario.workflowStage,
    protectedBehavior: scenario.protectedBehavior,
    sampleInput: scenario.sampleInput,
    expectedBehavior: scenario.expectedBehavior,
    failureImpact: scenario.failureImpact
  }));
}
