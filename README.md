# SwingOps AI

Agentic golf retail workflow platform for intake, workflow orchestration, structured equipment records, review queues, model routing, retrieval grounding, and MCP-compatible connector execution.

## Local external MCP server

SwingOps exposes a first local external MCP server transport for development.

Run it with:

    pnpm --filter @swingops/api mcp:dev

The server is stdio-based and intentionally thin. It wraps the existing API-owned connector surface instead of defining a second tool registry.

Current behavior:

- tools/list exposes the existing SwingOps tool contracts from listMcpCompatibleTools().
- tools/call delegates to callMcpCompatibleTool().
- Allowed low-risk read-only tools execute through the existing read-only executor.
- Disabled or high-risk mutation tools remain visible for governance but are blocked before execution.
- Successful calls preserve sanitized output metadata.
- Successful, failed, and blocked calls still persist ToolCallLog records.

This local transport does not claim production OAuth, hosted deployment, tenant isolation, or remote MCP access. The existing REST adapter remains available for the web UI and API tests.

## End-to-End Agentic Trade-In Demo

SwingOps AI includes an **Agentic Demo** tab that demonstrates a full trade-in workflow in one place:

1. Paste messy golf trade-in notes.
2. Parse freeform shorthand into structured club records.
3. Surface confidence, missing fields, shaft details, condition notes, headcover/accessory notes, and uncertainty.
4. Retrieve grounded knowledge matches with weighted scoring when the demo knowledge base has been ingested.
5. Route the model task through the provider, cost, latency, quality, and health decision layer.
6. Execute safe read-only MCP-compatible tools.
7. Show a mutation tool in the plan, then block it before execution because human approval is required.
8. Create review queue items for low-confidence or incomplete records.
9. Display an audit trail tying raw input, parsed data, RAG, routing, tool calls, blocked mutation policy, review queue, and persisted IDs together.

### Running the demo locally

Start the database and app:

```bash
pnpm db:up
pnpm dev
```

Optional but recommended for richer RAG matches:

```bash
# In the app, open MCP Connectors and click "Ingest Demo Knowledge Base".
```

Then open the web app, choose **Agentic Demo**, and run the included sample input. The demo creates persisted workflow, intake, model log, tool call log, and review queue artifacts so the result can also be inspected from **Workflow Runs**, **Review Queue**, and **MCP Connectors**.
