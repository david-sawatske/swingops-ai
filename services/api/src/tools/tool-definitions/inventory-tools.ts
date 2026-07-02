import type { AgentToolDefinition } from "../tool-registry.types.js";

export const inventoryReadOnlyAgentTools: AgentToolDefinition[] = [
{
    name: "swingops.inventory.lookupProduct",
    displayName: "Lookup inventory product",
    description:
      "Look up likely internal product and SKU matches for parsed golf trade-in equipment fields.",
    category: "INVENTORY",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "brand",
          type: "string",
          required: false,
          description: "Parsed club brand, such as TaylorMade, Titleist, Callaway, or PING."
        },
        {
          name: "productLine",
          type: "string",
          required: false,
          description: "Parsed product line or model family, such as Stealth 2 or TSR2."
        },
        {
          name: "category",
          type: "string",
          required: false,
          description: "Parsed equipment category, such as driver, fairway wood, or irons."
        },
        {
          name: "year",
          type: "number",
          required: false,
          description: "Optional parsed or inferred product year."
        },
        {
          name: "shaftBrand",
          type: "string",
          required: false,
          description: "Optional shaft brand parsed from the trade-in text."
        },
        {
          name: "shaftModel",
          type: "string",
          required: false,
          description: "Optional shaft model parsed from the trade-in text."
        },
        {
          name: "rawText",
          type: "string",
          required: false,
          description: "Original messy trade-in text for alias and ambiguity matching."
        }
      ]
    },
    riskLevel: "LOW",
    requiresHumanApproval: false,
    mutatesData: false,
    enabled: true,
    implementationStatus: "REGISTERED",
    statusReason:
      "Safe read-only lookup against local seeded internal inventory data. It does not create SKUs or change inventory.",
    outputSummary:
      "Returns the best internal product/SKU match, confidence, match reasons, and similar product candidates.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "Returns intentionally seeded demo inventory fields only; no supplier cost, customer data, or operational credentials are exposed."
  },
{
    name: "swingops.inventory.findSimilarProducts",
    displayName: "Find similar inventory products",
    description:
      "Find similar internal product candidates when a parsed trade-in record is ambiguous.",
    category: "INVENTORY",
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
          description: "Parsed product line or ambiguous product family."
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
          description: "Original messy trade-in text for candidate matching."
        }
      ]
    },
    riskLevel: "LOW",
    requiresHumanApproval: false,
    mutatesData: false,
    enabled: true,
    implementationStatus: "REGISTERED",
    statusReason:
      "Safe read-only lookup against local seeded internal inventory data for similar SKU candidates.",
    outputSummary:
      "Returns ranked similar internal product candidates with confidence and reason text.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "Returns intentionally seeded demo inventory candidates only."
  }
];

export const inventoryMutationAgentTools: AgentToolDefinition[] = [
{
    name: "swingops.inventory.createSku",
    displayName: "Create inventory SKU",
    description:
      "Create an internal inventory SKU after approval. Disabled on the read-only connector surface.",
    category: "INVENTORY",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "productId",
          type: "string",
          required: true,
          description: "Product ID for the SKU to create."
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
      "Mutation output is intentionally unavailable because SKU creation is blocked in read-only mode.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "No mutation output is exposed; blocked attempts persist policy metadata only."
  }
];
