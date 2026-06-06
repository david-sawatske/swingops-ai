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
    name: "swingops.intakeBatches.list",
    description:
      "List intake batches so an agent can inspect incoming trade-in intake work before planning workflow actions.",
    category: "INTAKE",
    inputShape: {
      type: "object",
      fields: []
    },
    riskLevel: "LOW",
    requiresHumanApproval: false,
    mutatesData: false,
    enabled: true,
    implementationStatus: "ROUTE_BACKED",
    statusReason:
      "Safe read-only lookup backed by the existing GET /intake-batches route.",
    existingHttpRoute: {
      method: "GET",
      path: "/intake-batches"
    }
  },
  {
    name: "swingops.intakeBatches.get",
    description:
      "Look up one intake batch with its raw intake items and associated workflow runs.",
    category: "INTAKE",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "The intake batch ID to retrieve."
        }
      ]
    },
    riskLevel: "LOW",
    requiresHumanApproval: false,
    mutatesData: false,
    enabled: true,
    implementationStatus: "ROUTE_BACKED",
    statusReason:
      "Safe read-only lookup backed by the existing GET /intake-batches/:id route.",
    existingHttpRoute: {
      method: "GET",
      path: "/intake-batches/:id"
    }
  },
  {
    name: "swingops.clubReference.search",
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
  },
  {
    name: "swingops.knowledgeBase.search",
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
    }
  },
  {
    name: "swingops.workflowRuns.list",
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
    }
  },
  {
    name: "swingops.workflowRuns.get",
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
    }
  },
  {
    name: "swingops.reviewQueueItems.list",
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
    }
  },
  {
    name: "swingops.reviewQueueItems.get",
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
    }
  },
  {
    name: "swingops.reviewQueueItems.resolve",
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
    }
  },
  {
    name: "swingops.reviewQueueItems.dismiss",
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
    }
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
  const tool = registeredAgentTools.find(
    (registeredTool) => registeredTool.name === name
  );

  return tool ? cloneTool(tool) : null;
}
