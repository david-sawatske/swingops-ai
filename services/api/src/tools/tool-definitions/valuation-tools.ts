import type { AgentToolDefinition } from "../tool-registry.types.js";

export const valuationReadOnlyAgentTools: AgentToolDefinition[] = [
{
    name: "swingops.tradeInValuation.estimate",
    displayName: "Estimate demo trade-in range",
    description:
      "Estimate a seeded demo trade-in range using parsed club fields, condition notes, accessory notes, and internal product match evidence.",
    category: "VALUATION",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "brand",
          type: "string",
          required: false,
          description: "Parsed club brand."
        },
        {
          name: "productLine",
          type: "string",
          required: false,
          description: "Parsed product line or model family."
        },
        {
          name: "category",
          type: "string",
          required: false,
          description: "Parsed equipment category."
        },
        {
          name: "rawText",
          type: "string",
          required: false,
          description: "Original messy trade-in text."
        },
        {
          name: "conditionNotes",
          type: "string",
          required: false,
          description: "Pipe-separated condition notes, such as sky mark|face wear."
        },
        {
          name: "accessoriesNotes",
          type: "string",
          required: false,
          description: "Pipe-separated accessory notes, such as no hc|no wrench."
        }
      ]
    },
    riskLevel: "LOW",
    requiresHumanApproval: false,
    mutatesData: false,
    enabled: true,
    implementationStatus: "REGISTERED",
    statusReason:
      "Safe read-only valuation lookup against seeded demo ranges. It does not create offers or update inventory.",
    outputSummary:
      "Returns a demo valuation range, confidence, pricing evidence, adjustments, and review reasons.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "Returns seeded demo valuation ranges only; no live offer, customer data, or real-time market pricing is exposed."
  },
{
    name: "swingops.tradeInValuation.explainAdjustments",
    displayName: "Explain valuation adjustments",
    description:
      "Explain which condition and accessory factors changed a seeded demo trade-in valuation range.",
    category: "VALUATION",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "brand",
          type: "string",
          required: false,
          description: "Parsed club brand."
        },
        {
          name: "productLine",
          type: "string",
          required: false,
          description: "Parsed product line or model family."
        },
        {
          name: "category",
          type: "string",
          required: false,
          description: "Parsed equipment category."
        },
        {
          name: "rawText",
          type: "string",
          required: false,
          description: "Original messy trade-in text."
        },
        {
          name: "conditionNotes",
          type: "string",
          required: false,
          description: "Pipe-separated condition notes."
        },
        {
          name: "accessoriesNotes",
          type: "string",
          required: false,
          description: "Pipe-separated accessory notes."
        }
      ]
    },
    riskLevel: "LOW",
    requiresHumanApproval: false,
    mutatesData: false,
    enabled: true,
    implementationStatus: "REGISTERED",
    statusReason:
      "Safe read-only explanation of seeded demo valuation adjustments. It does not create offers.",
    outputSummary:
      "Returns adjustment reasons, value factors, and review reasons for the demo valuation path.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "Returns seeded demo adjustment explanations only."
  }
];

export const valuationMutationAgentTools: AgentToolDefinition[] = [
{
    name: "swingops.tradeInOffer.create",
    displayName: "Create trade-in offer",
    description:
      "Create a trade-in offer after approval. Disabled on the read-only connector surface.",
    category: "VALUATION",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "workflowRunId",
          type: "string",
          required: true,
          description: "Workflow run ID that would receive the offer."
        }
      ]
    },
    riskLevel: "HIGH",
    requiresHumanApproval: true,
    mutatesData: true,
    enabled: false,
    implementationStatus: "DISABLED_PREVIEW_ONLY",
    statusReason:
      "Mutation tool is intentionally visible for governance planning but disabled on the read-only connector surface.",
    outputSummary:
      "Mutation output is intentionally unavailable because trade-in offer creation is blocked in read-only mode.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "No mutation output is exposed; blocked attempts persist policy metadata only."
  }
];
