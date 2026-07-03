import type { AgentToolDefinition } from "../tool-registry.types.js";

export const workflowGroundingAgentTools: AgentToolDefinition[] = [
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
  }
];

export const workflowRunAgentTools: AgentToolDefinition[] = [
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
        },
        {
          name: "maxResults",
          type: "number",
          required: false,
          description: "Maximum workflow runs to return, capped at 25."
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
  }
];
