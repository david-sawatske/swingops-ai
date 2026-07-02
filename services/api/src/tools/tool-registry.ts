import type {
  AgentToolCategory,
  AgentToolDefinition,
  AgentToolRiskLevel
} from "./tool-registry.types.js";

export type AgentToolRegistryFilter = {
  category?: AgentToolCategory;
  riskLevel?: AgentToolRiskLevel;
  enabled?: boolean;
  mutatesData?: boolean;
  requiresHumanApproval?: boolean;
};

const registeredAgentTools: AgentToolDefinition[] = [
  {
    name: "swingops.clubReference.search",
    displayName: "Search club reference",
    description:
      "Search a local read-only golf club reference dataset to ground ambiguous trade-in notes before human review.",
    category: "WORKFLOW",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "query",
          type: "string",
          required: true,
          description: "Ambiguous club text to search, such as TSR maybe TS2."
        }
      ]
    },
    riskLevel: "LOW",
    requiresHumanApproval: false,
    mutatesData: false,
    enabled: true,
    implementationStatus: "REGISTERED",
    statusReason:
      "Safe read-only lookup against a local demo club reference dataset. It does not mutate operational data.",
    outputSummary: "Returns local club-reference matches for ambiguous golf shorthand.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes: "Returns intentionally public demo reference data only."
  },
  {
    name: "swingops.knowledgeBase.search",
    displayName: "Search knowledge base",
    description:
      "Search the local golf trade-in knowledge base for equipment aliases, condition rules, policy notes, and grounding context before an agent creates or resolves workflow output.",
    category: "WORKFLOW",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "query",
          type: "string",
          required: true,
          description:
            "Messy golf trade-in text to ground, such as TM stealth2 drv 10.5 stiff no hc."
        },
        {
          name: "sourceName",
          type: "string",
          required: false,
          description:
            "Optional knowledge source filter for deterministic tests or scoped connector calls."
        },
        {
          name: "brand",
          type: "string",
          required: false,
          description: "Optional brand filter, such as TaylorMade or PING."
        },
        {
          name: "category",
          type: "string",
          required: false,
          description: "Optional category filter, such as DRIVER or FAIRWAY_WOOD."
        },
        {
          name: "chunkType",
          type: "enum",
          required: false,
          description: "Optional knowledge chunk type filter.",
          enumValues: [
            "CLUB_REFERENCE",
            "TRADE_IN_POLICY",
            "CONDITION_GUIDE",
            "BRAND_ALIAS",
            "SHAFT_FLEX_GUIDE"
          ]
        },
        {
          name: "maxResults",
          type: "number",
          required: false,
          description: "Maximum number of grounded chunks to return."
        }
      ]
    },
    riskLevel: "LOW",
    requiresHumanApproval: false,
    mutatesData: false,
    enabled: true,
    implementationStatus: "ROUTE_BACKED",
    statusReason:
      "Safe read-only search over local RAG-ready golf trade-in knowledge chunks. Retrieval is deterministic for local development and can be upgraded to vector embeddings later.",
    existingHttpRoute: {
      method: "POST",
      path: "/knowledge/search"
    },
    outputSummary:
      "Returns grounded knowledge chunks with citations, matched terms, and weighted scoreBreakdown components.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "Returns curated knowledge chunks and scoring metadata only; connector response is sanitized before MCP-compatible exposure."
  },
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
  },
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
  },
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
  },
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
  },
  {
    name: "swingops.customerMessage.send",
    displayName: "Send customer message",
    description:
      "Send a customer message after approval. Disabled on the read-only connector surface.",
    category: "CUSTOMER_COMMUNICATION",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "messageId",
          type: "string",
          required: true,
          description: "Message ID or draft ID that would be sent."
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
      "Mutation output is intentionally unavailable because customer messaging is blocked in read-only mode.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "No message content or mutation output is exposed; blocked attempts persist policy metadata only."
  },
  {
    name: "swingops.workflowRuns.list",
    displayName: "List workflow runs",
    description:
      "List workflow runs with intake context, latest model routing log, and review queue counts.",
    category: "WORKFLOW",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "status",
          type: "enum",
          required: false,
          description: "Optional workflow run status filter.",
          enumValues: [
            "QUEUED",
            "RUNNING",
            "NEEDS_REVIEW",
            "COMPLETED",
            "FAILED"
          ]
        }
      ]
    },
    riskLevel: "LOW",
    requiresHumanApproval: false,
    mutatesData: false,
    enabled: true,
    implementationStatus: "ROUTE_BACKED",
    statusReason:
      "Safe read-only lookup backed by the existing GET /workflow-runs route.",
    existingHttpRoute: {
      method: "GET",
      path: "/workflow-runs"
    },
    outputSummary:
      "Returns serialized workflow run summaries with latest model/tool/review context.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "Returns summary fields only; detailed request/response internals stay behind explicit get-by-id calls."
  },
  {
    name: "swingops.workflowRuns.get",
    displayName: "Get workflow run",
    description:
      "Look up a workflow run with its steps, model call logs, tool call logs, and review queue items.",
    category: "WORKFLOW",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "The workflow run ID to retrieve."
        }
      ]
    },
    riskLevel: "LOW",
    requiresHumanApproval: false,
    mutatesData: false,
    enabled: true,
    implementationStatus: "ROUTE_BACKED",
    statusReason:
      "Safe read-only lookup backed by the existing GET /workflow-runs/:id route.",
    existingHttpRoute: {
      method: "GET",
      path: "/workflow-runs/:id"
    },
    outputSummary:
      "Returns one workflow run with serialized steps, model logs, tool logs, and review queue items.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "Serializers expose audit-relevant fields while omitting database/client internals and external provider secrets."
  },
  {
    name: "swingops.reviewQueueItems.list",
    displayName: "List review queue items",
    description:
      "List review queue items with workflow and intake context for human-in-the-loop workflow planning.",
    category: "REVIEW_QUEUE",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "status",
          type: "enum",
          required: false,
          description: "Optional review item status filter.",
          enumValues: ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]
        }
      ]
    },
    riskLevel: "LOW",
    requiresHumanApproval: false,
    mutatesData: false,
    enabled: true,
    implementationStatus: "ROUTE_BACKED",
    statusReason:
      "Safe read-only lookup backed by the existing GET /review-queue-items route.",
    existingHttpRoute: {
      method: "GET",
      path: "/review-queue-items"
    },
    outputSummary:
      "Returns serialized review queue items with workflow and intake context.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "Returns human-review context only; mutation endpoints remain blocked on this surface."
  },
  {
    name: "swingops.reviewQueueItems.get",
    displayName: "Get review queue item",
    description:
      "Look up one review queue item with its proposed structured golf-club data and workflow context.",
    category: "REVIEW_QUEUE",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "The review queue item ID to retrieve."
        }
      ]
    },
    riskLevel: "LOW",
    requiresHumanApproval: false,
    mutatesData: false,
    enabled: true,
    implementationStatus: "ROUTE_BACKED",
    statusReason:
      "Safe read-only lookup backed by the existing GET /review-queue-items/:id route.",
    existingHttpRoute: {
      method: "GET",
      path: "/review-queue-items/:id"
    },
    outputSummary:
      "Returns one serialized review queue item with workflow and intake context.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "Returns review context for human-in-the-loop decisions; no mutation response is exposed."
  },
  {
    name: "swingops.reviewQueueItems.resolve",
    displayName: "Resolve review queue item",
    description:
      "Resolve a review queue item after a human reviewer accepts or corrects the proposed workflow output.",
    category: "REVIEW_QUEUE",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "The review queue item ID to resolve."
        },
        {
          name: "reviewerNotes",
          type: "string",
          required: false,
          description: "Optional human reviewer notes."
        }
      ]
    },
    riskLevel: "HIGH",
    requiresHumanApproval: true,
    mutatesData: true,
    enabled: false,
    implementationStatus: "DISABLED_PREVIEW_ONLY",
    statusReason:
      "Mutation tool is intentionally visible for governance planning but disabled until MCP execution policy and approval gates are implemented.",
    existingHttpRoute: {
      method: "POST",
      path: "/review-queue-items/:id/resolve"
    },
    outputSummary:
      "Mutation output is intentionally unavailable because this tool is visible but disabled on the connector surface.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "No mutation output is exposed; blocked attempts persist policy metadata only."
  },
  {
    name: "swingops.reviewQueueItems.dismiss",
    displayName: "Dismiss review queue item",
    description:
      "Dismiss a review queue item after a human reviewer determines no workflow update should be applied.",
    category: "REVIEW_QUEUE",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "The review queue item ID to dismiss."
        },
        {
          name: "reviewerNotes",
          type: "string",
          required: false,
          description: "Optional human reviewer notes."
        }
      ]
    },
    riskLevel: "HIGH",
    requiresHumanApproval: true,
    mutatesData: true,
    enabled: false,
    implementationStatus: "DISABLED_PREVIEW_ONLY",
    statusReason:
      "Mutation tool is intentionally visible for governance planning but disabled until MCP execution policy and approval gates are implemented.",
    existingHttpRoute: {
      method: "POST",
      path: "/review-queue-items/:id/dismiss"
    },
    outputSummary:
      "Mutation output is intentionally unavailable because this tool is visible but disabled on the connector surface.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "No mutation output is exposed; blocked attempts persist policy metadata only."
  }
];

