import type { AgentToolDefinition } from "../tool-registry.types.js";

export const reviewQueueAgentTools: AgentToolDefinition[] = [
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