function cloneTool(tool: AgentToolDefinition): AgentToolDefinition {
  return {
    ...tool,
    inputShape: {
      ...tool.inputShape,
      fields: tool.inputShape.fields.map((field) => ({
        ...field,
        ...(field.enumValues ? { enumValues: [...field.enumValues] } : {})
      }))
    },
    ...(tool.existingHttpRoute
      ? { existingHttpRoute: { ...tool.existingHttpRoute } }
      : {})
  };
}

export function listAgentTools(
  filter: AgentToolRegistryFilter = {}
): AgentToolDefinition[] {
  return registeredAgentTools
    .filter((tool) => {
      if (filter.category && tool.category !== filter.category) {
        return false;
      }

      if (filter.riskLevel && tool.riskLevel !== filter.riskLevel) {
        return false;
      }

      if (filter.enabled !== undefined && tool.enabled !== filter.enabled) {
        return false;
      }

      if (
        filter.mutatesData !== undefined &&
        tool.mutatesData !== filter.mutatesData
      ) {
        return false;
      }

      if (
        filter.requiresHumanApproval !== undefined &&
        tool.requiresHumanApproval !== filter.requiresHumanApproval
      ) {
        return false;
      }

      return true;
    })
    .map(cloneTool);
}

export function getAgentTool(name: string): AgentToolDefinition | null {
  return listAgentTools().find((tool) => tool.name === name) ?? null;
}
